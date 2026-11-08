/** Shared base: an invisible arcade-physics body with a CharacterRig that follows it. */
import Phaser from 'phaser';
import { CharacterRig, type HairStyle } from './CharacterRig';
import type { CharacterLook } from '../config/personalization';
import { SpeechBubble } from '../utils/effects';
import { GROUND_Y } from '../config/gameConfig';

export const BODY_W = 40;
export const BODY_H = 104;

export class Character {
  scene: Phaser.Scene;
  rect: Phaser.GameObjects.Rectangle;
  body: Phaser.Physics.Arcade.Body;
  rig: CharacterRig;
  bubble: SpeechBubble | null = null;
  wasGrounded = true;

  constructor(scene: Phaser.Scene, x: number, look: CharacterLook, style: HairStyle) {
    this.scene = scene;
    this.rect = scene.add.rectangle(x, GROUND_Y - BODY_H / 2, BODY_W, BODY_H, 0xff0000, 0);
    scene.physics.add.existing(this.rect);
    this.body = this.rect.body as Phaser.Physics.Arcade.Body;
    this.body.setCollideWorldBounds(true);
    this.rig = new CharacterRig(scene, x, GROUND_Y, look, style, 1);
    this.rig.setDepth(50);
  }

  get x() { return this.rect.x; }
  get y() { return this.rect.y; }
  get feetY() { return this.body.bottom; }

  grounded() {
    return this.body.blocked.down || this.body.touching.down;
  }

  headTop = () => this.rig.headTop();

  say(text: string, ms = 2000, tint = 0xffffff, big = false) {
    this.bubble?.pop();
    this.bubble = new SpeechBubble(this.scene, this, text, ms, tint, big);
  }

  syncRig(dt: number) {
    this.rig.setPosition(this.rect.x, this.body.bottom);
    // shadow stays on the surface below
    const ground = this.grounded() ? 0 : Math.max(0, GROUND_Y - this.body.bottom);
    this.rig.setAirHeight(this.grounded() ? 0 : Math.min(ground, 400));
    this.rig.tick(dt);
    if (this.bubble) {
      this.bubble.tick(dt);
      if (this.bubble.dead) this.bubble = null;
    }
  }

  destroy() {
    this.bubble?.destroy();
    this.rig.destroy();
    this.rect.destroy();
  }
}
