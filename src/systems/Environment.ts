/**
 * Builds a level's world: parallax backgrounds, ground, one-way platforms,
 * solid obstacles, hiding spots and decorative props — all drawn procedurally.
 */
import Phaser from 'phaser';
import { GAME_H, GAME_W, GROUND_Y, THEME_COLORS, type LevelDef, type PropDef, type ThemeId } from '../config/gameConfig';
import { motionScale } from '../utils/helpers';

const OUT = 0x2a1a24;

export interface HideSpot {
  x: number;
  y: number;
  w: number;
  sprite: Phaser.GameObjects.Container;
}

export interface BuiltWorld {
  ground: Phaser.GameObjects.Rectangle;
  platforms: Phaser.Physics.Arcade.StaticGroup;
  solids: Phaser.Physics.Arcade.StaticGroup;
  hideSpots: HideSpot[];
  /** obstacle x-ranges at ground level (for AI jump planning) */
  obstacles: { x1: number; x2: number; top: number }[];
  platformRects: { x1: number; x2: number; y: number }[];
}


/**
 * Bakes a static Graphics object into render-texture chunks so it isn't re-tessellated
 * every frame (big win on phones). (x0, y0, w, h) is the drawn area in the graphics' space.
 */
export function bake(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, x0: number, y0: number, w: number, h: number) {
  const CHUNK = 2048;
  const depth = g.depth;
  const sf = g.scrollFactorX;
  const parent = g.parentContainer;
  for (let cx = 0; cx < w; cx += CHUNK) {
    const cw = Math.min(CHUNK, w - cx);
    const rt = scene.make.renderTexture({ x: x0 + cx, y: y0, width: Math.ceil(cw), height: Math.ceil(h) }, false);
    rt.setOrigin(0, 0);
    rt.draw(g, -(x0 + cx), -y0);
    rt.setDepth(depth).setScrollFactor(sf);
    if (parent) parent.addAt(rt, parent.getIndex(g));
    else scene.add.existing(rt);
  }
  g.destroy();
}

function sky(scene: Phaser.Scene, theme: ThemeId) {
  const c = THEME_COLORS[theme];
  const g = scene.add.graphics().setScrollFactor(0).setDepth(-100);
  g.fillGradientStyle(c.skyTop, c.skyTop, c.skyBottom, c.skyBottom, 1);
  g.fillRect(0, 0, GAME_W, GAME_H);
  bake(scene, g, 0, 0, GAME_W, GAME_H);
  if (theme === 'sunset') {
    const sun = scene.add.graphics().setScrollFactor(0.05).setDepth(-95);
    for (let i = 10; i > 0; i--) {
      sun.fillStyle(0xffd27a, 0.05);
      sun.fillCircle(820, 470, 80 + i * 16);
    }
    sun.fillStyle(0xffc06b, 1);
    sun.fillCircle(820, 470, 90);
    sun.fillStyle(0xffe3a3, 0.6);
    sun.fillCircle(800, 450, 60);
  } else {
    const sun = scene.add.graphics().setScrollFactor(0.05).setDepth(-95);
    sun.fillStyle(0xfff3b0, 0.35);
    sun.fillCircle(1080, 120, 80);
    sun.fillStyle(0xfff6c8, 1);
    sun.fillCircle(1080, 120, 48);
  }
}

function clouds(scene: Phaser.Scene, width: number, theme: ThemeId) {
  const tint = theme === 'sunset' ? 0xffc2b0 : 0xffffff;
  for (let i = 0; i < Math.ceil(width / 500); i++) {
    const c = scene.add.image(i * 520 + Math.random() * 200, 70 + Math.random() * 140, 'cloud')
      .setScrollFactor(0.25).setAlpha(theme === 'sunset' ? 0.55 : 0.85).setTint(tint).setDepth(-90)
      .setScale(0.6 + Math.random() * 0.6);
    scene.tweens.add({ targets: c, x: c.x + 80, duration: 9000 + Math.random() * 6000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}

function farLayer(scene: Phaser.Scene, width: number, theme: ThemeId) {
  const c = THEME_COLORS[theme];
  const g = scene.add.graphics().setScrollFactor(0.2).setDepth(-80);
  const w = width * 0.2 + GAME_W + 200;
  g.fillStyle(c.far, 1);
  if (theme === 'street' || theme === 'sunset') {
    // skyline
    let x = -100;
    while (x < w) {
      const bw = 50 + Math.random() * 70;
      const bh = 120 + Math.random() * 180;
      g.fillRect(x, GROUND_Y - 120 - bh + 60, bw, bh + 200);
      if (theme === 'sunset') {
        g.fillStyle(0xffe08a, 0.5);
        for (let wy = GROUND_Y - 100 - bh + 80; wy < GROUND_Y - 40; wy += 26)
          for (let wx = x + 8; wx < x + bw - 10; wx += 16) if (Math.random() < 0.3) g.fillRect(wx, wy, 6, 9);
        g.fillStyle(c.far, 1);
      }
      x += bw + 6;
    }
  } else {
    for (let x = -100; x < w; x += 260) g.fillEllipse(x, GROUND_Y - 40, 420, 260);
  }
  bake(scene, g, -100, 0, w + 200, GROUND_Y + 220);
  const m = scene.add.graphics().setScrollFactor(0.45).setDepth(-70);
  m.fillStyle(c.mid, 1);
  const w2 = width * 0.45 + GAME_W + 200;
  for (let x = -100; x < w2; x += 180 + Math.random() * 80) {
    if (theme === 'street') {
      m.fillRoundedRect(x, GROUND_Y - 150, 120, 200, 10);
      m.fillTriangle(x - 10, GROUND_Y - 150, x + 130, GROUND_Y - 150, x + 60, GROUND_Y - 210);
    } else {
      m.fillRect(x + 40, GROUND_Y - 100, 14, 120);
      m.fillCircle(x + 47, GROUND_Y - 130, 55);
      m.fillCircle(x + 15, GROUND_Y - 100, 38);
      m.fillCircle(x + 80, GROUND_Y - 105, 40);
    }
  }
  bake(scene, m, -100, GROUND_Y - 260, w2 + 400, 320);
}

function groundAndPlatforms(scene: Phaser.Scene, level: LevelDef) {
  const c = THEME_COLORS[level.theme];
  const g = scene.add.graphics().setDepth(-10);
  g.fillStyle(c.ground, 1);
  g.fillRect(-200, GROUND_Y, level.width + 400, GAME_H - GROUND_Y + 200);
  g.fillStyle(c.groundTop, 1);
  g.fillRect(-200, GROUND_Y, level.width + 400, 16);
  g.lineStyle(3, OUT, 0.6);
  g.lineBetween(-200, GROUND_Y, level.width + 200, GROUND_Y);
  // pavement / grass tufts
  for (let x = 0; x < level.width; x += 60) {
    if (level.theme === 'street') {
      g.fillStyle(0xffffff, 0.18);
      g.fillRect(x, GROUND_Y + 34, 34, 6);
    } else {
      g.fillStyle(c.groundTop, 1);
      g.fillTriangle(x, GROUND_Y + 2, x + 6, GROUND_Y - 10, x + 12, GROUND_Y + 2);
    }
  }
  bake(scene, g, -200, GROUND_Y - 14, level.width + 400, GAME_H - GROUND_Y + 14);
  const ground = scene.add.rectangle(level.width / 2, GROUND_Y + 50, level.width + 400, 100, 0, 0);
  scene.physics.add.existing(ground, true);

  const platforms = scene.physics.add.staticGroup();
  const platformRects: BuiltWorld['platformRects'] = [];
  level.platforms.forEach((p) => {
    const pg = scene.add.graphics().setDepth(-5);
    pg.fillStyle(0x000000, 0.12);
    pg.fillRoundedRect(p.x - p.w / 2 + 6, p.y + 6, p.w, 26, 12);
    pg.fillStyle(c.platform, 1);
    pg.lineStyle(3, OUT, 1);
    pg.fillRoundedRect(p.x - p.w / 2, p.y, p.w, 26, 12);
    pg.strokeRoundedRect(p.x - p.w / 2, p.y, p.w, 26, 12);
    pg.fillStyle(c.platformTop, 1);
    pg.fillRoundedRect(p.x - p.w / 2 + 3, p.y + 2, p.w - 6, 9, 6);
    if (level.theme !== 'street') {
      pg.fillStyle(0xff9ec7, 1);
      for (let fx = p.x - p.w / 2 + 16; fx < p.x + p.w / 2 - 10; fx += 34) pg.fillCircle(fx, p.y + 1, 3);
    }
    bake(scene, pg, p.x - p.w / 2 - 4, p.y - 6, p.w + 14, 40);
    const r = scene.add.rectangle(p.x, p.y + 8, p.w, 16, 0, 0);
    platforms.add(r);
    platformRects.push({ x1: p.x - p.w / 2, x2: p.x + p.w / 2, y: p.y });
  });
  platforms.refresh();
  return { ground, platforms, platformRects };
}

// ------------------------------------------------------------------ props

function house(g: Phaser.GameObjects.Graphics, variant: number) {
  const cols = [0xffd1e3, 0xd7c8ff, 0xffe3b3][variant % 3];
  const roof = [0xff7eb6, 0x8f6ad8, 0xff9a62][variant % 3];
  g.lineStyle(3, OUT, 1);
  g.fillStyle(cols, 1);
  g.fillRect(-90, -180, 180, 180);
  g.strokeRect(-90, -180, 180, 180);
  g.fillStyle(roof, 1);
  g.fillTriangle(-110, -178, 110, -178, 0, -260);
  g.strokeTriangle(-110, -178, 110, -178, 0, -260);
  g.fillStyle(0x9fd8ff, 1);
  [-50, 50].forEach((x) => {
    g.fillRect(x - 22, -150, 44, 40);
    g.strokeRect(x - 22, -150, 44, 40);
    g.lineBetween(x, -150, x, -110);
  });
  g.fillStyle(0xa06a4a, 1);
  g.fillRoundedRect(-22, -80, 44, 80, { tl: 18, tr: 18, bl: 0, br: 0 });
  g.strokeRoundedRect(-22, -80, 44, 80, { tl: 18, tr: 18, bl: 0, br: 0 });
  g.fillStyle(0xff4f8b, 1);
  g.fillCircle(-6, -105, 7);
  g.fillCircle(6, -105, 7);
  g.fillTriangle(-13, -103, 13, -103, 0, -90);
}

function tree(g: Phaser.GameObjects.Graphics, theme: ThemeId) {
  const leaf = theme === 'sunset' ? 0xc56a8a : 0x6fcf7f;
  const leaf2 = theme === 'sunset' ? 0xe08aa0 : 0x94e39a;
  g.lineStyle(3, OUT, 1);
  g.fillStyle(0x9a6a4a, 1);
  g.fillRect(-14, -150, 28, 150);
  g.strokeRect(-14, -150, 28, 150);
  g.fillStyle(leaf, 1);
  [[-50, -170, 55], [40, -180, 60], [0, -230, 68], [-20, -150, 45], [50, -140, 42]].forEach(([x, y, r]) => {
    g.fillCircle(x, y, r);
    g.strokeCircle(x, y, r);
  });
  [[-50, -170, 55], [40, -180, 60], [0, -230, 68]].forEach(([x, y, r]) => g.fillCircle(x, y, r - 3));
  g.fillStyle(leaf2, 1);
  g.fillCircle(-10, -245, 26);
  g.fillCircle(45, -195, 20);
  g.fillStyle(0xff9ec7, 1);
  for (let i = 0; i < 7; i++) g.fillCircle(-60 + i * 20, -160 - (i % 3) * 30, 5);
}

function bench(g: Phaser.GameObjects.Graphics) {
  g.lineStyle(3, OUT, 1);
  g.fillStyle(0x7a5a8a, 1);
  g.fillRect(-56, -26, 8, 26);
  g.fillRect(48, -26, 8, 26);
  g.fillStyle(0xff9a62, 1);
  g.fillRoundedRect(-66, -40, 132, 14, 6);
  g.strokeRoundedRect(-66, -40, 132, 14, 6);
  g.fillRoundedRect(-66, -72, 132, 12, 6);
  g.strokeRoundedRect(-66, -72, 132, 12, 6);
  g.fillStyle(0x7a5a8a, 1);
  g.fillRect(-58, -62, 6, 24);
  g.fillRect(52, -62, 6, 24);
}

function crate(g: Phaser.GameObjects.Graphics) {
  g.lineStyle(3, OUT, 1);
  g.fillStyle(0xe8b07a, 1);
  g.fillRect(-30, -56, 60, 56);
  g.strokeRect(-30, -56, 60, 56);
  g.lineBetween(-30, -56, 30, 0);
  g.lineBetween(30, -56, -30, 0);
  g.fillStyle(0xff7eb6, 1);
  g.fillCircle(-6, -30, 5);
  g.fillCircle(6, -30, 5);
  g.fillTriangle(-11, -28, 11, -28, 0, -18);
}

function lamp(g: Phaser.GameObjects.Graphics) {
  g.lineStyle(3, OUT, 1);
  g.fillStyle(0x6a5a8a, 1);
  g.fillRect(-5, -190, 10, 190);
  g.strokeRect(-5, -190, 10, 190);
  g.fillStyle(0xfff3b0, 1);
  g.fillRoundedRect(-18, -222, 36, 34, 8);
  g.strokeRoundedRect(-18, -222, 36, 34, 8);
  g.fillStyle(0xfff3b0, 0.18);
  g.fillCircle(0, -205, 46);
}

function bush(g: Phaser.GameObjects.Graphics, theme: ThemeId) {
  const c = theme === 'sunset' ? 0x9a5a7e : theme === 'street' ? 0x8fd6a0 : 0x5fbf73;
  const c2 = theme === 'sunset' ? 0xb8709a : 0x9fe8a8;
  g.lineStyle(3, OUT, 1);
  g.fillStyle(c, 1);
  [[-55, -40, 42], [0, -60, 52], [55, -40, 42], [-25, -25, 34], [30, -25, 34]].forEach(([x, y, r]) => {
    g.fillCircle(x, y, r);
    g.strokeCircle(x, y, r);
  });
  [[-55, -40, 39], [0, -60, 49], [55, -40, 39]].forEach(([x, y, r]) => g.fillCircle(x, y, r));
  g.fillRect(-90, -30, 180, 30);
  g.fillStyle(c2, 1);
  g.fillCircle(-10, -80, 16);
  g.fillCircle(40, -55, 12);
  g.fillStyle(0xffffff, 1);
  [[-40, -50], [10, -40], [50, -60], [-60, -25]].forEach(([x, y]) => g.fillCircle(x, y, 4));
}

function fountain(g: Phaser.GameObjects.Graphics) {
  g.lineStyle(3, OUT, 1);
  g.fillStyle(0xd7c8ff, 1);
  g.fillRoundedRect(-90, -40, 180, 40, 10);
  g.strokeRoundedRect(-90, -40, 180, 40, 10);
  g.fillStyle(0x9fd8ff, 1);
  g.fillRect(-80, -38, 160, 10);
  g.fillStyle(0xd7c8ff, 1);
  g.fillRect(-12, -110, 24, 72);
  g.strokeRect(-12, -110, 24, 72);
  g.fillEllipse(0, -112, 80, 18);
  g.strokeEllipse(0, -112, 80, 18);
}

function flowers(g: Phaser.GameObjects.Graphics) {
  const cols = [0xff7eb6, 0xffd23f, 0xb48cff, 0xff9a62, 0x7fd3ff];
  for (let i = 0; i < 9; i++) {
    const x = -60 + i * 15;
    const h = 16 + (i % 3) * 8;
    g.lineStyle(2, 0x4a9a5a, 1);
    g.lineBetween(x, 0, x, -h);
    g.fillStyle(cols[i % cols.length], 1);
    for (let k = 0; k < 5; k++) {
      const a = (k * Math.PI * 2) / 5;
      g.fillCircle(x + Math.cos(a) * 4, -h + Math.sin(a) * 4, 3.5);
    }
    g.fillStyle(0xfff3b0, 1);
    g.fillCircle(x, -h, 2.5);
  }
}

function bridge(g: Phaser.GameObjects.Graphics) {
  g.lineStyle(3, OUT, 1);
  g.fillStyle(0xc49a6c, 1);
  g.beginPath();
  g.arc(0, 60, 150, Math.PI * 1.22, Math.PI * 1.78, false);
  g.strokePath();
  for (let i = -4; i <= 4; i++) {
    const x = i * 26;
    const y = 60 - Math.sqrt(150 * 150 - x * x);
    g.fillRect(x - 3, y - 30, 6, 30);
  }
}

function fairyLights(scene: Phaser.Scene, x: number) {
  const g = scene.add.graphics().setDepth(-3);
  g.lineStyle(2, 0x3a2a3a, 1);
  g.fillStyle(0x6a4a6a, 1);
  g.fillRect(x - 160, GROUND_Y - 230, 8, 230);
  g.fillRect(x + 152, GROUND_Y - 230, 8, 230);
  const pts: { x: number; y: number }[] = [];
  g.beginPath();
  for (let i = 0; i <= 20; i++) {
    const px = x - 156 + (i * 312) / 20;
    const py = GROUND_Y - 225 + Math.sin((i / 20) * Math.PI) * 50;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
    pts.push({ x: px, y: py });
  }
  g.strokePath();
  const cols = [0xffe066, 0xff9ec7, 0xb48cff, 0x9fe8ff];
  pts.forEach((p, i) => {
    if (i % 2) return;
    const b = scene.add.image(p.x, p.y + 6, 'dot').setScale(0.55).setTint(cols[i % cols.length]).setDepth(-2);
    const glow = scene.add.image(p.x, p.y + 6, 'soft').setScale(0.6).setTint(cols[i % cols.length]).setAlpha(0.5).setDepth(-2).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: [b, glow], alpha: 0.3, duration: 600 + Math.random() * 900, yoyo: true, repeat: -1, delay: Math.random() * 800 });
  });
}

function mailbox(g: Phaser.GameObjects.Graphics) {
  g.lineStyle(3, OUT, 1);
  g.fillStyle(0x6a5a8a, 1);
  g.fillRect(-4, -60, 8, 60);
  g.fillStyle(0xff7eb6, 1);
  g.fillRoundedRect(-22, -86, 44, 28, { tl: 14, tr: 14, bl: 2, br: 2 });
  g.strokeRoundedRect(-22, -86, 44, 28, { tl: 14, tr: 14, bl: 2, br: 2 });
  g.fillStyle(0xffd23f, 1);
  g.fillRect(14, -96, 4, 20);
}


// ------------------------------------------------------------ Pune props

/** Green Indian road-direction sign on two poles. Text is added separately. */
function roadSign(g: Phaser.GameObjects.Graphics, w: number) {
  g.lineStyle(3, OUT, 1);
  g.fillStyle(0x8a8f9a, 1);
  g.fillRect(-w / 2 + 12, -150, 8, 150);
  g.fillRect(w / 2 - 20, -150, 8, 150);
  g.strokeRect(-w / 2 + 12, -150, 8, 150);
  g.strokeRect(w / 2 - 20, -150, 8, 150);
  g.fillStyle(0x1f8a4c, 1);
  g.fillRoundedRect(-w / 2, -200, w, 52, 8);
  g.strokeRoundedRect(-w / 2, -200, w, 52, 8);
  g.lineStyle(2, 0xffffff, 0.9);
  g.strokeRoundedRect(-w / 2 + 5, -195, w - 10, 42, 6);
}

/** Street-food cart with a striped awning. */
function stall(g: Phaser.GameObjects.Graphics, variant: number) {
  const stripe = [0xff7a3d, 0xd94f8a, 0x8f6ad8][variant % 3];
  g.lineStyle(3, OUT, 1);
  // cart body
  g.fillStyle(0xfff1d6, 1);
  g.fillRoundedRect(-62, -70, 124, 54, 6);
  g.strokeRoundedRect(-62, -70, 124, 54, 6);
  // wheels
  g.fillStyle(0x4a3a4a, 1);
  [-38, 38].forEach((x) => { g.fillCircle(x, -12, 12); g.strokeCircle(x, -12, 12); });
  g.fillStyle(0xbbb, 1);
  [-38, 38].forEach((x) => g.fillCircle(x, -12, 4));
  // poles + awning
  g.fillStyle(0x7a5a4a, 1);
  g.fillRect(-58, -150, 6, 82);
  g.fillRect(52, -150, 6, 82);
  for (let i = 0; i < 6; i++) {
    g.fillStyle(i % 2 ? 0xffffff : stripe, 1);
    g.fillRect(-72 + i * 24, -168, 24, 26);
  }
  g.strokeRect(-72, -168, 144, 26);
  for (let i = 0; i < 6; i++) {
    g.fillStyle(i % 2 ? 0xffffff : stripe, 1);
    g.fillCircle(-60 + i * 24, -142, 12);
  }
  // goodies on the counter
  if (variant % 3 === 1) {
    // chai kettle + glasses
    g.fillStyle(0xc0c0c8, 1);
    g.fillRoundedRect(-36, -98, 30, 28, 8);
    g.strokeRoundedRect(-36, -98, 30, 28, 8);
    g.fillStyle(0xe8b07a, 0.9);
    [6, 20, 34].forEach((x) => { g.fillRect(x, -88, 9, 18); g.strokeRect(x, -88, 9, 18); });
  } else {
    // round snacks
    g.fillStyle(0xe0a24a, 1);
    [[-30, -80], [-12, -80], [6, -80], [-21, -94], [-3, -94]].forEach(([x, y]) => { g.fillCircle(x, y, 9); g.strokeCircle(x, y, 9); });
    g.fillStyle(0x6fbf4a, 1);
    g.fillCircle(32, -78, 7);
  }
}

/** Pune's favourite yellow-and-black auto-rickshaw. */
function rickshaw(g: Phaser.GameObjects.Graphics) {
  g.lineStyle(3, OUT, 1);
  // black canopy
  g.fillStyle(0x2b2b33, 1);
  g.fillRoundedRect(-58, -112, 104, 34, { tl: 26, tr: 14, bl: 0, br: 0 });
  g.strokeRoundedRect(-58, -112, 104, 34, { tl: 26, tr: 14, bl: 0, br: 0 });
  // yellow body
  g.fillStyle(0xffd23f, 1);
  g.fillRoundedRect(-58, -80, 112, 58, { tl: 4, tr: 22, bl: 10, br: 10 });
  g.strokeRoundedRect(-58, -80, 112, 58, { tl: 4, tr: 22, bl: 10, br: 10 });
  // green stripe + windshield
  g.fillStyle(0x2f9a5a, 1);
  g.fillRect(-56, -40, 108, 8);
  g.fillStyle(0xbfe6ff, 1);
  g.fillRoundedRect(18, -108, 26, 30, 6);
  g.strokeRoundedRect(18, -108, 26, 30, 6);
  // doorway
  g.fillStyle(0x2b2b33, 0.85);
  g.fillRoundedRect(-36, -76, 40, 34, 6);
  // headlight + wheels
  g.fillStyle(0xfff3b0, 1);
  g.fillCircle(54, -54, 6);
  g.strokeCircle(54, -54, 6);
  g.fillStyle(0x2b2b33, 1);
  [-38, 38].forEach((x) => { g.fillCircle(x, -14, 14); g.strokeCircle(x, -14, 14); });
  g.fillStyle(0x9a9aa6, 1);
  [-38, 38].forEach((x) => g.fillCircle(x, -14, 5));
}

/** A big glass-front shopping mall. Name board added as text. */
function mall(g: Phaser.GameObjects.Graphics, variant: number) {
  const body = variant % 2 ? 0xd7c8ff : 0xffd1e3;
  const glass = variant % 2 ? 0xa9d6ff : 0xb8ecff;
  g.lineStyle(3, OUT, 1);
  g.fillStyle(body, 1);
  g.fillRect(-160, -290, 320, 290);
  g.strokeRect(-160, -290, 320, 290);
  // glass facade grid
  g.fillStyle(glass, 1);
  g.fillRect(-140, -230, 280, 150);
  g.strokeRect(-140, -230, 280, 150);
  g.lineStyle(2, 0xffffff, 0.8);
  for (let x = -100; x < 140; x += 40) g.lineBetween(x, -230, x, -80);
  g.lineBetween(-140, -155, 140, -155);
  g.fillStyle(0xffffff, 0.35);
  g.fillTriangle(-140, -230, -60, -230, -140, -150);
  // name board
  g.lineStyle(3, OUT, 1);
  g.fillStyle(0x3a2440, 1);
  g.fillRoundedRect(-150, -284, 300, 44, 10);
  g.strokeRoundedRect(-150, -284, 300, 44, 10);
  // entrance + canopy
  g.fillStyle(0xff7eb6, 1);
  g.fillRoundedRect(-70, -84, 140, 16, 6);
  g.strokeRoundedRect(-70, -84, 140, 16, 6);
  g.fillStyle(0x9fd8ff, 1);
  g.fillRect(-50, -68, 100, 68);
  g.strokeRect(-50, -68, 100, 68);
  g.lineBetween(0, -68, 0, 0);
  // potted plants
  g.fillStyle(0x6fcf7f, 1);
  [-110, 110].forEach((x) => { g.fillCircle(x, -40, 20); g.strokeCircle(x, -40, 20); });
  g.fillStyle(0xc4744a, 1);
  [-110, 110].forEach((x) => { g.fillRect(x - 14, -26, 28, 26); g.strokeRect(x - 14, -26, 28, 26); });
}

/** Shaniwar Wada's fortified gate with its bastions and spiked doors. */
function wada(g: Phaser.GameObjects.Graphics) {
  const stone = 0xc9a98a;
  const dark = 0xa88a6e;
  g.lineStyle(3, OUT, 1);
  g.fillStyle(stone, 1);
  g.fillRect(-150, -170, 300, 170);
  g.strokeRect(-150, -170, 300, 170);
  // bastions
  [-130, 130].forEach((x) => {
    g.fillStyle(dark, 1);
    g.fillRect(x - 30, -220, 60, 220);
    g.strokeRect(x - 30, -220, 60, 220);
    for (let i = 0; i < 3; i++) { g.fillRect(x - 30 + i * 22, -234, 14, 14); g.strokeRect(x - 30 + i * 22, -234, 14, 14); }
  });
  // battlements
  g.fillStyle(stone, 1);
  for (let x = -96; x < 96; x += 24) { g.fillRect(x, -184, 14, 14); g.strokeRect(x, -184, 14, 14); }
  // stone lines
  g.lineStyle(1.5, OUT, 0.25);
  for (let y = -150; y < 0; y += 22) g.lineBetween(-100, y, 100, y);
  // arched gate with spiked wooden doors
  g.lineStyle(3, OUT, 1);
  g.fillStyle(0x7a4a2e, 1);
  g.fillRoundedRect(-48, -130, 96, 130, { tl: 48, tr: 48, bl: 0, br: 0 });
  g.strokeRoundedRect(-48, -130, 96, 130, { tl: 48, tr: 48, bl: 0, br: 0 });
  g.lineBetween(0, -128, 0, 0);
  g.fillStyle(0xd8d8e0, 1);
  for (let y = -90; y < -10; y += 26) for (let x = -36; x <= 36; x += 18) if (x !== 0) g.fillTriangle(x - 4, y + 6, x + 4, y + 6, x, y - 4);
  // saffron flag
  g.fillStyle(0x6a5a4a, 1);
  g.fillRect(-132, -300, 4, 70);
  g.fillStyle(0xff8a1e, 1);
  g.fillTriangle(-128, -300, -128, -270, -92, -285);
}

/** Parvati Hill with its temple on top and the long staircase. */
function parvati(g: Phaser.GameObjects.Graphics) {
  g.lineStyle(3, OUT, 1);
  g.fillStyle(0x8a5a7a, 1);
  g.fillEllipse(0, 0, 330, 300);
  g.strokeEllipse(0, 0, 330, 300);
  g.fillStyle(0xa86a8a, 1);
  g.fillEllipse(-40, -40, 160, 120);
  // steps
  g.lineStyle(2, 0xf2c2a0, 0.8);
  for (let i = 0; i < 9; i++) {
    const y = -12 - i * 14;
    const x = 40 - i * 5;
    g.lineBetween(x - 10, y, x + 10, y);
  }
  // temple
  g.lineStyle(3, OUT, 1);
  g.fillStyle(0xf2d2b0, 1);
  g.fillRect(-26, -178, 52, 34);
  g.strokeRect(-26, -178, 52, 34);
  g.fillTriangle(-20, -178, 20, -178, 0, -236);
  g.strokeTriangle(-20, -178, 20, -178, 0, -236);
  g.fillStyle(0xffc23f, 1);
  g.fillCircle(0, -240, 5);
  g.fillStyle(0xff8a1e, 1);
  g.fillTriangle(0, -260, 0, -246, 16, -253);
  g.fillStyle(0x6a3a4a, 1);
  g.fillRoundedRect(-8, -168, 16, 24, { tl: 8, tr: 8, bl: 0, br: 0 });
}

function propLabel(scene: Phaser.Scene, c: Phaser.GameObjects.Container, text: string, y: number, size: number, color = '#ffffff', maxW = 0) {
  const t = scene.add.text(0, y, text, {
    fontFamily: '"Baloo 2", "Nunito", sans-serif',
    fontSize: `${size}px`,
    fontStyle: '800',
    color,
    align: 'center',
  }).setOrigin(0.5);
  if (maxW && t.width > maxW) t.setScale(maxW / t.width);
  c.add(t);
  return t;
}

function signWidth(label: string) {
  return Math.min(300, Math.max(130, label.length * 13 + 40));
}

function drawProp(scene: Phaser.Scene, p: PropDef, theme: ThemeId): Phaser.GameObjects.Container {
  const c = scene.add.container(p.x, GROUND_Y);
  const g = scene.add.graphics();
  c.add(g);
  switch (p.type) {
    case 'house': house(g, p.variant ?? 0); c.setDepth(-8); break;
    case 'tree': tree(g, theme); c.setDepth(-8); break;
    case 'bench': bench(g); c.setDepth(-1); break;
    case 'crate': crate(g); c.setDepth(-1); break;
    case 'lamp': lamp(g); c.setDepth(-7); break;
    case 'bush': bush(g, theme); c.setDepth(60); break; // in front of characters → hiding spot
    case 'fountain': fountain(g); c.setDepth(-6); break;
    case 'flowers': flowers(g); c.setDepth(55); break;
    case 'bridge': bridge(g); c.setDepth(-6); break;
    case 'mailbox': mailbox(g); c.setDepth(-6); break;
    case 'sign': roadSign(g, signWidth(p.label ?? '')); c.setDepth(-7); break;
    case 'stall': stall(g, p.variant ?? 0); c.setDepth(-4); break;
    case 'rickshaw': rickshaw(g); c.setDepth(-1); break;
    case 'mall': mall(g, p.variant ?? 0); c.setDepth(-9); break;
    case 'wada': wada(g); c.setDepth(-9); break;
    case 'parvati': parvati(g); c.setDepth(-9); break;
    case 'fairylights': break;
  }
  bake(scene, g, -170, -330, 340, 400);
  // name boards are crisp text on top of the baked art
  const label = p.label;
  if (label) {
    switch (p.type) {
      case 'sign': propLabel(scene, c, label, -174, 22, '#ffffff', signWidth(label) - 20); break;
      case 'stall': propLabel(scene, c, label, -186, 20, '#3a2440', 150); break;
      case 'mall': propLabel(scene, c, label, -262, 24, '#ffe3f0', 284); break;
      case 'wada': propLabel(scene, c, label, -150, 18, '#4a2a1a', 180); break;
      case 'parvati': propLabel(scene, c, label, -60, 18, '#ffe3d0', 200); break;
    }
  }
  return c;
}

export function buildWorld(scene: Phaser.Scene, level: LevelDef): BuiltWorld {
  sky(scene, level.theme);
  clouds(scene, level.width, level.theme);
  farLayer(scene, level.width, level.theme);
  const { ground, platforms, platformRects } = groundAndPlatforms(scene, level);
  const solids = scene.physics.add.staticGroup();
  const hideSpots: HideSpot[] = [];
  const obstacles: BuiltWorld['obstacles'] = [];

  level.props.forEach((p) => {
    if (p.type === 'fairylights') {
      fairyLights(scene, p.x);
      return;
    }
    const c = drawProp(scene, p, level.theme);
    if (p.solid) {
      const w = p.type === 'bench' ? 120 : p.type === 'rickshaw' ? 112 : 58;
      const hgt = p.type === 'bench' ? 40 : p.type === 'rickshaw' ? 70 : 56;
      const r = scene.add.rectangle(p.x, GROUND_Y - hgt / 2, w, hgt, 0, 0);
      solids.add(r);
      obstacles.push({ x1: p.x - w / 2, x2: p.x + w / 2, top: GROUND_Y - hgt });
    }
    if (p.hide) hideSpots.push({ x: p.x, y: GROUND_Y, w: 150, sprite: c });
    if (p.type === 'fountain') {
      const spray = scene.add.particles(p.x, GROUND_Y - 118, 'dot', {
        speedY: { min: -260, max: -180 },
        speedX: { min: -50, max: 50 },
        gravityY: 500,
        scale: { start: 0.45, end: 0.1 },
        lifespan: 900,
        frequency: Math.round(60 / motionScale()),
        tint: [0x9fd8ff, 0xffffff],
        alpha: { start: 0.9, end: 0 },
      });
      spray.setDepth(-5);
    }
  });
  solids.refresh();

  if (level.theme === 'sunset') {
    // drifting petals for the whole level
    const petals = scene.add.particles(0, -20, 'petal', {
      x: { min: 0, max: GAME_W },
      speedX: { min: -60, max: -10 },
      speedY: { min: 40, max: 90 },
      rotate: { min: 0, max: 360 },
      lifespan: 9000,
      frequency: Math.round(260 / motionScale()),
      scale: { min: 0.6, max: 1 },
      tint: [0xffb3d1, 0xffd1e3, 0xffc2a0],
      alpha: 0.85,
    });
    petals.setScrollFactor(0).setDepth(70);
  }

  return { ground, platforms, solids, hideSpots, obstacles, platformRects };
}
