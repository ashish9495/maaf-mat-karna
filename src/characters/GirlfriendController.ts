/**
 * The player character (Khushi / "Mumma").
 * Acceleration-based movement, coyote time, jump buffering, variable jump height,
 * dash with cooldown + afterimages, squash & stretch and landing dust.
 */
import Phaser from 'phaser';
import { Character } from './Character';
import { personalization } from '../config/personalization';
import { PLAYER } from '../config/gameConfig';
import type { InputManager } from '../systems/InputManager';
import { AudioManager } from '../systems/AudioManager';
import { burst } from '../utils/effects';

export class GirlfriendController extends Character {
  private coyote = 0;
  private jumpBuffer = 0;
  private dashUntil = 0;
  private lastDash = -9999;
  private dashDir: 1 | -1 = 1;
  private attackPoseUntil = 0;
  private laughUntil = 0;
  locked = false;
  /** stats for tutorial prompts */
  didMove = false;
  didJump = false;
  didDash = false;
  speedMul = 1;

  constructor(scene: Phaser.Scene, x: number) {
    super(scene, x, personalization.girlfriend.look, 'khushi');
    this.rig.setExpression('evil');
    this.rig.setDepth(52);
  }

  dashReady() {
    return this.scene.time.now - this.lastDash > PLAYER.dashCooldown;
  }

  dashProgress() {
    return Phaser.Math.Clamp((this.scene.time.now - this.lastDash) / PLAYER.dashCooldown, 0, 1);
  }

  showAttack(ms = 220) {
    this.attackPoseUntil = this.scene.time.now + ms;
    this.rig.triggerAttack();
  }

  laugh(ms = 900) {
    this.laughUntil = this.scene.time.now + ms;
    this.rig.setExpression('evil');
    AudioManager.sfx('laugh');
  }

  update(dt: number, input: InputManager, aimAngle: number) {
    const now = this.scene.time.now;
    const s = dt / 1000;
    const body = this.body;
    const grounded = this.grounded();

    if (grounded) this.coyote = 0.1;
    else this.coyote -= s;
    if (input.jumpPressed) this.jumpBuffer = 0.12;
    else this.jumpBuffer -= s;

    let dir = 0;
    if (!this.locked) {
      if (input.left) dir -= 1;
      if (input.right) dir += 1;
    }
    if (dir !== 0) {
      this.didMove = true;
      this.rig.setFacing(dir as 1 | -1);
    }

    const dashing = now < this.dashUntil;
    if (!this.locked && input.dashPressed && this.dashReady()) {
      this.lastDash = now;
      this.dashUntil = now + PLAYER.dashTime;
      this.dashDir = dir !== 0 ? (dir as 1 | -1) : this.rig.facing;
      this.didDash = true;
      AudioManager.sfx('dash');
      this.rig.bounce(-0.12);
      this.afterimages();
    }

    if (dashing) {
      body.setVelocityX(this.dashDir * PLAYER.dashSpeed);
      body.setVelocityY(Math.min(body.velocity.y, 60));
    } else {
      const target = dir * PLAYER.speed * this.speedMul;
      const accel = (dir !== 0 ? PLAYER.accel : PLAYER.decel) * (grounded ? 1 : PLAYER.airControl);
      const vx = body.velocity.x;
      const diff = target - vx;
      const step = Math.sign(diff) * Math.min(Math.abs(diff), accel * s);
      body.setVelocityX(vx + step);
    }

    if (!this.locked && this.jumpBuffer > 0 && this.coyote > 0) {
      body.setVelocityY(-PLAYER.jump);
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.didJump = true;
      this.rig.bounce(-0.2);
      AudioManager.sfx('jump');
      burst(this.scene, this.x, this.feetY, 'dot', { count: 6, tint: 0xffffff, speed: 120, scale: 0.5, life: 300, gravity: -50 });
    }
    // variable jump height
    if (!input.jumpHeld && body.velocity.y < -250) body.setVelocityY(body.velocity.y * 0.9);

    // landing
    if (grounded && !this.wasGrounded) {
      this.rig.bounce(0.22);
      AudioManager.sfx('land');
      burst(this.scene, this.x, this.feetY, 'dot', { count: 8, tint: [0xffffff, 0xffe1ef], speed: 140, scale: 0.45, life: 350, gravity: 0 });
    }
    this.wasGrounded = grounded;

    // aim facing when attacking with mouse
    if (now < this.attackPoseUntil) {
      this.rig.setFacing(Math.cos(aimAngle) >= 0 ? 1 : -1);
    }

    // choose pose
    const rig = this.rig;
    rig.aimAngle = aimAngle;
    if (dashing) rig.pose = 'dash';
    else if (!grounded) rig.pose = body.velocity.y < 0 ? 'jump' : 'fall';
    else if (now < this.attackPoseUntil) rig.pose = 'attack';
    else if (Math.abs(body.velocity.x) > 40) {
      rig.pose = 'run';
      rig.runSpeed = Math.abs(body.velocity.x) / PLAYER.speed;
      AudioManager.sfx('step', { pitch: 1.2 });
    } else if (now < this.laughUntil) rig.pose = 'laugh';
    else rig.pose = 'idle';
    if ((rig.pose === 'attack') && (now >= this.attackPoseUntil)) rig.pose = 'idle';

    this.syncRig(dt);
  }

  private afterimages() {
    for (let i = 0; i < 4; i++) {
      this.scene.time.delayedCall(i * 40, () => {
        const ghost = this.scene.add.ellipse(this.x, this.y, 46, 100, 0xff9ec7, 0.35).setDepth(40);
        this.scene.tweens.add({ targets: ghost, alpha: 0, scaleX: 0.6, duration: 260, onComplete: () => ghost.destroy() });
      });
    }
  }

  /** world position of the throwing hand */
  handPos() {
    return { x: this.x + this.rig.facing * 22, y: this.y - 18, facing: this.rig.facing };
  }
}
