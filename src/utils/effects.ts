/** Reusable visual effects: speech bubbles, floating text, particle bursts, screen effects. */
import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager';
import { motionScale } from './helpers';

export class SpeechBubble extends Phaser.GameObjects.Container {
  private target: { headTop: () => { x: number; y: number } };
  private life: number;
  private bg: Phaser.GameObjects.Graphics;
  private txt: Phaser.GameObjects.Text;
  dead = false;
  private halfW = 0;

  constructor(scene: Phaser.Scene, target: { headTop: () => { x: number; y: number } }, text: string, ms = 2200, tint = 0xffffff, big = false) {
    super(scene, 0, 0);
    this.target = target;
    this.life = ms;
    this.txt = scene.add.text(0, 0, text, {
      fontFamily: '"Baloo 2", "Nunito", sans-serif',
      fontSize: big ? '26px' : '20px',
      color: '#3b1f2b',
      fontStyle: '700',
      align: 'center',
      wordWrap: { width: big ? 420 : 260 },
    }).setOrigin(0.5, 1);
    const w = this.txt.width + 26;
    const h = this.txt.height + 16;
    this.halfW = w / 2;
    this.bg = scene.add.graphics();
    this.bg.fillStyle(0x000000, 0.12);
    this.bg.fillRoundedRect(-w / 2 + 3, -h - 12 + 4, w, h, 16);
    this.bg.fillStyle(tint, 1);
    this.bg.lineStyle(3, 0x3b1f2b, 1);
    this.bg.fillRoundedRect(-w / 2, -h - 12, w, h, 16);
    this.bg.strokeRoundedRect(-w / 2, -h - 12, w, h, 16);
    this.bg.fillTriangle(-8, -13.5, 8, -13.5, 0, 0);
    this.bg.lineBetween(-8, -12, 0, 0);
    this.bg.lineBetween(8, -12, 0, 0);
    this.txt.setY(-20);
    this.add([this.bg, this.txt]);
    this.setDepth(900);
    this.setScale(0.2);
    scene.add.existing(this);
    scene.tweens.add({ targets: this, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.follow();
  }

  follow() {
    const p = this.target.headTop();
    // keep the bubble on screen near screen edges
    const view = this.scene.cameras.main.worldView;
    const margin = this.halfW + 10;
    const x = view.width > margin * 2 ? Phaser.Math.Clamp(p.x, view.x + margin, view.right - margin) : p.x;
    const y = Math.max(p.y - 6, view.y + 90);
    this.setPosition(x, y);
  }

  tick(dt: number) {
    if (this.dead) return;
    this.follow();
    this.life -= dt;
    if (this.life <= 0) this.pop();
  }

  pop() {
    if (this.dead) return;
    this.dead = true;
    this.scene.tweens.add({ targets: this, scale: 0, alpha: 0, duration: 160, onComplete: () => this.destroy() });
  }
}

export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color = '#ff3d7f', size = 30) {
  const t = scene.add.text(x, y, text, {
    fontFamily: '"Baloo 2", sans-serif',
    fontSize: `${size}px`,
    fontStyle: '800',
    color,
    stroke: '#ffffff',
    strokeThickness: 6,
  }).setOrigin(0.5).setDepth(950);
  scene.tweens.add({ targets: t, y: y - 70, alpha: 0, scale: 1.3, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
}

export function burst(scene: Phaser.Scene, x: number, y: number, texture: string, opts: { count?: number; tint?: number | number[]; speed?: number; scale?: number; life?: number; gravity?: number; depth?: number; rotate?: boolean } = {}) {
  const count = Math.max(1, Math.round((opts.count ?? 12) * motionScale()));
  const em = scene.add.particles(x, y, texture, {
    speed: { min: (opts.speed ?? 260) * 0.4, max: opts.speed ?? 260 },
    angle: { min: 0, max: 360 },
    scale: { start: opts.scale ?? 0.8, end: 0 },
    lifespan: opts.life ?? 700,
    gravityY: opts.gravity ?? 300,
    rotate: opts.rotate ? { min: 0, max: 360 } : 0,
    tint: opts.tint ?? 0xffffff,
    emitting: false,
  });
  em.setDepth(opts.depth ?? 800);
  em.explode(count);
  scene.time.delayedCall((opts.life ?? 700) + 100, () => em.destroy());
  return em;
}

export function starsOverHead(scene: Phaser.Scene, getPos: () => { x: number; y: number }, ms = 1200) {
  const stars: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < 3; i++) {
    stars.push(scene.add.image(0, 0, 'star').setScale(0.6).setTint(0xffe066).setDepth(850));
  }
  const start = scene.time.now;
  const ev = scene.time.addEvent({
    delay: 16,
    loop: true,
    callback: () => {
      const t = (scene.time.now - start) / 1000;
      const p = getPos();
      stars.forEach((s, i) => {
        const a = t * 6 + (i * Math.PI * 2) / 3;
        s.setPosition(p.x + Math.cos(a) * 30, p.y + Math.sin(a) * 8);
        s.rotation = t * 4;
      });
      if (scene.time.now - start > ms) {
        ev.remove();
        stars.forEach((s) => s.destroy());
      }
    },
  });
}

export function shake(scene: Phaser.Scene, intensity = 0.006, ms = 160) {
  if (!SaveManager.settings.screenShake || SaveManager.settings.reducedMotion) return;
  scene.cameras.main.shake(ms, intensity);
}

export function flash(scene: Phaser.Scene, ms = 200, r = 255, g = 255, b = 255) {
  if (SaveManager.settings.reducedMotion) return;
  scene.cameras.main.flash(ms, r, g, b);
}

/** Brief slow-motion hit-stop. */
export function hitStop(scene: Phaser.Scene, scale = 0.25, ms = 120) {
  if (SaveManager.settings.reducedMotion) return;
  scene.time.timeScale = scale;
  scene.physics.world.timeScale = 1 / scale;
  window.setTimeout(() => {
    if (!scene.sys || !scene.time) return;
    scene.time.timeScale = 1;
    scene.physics.world.timeScale = 1;
  }, ms);
}
