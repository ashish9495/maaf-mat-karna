/**
 * Ashish ("Baby") — the fleeing NPC, driven by a finite-state machine.
 *
 * States: IDLE, FLEEING, PANICKING, DODGING, HIDING, STUMBLING, HURT, EXHAUSTED,
 *         EVENT (random comedy events), JUMP_OVER (escape when cornered),
 *         ESCAPING (leaves the level), COLLAPSED, CINEMATIC.
 *
 * Navigation: he reads the level's obstacle and platform lists and jumps over
 * obstacles ahead, hops onto platforms, escapes corners by leaping over the
 * player, and recovers if he hasn't made progress for a while.
 */
import Phaser from 'phaser';
import { Character } from './Character';
import { personalization } from '../config/personalization';
import { BOYFRIEND, GROUND_Y } from '../config/gameConfig';
import { dialogue } from '../config/dialogueConfig';
import { pick, t } from '../utils/helpers';
import type { BuiltWorld, HideSpot } from '../systems/Environment';
import type { WeaponDef } from '../config/weaponConfig';
import { AudioManager } from '../systems/AudioManager';
import { starsOverHead, burst } from '../utils/effects';

export type BfState =
  | 'IDLE' | 'FLEEING' | 'PANICKING' | 'DODGING' | 'HIDING' | 'STUMBLING' | 'HURT'
  | 'EXHAUSTED' | 'EVENT' | 'JUMP_OVER' | 'ESCAPING' | 'COLLAPSED' | 'CINEMATIC'
  /** hit by Beautiful Eyes / Spicy Kiss: stops and compliments her */
  | 'CHARMED'
  /** hit by the Silent Treatment: frozen on the spot */
  | 'FROZEN';

const L_SNAP = { hi: 'Arey! Hosh mein aao, BHAAGO! 🏃', en: 'Snap out of it! RUN! 🏃' };

type EventKind = 'fakeApology' | 'puppy' | 'wrongWay' | 'fall';

export interface BfContext {
  gf: { x: number; y: number };
  hpStage: number;
  levelIndex: number;
  levelWidth: number;
  world: BuiltWorld;
  projectiles: Phaser.GameObjects.GameObject[];
}

export class BoyfriendAI extends Character {
  state: BfState = 'IDLE';
  private stateUntil = 0;
  private dir: 1 | -1 = 1;
  private nextLineAt = 0;
  private lastLine = '';
  private nextEventAt = 0;
  private eventKind: EventKind | null = null;
  private eventPhase = 0;
  private boostUntil = 0;
  private slowUntil = 0;
  private heartsUntil = 0;
  private nextHeartAt = 0;
  private progressX = 0;
  private progressCheckAt = 0;
  private hideSpot: HideSpot | null = null;
  private hideCooldownUntil = 0;
  private dodged = new WeakSet<Phaser.GameObjects.GameObject>();
  private nextPlatformTry = 0;
  private nextRestAt = 0;
  invulnerableUntil = 0;
  stumbles = 0;
  reactedTo = new Set<string>();
  escapeTargetX = 0;
  onEscaped: () => void = () => {};
  onFoundHiding: () => void = () => {};
  onStumble: () => void = () => {};
  private chocolate: Phaser.GameObjects.Image | null = null;

  constructor(scene: Phaser.Scene, x: number) {
    super(scene, x, personalization.boyfriend.look, 'ashish');
    this.rig.setExpression('panic');
    const now = scene.time.now;
    this.nextEventAt = now + 8000;
    this.nextLineAt = now + 2500;
    this.nextRestAt = now + 12000;
  }

  setState(s: BfState, ms = 0) {
    this.state = s;
    this.stateUntil = this.scene.time.now + ms;
  }

  /** can be damaged right now? */
  vulnerable() {
    return !['COLLAPSED', 'CINEMATIC', 'ESCAPING'].includes(this.state) && this.scene.time.now > this.invulnerableUntil;
  }

  hitRect() {
    return new Phaser.Geom.Rectangle(this.body.x - 6, this.body.y + (this.state === 'HIDING' ? 30 : 0), this.body.width + 12, this.body.height - (this.state === 'HIDING' ? 30 : 0));
  }

  speak(text: string, ms = 1900, force = false) {
    const now = this.scene.time.now;
    if (!force && (now < this.nextLineAt || text === this.lastLine)) return;
    this.lastLine = text;
    this.say(text, ms);
    this.nextLineAt = now + 3800 + Math.random() * 3000;
  }

  /** Called by the level when a weapon connects. */
  takeHit(def: WeaponDef, dir: number, hpStage: number) {
    const now = this.scene.time.now;
    this.invulnerableUntil = now + def.iframes;
    this.cancelEvent();
    if (this.state === 'HIDING') this.hideSpot = null;
    const kb = def.knockback;
    this.dir = dir > 0 ? 1 : -1;
    this.rig.bounce(0.25);
    // every single hit: "fahhh"
    AudioManager.hitVoice();

    if (def.effect === 'charm') {
      // he stops dead, heart-eyed, and compliments her
      this.body.setVelocityX(0);
      this.rig.setExpression('happy');
      this.rig.facing = this.x > this.scene.cameras.main.midPoint.x ? -1 : 1;
      this.setState('CHARMED', def.effectMs);
      this.heartsUntil = now + def.effectMs;
      const lines = dialogue.bfCompliments[def.id] ?? dialogue.bfCompliments.eyes;
      const line = !this.reactedTo.has(def.id) ? dialogue.bfWeaponReact[def.id] : pick(lines);
      this.reactedTo.add(def.id);
      this.speak(t(line), def.effectMs + 300, true);
      if (!this.reactedTo.has(`${def.id}-2`)) {
        // first time: react, then a proper compliment right after
        this.reactedTo.add(`${def.id}-2`);
        this.scene.time.delayedCall(1100, () => {
          if (this.state === 'CHARMED') this.speak(t(pick(lines)), def.effectMs, true);
        });
      }
      return;
    }

    if (def.effect === 'freeze') {
      this.body.setVelocityX(0);
      this.rig.setExpression('sad');
      this.setState('FROZEN', def.effectMs);
      const line = !this.reactedTo.has(def.id) ? dialogue.bfWeaponReact[def.id] : pick(dialogue.bfFrozen);
      this.reactedTo.add(def.id);
      this.speak(t(line), def.effectMs, true);
      return;
    }

    this.body.setVelocityX(dir * kb);
    if (def.kind !== 'stream' && def.kind !== 'shockwave') this.body.setVelocityY(Math.min(this.body.velocity.y, -Math.min(420, kb * 0.8)));
    if (def.kind === 'shockwave') this.body.setVelocityY(-420); // bounced off the ground
    this.rig.setExpression('hurt');
    this.setState('HURT', def.kind === 'stream' ? 120 : 380);
    if (def.effect === 'slow') this.slowUntil = now + def.effectMs;
    if (['arc', 'melee', 'charge', 'boomerang', 'shockwave'].includes(def.kind)) {
      starsOverHead(this.scene, () => this.rig.headTop(), 900);
    }
    if (!this.reactedTo.has(def.id) && dialogue.bfWeaponReact[def.id]) {
      this.reactedTo.add(def.id);
      this.speak(t(dialogue.bfWeaponReact[def.id]), 2000, true);
    } else if (Math.random() < 0.3) {
      this.speak(t(pick(hpStage >= 2 ? dialogue.bfHurtLow : dialogue.bfChase)), 1800);
    }
  }

  /** called when the player switches to a powerful weapon */
  panicAtWeapon() {
    if (['COLLAPSED', 'CINEMATIC', 'ESCAPING'].includes(this.state)) return;
    this.speak(t(dialogue.bfPanicPower), 2000, true);
    this.boostUntil = this.scene.time.now + 2000;
    this.rig.setExpression('shock');
  }

  startEscape(toX: number) {
    this.cancelEvent();
    this.escapeTargetX = toX;
    this.setState('ESCAPING');
    this.speak(t(dialogue.randomEvents.escape), 2400, true);
  }

  collapse() {
    this.cancelEvent();
    this.setState('COLLAPSED');
    this.body.setVelocityX(0);
  }

  private cancelEvent() {
    this.eventKind = null;
    this.chocolate?.destroy();
    this.chocolate = null;
  }

  private speedFor(stage: number) {
    const now = this.scene.time.now;
    let k = [1, 0.9, 0.78, 0.86, 0][stage] ?? 1;
    if (now < this.boostUntil) k *= 1.35;
    if (now < this.slowUntil) k *= 0.6;
    return BOYFRIEND.baseSpeed * k;
  }

  private jump(power = 1) {
    if (!this.grounded()) return false;
    this.body.setVelocityY(-BOYFRIEND.jump * power);
    this.rig.bounce(-0.2);
    AudioManager.sfx('jump', { pitch: 0.8 });
    return true;
  }

  update(dt: number, ctx: BfContext) {
    const now = this.scene.time.now;
    const body = this.body;
    const dx = this.x - ctx.gf.x;
    const dist = Math.abs(dx);
    const grounded = this.grounded();
    const stage = ctx.hpStage;
    const rig = this.rig;

    // landing feedback
    if (grounded && !this.wasGrounded) {
      rig.bounce(0.2);
      burst(this.scene, this.x, this.feetY, 'dot', { count: 5, tint: 0xffffff, speed: 100, scale: 0.4, life: 300, gravity: 0 });
    }
    this.wasGrounded = grounded;

    const expired = now >= this.stateUntil;

    switch (this.state) {
      case 'IDLE':
        body.setVelocityX(0);
        rig.pose = 'idle';
        if (dist < 600) this.setState('FLEEING');
        break;

      case 'HURT':
        rig.pose = 'hurt';
        body.setVelocityX(body.velocity.x * 0.92);
        if (expired && grounded) {
          this.setState('PANICKING', 900);
        } else if (expired && now > this.stateUntil + 900) {
          this.setState('PANICKING', 900);
        }
        break;

      case 'CHARMED':
        // dreamy, heart-eyed, swaying on the spot
        rig.pose = 'idle';
        rig.setExpression('happy');
        body.setVelocityX(body.velocity.x * 0.8);
        if (now < this.heartsUntil && now > this.nextHeartAt) {
          this.nextHeartAt = now + 220;
          const h = rig.headTop();
          burst(this.scene, h.x + (Math.random() - 0.5) * 40, h.y + 10, 'heart', { count: 1, tint: [0xff4f8b, 0xff9ec7], speed: 50, scale: 0.6, life: 900, gravity: -90 });
        }
        if (expired) {
          rig.setExpression('shock');
          this.speak(t(L_SNAP), 1200, true);
          this.setState('PANICKING', 700);
        }
        break;

      case 'FROZEN':
        rig.pose = 'idle';
        rig.setExpression('sad');
        body.setVelocityX(0);
        if (now > this.nextHeartAt) {
          this.nextHeartAt = now + 400;
          const h = rig.headTop();
          burst(this.scene, h.x, h.y + 4, 'soft', { count: 1, tint: 0xd9dbe8, speed: 20, scale: 0.6, life: 800, gravity: -40 });
        }
        if (expired) this.setState('PANICKING', 600);
        break;

      case 'STUMBLING': {
        const t0 = this.stateUntil - now;
        rig.pose = t0 > 500 ? 'stumble' : 'kneel';
        rig.setExpression('shock');
        body.setVelocityX(body.velocity.x * 0.9);
        if (expired) this.setState('PANICKING', 700);
        break;
      }

      case 'EXHAUSTED':
        rig.pose = 'idle';
        rig.setExpression('tired');
        body.setVelocityX(body.velocity.x * 0.85);
        if (expired || dist < 170) {
          if (dist < 170) this.speak(t(pick(dialogue.bfChase)), 1600, true);
          this.setState('PANICKING', 800);
        }
        break;

      case 'HIDING': {
        const spot = this.hideSpot;
        if (!spot) {
          this.setState('FLEEING');
          break;
        }
        const toSpot = spot.x - this.x;
        if (Math.abs(toSpot) > 12) {
          body.setVelocityX(Math.sign(toSpot) * this.speedFor(stage));
          rig.pose = 'panicRun';
          rig.setFacing(toSpot > 0 ? 1 : -1);
        } else {
          body.setVelocityX(0);
          rig.pose = 'hide';
          rig.setExpression('closed');
        }
        if (dist < 150) {
          this.speak(t(dialogue.randomEvents.found), 1800, true);
          this.onFoundHiding();
          this.hideSpot = null;
          this.boostUntil = now + 1200;
          this.setState('PANICKING', 900);
        } else if (expired) {
          this.hideSpot = null;
          this.setState('FLEEING');
        }
        break;
      }

      case 'EVENT':
        this.runEvent(now, dx, dist, stage);
        break;

      case 'JUMP_OVER':
        rig.pose = body.velocity.y < 0 ? 'jump' : 'fall';
        rig.setExpression('panic');
        if (grounded && expired) this.setState('FLEEING');
        break;

      case 'ESCAPING': {
        const toX = this.escapeTargetX - this.x;
        this.dir = toX > 0 ? 1 : -1;
        body.setVelocityX(this.dir * BOYFRIEND.baseSpeed * 1.25);
        rig.setFacing(this.dir);
        rig.pose = 'panicRun';
        rig.setExpression('panic');
        this.avoidObstacles(ctx);
        if (Math.abs(toX) < 30) {
          body.setVelocityX(0);
          this.setState('CINEMATIC');
          this.scene.tweens.add({ targets: this.rig, alpha: 0, duration: 400 });
          this.onEscaped();
        }
        break;
      }

      case 'COLLAPSED':
      case 'CINEMATIC':
        body.setVelocityX(body.velocity.x * 0.85);
        break;

      case 'DODGING':
        rig.pose = 'jump';
        rig.setExpression('shock');
        if (expired) this.setState('FLEEING');
        this.fleeMovement(dx, dist, stage, ctx, true);
        break;

      case 'PANICKING':
      case 'FLEEING':
      default:
        if (this.state === 'PANICKING' && expired) this.setState('FLEEING');
        this.fleeMovement(dx, dist, stage, ctx, false);
        this.considerSpecials(now, dist, stage, ctx);
        break;
    }

    // dodge incoming projectiles
    if (['FLEEING', 'PANICKING', 'EXHAUSTED'].includes(this.state)) this.tryDodge(ctx);

    this.syncRig(dt);
  }

  private fleeMovement(dx: number, dist: number, stage: number, ctx: BfContext, airOnly: boolean) {
    const now = this.scene.time.now;
    const body = this.body;
    const rig = this.rig;
    const margin = 110;

    // pick direction: away from the girlfriend
    let desired: 1 | -1 = dx >= 0 ? 1 : -1;
    const nearLeft = this.x < margin;
    const nearRight = this.x > ctx.levelWidth - margin;
    const cornered = (desired === -1 && nearLeft) || (desired === 1 && nearRight);

    if (cornered && dist < 300 && this.grounded()) {
      // leap over her
      this.dir = desired === 1 ? -1 : 1;
      body.setVelocityY(-BOYFRIEND.jump * 1.12);
      body.setVelocityX(this.dir * 430);
      rig.setFacing(this.dir);
      this.setState('JUMP_OVER', 400);
      this.speak(t(dialogue.randomEvents.cornered), 1500, Math.random() < 0.5);
      return;
    }
    if (cornered) desired = desired === 1 ? -1 : 1;
    this.dir = desired;

    const relaxed = dist > 560 && this.state !== 'PANICKING';
    const speed = this.speedFor(stage) * (relaxed ? 0.45 : 1);
    if (!airOnly || !this.grounded()) body.setVelocityX(this.dir * speed);
    rig.setFacing(this.dir);
    rig.runSpeed = speed / BOYFRIEND.baseSpeed;
    if (this.grounded()) {
      rig.pose = relaxed ? 'lookBack' : 'panicRun';
      if (relaxed && Math.abs(body.velocity.x) < 10) rig.pose = 'idle';
    } else rig.pose = body.velocity.y < 0 ? 'jump' : 'fall';

    // expressions by health stage
    const cryCycle = Math.floor(now / 1200) % 2 === 0;
    const expr = stage === 0 ? (dist < 320 ? 'panic' : 'normal') : stage === 1 ? (cryCycle ? 'cry' : 'panic') : stage === 2 ? (cryCycle ? 'tired' : 'cry') : 'cry';
    if (now > this.invulnerableUntil) rig.setExpression(expr);

    this.avoidObstacles(ctx);

    // hop onto platforms now and then
    if (this.grounded() && now > this.nextPlatformTry) {
      this.nextPlatformTry = now + 1500 + Math.random() * 2000;
      const p = ctx.world.platformRects.find((r) => {
        const ahead = this.dir === 1 ? r.x1 - this.x : this.x - r.x2;
        const reachable = this.feetY - r.y < 210 && this.feetY - r.y > 30;
        return ahead > 20 && ahead < 220 && reachable;
      });
      if (p && Math.random() < 0.55) this.jump(1);
    }

    // stuck recovery
    if (now > this.progressCheckAt) {
      const moved = Math.abs(this.x - this.progressX);
      if (moved < 14 && dist < 420 && this.state === 'FLEEING') {
        this.dir = this.dir === 1 ? -1 : 1;
        this.jump(1.05);
        body.setVelocityX(this.dir * speed);
      }
      this.progressX = this.x;
      this.progressCheckAt = now + 1300;
    }

    // contextual chatter
    if (dist < 380 && now > this.nextLineAt) {
      const pool = stage >= 2 && Math.random() < 0.6 ? dialogue.bfHurtLow : dialogue.bfChase;
      this.speak(t(pick(pool)), 2000);
    }
  }

  private avoidObstacles(ctx: BfContext) {
    if (!this.grounded()) return;
    const ahead = ctx.world.obstacles.find((o) => {
      const d = this.dir === 1 ? o.x1 - this.x : this.x - o.x2;
      return d > 0 && d < 80 && this.feetY > o.top + 5;
    });
    const blocked = (this.dir === 1 && this.body.blocked.right) || (this.dir === -1 && this.body.blocked.left);
    if (ahead || blocked) this.jump(ahead ? 0.85 : 1);
  }

  private tryDodge(ctx: BfContext) {
    if (!this.grounded()) return;
    const chance = [0.2, 0.34, 0.22][ctx.levelIndex] * (ctx.hpStage >= 2 ? 0.6 : 1);
    for (const obj of ctx.projectiles) {
      if (this.dodged.has(obj)) continue;
      const p = obj as Phaser.Physics.Arcade.Image;
      const b = p.body as Phaser.Physics.Arcade.Body | null;
      if (!b) continue;
      const toMe = this.x - p.x;
      if (Math.abs(toMe) < 200 && Math.sign(b.velocity.x) === Math.sign(toMe) && Math.abs(p.y - this.y) < 120) {
        this.dodged.add(obj);
        if (Math.random() < chance) {
          this.jump(1.0);
          this.setState('DODGING', 380);
          return;
        }
      }
    }
  }

  private considerSpecials(now: number, dist: number, stage: number, ctx: BfContext) {
    if (!this.grounded() || this.state !== 'FLEEING') return;

    // stumble — more often when hurt
    // chance per second, evaluated per frame (~60fps)
    const stumbleRate = [0.04, 0.09, 0.13, 0.09][stage] ?? 0;
    if (dist < 500 && Math.random() < stumbleRate / 60) {
      this.doStumble();
      return;
    }

    // catch breath when exhausted
    if (stage >= 2 && now > this.nextRestAt && dist > 260) {
      this.nextRestAt = now + 9000 + Math.random() * 6000;
      this.setState('EXHAUSTED', 1300);
      this.speak(t(pick(dialogue.bfHurtLow)), 1500, true);
      return;
    }

    // hide in a bush ahead
    if (now > this.hideCooldownUntil && dist > 360) {
      const spot = ctx.world.hideSpots.find((s) => {
        const ahead = this.dir === 1 ? s.x - this.x : this.x - s.x;
        return ahead > 40 && ahead < 320;
      });
      if (spot && Math.random() < 0.02) {
        this.hideSpot = spot;
        this.hideCooldownUntil = now + 15000;
        this.setState('HIDING', 2600 + Math.random() * 1600);
        this.speak(t(dialogue.randomEvents.hide), 2000, true);
        return;
      }
    }

    // random comedy events
    if (now > this.nextEventAt && dist > 260 && dist < 650) {
      this.nextEventAt = now + 10000 + Math.random() * 7000;
      const kinds: EventKind[] = ['fakeApology', 'puppy', 'wrongWay', 'fall'];
      this.eventKind = pick(kinds);
      if (this.eventKind === 'fall') {
        this.speak(t(dialogue.randomEvents.fall), 1500, true);
        this.doStumble();
        this.eventKind = null;
        return;
      }
      this.eventPhase = 0;
      this.setState('EVENT', 99999);
      this.stateUntil = now;
    }
  }

  doStumble() {
    this.setState('STUMBLING', 1100);
    this.stumbles++;
    AudioManager.sfx('land');
    burst(this.scene, this.x + this.dir * 20, GROUND_Y, 'dot', { count: 10, tint: 0xffffff, speed: 160, scale: 0.5, life: 400, gravity: 0 });
    this.onStumble();
  }

  private runEvent(now: number, dx: number, dist: number, stage: number) {
    const body = this.body;
    const rig = this.rig;
    const towardGf: 1 | -1 = dx > 0 ? -1 : 1;
    if (!this.eventKind) {
      this.setState('FLEEING');
      return;
    }
    // abort if she gets very close
    if (dist < 120 && this.eventKind !== 'wrongWay') {
      this.cancelEvent();
      this.setState('PANICKING', 800);
      return;
    }
    const phaseDone = now >= this.stateUntil;
    switch (this.eventKind) {
      case 'fakeApology':
        if (this.eventPhase === 0) {
          body.setVelocityX(0);
          rig.setFacing(towardGf);
          rig.pose = 'beg';
          rig.setExpression('puppy');
          this.speak(t(dialogue.randomEvents.fakeApology), 1500, true);
          this.chocolate = this.scene.add.image(this.x + towardGf * 30, this.y - 40, 'chocolate').setDepth(60);
          this.eventPhase = 1;
          this.stateUntil = now + 1500;
        } else if (this.eventPhase === 1) {
          this.chocolate?.setPosition(this.x + towardGf * 30, this.y - 20 + Math.sin(now / 120) * 3);
          if (phaseDone) {
            this.chocolate?.destroy();
            this.chocolate = null;
            this.speak(t(dialogue.randomEvents.fakeApologyRun), 1500, true);
            this.boostUntil = now + 1400;
            this.eventKind = null;
            this.setState('PANICKING', 1200);
          }
        }
        break;
      case 'puppy':
        if (this.eventPhase === 0) {
          body.setVelocityX(0);
          rig.setFacing(towardGf);
          rig.pose = 'idle';
          rig.setExpression('puppy');
          this.speak(t(dialogue.randomEvents.puppyEyes), 1300, true);
          this.eventPhase = 1;
          this.stateUntil = now + 1300;
        } else if (phaseDone) {
          this.eventKind = null;
          this.setState('PANICKING', 900);
        }
        break;
      case 'wrongWay':
        if (this.eventPhase === 0) {
          this.eventPhase = 1;
          this.stateUntil = now + 650;
          rig.setExpression('happy');
        }
        if (this.eventPhase === 1) {
          body.setVelocityX(towardGf * this.speedFor(stage) * 0.9);
          rig.setFacing(towardGf);
          rig.pose = 'run';
          if (phaseDone || dist < 160) {
            rig.setExpression('shock');
            this.speak(t(dialogue.randomEvents.wrongWay), 1600, true);
            body.setVelocityX(0);
            this.eventPhase = 2;
            this.stateUntil = now + 350;
          }
        } else if (this.eventPhase === 2) {
          rig.pose = 'hurt';
          if (phaseDone) {
            this.boostUntil = now + 1200;
            this.eventKind = null;
            this.setState('PANICKING', 900);
          }
        }
        break;
      default:
        this.eventKind = null;
        this.setState('FLEEING');
    }
  }
}
