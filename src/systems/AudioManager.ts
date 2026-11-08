/**
 * AudioManager — all sound runs through one Web Audio graph.
 *
 *  master ─┬─ musicBus ─┬─ chaseBus     (synth chiptune or optional chase.mp3)
 *          │            └─ romanticBus  (user song file, configured file, or original synth fallback)
 *          └─ sfxBus                    (procedurally synthesised effects — no audio files required)
 *
 * Browsers block audio until a user gesture: call unlock() from any click/touch/key.
 */
import { personalization } from '../config/personalization';
import { SaveManager } from './SaveManager';

export type SfxName =
  | 'throw' | 'thwack' | 'pillow' | 'pop' | 'splash' | 'dash' | 'jump' | 'land' | 'step'
  | 'hurt' | 'cry' | 'laugh' | 'unlock' | 'achievement' | 'click' | 'drop' | 'whoosh'
  | 'hug' | 'firework' | 'thunder' | 'charge' | 'bonk' | 'sparkle' | 'miss' | 'heart';

const NOTE = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// --- original chase loop (C major, bouncy). 32 sixteenth-steps, 0 = rest ---
const CHASE_LEAD = [
  72, 0, 76, 0, 79, 0, 76, 74, 72, 0, 67, 0, 69, 71, 72, 0,
  74, 0, 77, 0, 81, 0, 79, 77, 76, 0, 74, 0, 72, 0, 0, 0,
];
const CHASE_LEAD_B = [
  79, 0, 79, 81, 79, 0, 76, 0, 77, 0, 77, 79, 77, 0, 74, 0,
  76, 0, 72, 0, 74, 0, 71, 0, 72, 0, 67, 0, 72, 0, 0, 0,
];
const CHASE_BASS = [48, 48, 55, 48, 53, 53, 57, 53, 55, 55, 59, 55, 48, 48, 55, 52];

// --- original romantic fallback: slow chord progression (Am – F – C – G) ---
const ROM_CHORDS = [
  [57, 60, 64, 69],
  [53, 57, 60, 65],
  [48, 55, 60, 64],
  [55, 59, 62, 67],
];

const IDB_NAME = 'mmk-audio';
const IDB_STORE = 'files';

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbPut(key: string, val: Blob) {
  const db = await idbOpen();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function idbGet(key: string): Promise<Blob | undefined> {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const q = tx.objectStore(IDB_STORE).get(key);
    q.onsuccess = () => res(q.result as Blob | undefined);
    q.onerror = () => rej(q.error);
  });
}
async function idbDel(key: string) {
  const db = await idbOpen();
  await new Promise<void>((res) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}

async function urlExists(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const type = r.headers.get('content-type') || '';
    // Vite dev server answers unknown paths with index.html (200, text/html) — treat that as missing.
    return r.ok && !type.includes('text/html');
  } catch {
    return false;
  }
}

class AudioManagerImpl {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private chaseBus!: GainNode;
  private romanticBus!: GainNode;
  private noiseBuf!: AudioBuffer;

  private seqTimer: number | null = null;
  private seqNextTime = 0;
  private seqStep = 0;
  private seqMode: 'none' | 'chase' | 'romantic' = 'none';
  private intensity = 0;

  private chaseEl: HTMLAudioElement | null = null;
  private romanticEl: HTMLAudioElement | null = null;
  private romanticSourceLabel = 'Original soft soundtrack';
  private customUrl: string | null = null;
  private lastStep = 0;
  unlocked = false;

  // "fahhh" hit voice — decoded once into a Web Audio buffer so it starts instantly
  // and can overlap; falls back to an <audio> element if decoding isn't possible.
  private hitBuf: AudioBuffer | null = null;
  private hitState: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  private hitVoices: AudioBufferSourceNode[] = [];
  private lastHitVoice = 0;

  constructor() {
    SaveManager.onSettings(() => this.applyVolumes());
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) {
        this.ctx.suspend().catch(() => {});
        this.chaseEl?.pause();
        this.romanticEl?.pause();
      } else if (this.unlocked) {
        this.ctx.resume().catch(() => {});
        if (this.seqMode === 'romantic' && this.romanticEl) this.romanticEl.play().catch(() => {});
        if (this.seqMode === 'chase' && this.chaseEl) this.chaseEl.play().catch(() => {});
      }
    });
    // restore a song picked earlier
    idbGet('romantic')
      .then((b) => {
        if (b) {
          this.customUrl = URL.createObjectURL(b);
          this.romanticSourceLabel = (b as File).name || 'Your chosen song';
        }
      })
      .catch(() => {});
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.chaseBus = this.ctx.createGain();
      this.chaseBus.connect(this.musicBus);
      this.romanticBus = this.ctx.createGain();
      this.romanticBus.gain.value = 0;
      this.romanticBus.connect(this.musicBus);
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      // iOS: let game sounds play even when the ringer switch is on silent (Safari 17+)
      try {
        const nav = navigator as Navigator & { audioSession?: { type: string } };
        if (nav.audioSession) nav.audioSession.type = 'playback';
      } catch { /* not supported */ }
      // iOS/old Safari: playing a 1-sample silent buffer inside the gesture fully unlocks output
      try {
        const b = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = b;
        src.connect(this.ctx.destination);
        src.start(0);
      } catch { /* ignore */ }
      this.loadHitVoice();
    }
    // resume after the browser suspended/interrupted audio (iOS calls, tab switches…)
    if (this.ctx.state !== 'running' && !document.hidden) this.ctx.resume().catch(() => {});
    if (this.hitState === 'failed') {
      this.hitState = 'idle';
      this.loadHitVoice();
    }
    this.unlocked = true;
  }

  /** Fetch + decode the hit sound once. Works with both promise and callback-style Safari. */
  private loadHitVoice() {
    const ctx = this.ctx;
    if (!ctx || this.hitState === 'loading' || this.hitState === 'ready') return;
    this.hitState = 'loading';
    fetch(personalization.hitSoundPath)
      .then((r) => {
        if (!r.ok) throw new Error('missing hit sound');
        return r.arrayBuffer();
      })
      .then((ab) => new Promise<AudioBuffer>((resolve, reject) => {
        const p = ctx.decodeAudioData(ab, resolve, reject) as Promise<AudioBuffer> | undefined;
        if (p && typeof p.then === 'function') p.then(resolve, reject);
      }))
      .then((buf) => {
        this.hitBuf = buf;
        this.hitState = 'ready';
      })
      .catch(() => {
        this.hitState = 'failed';
      });
  }

  /** "Fahhh!" — played every time Baby gets hit. */
  hitVoice() {
    const ctx = this.ctx;
    if (!ctx) return; // no user gesture yet → browsers block all audio anyway
    const now = performance.now();
    // rapid weapons (water, momos) hit many times a second: don't turn it into noise
    if (now - this.lastHitVoice < 420) return;
    this.lastHitVoice = now;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});

    if (this.hitBuf) {
      // at most two overlapping voices; the oldest is cut
      while (this.hitVoices.length >= 2) {
        const old = this.hitVoices.shift();
        try { old?.stop(); } catch { /* already stopped */ }
      }
      const src = ctx.createBufferSource();
      src.buffer = this.hitBuf;
      src.playbackRate.value = 0.95 + Math.random() * 0.1;
      const g = ctx.createGain();
      g.gain.value = personalization.hitSoundVolume;
      src.connect(g);
      g.connect(this.sfxBus);
      src.onended = () => {
        this.hitVoices = this.hitVoices.filter((v) => v !== src);
        try { g.disconnect(); } catch { /* ignore */ }
      };
      src.start();
      this.hitVoices.push(src);
      return;
    }
    // fallback: plain <audio> (still loading, or decoding unsupported)
    const s = SaveManager.settings;
    if (s.muted) return;
    const el = new Audio(personalization.hitSoundPath);
    el.volume = Math.min(1, s.sfxVolume * 0.7 * personalization.hitSoundVolume);
    el.play().catch(() => {});
    if (this.hitState !== 'loading') this.loadHitVoice();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = SaveManager.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.musicVolume * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfxVolume * 0.7, t, 0.05);
    const elVol = s.muted ? 0 : s.musicVolume;
    if (this.chaseEl) this.chaseEl.volume = Math.min(1, elVol * 0.7);
    if (this.romanticEl && !this.romanticFading) this.romanticEl.volume = Math.min(1, elVol * personalization.romanticMusicVolume);
  }

  get romanticLabel() {
    return this.customUrl ? this.romanticSourceLabel : this.romanticSourceLabel;
  }

  // ------------------------------------------------------------------ music

  async startChase() {
    if (!this.ctx) return;
    this.stopRomantic(0.6);
    const t = this.ctx.currentTime;
    this.chaseBus.gain.cancelScheduledValues(t);
    this.chaseBus.gain.setValueAtTime(this.chaseBus.gain.value, t);
    this.chaseBus.gain.linearRampToValueAtTime(1, t + 0.8);
    if (this.seqMode === 'chase') return;
    this.seqMode = 'chase';
    if (await urlExists(personalization.chaseMusicPath)) {
      if (this.seqMode !== 'chase') return;
      this.chaseEl = new Audio(personalization.chaseMusicPath);
      this.chaseEl.loop = true;
      this.applyVolumes();
      this.chaseEl.play().catch(() => this.startSequencer());
    } else {
      this.startSequencer();
    }
  }

  setIntensity(level: number) {
    this.intensity = level;
  }

  stopChase(fade = 1.2) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.chaseBus.gain.cancelScheduledValues(t);
    this.chaseBus.gain.setValueAtTime(this.chaseBus.gain.value, t);
    this.chaseBus.gain.linearRampToValueAtTime(0.0001, t + fade);
    if (this.chaseEl) {
      const el = this.chaseEl;
      this.chaseEl = null;
      this.fadeElement(el, 0, fade * 1000, true);
    }
    if (this.seqMode === 'chase') {
      window.setTimeout(() => {
        if (this.seqMode === 'chase') this.stopSequencer();
      }, fade * 1000 + 50);
      this.seqMode = 'none';
    }
  }

  private romanticFading = false;

  /** Start the romantic soundtrack with a gentle fade-in. */
  async startRomantic(fadeSec = 4) {
    if (!this.ctx) return;
    // already playing → just make sure it's audible
    if (this.seqMode === 'romantic' && (this.romanticStarting || this.romanticEl || this.seqTimer !== null)) {
      if (!this.romanticEl) {
        const t = this.ctx.currentTime;
        this.romanticBus.gain.cancelScheduledValues(t);
        this.romanticBus.gain.setValueAtTime(this.romanticBus.gain.value, t);
        this.romanticBus.gain.linearRampToValueAtTime(1, t + 1);
      }
      return;
    }
    this.stopChase(1.5);
    this.seqMode = 'romantic';
    this.romanticStarting = true;
    try {
      await this.beginRomantic(fadeSec);
    } finally {
      this.romanticStarting = false;
    }
  }

  private romanticStarting = false;

  private async beginRomantic(fadeSec: number) {
    const target = SaveManager.settings.muted ? 0 : Math.min(1, SaveManager.settings.musicVolume * personalization.romanticMusicVolume);

    let src: string | null = null;
    if (this.customUrl) src = this.customUrl;
    else if (await urlExists(personalization.romanticMusicPath)) {
      src = personalization.romanticMusicPath;
      this.romanticSourceLabel = personalization.romanticSongLabel;
    }
    if (this.seqMode !== 'romantic') return;

    if (src) {
      try {
        this.romanticEl?.pause();
        const el = new Audio(src);
        el.loop = true;
        el.volume = 0;
        this.romanticEl = el;
        await el.play();
        this.romanticFading = true;
        this.fadeElement(el, target, fadeSec * 1000, false, () => (this.romanticFading = false));
        return;
      } catch {
        this.romanticEl = null;
        this.romanticSourceLabel = 'Original soft soundtrack';
      }
    }
    // fallback synth
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.romanticBus.gain.cancelScheduledValues(t);
    this.romanticBus.gain.setValueAtTime(0.0001, t);
    this.romanticBus.gain.linearRampToValueAtTime(1, t + fadeSec);
    this.startSequencer();
  }

  stopRomantic(fade = 1.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.romanticBus.gain.cancelScheduledValues(t);
    this.romanticBus.gain.setValueAtTime(this.romanticBus.gain.value, t);
    this.romanticBus.gain.linearRampToValueAtTime(0.0001, t + fade);
    if (this.romanticEl) {
      const el = this.romanticEl;
      this.romanticEl = null;
      this.fadeElement(el, 0, fade * 1000, true);
    }
    if (this.seqMode === 'romantic') {
      this.seqMode = 'none';
      window.setTimeout(() => {
        if (this.seqMode === 'none') this.stopSequencer();
      }, fade * 1000 + 50);
    }
  }

  /** Duck all music (e.g. during a dramatic pause). */
  duck(amount: number, sec = 0.6) {
    if (!this.ctx) return;
    const s = SaveManager.settings;
    this.musicBus.gain.setTargetAtTime(s.musicVolume * 0.55 * amount, this.ctx.currentTime, sec / 3);
  }

  stopAll() {
    this.stopChase(0.4);
    this.stopRomantic(0.4);
  }

  /** User picked a song file in Settings. Validates and stores it for future visits. */
  async setCustomRomantic(file: File): Promise<string> {
    const okType = file.type.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|oga|wav|webm|flac)$/i.test(file.name);
    if (!okType) throw new Error('That file is not an audio file. Try an .mp3, .m4a, .ogg or .wav.');
    if (file.size > 40 * 1024 * 1024) throw new Error('That file is larger than 40 MB. Try a smaller one.');
    const url = URL.createObjectURL(file);
    // make sure the browser can actually decode it
    await new Promise<void>((res, rej) => {
      const a = new Audio();
      const timer = window.setTimeout(() => res(), 4000);
      a.oncanplaythrough = () => { clearTimeout(timer); res(); };
      a.onloadedmetadata = () => { clearTimeout(timer); res(); };
      a.onerror = () => { clearTimeout(timer); rej(new Error("This browser can't play that file format.")); };
      a.src = url;
      a.load();
    });
    if (this.customUrl) URL.revokeObjectURL(this.customUrl);
    this.customUrl = url;
    this.romanticSourceLabel = file.name;
    idbPut('romantic', file).catch(() => {});
    return file.name;
  }

  async clearCustomRomantic() {
    if (this.customUrl) URL.revokeObjectURL(this.customUrl);
    this.customUrl = null;
    this.romanticSourceLabel = 'Original soft soundtrack';
    await idbDel('romantic').catch(() => {});
  }

  hasCustomSong() {
    return !!this.customUrl;
  }

  /** Preview the romantic track for 6 seconds (settings panel). */
  async previewRomantic() {
    await this.startRomantic(0.8);
    window.setTimeout(() => this.stopRomantic(1), 6000);
  }

  private fadeElement(el: HTMLAudioElement, to: number, ms: number, pauseAtEnd: boolean, done?: () => void) {
    const from = el.volume;
    const start = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / ms);
      el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1) requestAnimationFrame(tick);
      else {
        if (pauseAtEnd) el.pause();
        done?.();
      }
    };
    requestAnimationFrame(tick);
  }

  // -------------------------------------------------------------- sequencer

  private startSequencer() {
    if (!this.ctx) return;
    if (this.seqTimer !== null) return;
    this.seqStep = 0;
    this.seqNextTime = this.ctx.currentTime + 0.1;
    this.seqTimer = window.setInterval(() => this.schedule(), 25);
  }

  private stopSequencer() {
    if (this.seqTimer !== null) {
      clearInterval(this.seqTimer);
      this.seqTimer = null;
    }
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    while (this.seqNextTime < ctx.currentTime + 0.12) {
      if (this.seqMode === 'chase') this.chaseStep(this.seqStep, this.seqNextTime);
      else if (this.seqMode === 'romantic') this.romanticStep(this.seqStep, this.seqNextTime);
      const bpm = this.seqMode === 'romantic' ? 66 : 148 + this.intensity * 10;
      const stepDur = this.seqMode === 'romantic' ? 60 / bpm / 2 : 60 / bpm / 4;
      this.seqNextTime += stepDur;
      this.seqStep++;
    }
  }

  private chaseStep(step: number, t: number) {
    const bar = Math.floor(step / 32) % 4;
    const i = step % 32;
    const lead = bar === 2 ? CHASE_LEAD_B : CHASE_LEAD;
    const n = lead[i];
    const out = this.chaseBus;
    if (n) this.tone(out, NOTE(n), t, 0.11, 'square', 0.06, 0.005, 0.08);
    if (i % 2 === 0) {
      const b = CHASE_BASS[(i / 2) % CHASE_BASS.length] - (bar === 3 ? 2 : 0);
      this.tone(out, NOTE(b - 12), t, 0.16, 'triangle', 0.16, 0.005, 0.12);
    }
    if (i % 8 === 0) this.kick(out, t);
    if (i % 8 === 4) this.snare(out, t, 0.12);
    if (i % 2 === 1) this.hat(out, t, 0.035 + this.intensity * 0.015);
    if (this.intensity >= 2 && i % 4 === 2) this.tone(out, NOTE(84 + (i % 8)), t, 0.05, 'sine', 0.03);
  }

  private romanticStep(step: number, t: number) {
    // 8 steps per chord (eighth notes at 66bpm ≈ 3.6s per chord)
    const chord = ROM_CHORDS[Math.floor(step / 8) % ROM_CHORDS.length];
    const i = step % 8;
    const out = this.romanticBus;
    if (i === 0) {
      // soft pad
      chord.forEach((n, k) => this.pad(out, NOTE(n - 12 + (k === 0 ? 0 : 12)), t, 3.8, 0.028));
      this.tone(out, NOTE(chord[0] - 24), t, 3.4, 'sine', 0.1, 0.4, 2.5);
    }
    const arp = [0, 1, 2, 3, 2, 1, 2, 3];
    this.tone(out, NOTE(chord[arp[i]] + 12), t, 1.4, 'triangle', 0.045, 0.01, 1.2);
    if ((i === 3 || i === 6) && Math.random() < 0.45) {
      const n = chord[Math.floor(Math.random() * chord.length)] + 24;
      this.tone(out, NOTE(n), t + 0.05, 2.2, 'sine', 0.035, 0.02, 2);
    }
  }

  // ------------------------------------------------------------ primitives

  private tone(out: AudioNode, freq: number, t: number, dur: number, type: OscillatorType, vol: number, attack = 0.005, release = 0.1, slideTo?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private pad(out: AudioNode, freq: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 1.2);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    f.connect(g).connect(out);
    [-6, 6].forEach((det) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.1);
    });
  }

  private noise(out: AudioNode, t: number, dur: number, vol: number, filterType: BiquadFilterType, freq: number, freqEnd?: number, q = 1) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  private kick(out: AudioNode, t: number) {
    this.tone(out, 150, t, 0.14, 'sine', 0.35, 0.002, 0.12, 45);
  }
  private snare(out: AudioNode, t: number, vol: number) {
    this.noise(out, t, 0.12, vol, 'highpass', 1500);
  }
  private hat(out: AudioNode, t: number, vol: number) {
    this.noise(out, t, 0.04, vol, 'highpass', 7000);
  }

  // ------------------------------------------------------------------ sfx

  sfx(name: SfxName, opts: { pitch?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const out = this.sfxBus;
    const p = opts.pitch ?? 1;
    switch (name) {
      case 'throw':
        this.noise(out, t, 0.18, 0.25, 'bandpass', 600 * p, 2400 * p, 2);
        break;
      case 'thwack':
        this.noise(out, t, 0.09, 0.6, 'lowpass', 3000);
        this.tone(out, 220 * p, t, 0.12, 'square', 0.2, 0.001, 0.1, 70);
        break;
      case 'pillow':
        this.noise(out, t, 0.3, 0.5, 'lowpass', 700, 200);
        this.tone(out, 120, t, 0.2, 'sine', 0.3, 0.01, 0.15, 60);
        break;
      case 'pop':
        this.tone(out, 520 * p, t, 0.08, 'square', 0.12, 0.001, 0.06, 900 * p);
        break;
      case 'splash':
        this.noise(out, t, 0.12, 0.2, 'highpass', 2500 * p);
        break;
      case 'dash':
        this.noise(out, t, 0.22, 0.25, 'bandpass', 2000, 400, 3);
        break;
      case 'jump':
        this.tone(out, 300 * p, t, 0.14, 'square', 0.08, 0.002, 0.1, 620 * p);
        break;
      case 'land':
        this.noise(out, t, 0.06, 0.15, 'lowpass', 500);
        break;
      case 'step': {
        if (t - this.lastStep < 0.12) return;
        this.lastStep = t;
        this.noise(out, t, 0.03, 0.06, 'bandpass', 900 * p, undefined, 4);
        break;
      }
      case 'hurt':
        this.tone(out, 640 * p, t, 0.22, 'sawtooth', 0.09, 0.005, 0.2, 260 * p);
        break;
      case 'cry':
        [0, 0.28].forEach((d, k) => this.tone(out, (560 - k * 80) * p, t + d, 0.32, 'triangle', 0.1, 0.03, 0.25, (380 - k * 60) * p));
        break;
      case 'laugh':
        [0, 0.13, 0.26, 0.39, 0.52].forEach((d, k) => this.tone(out, (720 - k * 40) * p, t + d, 0.09, 'square', 0.06, 0.005, 0.07, (520 - k * 30) * p));
        break;
      case 'unlock':
        [0, 0.08, 0.16, 0.24].forEach((d, k) => this.tone(out, NOTE(72 + [0, 4, 7, 12][k]), t + d, 0.18, 'square', 0.08));
        break;
      case 'achievement':
        [0, 0.1, 0.2, 0.32].forEach((d, k) => this.tone(out, NOTE(76 + [0, 3, 7, 12][k]), t + d, 0.28, 'triangle', 0.12));
        this.tone(out, NOTE(100), t + 0.32, 0.5, 'sine', 0.04);
        break;
      case 'click':
        this.tone(out, 900, t, 0.04, 'square', 0.05, 0.001, 0.03);
        break;
      case 'drop':
        this.tone(out, 160, t, 0.18, 'sine', 0.25, 0.002, 0.15, 90);
        this.noise(out, t, 0.05, 0.08, 'lowpass', 800);
        break;
      case 'whoosh':
        this.noise(out, t, 0.6, 0.12, 'bandpass', 300, 1800, 1.5);
        break;
      case 'hug':
        [0, 0.12, 0.24].forEach((d, k) => this.tone(out, NOTE(67 + [0, 4, 7][k]), t + d, 1.2, 'sine', 0.08, 0.05, 1));
        break;
      case 'firework':
        this.tone(out, 300, t, 0.4, 'sine', 0.05, 0.01, 0.3, 1200);
        for (let k = 0; k < 6; k++) this.noise(out, t + 0.4 + k * 0.05, 0.08, 0.08, 'highpass', 3000 + k * 500);
        break;
      case 'thunder':
        this.noise(out, t, 1.2, 0.5, 'lowpass', 400, 60);
        this.tone(out, 60, t, 0.8, 'sawtooth', 0.12, 0.01, 0.7, 30);
        break;
      case 'charge':
        this.tone(out, 200, t, 0.7, 'sawtooth', 0.06, 0.02, 0.2, 900);
        break;
      case 'bonk':
        this.tone(out, 880, t, 0.1, 'square', 0.1, 0.001, 0.08, 440);
        this.noise(out, t, 0.08, 0.2, 'lowpass', 1200);
        break;
      case 'sparkle':
        [0, 0.06, 0.12].forEach((d, k) => this.tone(out, NOTE(88 + k * 3), t + d, 0.2, 'sine', 0.05));
        break;
      case 'miss':
        this.tone(out, 300, t, 0.2, 'triangle', 0.05, 0.01, 0.15, 200);
        break;
      case 'heart':
        this.tone(out, NOTE(84), t, 0.15, 'sine', 0.07);
        this.tone(out, NOTE(91), t + 0.08, 0.2, 'sine', 0.06);
        break;
    }
  }
}

export const AudioManager = new AudioManagerImpl();
