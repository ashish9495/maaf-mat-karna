/**
 * ============================================================
 *  PERSONALIZATION — edit this file to make the game yours.
 * ============================================================
 * Every personal name, message, colour, photo and song lives here.
 * Game logic never hardcodes them, so you can change anything below
 * without touching the rest of the code.
 *
 * Asset paths are relative to /public. Example: a file saved as
 *   public/assets/memories/memory-3.jpg
 * is referenced here as
 *   'assets/memories/memory-3.jpg'
 * Missing files are fine: the game shows a pretty placeholder instead.
 */

export interface CharacterLook {
  skin: string;
  skinShade: string;
  hair: string;
  hairShine: string;
  top: string;
  topShade: string;
  bottom: string;
  shoes: string;
  blush: string;
  /** Optional portrait image used in the menu cards / HUD (e.g. your cartoon portrait). */
  portrait?: string;
}

export const personalization = {
  gameTitle: 'MAAF MAT KARNA 😈',
  tagline: 'She has unlimited weapons. He has only one heart.',
  subtitle: 'A love story with way too many weapons.',
  closingLine: 'The only boss fight where losing means winning her heart.',

  girlfriend: {
    name: 'Khushi',
    nickname: 'Mumma',
    title: 'The Adorable Final Boss',
    personality: 'Extremely cute, dangerously mischievous, absolutely unstoppable.',
    look: {
      skin: '#d9a07a',
      skinShade: '#c0865f',
      hair: '#1d1517',
      hairShine: '#4a3a40',
      top: '#26232b',
      topShade: '#17151b',
      bottom: '#b9a3e3',
      shoes: '#ff7eb6',
      blush: '#ff8fa8',
      portrait: 'assets/characters/khushi-portrait.png',
    } as CharacterLook,
  },

  boyfriend: {
    name: 'Ashish',
    nickname: 'Baby',
    title: 'The Professional Escape Artist',
    personality: '99% panic, 1% courage, 100% in love.',
    look: {
      skin: '#c28460',
      skinShade: '#a56d4c',
      hair: '#141012',
      hairShine: '#3b3036',
      top: '#a24a5e',
      topShade: '#843a4b',
      bottom: '#3d4a6b',
      shoes: '#f4f1ea',
      blush: '#e0707e',
      portrait: 'assets/characters/ashish-portrait.png',
    } as CharacterLook,
  },

  /**
   * Romantic song for the ending.
   * Put a recording you are allowed to use at public/assets/music/ and set the path,
   * e.g. 'assets/music/romantic.mp3'. She can also pick a file from Settings in-game.
   * If nothing is found, an original soft piano/pad soundtrack plays instead.
   */
  romanticMusicPath: 'assets/music/romantic.mp3',
  romanticSongLabel: 'Abhi Na Jao Chhod Kar',
  romanticMusicVolume: 0.8,

  /** Played every time Baby gets hit. Short mp3 works best on every phone/browser. */
  hitSoundPath: 'assets/sfx/fahhh.mp3',
  /** Loudness of the hit sound relative to other effects (1 = same). */
  hitSoundVolume: 1.2,

  /** Optional comedy chase music file. If missing, an original chiptune loop is synthesised. */
  chaseMusicPath: 'assets/music/chase.mp3',

  /** Final handwritten note (Ending A). Use \n for new lines. */
  finalNote:
    'My dearest Mumma,\n\n' +
    'I know I can be silly, annoying, dramatic, and sometimes impossible.\n\n' +
    'But loving you is one of the most beautiful parts of my life.\n\n' +
    'Thank you for every laugh, every memory, every little moment, and every hug.\n\n' +
    'I love you, my favorite person.',
  signature: 'Forever your Baby. ❤️',

  /** Secret message shown when she finds the hidden golden heart in Level 2. */
  secretMessage: 'Psst… you found my secret. Even mid-chase, I was running in circles just to stay near you. ❤️',

  /** Important dates (optional). Leave empty strings if you don't want to show any. */
  importantDates: {
    firstMet: '',
    anniversary: '',
  },
};

export type Personalization = typeof personalization;
