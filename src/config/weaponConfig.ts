/**
 * MUMMA'S ARSENAL — every weapon, its numbers and how it behaves.
 * Unlock timing per level lives in gameConfig.ts (LEVELS[].unlocks).
 */
export type WeaponId =
  | 'chappal' | 'lipgloss' | 'pillow' | 'momos' | 'pizza' | 'emoji' | 'eyes' | 'ticks'
  | 'water' | 'tantrum' | 'fireball' | 'silent' | 'kiss' | 'ultimate';

export type WeaponKind =
  | 'arc'        // thrown with gravity (chappal, lipgloss)
  | 'melee'      // close-range smack (pillow)
  | 'straight'   // flies straight (emoji, blue ticks, silent treatment)
  | 'stream'     // rapid fire (water)
  | 'charge'     // hold-to-charge giant chappal (ultimate)
  | 'spread'     // fan of 3 (momos)
  | 'boomerang'  // flies out and comes back (pizza)
  | 'beam'       // instant heart-laser from her eyes (beautiful eyes)
  | 'shockwave'  // ground waves both ways (tantrum)
  | 'bounce'     // bouncing projectile (fireball)
  | 'homing';    // seeks him out (spicy kiss)

/** What a hit does to Baby on top of damage */
export type WeaponEffect = 'none' | 'slow' | 'charm' | 'freeze';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  icon: string;
  damage: number;
  /** ms between attacks */
  cooldown: number;
  kind: WeaponKind;
  /** projectile speed in px/s (unused for melee / beam) */
  speed: number;
  /** how long the boyfriend is invulnerable after being hit by this weapon (ms) */
  iframes: number;
  knockback: number;
  /** projectile lifetime in ms */
  life: number;
  /** projectile texture key (generated in utils/textures.ts) */
  tex: string;
  projScale: number;
  /** texture held in her hand (null = nothing in hand) */
  held: string | null;
  heldScale: number;
  effect: WeaponEffect;
  /** how long the effect lasts (ms) */
  effectMs: number;
  /** a "power" attack: bigger hit-stop, flash and damage number */
  power?: boolean;
  description: string;
}

const W = (d: WeaponDef) => d;

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  chappal: W({
    id: 'chappal', name: 'Legendary Chappal', icon: '🩴',
    damage: 7, cooldown: 420, kind: 'arc', speed: 760, iframes: 450, knockback: 260, life: 1600,
    tex: 'w-chappal', projScale: 0.9, held: 'w-chappal', heldScale: 0.8, effect: 'none', effectMs: 0,
    description: 'Spinning slipper of justice. Arcs through the air.',
  }),
  lipgloss: W({
    id: 'lipgloss', name: 'Sticky Lipgloss', icon: '💄',
    damage: 6, cooldown: 480, kind: 'arc', speed: 720, iframes: 420, knockback: 120, life: 1600,
    tex: 'w-lipgloss', projScale: 0.9, held: 'w-lipgloss', heldScale: 0.8, effect: 'slow', effectMs: 1800,
    description: 'Glossy, shiny and SO sticky. A hit slows him right down.',
  }),
  pillow: W({
    id: 'pillow', name: 'Pillow of Doom', icon: '🛏️',
    damage: 10, cooldown: 650, kind: 'melee', speed: 0, iframes: 500, knockback: 520, life: 180,
    tex: 'w-pillow', projScale: 1, held: 'w-pillow', heldScale: 0.75, effect: 'none', effectMs: 0,
    description: 'Short-range fluffy smack. Massive knockback, many feathers.',
  }),
  momos: W({
    id: 'momos', name: 'Momo Shotgun', icon: '🥟',
    damage: 4, cooldown: 560, kind: 'spread', speed: 700, iframes: 160, knockback: 120, life: 900,
    tex: 'p-momo', projScale: 0.85, held: 'p-momo', heldScale: 0.75, effect: 'none', effectMs: 0,
    description: 'Three steaming momos at once. Chutney not included.',
  }),
  pizza: W({
    id: 'pizza', name: 'Burn-to-Hell Pizza', icon: '🍕',
    damage: 10, cooldown: 1100, kind: 'boomerang', speed: 820, iframes: 420, knockback: 300, life: 1700,
    tex: 'p-pizza', projScale: 0.9, held: 'p-pizza', heldScale: 0.6, effect: 'none', effectMs: 0,
    description: 'A flaming slice that spins out and comes right back to her.',
  }),
  emoji: W({
    id: 'emoji', name: 'Angry Emoji Cannon', icon: '😡',
    damage: 5, cooldown: 260, kind: 'straight', speed: 720, iframes: 260, knockback: 140, life: 900,
    tex: 'p-emoji', projScale: 0.75, held: 'w-cannon', heldScale: 0.8, effect: 'none', effectMs: 0,
    description: 'Fires furious emojis in a straight line. Medium range.',
  }),
  eyes: W({
    id: 'eyes', name: 'Beautiful Eyes', icon: '😍',
    damage: 14, cooldown: 2600, kind: 'beam', speed: 0, iframes: 900, knockback: 0, life: 0,
    tex: 'heart', projScale: 1, held: null, heldScale: 1, effect: 'charm', effectMs: 1900, power: true,
    description: 'One look from her and he forgets how to run. POWER ATTACK.',
  }),
  ticks: W({
    id: 'ticks', name: 'Blue Ticks (Seen)', icon: '✔️',
    damage: 5, cooldown: 340, kind: 'straight', speed: 900, iframes: 260, knockback: 100, life: 800,
    tex: 'p-ticks', projScale: 0.9, held: 'w-phone', heldScale: 0.8, effect: 'none', effectMs: 0,
    description: 'Seen. No reply. The most painful weapon ever invented.',
  }),
  water: W({
    id: 'water', name: 'Heartbreak Water Blaster', icon: '💦',
    damage: 3, cooldown: 95, kind: 'stream', speed: 820, iframes: 140, knockback: 40, life: 520,
    tex: 'p-water', projScale: 1, held: 'w-blaster', heldScale: 0.8, effect: 'slow', effectMs: 900,
    description: 'Rapid heart-shaped droplets. Hits slow him down.',
  }),
  tantrum: W({
    id: 'tantrum', name: 'Tantrum Stomp', icon: '💢',
    damage: 9, cooldown: 1500, kind: 'shockwave', speed: 620, iframes: 500, knockback: 420, life: 1100,
    tex: 'p-shock', projScale: 1, held: null, heldScale: 1, effect: 'none', effectMs: 0,
    description: 'She stomps. The ground shakes both ways. Jump or suffer.',
  }),
  fireball: W({
    id: 'fireball', name: 'Gussa Fireballs', icon: '🔥',
    damage: 6, cooldown: 380, kind: 'bounce', speed: 560, iframes: 300, knockback: 200, life: 2200,
    tex: 'p-fire', projScale: 0.85, held: 'p-fire', heldScale: 0.6, effect: 'none', effectMs: 0,
    description: 'Bouncing balls of pure anger. Up to four bounces each.',
  }),
  silent: W({
    id: 'silent', name: 'Silent Treatment', icon: '🤐',
    damage: 5, cooldown: 1400, kind: 'straight', speed: 380, iframes: 600, knockback: 0, life: 2200,
    tex: 'p-silent', projScale: 1, held: null, heldScale: 1, effect: 'freeze', effectMs: 1500,
    description: 'A slow cloud of total silence. He freezes on the spot.',
  }),
  kiss: W({
    id: 'kiss', name: 'Spicy Kiss', icon: '💋',
    damage: 14, cooldown: 2400, kind: 'homing', speed: 520, iframes: 900, knockback: 0, life: 2600,
    tex: 'p-kiss', projScale: 1, held: null, heldScale: 1, effect: 'charm', effectMs: 1900, power: true,
    description: 'A blown kiss that hunts him down. He melts. POWER ATTACK.',
  }),
  ultimate: W({
    id: 'ultimate', name: 'Ultimate Chappal of Destiny', icon: '✨',
    damage: 18, cooldown: 1800, kind: 'charge', speed: 900, iframes: 600, knockback: 600, life: 1800,
    tex: 'w-ultimate', projScale: 1, held: 'w-ultimate', heldScale: 0.55, effect: 'none', effectMs: 0, power: true,
    description: 'Charges up, then launches a giant glowing chappal. The end is near.',
  }),
};

/** Slot order in the HUD (also the 1–9, 0 number keys). */
export const WEAPON_ORDER: WeaponId[] = [
  'chappal', 'lipgloss', 'pillow', 'momos', 'pizza', 'emoji', 'eyes',
  'ticks', 'water', 'tantrum', 'fireball', 'silent', 'kiss', 'ultimate',
];
