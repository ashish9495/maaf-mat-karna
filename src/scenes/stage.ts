/** Shared garden staging for the final cinematic and the endings. */
import Phaser from 'phaser';
import { GAME_H, GAME_W, GROUND_Y, LEVELS } from '../config/gameConfig';
import { personalization } from '../config/personalization';
import { CharacterRig } from '../characters/CharacterRig';
import { buildWorld } from '../systems/Environment';
import { SpeechBubble } from '../utils/effects';
import { motionScale } from '../utils/helpers';

export const STAGE_CENTER = 1400;

export interface Stage {
  gf: CharacterRig;
  bf: CharacterRig;
  warm: Phaser.GameObjects.Rectangle;
  vignette: Phaser.GameObjects.RenderTexture;
  bubbles: SpeechBubble[];
  hearts: Phaser.GameObjects.Particles.ParticleEmitter;
  tick: (dt: number) => void;
  say: (who: 'gf' | 'bf', text: string, ms?: number) => void;
}

export function buildStage(scene: Phaser.Scene): Stage {
  buildWorld(scene, LEVELS[2]);
  const cam = scene.cameras.main;
  cam.setBounds(0, 0, LEVELS[2].width, GAME_H);
  cam.centerOn(STAGE_CENTER, GAME_H / 2);

  const gf = new CharacterRig(scene, STAGE_CENTER - 260, GROUND_Y, personalization.girlfriend.look, 'khushi', 1.15).setDepth(50);
  const bf = new CharacterRig(scene, STAGE_CENTER + 110, GROUND_Y, personalization.boyfriend.look, 'ashish', 1.15).setDepth(50);
  gf.setFacing(1);
  bf.setFacing(-1);

  // warm golden light used during the emotional turn
  const warm = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xffa94d, 0).setScrollFactor(0).setDepth(400).setBlendMode(Phaser.BlendModes.ADD);
  const vg = scene.add.graphics().setScrollFactor(0).setDepth(401);
  for (let i = 0; i < 12; i++) {
    vg.lineStyle(60, 0x1a0f2a, 0.06);
    vg.strokeRect(-20 + i * 6, -20 + i * 6, GAME_W + 40 - i * 12, GAME_H + 40 - i * 12);
  }
  // bake the static vignette into a texture once
  const vrt = scene.make.renderTexture({ x: 0, y: 0, width: GAME_W, height: GAME_H }, false).setOrigin(0, 0);
  vrt.draw(vg, 0, 0);
  vg.destroy();
  const vignette = scene.add.existing(vrt).setScrollFactor(0).setDepth(401).setAlpha(0);

  const hearts = scene.add.particles(0, 0, 'heart', {
    x: { min: STAGE_CENTER - 500, max: STAGE_CENTER + 500 },
    y: GROUND_Y + 20,
    speedY: { min: -110, max: -50 },
    speedX: { min: -25, max: 25 },
    lifespan: 6500,
    frequency: Math.round(220 / motionScale()),
    scale: { start: 0.7, end: 0.2 },
    alpha: { start: 0.9, end: 0 },
    tint: [0xff4f8b, 0xff9ec7, 0xffc93c, 0xffffff],
    emitting: false,
  });
  hearts.setDepth(60);

  const stage: Stage = {
    gf, bf, warm, vignette, hearts, bubbles: [],
    tick: (dt: number) => {
      gf.tick(dt);
      bf.tick(dt);
      stage.bubbles = stage.bubbles.filter((b) => {
        b.tick(dt);
        return !b.dead;
      });
    },
    say: (who, text, ms = 2200) => {
      stage.bubbles.forEach((b) => b.pop());
      stage.bubbles.push(new SpeechBubble(scene, who === 'gf' ? gf : bf, text, ms, who === 'gf' ? 0xffe1ef : 0xffffff, true));
    },
  };
  return stage;
}

/** Camera colour grading (WebGL only — silently skipped on canvas renderers). */
export class Grade {
  private cm: Phaser.FX.ColorMatrix | null = null;
  sat = 0;
  constructor(scene: Phaser.Scene) {
    try {
      if (scene.renderer.type === Phaser.WEBGL) this.cm = scene.cameras.main.postFX.addColorMatrix();
    } catch {
      this.cm = null;
    }
  }
  set(v: number) {
    this.sat = v;
    if (!this.cm) return;
    this.cm.reset();
    this.cm.saturate(v);
  }
}
