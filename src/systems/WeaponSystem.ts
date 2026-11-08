/**
 * WeaponSystem — inventory, switching, cooldowns, projectiles and hit checks.
 *
 * Every weapon kind has its own mechanic:
 *   arc (chappal, lipgloss) · melee (pillow) · straight (emoji, blue ticks, silent treatment)
 *   stream (water) · charge (ultimate) · spread (momos) · boomerang (pizza)
 *   beam (beautiful eyes) · shockwave (tantrum) · bounce (fireballs) · homing (spicy kiss)
 */
import Phaser from 'phaser';
import { WEAPONS, WEAPON_ORDER, type WeaponDef, type WeaponId } from '../config/weaponConfig';
import { AudioManager } from './AudioManager';
import { burst, shake } from '../utils/effects';
import { GROUND_Y } from '../config/gameConfig';
import { SaveManager } from './SaveManager';

export interface WeaponHooks {
  /** world position of the throwing hand */
  origin: () => { x: number; y: number; facing: 1 | -1 };
  /** world position between her eyes (for the Beautiful Eyes beam) */
  eyes: () => { x: number; y: number };
  /** her feet (for the tantrum stomp) */
  feet: () => { x: number; y: number };
  /** called when something connects. return true if the hit counted */
  hit: (w: WeaponDef, x: number, y: number, dir: number) => boolean;
  /** target body for melee / overlap */
  targetRect: () => Phaser.Geom.Rectangle | null;
  onSwing: (w: WeaponDef) => void;
  onCharge: (charging: boolean) => void;
  onUnlock: (w: WeaponDef) => void;
  onMiss: () => void;
  onChange: () => void;
}

interface ProjData {
  def: WeaponDef;
  born: number;
  hit: boolean;
  spin: number;
  /** extra projectiles of a volley don't count as separate misses */
  quietMiss?: boolean;
  bounces?: number;
  returning?: boolean;
  /** lifetime counted in (clamped) frame time, so range stays the same on slow devices */
  age: number;
}

/** projectile kinds that fly with gravity */
const GRAVITY: Partial<Record<WeaponDef['kind'], number>> = {
  arc: 900,
  stream: 500,
  charge: 250,
  spread: 280,
  bounce: 1300,
};

export class WeaponSystem {
  unlocked: WeaponId[] = [];
  current: WeaponId = 'chappal';
  used = new Set<WeaponId>();
  projectiles: Phaser.Physics.Arcade.Group;
  private lastFire: Record<string, number> = {};
  private charging = false;
  private chargeStart = 0;
  private scene: Phaser.Scene;
  private hooks: WeaponHooks;
  enabled = true;

  constructor(scene: Phaser.Scene, hooks: WeaponHooks, start: WeaponId[]) {
    this.scene = scene;
    this.hooks = hooks;
    this.unlocked = [...start].sort((a, b) => WEAPON_ORDER.indexOf(a) - WEAPON_ORDER.indexOf(b));
    this.current = start[start.length - 1] ?? 'chappal';
    this.projectiles = scene.physics.add.group({ allowGravity: true });
  }

  get def(): WeaponDef {
    return WEAPONS[this.current];
  }

  heldTexture(id: WeaponId = this.current) {
    return WEAPONS[id].held;
  }

  heldScale(id: WeaponId = this.current) {
    return WEAPONS[id].heldScale;
  }

  has(id: WeaponId) {
    return this.unlocked.includes(id);
  }

  unlock(id: WeaponId, equip = true) {
    if (this.unlocked.includes(id)) return false;
    this.unlocked.push(id);
    this.unlocked.sort((a, b) => WEAPON_ORDER.indexOf(a) - WEAPON_ORDER.indexOf(b));
    AudioManager.sfx('unlock');
    this.hooks.onUnlock(WEAPONS[id]);
    if (equip) this.equip(id);
    else this.hooks.onChange();
    return true;
  }

  equip(id: WeaponId) {
    if (!this.unlocked.includes(id) || this.charging) return;
    if (id === this.current) return;
    this.current = id;
    AudioManager.sfx('click');
    this.hooks.onChange();
  }

  cycle(dir: number) {
    const i = this.unlocked.indexOf(this.current);
    const n = this.unlocked.length;
    this.equip(this.unlocked[(i + dir + n) % n]);
  }

  /** 0..1, 1 = ready */
  cooldownProgress(id: WeaponId = this.current) {
    const d = WEAPONS[id];
    const last = this.lastFire[id] ?? -99999;
    return Phaser.Math.Clamp((this.scene.time.now - last) / d.cooldown, 0, 1);
  }

  isCharging() {
    return this.charging;
  }

  /**
   * Try to attack. `held` lets rapid-fire weapons keep firing while the button is held.
   */
  tryAttack(aimAngle: number, pressed: boolean, held: boolean) {
    if (!this.enabled) return;
    const d = this.def;
    const now = this.scene.time.now;
    const ready = this.cooldownProgress() >= 1;

    if (d.kind === 'charge') {
      if (this.charging) {
        if (now - this.chargeStart > 750) {
          this.charging = false;
          this.hooks.onCharge(false);
          this.fire(d, aimAngle);
        }
        return;
      }
      if (pressed && ready) {
        this.charging = true;
        this.chargeStart = now;
        AudioManager.sfx('charge');
        this.hooks.onCharge(true);
      }
      return;
    }

    const auto = d.kind === 'stream' || (d.kind === 'straight' && d.cooldown < 500) || d.kind === 'bounce';
    if (!ready) return;
    if (pressed || (auto && held)) this.fire(d, aimAngle);
  }

  cancelCharge() {
    if (this.charging) {
      this.charging = false;
      this.hooks.onCharge(false);
    }
  }

  private fire(d: WeaponDef, angle: number) {
    this.lastFire[d.id] = this.scene.time.now;
    this.used.add(d.id);
    const o = this.hooks.origin();
    this.hooks.onSwing(d);
    const vel = (a: number, sp = d.speed) => [Math.cos(a) * sp, Math.sin(a) * sp] as const;

    switch (d.kind) {
      case 'arc': {
        const [vx, vy] = vel(angle);
        this.spawn(d, o.x, o.y, vx, vy);
        AudioManager.sfx('throw', { pitch: d.id === 'lipgloss' ? 1.25 : 1 });
        if (d.id === 'chappal') SaveManager.progress.chappalsThrown++;
        break;
      }
      case 'melee': {
        AudioManager.sfx('whoosh');
        const reach = new Phaser.Geom.Rectangle(o.facing === 1 ? o.x - 10 : o.x - 120, o.y - 60, 130, 110);
        const swoosh = this.scene.add.image(o.x + o.facing * 55, o.y - 5, 'w-pillow').setScale(1.4).setDepth(70).setAlpha(0.9);
        swoosh.setFlipX(o.facing === -1);
        this.scene.tweens.add({ targets: swoosh, angle: o.facing * 80, alpha: 0, scale: 1.8, duration: 220, onComplete: () => swoosh.destroy() });
        const t = this.hooks.targetRect();
        if (t && Phaser.Geom.Intersects.RectangleToRectangle(reach, t)) this.hooks.hit(d, t.centerX, t.centerY, o.facing);
        else this.hooks.onMiss();
        break;
      }
      case 'straight': {
        const a = angle + (d.id === 'emoji' ? (Math.random() - 0.5) * 0.08 : 0);
        const [vx, vy] = vel(a);
        this.spawn(d, o.x, o.y, vx, vy);
        if (d.id === 'emoji') {
          burst(this.scene, o.x + Math.cos(a) * 20, o.y + Math.sin(a) * 20, 'dot', { count: 5, tint: [0xff5a3c, 0xffd23f], speed: 120, scale: 0.4, life: 250, gravity: 0 });
          AudioManager.sfx('pop', { pitch: 0.9 + Math.random() * 0.2 });
        } else if (d.id === 'ticks') {
          AudioManager.sfx('click', { pitch: 1.6 });
          AudioManager.sfx('pop', { pitch: 1.5 });
        } else {
          AudioManager.sfx('whoosh', { pitch: 0.6 });
        }
        break;
      }
      case 'stream': {
        const [vx, vy] = vel(angle + (Math.random() - 0.5) * 0.12);
        this.spawn(d, o.x, o.y, vx, vy);
        AudioManager.sfx('splash', { pitch: 0.8 + Math.random() * 0.4 });
        break;
      }
      case 'charge': {
        const [vx, vy] = vel(angle - 0.08);
        this.spawn(d, o.x, o.y - 10, vx, vy);
        AudioManager.sfx('thunder');
        break;
      }
      case 'spread': {
        [-0.17, 0, 0.17].forEach((off, i) => {
          const [vx, vy] = vel(angle + off - 0.05, d.speed * (1 - Math.abs(off) * 0.3));
          this.spawn(d, o.x, o.y, vx, vy, i !== 1);
        });
        AudioManager.sfx('pop', { pitch: 0.7 });
        AudioManager.sfx('throw', { pitch: 0.8 });
        break;
      }
      case 'boomerang': {
        const [vx, vy] = vel(angle);
        this.spawn(d, o.x, o.y, vx, vy);
        AudioManager.sfx('whoosh', { pitch: 0.75 });
        break;
      }
      case 'bounce': {
        // lob it forward and slightly up so it bounces along the ground
        const dir = Math.cos(angle) >= 0 ? 1 : -1;
        const elev = Phaser.Math.Clamp(Math.atan2(-Math.sin(angle), Math.abs(Math.cos(angle))), 0.15, 1.1);
        const [vx, vy] = vel(dir === 1 ? -elev : Math.PI + elev);
        this.spawn(d, o.x, o.y, vx, vy);
        AudioManager.sfx('throw', { pitch: 0.65 });
        break;
      }
      case 'homing': {
        const [vx, vy] = vel(angle - 0.3);
        this.spawn(d, o.x, o.y - 30, vx, vy);
        AudioManager.sfx('heart');
        AudioManager.sfx('sparkle');
        break;
      }
      case 'shockwave':
        this.stomp(d);
        break;
      case 'beam':
        this.beam(d, angle);
        break;
    }
  }

  // ------------------------------------------------------------ special attacks

  /** Beautiful Eyes: an instant heart-laser from her eyes along the aim. */
  private beam(d: WeaponDef, angle: number) {
    const e = this.hooks.eyes();
    const len = 1150;
    const line = new Phaser.Geom.Line(e.x, e.y, e.x + Math.cos(angle) * len, e.y + Math.sin(angle) * len);
    const t = this.hooks.targetRect();
    let endX = line.x2, endY = line.y2;
    let connected = false;
    if (t && Phaser.Geom.Intersects.LineToRectangle(line, t)) {
      endX = t.centerX;
      endY = t.centerY;
      connected = true;
    }
    // draw the beam: soft pink glow + bright core, fading out
    const g = this.scene.add.graphics().setDepth(66).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(26, 0xff7eb6, 0.35);
    g.lineBetween(e.x, e.y, endX, endY);
    g.lineStyle(12, 0xff9ec7, 0.7);
    g.lineBetween(e.x, e.y, endX, endY);
    g.lineStyle(4, 0xffffff, 1);
    g.lineBetween(e.x, e.y, endX, endY);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 450, delay: 120, onComplete: () => g.destroy() });
    // hearts along the beam
    const n = 9;
    for (let i = 1; i <= n; i++) {
      const x = Phaser.Math.Linear(e.x, endX, i / n);
      const y = Phaser.Math.Linear(e.y, endY, i / n);
      burst(this.scene, x, y, 'heart', { count: 1, tint: [0xff4f8b, 0xff9ec7], speed: 60, scale: 0.6, life: 600, gravity: -60 });
    }
    // sparkle in her eyes
    burst(this.scene, e.x, e.y, 'star', { count: 8, tint: [0xffffff, 0xffe066, 0xff9ec7], speed: 140, scale: 0.45, life: 500, gravity: 0 });
    AudioManager.sfx('sparkle');
    AudioManager.sfx('heart');
    if (connected) this.hooks.hit(d, endX, endY, Math.cos(angle) >= 0 ? 1 : -1);
    else this.hooks.onMiss();
  }

  /** Tantrum: she stomps and two shockwaves race along the ground. Jump to dodge! */
  private stomp(d: WeaponDef) {
    const f = this.hooks.feet();
    [-1, 1].forEach((dir, i) => this.spawn(d, f.x + dir * 30, GROUND_Y - 22, dir * d.speed, 0, i === 0));
    burst(this.scene, f.x, GROUND_Y - 6, 'dot', { count: 18, tint: [0xffffff, 0xffd1a8, 0xff9a62], speed: 280, scale: 0.6, life: 500, gravity: 300 });
    const mark = this.scene.add.image(f.x + 26, f.y - 120, 'anger').setDepth(70).setScale(0.2);
    this.scene.tweens.add({ targets: mark, scale: 1, duration: 160, ease: 'Back.easeOut', yoyo: true, hold: 300, onComplete: () => mark.destroy() });
    AudioManager.sfx('thwack', { pitch: 0.45 });
    AudioManager.sfx('land', { pitch: 0.6 });
    shake(this.scene, 0.01, 260);
  }

  private spawn(d: WeaponDef, x: number, y: number, vx: number, vy: number, quietMiss = false) {
    const p = this.projectiles.create(x, y, d.tex) as Phaser.Physics.Arcade.Image;
    p.setScale(d.projScale).setDepth(65);
    const body = p.body as Phaser.Physics.Arcade.Body;
    // per-projectile gravity: body gravity is added to world gravity, so offset it
    const gravity = GRAVITY[d.kind] ?? 0;
    body.setAllowGravity(gravity > 0);
    if (gravity > 0) body.setGravityY(gravity - this.scene.physics.world.gravity.y);
    body.setVelocity(vx, vy);
    const r = Math.min(p.width, p.height) * 0.42;
    body.setCircle(r, p.width / 2 - r, p.height / 2 - r);
    const spinning = ['arc', 'charge', 'boomerang', 'spread', 'bounce'].includes(d.kind);
    const spinRate = d.kind === 'charge' ? 9 : d.kind === 'boomerang' ? 20 : d.kind === 'spread' ? 6 : d.kind === 'bounce' ? 10 : 16;
    const data: ProjData = { def: d, born: this.scene.time.now, age: 0, hit: false, spin: spinning ? (vx >= 0 ? 1 : -1) * spinRate : 0, quietMiss, bounces: 0 };
    p.setData('p', data);
    if (d.kind === 'shockwave') {
      p.setScale(0.6, 0.6);
      p.setFlipX(vx < 0);
      this.scene.tweens.add({ targets: p, scaleX: 1.2, scaleY: 1.1, duration: d.life * 0.6 });
    }

    const trailCfg: Record<string, Phaser.Types.GameObjects.Particles.ParticleEmitterConfig | undefined> = {
      charge: { speed: 40, scale: { start: 0.5, end: 0 }, lifespan: 500, frequency: 30, tint: [0xff7eb6, 0xc77dff, 0xffe066], blendMode: Phaser.BlendModes.ADD },
      arc: { speed: 10, scale: { start: 0.3, end: 0 }, alpha: { start: 0.6, end: 0 }, lifespan: 250, frequency: 40, tint: d.id === 'lipgloss' ? [0xff4f9a, 0xffffff] : 0xffb3d1 },
      boomerang: { speed: 30, scale: { start: 0.55, end: 0 }, lifespan: 380, frequency: 25, tint: [0xff5a1e, 0xffc23f, 0xff8a1e], blendMode: Phaser.BlendModes.ADD },
      bounce: { speed: 20, scale: { start: 0.45, end: 0 }, lifespan: 300, frequency: 30, tint: [0xff4a1e, 0xffa63c], blendMode: Phaser.BlendModes.ADD },
      homing: { speed: 25, scale: { start: 0.45, end: 0 }, lifespan: 600, frequency: 60, tint: [0xff4f8b, 0xff9ec7] },
      straight: d.id === 'silent' ? { speed: 15, scale: { start: 0.5, end: 0 }, alpha: { start: 0.5, end: 0 }, lifespan: 600, frequency: 90, tint: 0xd9dbe8 } : undefined,
      spread: d.id === 'momos' ? { speedY: { min: -60, max: -30 }, speedX: { min: -10, max: 10 }, scale: { start: 0.35, end: 0 }, alpha: { start: 0.5, end: 0 }, lifespan: 400, frequency: 80, tint: 0xffffff } : undefined,
    };
    const cfg = trailCfg[d.kind];
    if (cfg) {
      const tex = d.kind === 'homing' ? 'heart' : d.kind === 'charge' ? 'star' : d.kind === 'straight' || d.kind === 'spread' ? 'soft' : 'dot';
      const trail = this.scene.add.particles(0, 0, tex, { follow: p, ...cfg });
      trail.setDepth(63);
      p.setData('trail', trail);
    }
  }

  /** per-frame projectile upkeep: spin, steering, lifetime, ground/target hits */
  update(dt: number) {
    const target = this.hooks.targetRect();
    const s = Math.min(dt, 50) / 1000;
    (this.projectiles.getChildren().slice() as Phaser.Physics.Arcade.Image[]).forEach((p) => {
      const data = p.getData('p') as ProjData;
      if (!data || !p.body) return;
      const d = data.def;
      const b = p.body as Phaser.Physics.Arcade.Body;
      data.age += Math.min(dt, 50);
      const age = data.age;

      // --- steering
      if (d.kind === 'homing' && target && !data.hit) {
        const want = Math.atan2(target.centerY - p.y, target.centerX - p.x);
        const cur = Math.atan2(b.velocity.y, b.velocity.x);
        const turn = Phaser.Math.Angle.RotateTo(cur, want, 5.5 * s);
        const sp = d.speed + Math.min(300, age * 0.25);
        b.setVelocity(Math.cos(turn) * sp, Math.sin(turn) * sp);
      }
      if (d.kind === 'boomerang') {
        if (!data.returning && age > d.life * 0.33) data.returning = true;
        if (data.returning) {
          const o = this.hooks.origin();
          const want = Math.atan2(o.y - p.y, o.x - p.x);
          const sp = d.speed * 1.05;
          const cur = new Phaser.Math.Vector2(b.velocity.x, b.velocity.y);
          cur.lerp(new Phaser.Math.Vector2(Math.cos(want) * sp, Math.sin(want) * sp), Math.min(1, 6 * s));
          b.setVelocity(cur.x, cur.y);
          if (Phaser.Math.Distance.Between(p.x, p.y, o.x, o.y) < 46) {
            // caught it!
            burst(this.scene, p.x, p.y, 'dot', { count: 6, tint: [0xff8a1e, 0xffc23f], speed: 90, scale: 0.4, life: 250, gravity: 0 });
            if (!data.hit && !data.quietMiss) this.hooks.onMiss();
            this.kill(p, true);
            return;
          }
        }
      }
      if (d.id === 'silent') p.y += Math.sin(age / 160) * 0.6;

      // --- rotation
      if (data.spin) p.rotation += data.spin * s;
      else if (d.kind === 'stream') p.rotation = Math.atan2(b.velocity.y, b.velocity.x);
      else if (d.kind === 'homing') p.rotation = Math.sin(age / 120) * 0.25;
      else if (d.kind === 'shockwave') p.rotation = 0;
      else p.rotation = Math.atan2(b.velocity.y, b.velocity.x) * 0.2;

      // --- target hit
      if (target && !data.hit) {
        const pr = new Phaser.Geom.Rectangle(p.x - p.displayWidth * 0.35, p.y - p.displayHeight * 0.35, p.displayWidth * 0.7, p.displayHeight * 0.7);
        if (Phaser.Geom.Intersects.RectangleToRectangle(pr, target)) {
          const counted = this.hooks.hit(d, p.x, p.y, Math.sign(b.velocity.x) || 1);
          if (counted) {
            data.hit = true;
            if (d.kind === 'boomerang') {
              data.returning = true; // the pizza keeps flying back to her
            } else {
              this.kill(p, true);
              return;
            }
          }
        }
      }

      // --- ground + lifetime
      const expired = age > d.life;
      let hitGround = d.kind !== 'shockwave' && d.kind !== 'boomerang' && p.y > GROUND_Y - 4;
      if (hitGround && d.kind === 'bounce' && (data.bounces ?? 0) < 4 && !expired) {
        data.bounces = (data.bounces ?? 0) + 1;
        p.y = GROUND_Y - 6;
        b.setVelocityY(-Math.max(380, Math.abs(b.velocity.y) * 0.78));
        burst(this.scene, p.x, GROUND_Y - 4, 'dot', { count: 4, tint: [0xff8a1e, 0xffd23f], speed: 110, scale: 0.35, life: 250, gravity: 200 });
        hitGround = false;
      }
      if (expired || hitGround) {
        if (!data.hit && !data.quietMiss) this.hooks.onMiss();
        if (hitGround && d.kind === 'stream') burst(this.scene, p.x, GROUND_Y - 4, 'dot', { count: 4, tint: 0x9fd8ff, speed: 120, scale: 0.35, life: 300 });
        if (hitGround && d.kind === 'spread') burst(this.scene, p.x, GROUND_Y - 6, 'soft', { count: 2, tint: 0xffffff, speed: 40, scale: 0.6, life: 400, gravity: -60 });
        this.kill(p, false);
      }
    });
  }

  private kill(p: Phaser.Physics.Arcade.Image, hit: boolean) {
    const trail = p.getData('trail') as Phaser.GameObjects.Particles.ParticleEmitter | undefined;
    if (trail) {
      trail.stop();
      this.scene.time.delayedCall(700, () => trail.destroy());
    }
    const data = p.getData('p') as ProjData;
    if (!hit && (data.def.kind === 'arc' || data.def.kind === 'spread')) {
      // thrown things land and fade out
      const ghost = this.scene.add.image(p.x, Math.min(p.y, GROUND_Y - 8), data.def.tex).setScale(data.def.projScale).setDepth(20).setRotation(p.rotation);
      this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 700, delay: 300, onComplete: () => ghost.destroy() });
    }
    if (!hit && data.def.kind === 'shockwave') {
      this.scene.tweens.killTweensOf(p);
    }
    p.destroy();
  }

  clearProjectiles() {
    (this.projectiles.getChildren().slice() as Phaser.Physics.Arcade.Image[]).forEach((p) => {
      this.scene.tweens.killTweensOf(p);
      p.setData('p', { ...(p.getData('p') as ProjData), hit: true });
      this.kill(p, true);
    });
    this.cancelCharge();
  }
}
