import type { WeaponId } from './weaponConfig';

export const GAME_W = 1280;
export const GAME_H = 720;
export const GROUND_Y = 640;

export const PLAYER = {
  speed: 330,
  accel: 2600,
  decel: 2400,
  airControl: 0.75,
  jump: 900,
  dashSpeed: 820,
  dashTime: 190,
  dashCooldown: 900,
  gravity: 1700,
};

export const BOYFRIEND = {
  maxHp: 100,
  baseSpeed: 275,
  jump: 880,
};

export type ThemeId = 'street' | 'park' | 'sunset';

export interface PlatformDef {
  x: number;
  y: number;
  w: number;
}
export interface PropDef {
  type:
    | 'bench' | 'crate' | 'lamp' | 'house' | 'tree' | 'bush' | 'fountain' | 'flowers' | 'bridge' | 'fairylights' | 'mailbox'
    // Pune specials
    | 'sign' | 'stall' | 'rickshaw' | 'mall' | 'wada' | 'parvati';
  /** text for signs, stalls and malls */
  label?: string;
  x: number;
  /** solid props block movement; others are decorative */
  solid?: boolean;
  /** bush = hiding spot */
  hide?: boolean;
  variant?: number;
}

export interface LevelDef {
  index: number;
  theme: ThemeId;
  width: number;
  /** HP at which the boyfriend escapes to the next level (0 = final cinematic) */
  hpTarget: number;
  /**
   * Weapons unlocked during this level, in order. atHits = hits landed in this level
   * (0 = as soon as the level starts). Anything not yet unlocked when the level ends
   * is handed over at the start of the next level, so nothing is ever missed.
   */
  unlocks: { atHits: number; weapon: WeaponId; equip?: boolean }[];
  platforms: PlatformDef[];
  props: PropDef[];
  /** optional collectible secret heart */
  secret?: { x: number; y: number };
  objective: string;
}

export const LEVELS: LevelDef[] = [
  // FC Road → Goodluck Chowk → JM Road → Shaniwar Wada → Karve Nagar
  {
    index: 0,
    theme: 'street',
    width: 3400,
    hpTarget: 65,
    unlocks: [
      { atHits: 1, weapon: 'lipgloss' },
      { atHits: 2, weapon: 'pillow' },
      { atHits: 4, weapon: 'momos' },
    ],
    objective: 'Chase Baby down FC Road!',
    platforms: [
      { x: 700, y: 500, w: 220 },
      { x: 1250, y: 430, w: 260 },
      { x: 1900, y: 500, w: 220 },
      { x: 2500, y: 450, w: 280 },
      { x: 2900, y: 360, w: 200 },
    ],
    props: [
      { type: 'house', x: 230, variant: 0 },
      { type: 'sign', x: 430, label: 'F.C. ROAD' },
      { type: 'stall', x: 620, label: 'VADA PAV', variant: 0 },
      { type: 'bench', x: 920, solid: true },
      { type: 'house', x: 1100, variant: 1 },
      { type: 'sign', x: 1330, label: 'GOODLUCK CHOWK' },
      { type: 'rickshaw', x: 1500, solid: true },
      { type: 'bush', x: 1680, hide: true },
      { type: 'stall', x: 1860, label: 'CUTTING CHAI', variant: 1 },
      { type: 'crate', x: 2080, solid: true },
      { type: 'sign', x: 2260, label: 'J.M. ROAD' },
      { type: 'stall', x: 2440, label: 'MASKA BUN', variant: 2 },
      { type: 'lamp', x: 2620 },
      { type: 'wada', x: 2880, label: 'SHANIWAR WADA' },
      { type: 'flowers', x: 1400 },
      { type: 'sign', x: 3230, label: 'KARVE NAGAR →' },
    ],
  },
  // SB Road → Phoenix Marketcity (Viman Nagar) → Mall of the Millennium (Wakad)
  {
    index: 1,
    theme: 'park',
    width: 3800,
    hpTarget: 30,
    unlocks: [
      { atHits: 0, weapon: 'pizza' },
      { atHits: 0, weapon: 'emoji', equip: false },
      { atHits: 2, weapon: 'eyes' },
      { atHits: 3, weapon: 'ticks' },
      { atHits: 4, weapon: 'water' },
      { atHits: 5, weapon: 'tantrum' },
    ],
    objective: 'Bring his HP down to 30!',
    secret: { x: 2960, y: 255 },
    platforms: [
      { x: 520, y: 490, w: 200 },
      { x: 1050, y: 420, w: 300 },
      { x: 1500, y: 500, w: 180 },
      { x: 2100, y: 440, w: 380 },
      { x: 2650, y: 500, w: 200 },
      { x: 2960, y: 340, w: 220 },
      { x: 3350, y: 460, w: 260 },
    ],
    props: [
      { type: 'tree', x: 180 },
      { type: 'sign', x: 400, label: 'S.B. ROAD' },
      { type: 'bush', x: 760, hide: true },
      { type: 'bench', x: 880, solid: true },
      { type: 'mall', x: 1270, label: 'PHOENIX MARKETCITY', variant: 0 },
      { type: 'fountain', x: 1750 },
      { type: 'sign', x: 1960, label: 'VIMAN NAGAR' },
      { type: 'bridge', x: 2350 },
      { type: 'rickshaw', x: 2560, solid: true },
      { type: 'bush', x: 2800, hide: true },
      { type: 'mall', x: 3080, label: 'MALL OF THE MILLENNIUM', variant: 1 },
      { type: 'sign', x: 3520, label: 'WAKAD' },
      { type: 'flowers', x: 600 },
      { type: 'flowers', x: 1950 },
      { type: 'flowers', x: 3650 },
    ],
  },
  // Sunset: Parvati Hill, Z Bridge, Koregaon Park lanes
  {
    index: 2,
    theme: 'sunset',
    width: 3000,
    hpTarget: 0,
    unlocks: [
      { atHits: 0, weapon: 'fireball' },
      { atHits: 0, weapon: 'kiss' },
      { atHits: 0, weapon: 'ultimate', equip: false },
      { atHits: 1, weapon: 'silent' },
    ],
    objective: 'Finish it, Mumma. 😈',
    platforms: [
      { x: 650, y: 480, w: 240 },
      { x: 1250, y: 420, w: 260 },
      { x: 1850, y: 490, w: 220 },
      { x: 2400, y: 430, w: 260 },
    ],
    props: [
      { type: 'tree', x: 160 },
      { type: 'fairylights', x: 480 },
      { type: 'parvati', x: 760, label: 'PARVATI HILL' },
      { type: 'bench', x: 1000, solid: true },
      { type: 'flowers', x: 1150 },
      { type: 'sign', x: 1450, label: 'Z BRIDGE' },
      { type: 'bridge', x: 1680 },
      { type: 'bush', x: 2050, hide: true },
      { type: 'fairylights', x: 2200 },
      { type: 'sign', x: 2480, label: 'KOREGAON PARK' },
      { type: 'flowers', x: 2650 },
      { type: 'tree', x: 2860 },
    ],
  },
];

export const THEME_COLORS: Record<ThemeId, { skyTop: number; skyBottom: number; ground: number; groundTop: number; platform: number; platformTop: number; far: number; mid: number }> = {
  street: { skyTop: 0xa8d8ff, skyBottom: 0xffe1ef, ground: 0xc9a4e8, groundTop: 0xffb3d1, platform: 0xffc9a8, platformTop: 0xffefa0, far: 0xd9c6ff, mid: 0xffcfe4 },
  park: { skyTop: 0x9fe3ff, skyBottom: 0xfff4c2, ground: 0x7fcf8a, groundTop: 0xa9ee96, platform: 0xc49a6c, platformTop: 0x9de08c, far: 0xbfe7c8, mid: 0x8fd6a0 },
  sunset: { skyTop: 0x5a4a8f, skyBottom: 0xffa26b, ground: 0x7d4e6e, groundTop: 0xd77a8a, platform: 0x8a5a7a, platformTop: 0xf2a07b, far: 0x9a6a9a, mid: 0x6e4a72 },
};
