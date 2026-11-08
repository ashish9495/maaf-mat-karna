/** Generates every texture procedurally so the game needs no image files to run. */
import Phaser from 'phaser';

const OUT = 0x2a1a24;

function gen(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function heartPath(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number) {
  g.fillCircle(cx - s * 0.5, cy - s * 0.2, s * 0.55);
  g.fillCircle(cx + s * 0.5, cy - s * 0.2, s * 0.55);
  g.fillTriangle(cx - s * 1.02, cy, cx + s * 1.02, cy, cx, cy + s * 1.05);
}

function chappal(g: Phaser.GameObjects.Graphics, w: number, h: number, sole: number, strap: number, line = 3) {
  const cx = w / 2, cy = h / 2;
  g.fillStyle(sole, 1);
  g.lineStyle(line, OUT, 1);
  g.fillEllipse(cx, cy, w - 6, h - 6);
  g.strokeEllipse(cx, cy, w - 6, h - 6);
  g.fillStyle(0xffffff, 0.35);
  g.fillEllipse(cx - w * 0.1, cy - h * 0.12, w * 0.55, h * 0.25);
  g.lineStyle(Math.max(3, h * 0.16), strap, 1);
  g.beginPath();
  g.moveTo(cx + w * 0.28, cy);
  g.lineTo(cx - w * 0.05, cy - h * 0.34);
  g.moveTo(cx + w * 0.28, cy);
  g.lineTo(cx - w * 0.05, cy + h * 0.34);
  g.strokePath();
  g.fillStyle(strap, 1);
  g.fillCircle(cx + w * 0.28, cy, h * 0.12);
}

export function generateTextures(scene: Phaser.Scene) {
  gen(scene, 'dot', 16, 16, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 8);
  });
  gen(scene, 'soft', 64, 64, (g) => {
    for (let i = 16; i > 0; i--) {
      g.fillStyle(0xffffff, 0.06);
      g.fillCircle(32, 32, i * 2);
    }
  });
  gen(scene, 'heart', 32, 32, (g) => {
    g.fillStyle(0xffffff, 1);
    heartPath(g, 16, 14, 10);
  });
  gen(scene, 'star', 32, 32, (g) => {
    g.fillStyle(0xffffff, 1);
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 6 : 15;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(new Phaser.Math.Vector2(16 + Math.cos(a) * r, 16 + Math.sin(a) * r));
    }
    g.fillPoints(pts, true);
  });
  gen(scene, 'feather', 28, 14, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(14, 7, 26, 10);
    g.lineStyle(1.5, 0xd8cfe8, 1);
    g.lineBetween(2, 7, 26, 7);
  });
  gen(scene, 'petal', 14, 10, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(7, 5, 13, 8);
  });
  gen(scene, 'confetti', 8, 12, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 8, 12);
  });
  gen(scene, 'cloud', 200, 90, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(60, 55, 32);
    g.fillCircle(100, 40, 38);
    g.fillCircle(140, 55, 30);
    g.fillRoundedRect(30, 50, 140, 36, 18);
  });

  // ---------- weapons ----------
  gen(scene, 'w-chappal', 48, 24, (g) => chappal(g, 48, 24, 0xff7eb6, 0xffd23f));
  gen(scene, 'w-ultimate', 130, 66, (g) => {
    for (let i = 8; i > 0; i--) {
      g.fillStyle(i % 2 ? 0xc77dff : 0xff7eb6, 0.07);
      g.fillEllipse(65, 33, 70 + i * 7, 30 + i * 4);
    }
    g.translateCanvas(25, 13);
    chappal(g, 80, 40, 0xff4fa3, 0xffe066, 4);
    g.translateCanvas(-25, -13);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(30, 18, 3);
    g.fillCircle(100, 50, 2.5);
    g.fillCircle(108, 16, 2);
  });
  gen(scene, 'w-pillow', 66, 46, (g) => {
    g.fillStyle(0xf6efff, 1);
    g.lineStyle(3, OUT, 1);
    g.beginPath();
    g.moveTo(6, 6);
    g.lineTo(33, 10);
    g.lineTo(60, 6);
    g.lineTo(56, 23);
    g.lineTo(60, 40);
    g.lineTo(33, 36);
    g.lineTo(6, 40);
    g.lineTo(10, 23);
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.fillStyle(0xffb3d1, 1);
    heartPath(g, 33, 21, 6);
  });
  gen(scene, 'w-cannon', 54, 34, (g) => {
    g.fillStyle(0xff6b8b, 1);
    g.lineStyle(3, OUT, 1);
    g.fillRoundedRect(8, 6, 42, 16, 7);
    g.strokeRoundedRect(8, 6, 42, 16, 7);
    g.fillStyle(0xffd23f, 1);
    g.fillRect(40, 5, 6, 18);
    g.fillStyle(0x8f5bd8, 1);
    g.fillCircle(16, 24, 8);
    g.strokeCircle(16, 24, 8);
  });
  gen(scene, 'w-blaster', 56, 32, (g) => {
    g.lineStyle(3, OUT, 1);
    g.fillStyle(0x49c6ff, 1);
    g.fillRoundedRect(6, 6, 44, 13, 6);
    g.strokeRoundedRect(6, 6, 44, 13, 6);
    g.fillStyle(0xffd23f, 1);
    g.fillRoundedRect(12, 15, 11, 15, 4);
    g.strokeRoundedRect(12, 15, 11, 15, 4);
    g.fillStyle(0xff7eb6, 1);
    g.fillCircle(30, 6, 6);
    g.strokeCircle(30, 6, 6);
  });
  gen(scene, 'p-emoji', 40, 40, (g) => {
    g.fillStyle(0xff5a3c, 1);
    g.lineStyle(3, OUT, 1);
    g.fillCircle(20, 20, 17);
    g.strokeCircle(20, 20, 17);
    g.fillStyle(0xffa26b, 0.6);
    g.fillCircle(15, 13, 6);
    g.lineStyle(3, OUT, 1);
    g.lineBetween(9, 13, 17, 17);
    g.lineBetween(31, 13, 23, 17);
    g.fillStyle(OUT, 1);
    g.fillCircle(14, 19, 2.6);
    g.fillCircle(26, 19, 2.6);
    g.beginPath();
    g.arc(20, 32, 7, Math.PI + 0.3, -0.3, false);
    g.strokePath();
  });
  gen(scene, 'p-water', 18, 18, (g) => {
    g.fillStyle(0x6fd3ff, 1);
    heartPath(g, 9, 8, 6);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(6, 6, 2);
  });
  gen(scene, 'golden-heart', 48, 48, (g) => {
    for (let i = 6; i > 0; i--) {
      g.fillStyle(0xffe066, 0.08);
      g.fillCircle(24, 24, 12 + i * 2.5);
    }
    g.fillStyle(0xffc93c, 1);
    heartPath(g, 24, 21, 12);
    g.fillStyle(0xfff6c2, 1);
    g.fillCircle(19, 16, 3);
  });
  gen(scene, 'chocolate', 30, 20, (g) => {
    g.fillStyle(0x7a4a2e, 1);
    g.lineStyle(2, OUT, 1);
    g.fillRoundedRect(2, 2, 26, 16, 3);
    g.strokeRoundedRect(2, 2, 26, 16, 3);
    g.fillStyle(0xd94b6a, 1);
    g.fillRect(16, 2, 12, 16);
    g.lineStyle(1, 0x5a341f, 1);
    g.lineBetween(9, 2, 9, 18);
  });

  // ---------------------------------------------------------------- new arsenal
  gen(scene, 'w-lipgloss', 24, 60, (g) => {
    g.lineStyle(3, OUT, 1);
    // gold cap with wand
    g.fillStyle(0xffd23f, 1);
    g.fillRoundedRect(6, 3, 12, 20, 4);
    g.strokeRoundedRect(6, 3, 12, 20, 4);
    g.fillStyle(0xfff3b0, 1);
    g.fillRect(8, 6, 3, 14);
    // glossy pink tube
    g.fillStyle(0xff4f9a, 1);
    g.fillRoundedRect(4, 22, 16, 34, 6);
    g.strokeRoundedRect(4, 22, 16, 34, 6);
    g.fillStyle(0xff9ec7, 1);
    g.fillRoundedRect(7, 25, 4, 26, 2);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(15, 30, 2);
    g.fillCircle(14, 45, 1.4);
  });
  gen(scene, 'p-momo', 44, 38, (g) => {
    g.lineStyle(3, OUT, 1);
    g.fillStyle(0xfff4e0, 1);
    g.beginPath();
    g.moveTo(4, 32);
    g.lineTo(40, 32);
    g.lineTo(36, 18);
    g.lineTo(28, 9);
    g.lineTo(22, 5);
    g.lineTo(16, 9);
    g.lineTo(8, 18);
    g.closePath();
    g.fillPath();
    g.strokePath();
    // pleats
    g.lineStyle(2, 0xd8c3a8, 1);
    g.lineBetween(22, 7, 13, 18);
    g.lineBetween(22, 7, 22, 19);
    g.lineBetween(22, 7, 31, 18);
    // cute face
    g.fillStyle(OUT, 1);
    g.fillCircle(16, 25, 2.2);
    g.fillCircle(28, 25, 2.2);
    g.lineStyle(2, OUT, 1);
    g.beginPath();
    g.arc(22, 26, 3, 0.2, Math.PI - 0.2, false);
    g.strokePath();
    g.fillStyle(0xff9ec7, 0.8);
    g.fillCircle(12, 28, 2.5);
    g.fillCircle(32, 28, 2.5);
  });
  gen(scene, 'p-pizza', 70, 70, (g) => {
    // flames behind
    g.fillStyle(0xff5a1e, 1);
    g.fillTriangle(10, 20, 22, 2, 30, 22);
    g.fillTriangle(36, 14, 50, 0, 56, 20);
    g.fillTriangle(56, 28, 70, 18, 62, 40);
    g.fillStyle(0xffc23f, 1);
    g.fillTriangle(15, 20, 22, 8, 27, 21);
    g.fillTriangle(41, 15, 50, 6, 53, 20);
    g.lineStyle(3, OUT, 1);
    // slice
    g.fillStyle(0xffd65a, 1);
    g.fillTriangle(8, 22, 62, 22, 35, 68);
    g.strokeTriangle(8, 22, 62, 22, 35, 68);
    // crust
    g.fillStyle(0xd98a3a, 1);
    g.fillRoundedRect(5, 16, 60, 11, 5);
    g.strokeRoundedRect(5, 16, 60, 11, 5);
    // pepperoni + chilli
    g.fillStyle(0xd9363e, 1);
    [[24, 34, 5], [42, 33, 5], [34, 48, 4.5]].forEach(([x, y, r]) => { g.fillCircle(x, y, r); g.strokeCircle(x, y, r); });
    g.fillStyle(0x4caf50, 1);
    g.fillRect(31, 38, 6, 3);
  });
  gen(scene, 'p-ticks', 52, 32, (g) => {
    g.lineStyle(7, OUT, 1);
    const tick = (x: number) => {
      g.beginPath();
      g.moveTo(x, 16);
      g.lineTo(x + 8, 25);
      g.lineTo(x + 22, 7);
      g.strokePath();
    };
    tick(5); tick(22);
    g.lineStyle(4, 0x2f9bff, 1);
    tick(5); tick(22);
  });
  gen(scene, 'w-phone', 26, 42, (g) => {
    g.lineStyle(3, OUT, 1);
    g.fillStyle(0x3a2a40, 1);
    g.fillRoundedRect(3, 3, 20, 36, 5);
    g.strokeRoundedRect(3, 3, 20, 36, 5);
    g.fillStyle(0xe6f4ff, 1);
    g.fillRoundedRect(6, 7, 14, 26, 2);
    g.lineStyle(2, 0x2f9bff, 1);
    g.beginPath();
    g.moveTo(8, 20); g.lineTo(10, 23); g.lineTo(14, 17);
    g.moveTo(12, 20); g.lineTo(14, 23); g.lineTo(18, 17);
    g.strokePath();
  });
  gen(scene, 'p-shock', 80, 46, (g) => {
    for (let i = 0; i < 3; i++) {
      g.lineStyle(7 - i * 2, [0xff3d3d, 0xff8a1e, 0xffd23f][i], 1 - i * 0.2);
      g.beginPath();
      g.arc(40, 46, 34 - i * 9, Math.PI, 0, false);
      g.strokePath();
    }
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(14, 30, 2.5);
    g.fillCircle(64, 28, 2.5);
  });
  gen(scene, 'anger', 40, 40, (g) => {
    // the classic anime anger mark
    g.lineStyle(6, 0xff2d55, 1);
    const arc = (cx: number, cy: number, a0: number) => {
      g.beginPath();
      g.arc(cx, cy, 9, a0, a0 + Math.PI / 2, false);
      g.strokePath();
    };
    arc(9, 9, 0); arc(31, 9, Math.PI / 2); arc(31, 31, Math.PI); arc(9, 31, -Math.PI / 2);
  });
  gen(scene, 'p-fire', 44, 44, (g) => {
    for (let i = 5; i > 0; i--) {
      g.fillStyle(0xff7a1e, 0.08);
      g.fillCircle(22, 22, 12 + i * 2);
    }
    g.lineStyle(3, OUT, 1);
    g.fillStyle(0xff4a1e, 1);
    g.fillCircle(22, 22, 13);
    g.strokeCircle(22, 22, 13);
    g.fillStyle(0xffa63c, 1);
    g.fillCircle(24, 20, 9);
    g.fillStyle(0xfff0a0, 1);
    g.fillCircle(25, 19, 4.5);
    // angry little eyebrows
    g.lineStyle(2.5, OUT, 1);
    g.lineBetween(14, 15, 20, 18);
    g.lineBetween(30, 15, 24, 18);
  });
  gen(scene, 'p-silent', 66, 50, (g) => {
    g.lineStyle(3, OUT, 1);
    g.fillStyle(0xd9dbe8, 1);
    [[18, 30, 14], [33, 22, 17], [49, 30, 14], [33, 34, 15]].forEach(([x, y, r]) => g.fillCircle(x, y, r));
    [[18, 30, 14], [33, 22, 17], [49, 30, 14]].forEach(([x, y, r]) => g.strokeCircle(x, y, r));
    g.fillStyle(0xd9dbe8, 1);
    g.fillRect(16, 30, 36, 14);
    g.lineBetween(14, 44, 54, 44);
    // zipped mouth
    g.lineStyle(3, OUT, 1);
    g.lineBetween(20, 34, 46, 34);
    g.lineStyle(2, OUT, 1);
    for (let x = 23; x < 45; x += 5) g.lineBetween(x, 31, x, 37);
    g.fillStyle(OUT, 1);
    g.fillCircle(25, 24, 2.4);
    g.fillCircle(41, 24, 2.4);
  });
  gen(scene, 'p-kiss', 50, 36, (g) => {
    g.lineStyle(3, OUT, 1);
    g.fillStyle(0xe5193f, 1);
    // upper lip (cupid's bow)
    g.beginPath();
    g.moveTo(4, 18);
    g.lineTo(13, 7);
    g.lineTo(20, 6);
    g.lineTo(25, 10);
    g.lineTo(30, 6);
    g.lineTo(37, 7);
    g.lineTo(46, 18);
    g.lineTo(25, 19);
    g.closePath();
    g.fillPath();
    g.strokePath();
    // lower lip
    g.beginPath();
    g.moveTo(4, 18);
    g.lineTo(46, 18);
    g.lineTo(38, 28);
    g.lineTo(25, 31);
    g.lineTo(12, 28);
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.fillStyle(0xff8aa5, 1);
    g.fillEllipse(30, 24, 10, 4);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(16, 11, 2);
  });
}
