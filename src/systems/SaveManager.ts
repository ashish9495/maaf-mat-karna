/** LocalStorage-backed settings and progress. Every access is wrapped so private mode never crashes the game. */

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  reducedMotion: boolean;
  screenShake: boolean;
  language: 'hi' | 'en';
}

export interface Progress {
  achievements: string[];
  endings: ('forgiven' | 'boss')[];
  cinematicSeen: boolean;
  chaseCompleted: boolean;
  chappalsThrown: number;
}

const KEY_SETTINGS = 'mmk.settings.v1';
const KEY_PROGRESS = 'mmk.progress.v1';

const defaultSettings: Settings = {
  musicVolume: 0.6,
  sfxVolume: 0.75,
  muted: false,
  reducedMotion: false,
  screenShake: true,
  language: 'hi',
};

const defaultProgress: Progress = {
  achievements: [],
  endings: [],
  cinematicSeen: false,
  chaseCompleted: false,
  chappalsThrown: 0,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...fallback };
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return { ...fallback };
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep running in memory */
  }
}

type Listener = (s: Settings) => void;

class SaveManagerImpl {
  settings: Settings = read(KEY_SETTINGS, defaultSettings);
  progress: Progress = read(KEY_PROGRESS, defaultProgress);
  private listeners: Listener[] = [];

  constructor() {
    if (typeof matchMedia !== 'undefined' && !localStorage.getItem?.(KEY_SETTINGS)) {
      try {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) this.settings.reducedMotion = true;
      } catch {
        /* ignore */
      }
    }
  }

  updateSettings(patch: Partial<Settings>) {
    this.settings = { ...this.settings, ...patch };
    write(KEY_SETTINGS, this.settings);
    this.listeners.forEach((l) => l(this.settings));
  }

  onSettings(l: Listener) {
    this.listeners.push(l);
    return () => (this.listeners = this.listeners.filter((x) => x !== l));
  }

  saveProgress() {
    write(KEY_PROGRESS, this.progress);
  }

  hasAchievement(id: string) {
    return this.progress.achievements.includes(id);
  }

  unlockEnding(e: 'forgiven' | 'boss') {
    if (!this.progress.endings.includes(e)) this.progress.endings.push(e);
    this.saveProgress();
  }
}

export const SaveManager = new SaveManagerImpl();
