/** Menu panels: Settings, How to Play, Credits, Pause menu, Endings & Memories gallery. */
import { h, btn, panel, uiRoot, isTouchDevice } from './dom';
import { SaveManager } from '../systems/SaveManager';
import { AudioManager } from '../systems/AudioManager';
import { personalization } from '../config/personalization';
import { ACHIEVEMENTS } from '../systems/AchievementSystem';
import { WEAPONS, WEAPON_ORDER } from '../config/weaponConfig';
import { esc } from '../utils/helpers';

function slider(label: string, value: number, onInput: (v: number) => void) {
  const input = h('input', { type: 'range', min: 0, max: 100, value: Math.round(value * 100) }) as HTMLInputElement;
  const out = h('span', { class: 'val', text: `${Math.round(value * 100)}%` });
  input.addEventListener('input', () => {
    out.textContent = `${input.value}%`;
    onInput(Number(input.value) / 100);
  });
  input.addEventListener('change', () => {
    AudioManager.unlock();
    AudioManager.sfx('click');
  });
  return h('label', { class: 'row' }, h('span', { text: label }), input, out);
}

function toggle(label: string, value: boolean, onChange: (v: boolean) => void) {
  const input = h('input', { type: 'checkbox' }) as HTMLInputElement;
  input.checked = value;
  input.addEventListener('change', () => {
    AudioManager.unlock();
    AudioManager.sfx('click');
    onChange(input.checked);
  });
  return h('label', { class: 'row toggle' }, h('span', { text: label }), input, h('span', { class: 'switch' }));
}

export function openSettings(onClose?: () => void) {
  const s = SaveManager.settings;
  const songName = h('div', { class: 'song-name', text: AudioManager.hasCustomSong() ? `🎵 ${AudioManager.romanticLabel}` : '🎵 Using the configured song file or the original soft soundtrack' });
  const songErr = h('div', { class: 'song-err' });
  const file = h('input', { type: 'file', accept: 'audio/*,.mp3,.m4a,.ogg,.wav,.aac', class: 'file-input' }) as HTMLInputElement;
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    songErr.textContent = '';
    try {
      const name = await AudioManager.setCustomRomantic(f);
      songName.textContent = `🎵 ${name}`;
    } catch (e) {
      songErr.textContent = (e as Error).message;
    }
    file.value = '';
  });
  const lang = h('select', { class: 'select' },
    h('option', { value: 'hi', text: 'Hinglish' }),
    h('option', { value: 'en', text: 'English' }),
  ) as HTMLSelectElement;
  lang.value = s.language;
  lang.addEventListener('change', () => SaveManager.updateSettings({ language: lang.value as 'hi' | 'en' }));

  const body = h('div', { class: 'settings' },
    h('h3', { text: '🔊 Audio' }),
    slider('Music volume', s.musicVolume, (v) => SaveManager.updateSettings({ musicVolume: v })),
    slider('Sound effects', s.sfxVolume, (v) => SaveManager.updateSettings({ sfxVolume: v })),
    toggle('Mute everything', s.muted, (v) => SaveManager.updateSettings({ muted: v })),
    h('h3', { text: '💞 Ending song' }),
    h('p', { class: 'muted small', html: `Pick a recording of <i>${esc(personalization.romanticSongLabel)}</i> (or any song) that you own or are allowed to use. It's saved in this browser only.` }),
    songName,
    h('div', { class: 'row-btns' },
      h('label', { class: 'btn btn-small file-btn' }, '📁 Choose song file', file),
      btn('▶ Preview', () => { AudioManager.unlock(); AudioManager.previewRomantic(); }, 'btn btn-small btn-ghost'),
      btn('Reset', async () => { await AudioManager.clearCustomRomantic(); songName.textContent = '🎵 Using the configured song file or the original soft soundtrack'; }, 'btn btn-small btn-ghost'),
    ),
    songErr,
    h('h3', { text: '✨ Comfort' }),
    toggle('Reduced motion', s.reducedMotion, (v) => SaveManager.updateSettings({ reducedMotion: v })),
    toggle('Screen shake', s.screenShake, (v) => SaveManager.updateSettings({ screenShake: v })),
    h('label', { class: 'row' }, h('span', { text: 'Dialogue language' }), lang),
    h('h3', { text: '📱 Mobile controls' }),
    h('p', { class: 'muted small', text: 'Hold ◀ ▶ to run, ⬆ to jump, the big weapon button to attack (aims automatically), 💨 to dash and 🔄 to switch weapons. Landscape works best.' }),
  );
  return panel('Settings', body, onClose);
}

export function openHowToPlay(onClose?: () => void) {
  const touch = isTouchDevice();
  const keys: [string, string][] = [
    ['A / D or ← →', 'Run'],
    ['W / ↑ / Space', 'Jump (hold for higher)'],
    ['Mouse + Left click / J', 'Aim & attack'],
    ['Shift / K', 'Dash'],
    ['Q / E or 1–9, 0', 'Switch weapons (or click a weapon icon)'],
    ['Esc / P', 'Pause'],
  ];
  const body = h('div', { class: 'howto' },
    h('p', { html: `You are <b>${esc(personalization.girlfriend.name)}</b>. ${esc(personalization.boyfriend.name)} has done <i>something</i>. Chase him through 3 levels and bring his health to zero. 😈` }),
    h('div', { class: 'keys' }, ...keys.map(([k, v]) => h('div', { class: 'key-row' }, h('kbd', { text: k }), h('span', { text: v })))),
    touch ? h('p', { class: 'muted small', text: 'On a phone: use the on-screen buttons. Attacks aim at him automatically. Tap any weapon icon at the top left (or 🔄) to switch.' }) : null,
    h('h3', { text: "Mumma's Arsenal" }),
    h('div', { class: 'weapon-list' }, ...WEAPON_ORDER.map((id) => {
      const w = WEAPONS[id];
      return h('div', { class: 'weapon-item' }, h('span', { class: 'wi-icon', text: w.icon }), h('div', {}, h('b', { text: `${w.name} · ${w.damage} dmg` }), h('small', { text: w.description })));
    })),
    h('p', { class: 'muted small', text: 'Tip: he hides in bushes, fakes apologies and tries to jump over you when cornered. Do not trust the puppy eyes.' }),
  );
  return panel('How to Play', body, onClose);
}

export function openCredits(onClose?: () => void) {
  const gf = personalization.girlfriend;
  const bf = personalization.boyfriend;
  const body = h('div', { class: 'credits' },
    h('p', { class: 'big', html: `Made with way too much love by <b>${esc(bf.name)}</b><br>for <b>${esc(gf.name)}</b> (${esc(gf.nickname)}) ❤️` }),
    h('p', { text: 'Starring' }),
    h('p', { html: `<b>${esc(gf.name)}</b> — ${esc(gf.title)}<br><b>${esc(bf.name)}</b> — ${esc(bf.title)}` }),
    h('p', { class: 'muted small', text: 'All art, music and sound effects are generated in code for this game. Built with Phaser 3, TypeScript and Vite.' }),
    h('p', { class: 'muted small', html: `<i>"${esc(personalization.closingLine)}"</i>` }),
    h('h3', { text: '🏆 Achievements' }),
    h('div', { class: 'ach-grid' }, ...ACHIEVEMENTS.map((a) => {
      const got = SaveManager.hasAchievement(a.id);
      return h('div', { class: `ach ${got ? 'got' : ''}` }, h('span', { text: got || !a.hidden ? a.icon : '❔' }), h('div', {}, h('b', { text: got || !a.hidden ? a.name : 'Secret' }), h('small', { text: got || !a.hidden ? a.desc : 'Keep playing to discover it.' })));
    })),
    h('p', { class: 'muted small', text: `Chappals thrown so far: ${SaveManager.progress.chappalsThrown} 🩴` }),
  );
  return panel('Credits', body, onClose);
}

export interface PauseHandlers {
  resume: () => void;
  restart: () => void;
  exit: () => void;
}

export function openPause(hd: PauseHandlers) {
  const wrap = h('div', { class: 'modal-backdrop pause' });
  const close = (fn: () => void) => {
    wrap.remove();
    fn();
  };
  const card = h('div', { class: 'modal-card pause-card' },
    h('h2', { text: 'Paused ⏸' }),
    h('p', { class: 'muted', text: 'Baby is catching his breath…' }),
    h('div', { class: 'stack' },
      btn('▶ Resume', () => close(hd.resume), 'btn'),
      btn('🔁 Restart Level', () => close(hd.restart), 'btn btn-ghost'),
      btn('🔊 Audio Settings', () => openSettings(), 'btn btn-ghost'),
      btn('🎮 Controls', () => openHowToPlay(), 'btn btn-ghost'),
      btn('🏠 Exit to Main Menu', () => close(hd.exit), 'btn btn-ghost'),
    ),
  );
  wrap.append(card);
  uiRoot().append(wrap);
  return wrap;
}

export interface GalleryHandlers {
  watchEnding: () => void;
  memories: () => void;
  level: (i: number) => void;
}

export function openGallery(hd: GalleryHandlers) {
  const p = SaveManager.progress;
  let ref: HTMLDivElement | null = null;
  const go = (fn: () => void) => () => {
    (ref as unknown as { close: () => void } | null)?.close();
    fn();
  };
  const body = h('div', { class: 'gallery' },
    h('p', { class: 'muted', text: 'Everything you have unlocked so far.' }),
    h('div', { class: 'stack' },
      p.cinematicSeen ? btn('🎬 Watch the ending again', go(hd.watchEnding), 'btn') : null,
      p.cinematicSeen ? btn('📸 Revisit our memories', go(hd.memories), 'btn btn-ghost') : null,
    ),
    h('h3', { text: 'Endings found' }),
    h('div', { class: 'endings' },
      h('div', { class: `ending-chip ${p.endings.includes('forgiven') ? 'got' : ''}`, text: p.endings.includes('forgiven') ? '❤️ Forgiven by Mumma' : '🔒 ???' }),
      h('div', { class: `ending-chip ${p.endings.includes('boss') ? 'got' : ''}`, text: p.endings.includes('boss') ? '😈 Mumma is still the Boss' : '🔒 ???' }),
    ),
    h('h3', { text: 'Replay a level' }),
    h('div', { class: 'row-btns' },
      btn('Level 1', go(() => hd.level(0)), 'btn btn-small btn-ghost'),
      p.chaseCompleted ? btn('Level 2', go(() => hd.level(1)), 'btn btn-small btn-ghost') : null,
      p.chaseCompleted ? btn('Level 3', go(() => hd.level(2)), 'btn btn-small btn-ghost') : null,
    ),
  );
  ref = panel('Endings & Memories', body);
  return ref;
}
