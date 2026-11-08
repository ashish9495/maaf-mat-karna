/**
 * LevelScene — the playable chase. One scene class drives all three levels,
 * configured from LEVELS in gameConfig.ts.
 */
import Phaser from 'phaser';
import { GAME_H, GAME_W, GROUND_Y, LEVELS, BOYFRIEND, type LevelDef } from '../config/gameConfig';
import { WEAPONS, WEAPON_ORDER, type WeaponDef, type WeaponId } from '../config/weaponConfig';
import { personalization } from '../config/personalization';
import { dialogue } from '../config/dialogueConfig';
import { buildWorld, type BuiltWorld } from '../systems/Environment';
import { GirlfriendController } from '../characters/GirlfriendController';
import { BoyfriendAI } from '../characters/BoyfriendAI';
import { InputManager } from '../systems/InputManager';
import { WeaponSystem } from '../systems/WeaponSystem';
import { HealthSystem } from '../systems/HealthSystem';
import { AudioManager } from '../systems/AudioManager';
import { SaveManager } from '../systems/SaveManager';
import { unlockAchievement } from '../systems/AchievementSystem';
import { HUD } from '../ui/HUD';
import { MobileControls } from '../ui/MobileControls';
import { openPause } from '../ui/Panels';
import { clearUI, isTouchDevice, mount, toast } from '../ui/dom';
import { burst, floatText, flash, hitStop, shake } from '../utils/effects';
import { esc, pick, t } from '../utils/helpers';

interface RunStats {
  hits: number;
  weapons: string[];
  stumbles: number;
}

interface LevelData {
  level?: number;
  hp?: number;
  fresh?: boolean;
}

type Phase = 'play' | 'escaping' | 'exiting' | 'finale';

export class LevelScene extends Phaser.Scene {
  def!: LevelDef;
  world!: BuiltWorld;
  gf!: GirlfriendController;
  bf!: BoyfriendAI;
  input2!: InputManager;
  weapons!: WeaponSystem;
  health!: HealthSystem;
  hud!: HUD;
  mobile: MobileControls | null = null;
  private cleanups: (() => void)[] = [];
  private phase: Phase = 'play';
  private combo = 0;
  private lastHitAt = 0;
  private missStreak = 0;
  private levelHits = 0;
  private nextTauntAt = 0;
  private tutorialStep = 0;
  private indicator!: Phaser.GameObjects.Container;
  private exitMarker: Phaser.GameObjects.Container | null = null;
  private secret: Phaser.GameObjects.Image | null = null;
  private paused = false;
  private pauseEl: HTMLDivElement | null = null;
  private heartTaps = 0;
  private run!: RunStats;

  constructor() {
    super('Level');
  }

  init(data: LevelData) {
    const idx = Phaser.Math.Clamp(data.level ?? 0, 0, LEVELS.length - 1);
    this.def = LEVELS[idx];
    this.registry.set('levelHp', data.hp ?? [100, 65, 30][idx]);
    if (data.fresh || !this.registry.get('run')) this.registry.set('run', { hits: 0, weapons: [], stumbles: 0 } as RunStats);
    this.phase = 'play';
    this.combo = 0;
    this.missStreak = 0;
    this.levelHits = 0;
    this.tutorialStep = 0;
    this.paused = false;
    this.cleanups = [];
    this.heartTaps = 0;
    this.exitMarker = null;
    this.secret = null;
  }

  create() {
    clearUI();
    document.body.classList.add('in-game');
    this.run = this.registry.get('run') as RunStats;
    const def = this.def;
    this.time.timeScale = 1;
    this.physics.world.timeScale = 1;

    this.world = buildWorld(this, def);
    this.physics.world.setBounds(0, -800, def.width, GROUND_Y + 800 + 60);

    this.gf = new GirlfriendController(this, 300);
    this.bf = new BoyfriendAI(this, def.index === 0 ? 760 : 840);
    this.bf.rig.setFacing(1);

    // colliders
    const oneWay = (a: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile, b: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile) => {
      const body = (a as Phaser.Types.Physics.Arcade.GameObjectWithBody).body as Phaser.Physics.Arcade.Body;
      const plat = (b as Phaser.Types.Physics.Arcade.GameObjectWithBody).body as Phaser.Physics.Arcade.StaticBody;
      return body.velocity.y >= 0 && body.prev.y + body.height <= plat.top + 10;
    };
    [this.gf.rect, this.bf.rect].forEach((r) => {
      this.physics.add.collider(r, this.world.ground);
      this.physics.add.collider(r, this.world.solids);
      this.physics.add.collider(r, this.world.platforms, undefined, oneWay, this);
    });

    // camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, def.width, GAME_H);
    cam.startFollow(this.gf.rect, true, 0.09, 0.09);
    cam.setDeadzone(160, 220);
    cam.fadeIn(450, 255, 220, 235);

    // systems
    this.input2 = new InputManager(this);
    this.health = new HealthSystem(BOYFRIEND.maxHp, this.registry.get('levelHp') as number);
    this.health.setFloor(def.hpTarget);

    this.weapons = new WeaponSystem(this, {
      origin: () => this.gf.handPos(),
      eyes: () => ({ x: this.gf.x + this.gf.rig.facing * 10, y: this.gf.rig.headTop().y + 50 }),
      feet: () => ({ x: this.gf.x, y: GROUND_Y }),
      targetRect: () => (this.bf.vulnerable() ? this.bf.hitRect() : null),
      hit: (w, x, y, dir) => this.onHit(w, x, y, dir),
      onSwing: (w) => {
        this.gf.showAttack(w.kind === 'melee' ? 300 : 200);
      },
      onCharge: (c) => this.onCharge(c),
      onUnlock: (w) => this.hud?.unlockBanner(w.icon, w.name, w.description),
      onMiss: () => this.onMiss(),
      onChange: () => this.onWeaponChange(),
    }, this.startingWeapons());

    // UI
    this.hud = new HUD({
      onPause: () => this.pause(),
      onSelect: (id) => this.weapons.equip(id),
      onPortrait: () => {
        AudioManager.sfx('cry', { pitch: 1.3 });
        this.bf.speak(t(dialogue.portraitClick), 1300, true);
      },
      onHeart: () => this.heartTap(),
    });
    this.cleanups.push(mount(this.hud.root));
    if (isTouchDevice() || new URLSearchParams(location.search).has('touch')) {
      this.mobile = new MobileControls(this.input2);
      this.cleanups.push(mount(this.mobile.root));
      document.body.classList.add('touch');
    }
    this.hud.setHp(this.health.hp, this.health.max);
    this.hud.setStage(t(dialogue.levelIntro[def.index]), def.objective);
    this.onWeaponChange(true);
    this.hud.banner(t(dialogue.levelIntro[def.index]), def.objective);

    this.buildIndicator();
    if (def.secret) this.buildSecret(def.secret.x, def.secret.y);

    AudioManager.startChase();
    AudioManager.setIntensity(this.health.stage >= 2 ? 1 : 0);

    // weapons unlocked the moment this level starts (staggered so each gets its banner)
    def.unlocks.filter((u) => u.atHits === 0).forEach((u, i) => {
      this.time.delayedCall(1800 + i * 1500, () => {
        if (this.phase !== 'play') return;
        this.weapons.unlock(u.weapon, u.equip !== false);
        if (u.weapon === 'ultimate') this.time.delayedCall(600, () => this.bf.panicAtWeapon());
      });
    });

    this.time.delayedCall(900, () => {
      if (this.bf.state === 'IDLE') this.bf.setState('FLEEING');
    });
    this.nextTauntAt = this.time.now + 6000;

    // auto-pause when the tab loses focus
    const onHidden = () => {
      if (this.phase === 'play' || this.phase === 'escaping') this.pause();
    };
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.cleanups.push(() => this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden));

    this.bf.onFoundHiding = () => unlockAchievement('hide-seek');
    this.bf.onStumble = () => {
      this.run.stumbles++;
      if (this.run.stumbles >= 3) unlockAchievement('no-break');
    };
    this.bf.onEscaped = () => this.onBfEscaped();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private startingWeapons(): WeaponId[] {
    // the chappal plus everything scheduled in earlier levels (even if she finished
    // a level before reaching an unlock, she still gets it here)
    const list: WeaponId[] = ['chappal'];
    LEVELS.slice(0, this.def.index).forEach((l) => l.unlocks.forEach((u) => list.includes(u.weapon) || list.push(u.weapon)));
    return list;
  }

  private cleanup() {
    this.cleanups.forEach((c) => c());
    this.cleanups = [];
    this.pauseEl?.remove();
    this.pauseEl = null;
    document.body.classList.remove('in-game');
    this.input2?.resetTouch();
  }

  // ----------------------------------------------------------- frame loop

  update(_time: number, dt: number) {
    if (this.paused) return;
    dt = Math.min(dt, 50);
    const inp = this.input2;
    inp.update();
    if (inp.pausePressed && this.phase !== 'finale') {
      inp.endFrame();
      this.pause();
      return;
    }

    const aim = this.computeAim();
    const playing = this.phase === 'play' || this.phase === 'escaping' || this.phase === 'exiting';
    this.gf.locked = !playing;

    // weapon switching
    if (playing) {
      if (inp.cycle) this.weapons.cycle(inp.cycle);
      if (inp.select >= 0) {
        const id = WEAPON_ORDER[inp.select];
        if (id) this.weapons.equip(id);
      }
      if (this.phase === 'play') this.weapons.tryAttack(aim, inp.attackPressed, inp.attackHeld);
      if (inp.attackPressed) this.tutorialAction('attack');
    }

    this.gf.update(dt, inp, aim);
    this.bf.update(dt, {
      gf: { x: this.gf.x, y: this.gf.y },
      hpStage: this.health.stage,
      levelIndex: this.def.index,
      levelWidth: this.def.width,
      world: this.world,
      projectiles: this.weapons.projectiles.getChildren(),
    });
    this.weapons.update(dt);

    // HUD upkeep
    this.weapons.unlocked.forEach((id) => this.hud.setCooldown(id, this.weapons.cooldownProgress(id)));
    this.hud.setDash(this.gf.dashProgress());
    if (this.combo > 0 && this.time.now - this.lastHitAt > 2200) {
      this.combo = 0;
      this.hud.setCombo(0);
    }

    this.updateCameraLook();
    this.updateIndicator();
    this.updateTutorial();
    this.checkSecret();
    this.checkExit();

    inp.endFrame();
  }

  private computeAim(): number {
    const o = this.gf.handPos();
    if (this.input2.usingMouseAim() && this.input2.aimWorld) {
      const a = Math.atan2(this.input2.aimWorld.y - o.y, this.input2.aimWorld.x - o.x);
      // chappals arc, so lift the throw a little toward the cursor
      return this.weapons.def.kind === 'arc' ? a - 0.14 * Math.cos(a) : a;
    }
    // auto-aim at Baby (mobile, keyboard-only)
    const tx = this.bf.x;
    const ty = this.bf.y - 10;
    const dx = tx - o.x;
    const dy = ty - o.y;
    if (Math.abs(dx) > 1000) return this.gf.rig.facing === 1 ? 0 : Math.PI;
    const d = this.weapons.def;
    if (d.kind === 'arc') {
      // compensate for the arc's gravity (900) with one refinement step
      const vx = d.speed * 0.95;
      const time = Math.abs(dx) / vx;
      const drop = 0.5 * 900 * time * time;
      return Math.atan2(dy - drop * 0.9, dx);
    }
    return Math.atan2(dy, dx);
  }

  private updateCameraLook() {
    // look ahead toward Baby so he stays visible
    const cam = this.cameras.main;
    const dx = Phaser.Math.Clamp(this.bf.x - this.gf.x, -380, 380);
    const target = -dx * 0.55;
    cam.followOffset.x += (target - cam.followOffset.x) * 0.04;
    cam.followOffset.y = 60;
  }

  // ------------------------------------------------------------ combat

  private onHit(w: WeaponDef, x: number, y: number, dir: number): boolean {
    if (this.phase !== 'play' || !this.bf.vulnerable()) return false;
    const dealt = this.health.damage(w.damage);
    if (dealt <= 0 && this.health.hp > 0) return false;

    this.bf.takeHit(w, dir, this.health.stage);
    this.hud.setHp(this.health.hp, this.health.max);
    // level flow is decided after the hit reaction so the reaction can't override it
    if (this.health.hp <= 0) this.time.delayedCall(250, () => this.finale());
    else if (this.def.hpTarget > 0 && this.health.atFloor) this.time.delayedCall(500, () => this.startEscape());
    floatText(this, x, y - 40, `-${dealt || w.damage}`, w.power ? '#c77dff' : '#ff3d7f', w.power ? 44 : 30);

    switch (w.kind) {
      case 'arc':
        AudioManager.sfx('thwack', { pitch: w.id === 'lipgloss' ? 1.3 : 1 });
        burst(this, x, y, 'star', { count: 8, tint: w.id === 'lipgloss' ? [0xff4f9a, 0xffffff] : [0xffe066, 0xff9ec7], speed: 260, scale: 0.55, life: 550 });
        floatText(this, x + 30, y - 80, w.id === 'lipgloss' ? 'STICKY!' : 'THWACK!', w.id === 'lipgloss' ? '#ff4f9a' : '#ffb703', 24);
        hitStop(this, 0.3, 70);
        shake(this, 0.004, 120);
        break;
      case 'melee':
        AudioManager.sfx('pillow');
        burst(this, x, y, 'feather', { count: 22, tint: [0xffffff, 0xf3e6ff, 0xffe1ef], speed: 340, scale: 1, life: 1100, gravity: 120, rotate: true });
        burst(this, x, y, 'soft', { count: 6, tint: 0xffffff, speed: 80, scale: 1.4, life: 500, gravity: -40 });
        floatText(this, x, y - 90, 'FWUMP!', '#9b5de5', 26);
        hitStop(this, 0.25, 100);
        shake(this, 0.007, 160);
        break;
      case 'straight':
        if (w.id === 'ticks') {
          AudioManager.sfx('click', { pitch: 1.8 });
          burst(this, x, y, 'p-ticks', { count: 3, speed: 160, scale: 0.5, life: 600, rotate: true });
          floatText(this, x + 20, y - 80, 'SEEN ✓✓', '#2f9bff', 24);
        } else if (w.id === 'silent') {
          AudioManager.sfx('whoosh', { pitch: 0.5 });
          burst(this, x, y, 'soft', { count: 6, tint: 0xd9dbe8, speed: 90, scale: 1, life: 700, gravity: -30 });
          floatText(this, x + 20, y - 80, '. . .', '#7a7a90', 30);
        } else {
          AudioManager.sfx('pop', { pitch: 1.3 });
          burst(this, x, y, 'p-emoji', { count: 4, speed: 180, scale: 0.45, life: 500, rotate: true });
        }
        break;
      case 'stream':
        AudioManager.sfx('splash', { pitch: 1.4 });
        burst(this, x, y, 'p-water', { count: 5, speed: 160, scale: 0.7, life: 450 });
        break;
      case 'spread':
        AudioManager.sfx('pop', { pitch: 0.8 });
        burst(this, x, y, 'soft', { count: 4, tint: 0xffffff, speed: 90, scale: 0.7, life: 450, gravity: -50 });
        floatText(this, x + 20, y - 80, 'MOMO!', '#e8a33a', 22);
        break;
      case 'boomerang':
        AudioManager.sfx('thwack', { pitch: 0.85 });
        burst(this, x, y, 'dot', { count: 16, tint: [0xff5a1e, 0xffc23f, 0xff8a1e], speed: 300, scale: 0.6, life: 600, gravity: -80 });
        floatText(this, x + 30, y - 80, 'SIZZLE!', '#ff5a1e', 26);
        hitStop(this, 0.3, 80);
        shake(this, 0.006, 140);
        break;
      case 'bounce':
        AudioManager.sfx('pop', { pitch: 0.6 });
        burst(this, x, y, 'dot', { count: 10, tint: [0xff4a1e, 0xffa63c, 0xfff0a0], speed: 220, scale: 0.5, life: 450, gravity: -60 });
        floatText(this, x + 20, y - 70, 'GARAM!', '#ff4a1e', 22);
        break;
      case 'shockwave':
        AudioManager.sfx('thwack', { pitch: 0.55 });
        burst(this, x, y + 20, 'dot', { count: 14, tint: [0xff3d3d, 0xffd23f], speed: 260, scale: 0.55, life: 500, gravity: 300 });
        floatText(this, x, y - 90, 'DHAMM!', '#ff2d55', 28);
        hitStop(this, 0.3, 90);
        break;
      case 'beam':
      case 'homing':
        AudioManager.sfx('heart');
        AudioManager.sfx('sparkle');
        burst(this, x, y, 'heart', { count: 18, tint: [0xff4f8b, 0xff9ec7, 0xffffff], speed: 300, scale: 0.8, life: 900, gravity: -120 });
        flash(this, 140, 255, 190, 220);
        floatText(this, x + 30, y - 95, w.kind === 'beam' ? 'CRITICAL CUTENESS!' : 'SPICY! 🌶️', '#ff2d7f', 26);
        hitStop(this, 0.15, 240);
        if (!SaveManager.settings.reducedMotion) {
          this.cameras.main.zoomTo(1.1, 160);
          this.time.delayedCall(700, () => this.cameras.main.zoomTo(1, 400));
        }
        break;
      case 'charge':
        AudioManager.sfx('thwack', { pitch: 0.7 });
        AudioManager.sfx('sparkle');
        burst(this, x, y, 'star', { count: 24, tint: [0xff7eb6, 0xc77dff, 0xffe066], speed: 420, scale: 0.8, life: 800 });
        flash(this, 160, 255, 210, 240);
        hitStop(this, 0.15, 220);
        shake(this, 0.012, 260);
        if (!SaveManager.settings.reducedMotion) {
          this.cameras.main.zoomTo(1.12, 120);
          this.time.delayedCall(260, () => this.cameras.main.zoomTo(1, 300));
        }
        break;
    }

    // combo & stats
    const now = this.time.now;
    this.combo = now - this.lastHitAt < 2200 ? this.combo + 1 : 1;
    this.lastHitAt = now;
    this.hud.setCombo(this.combo);
    if (this.combo >= 5) unlockAchievement('champion');
    this.missStreak = 0;
    this.levelHits++;
    this.run.hits++;
    if (!this.run.weapons.includes(w.id)) this.run.weapons.push(w.id);
    if (this.run.hits >= 10) unlockAchievement('chappal-queen');
    if (this.run.weapons.length >= 5) unlockAchievement('bully');

    // unlocks by progress in this level
    this.def.unlocks
      .filter((u) => u.atHits > 0 && u.atHits === this.levelHits)
      .forEach((u, i) => this.time.delayedCall(250 + i * 900, () => {
        if (this.phase === 'play') this.weapons.unlock(u.weapon, u.equip !== false);
      }));

    AudioManager.setIntensity(this.health.stage >= 3 ? 2 : this.health.stage >= 2 ? 1 : 0);

    if (now > this.nextTauntAt && Math.random() < 0.45) {
      this.nextTauntAt = now + 5000 + Math.random() * 3000;
      this.time.delayedCall(350, () => {
        this.gf.say(t(pick(dialogue.gfTaunts)), 1500, 0xffe1ef);
        if (Math.random() < 0.5) this.gf.laugh(800);
      });
    }
    return true;
  }

  private onMiss() {
    if (this.phase !== 'play') return;
    this.missStreak++;
    if (this.missStreak >= 8) {
      unlockAchievement('butterfingers');
      if (this.missStreak === 8) this.bf.speak(SaveManager.settings.language === 'en' ? 'Missed me! 😜' : 'Nahi laga! 😜', 1400, true);
    }
  }

  private onCharge(charging: boolean) {
    if (charging) {
      this.gf.rig.pose = 'raise';
      this.gf.showAttack(800);
      this.gf.speedMul = 0.4;
      const glow = this.add.image(this.gf.x, this.gf.y - 60, 'soft').setTint(0xff7eb6).setBlendMode(Phaser.BlendModes.ADD).setDepth(49).setScale(0.5);
      this.tweens.add({ targets: glow, scale: 3, alpha: 0, duration: 750, onComplete: () => glow.destroy() });
      burst(this, this.gf.x, this.gf.y - 60, 'star', { count: 10, tint: [0xff7eb6, 0xc77dff], speed: 120, scale: 0.4, life: 600, gravity: -100 });
    } else {
      this.gf.speedMul = 1;
    }
  }

  private onWeaponChange(silent = false) {
    const id = this.weapons.current;
    this.hud?.setWeapons(this.weapons.unlocked, id);
    this.gf.rig.holdWeapon(this.weapons.heldTexture(id), this.weapons.heldScale(id));
    this.mobile?.setAttackIcon(WEAPONS[id].icon);
    if (!silent) {
      this.gf.rig.bounce(0.1);
      if (id === 'ultimate') {
        this.bf.panicAtWeapon();
        this.gf.laugh();
      } else if (WEAPONS[id].power && Math.abs(this.bf.x - this.gf.x) < 900) {
        this.bf.speak(t(dialogue.bfSeesPower[id] ?? dialogue.bfPanicPower), 1600, true);
      } else if (id === 'chappal' && Math.random() < 0.5 && Math.abs(this.bf.x - this.gf.x) < 600) {
        this.bf.speak(t(dialogue.bfSeesChappal), 1500, true);
      }
    }
  }

  // ------------------------------------------------------ level flow

  private startEscape() {
    if (this.phase !== 'play') return;
    this.phase = 'escaping';
    this.weapons.clearProjectiles();
    this.combo = 0;
    this.hud.setCombo(0);
    this.bf.startEscape(this.def.width - 70);
    this.hud.setObjective('He ran! Follow him → ');
    this.gf.say(t(pick(dialogue.gfTaunts)), 1500, 0xffe1ef);
  }

  private onBfEscaped() {
    this.phase = 'exiting';
    const x = this.def.width - 70;
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.5);
    g.fillRoundedRect(-40, -150, 80, 150, 20);
    g.lineStyle(4, 0xff4f8b, 1);
    g.strokeRoundedRect(-40, -150, 80, 150, 20);
    const txt = this.add.text(0, -190, 'NEXT ➜', { fontFamily: '"Baloo 2", sans-serif', fontSize: '30px', fontStyle: '800', color: '#ff3d7f', stroke: '#fff', strokeThickness: 6 }).setOrigin(0.5);
    this.exitMarker = this.add.container(x, GROUND_Y, [g, txt]).setDepth(30);
    this.tweens.add({ targets: txt, y: -205, duration: 500, yoyo: true, repeat: -1 });
  }

  private checkExit() {
    if (this.phase !== 'exiting') return;
    if (this.gf.x > this.def.width - 140) {
      this.phase = 'finale';
      this.gf.locked = true;
      this.registry.set('run', this.run);
      this.cameras.main.fadeOut(500, 255, 220, 235);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('Level', { level: this.def.index + 1, hp: this.health.hp });
      });
    }
  }

  private finale() {
    if (this.phase === 'finale') return;
    this.phase = 'finale';
    this.weapons.enabled = false;
    this.weapons.clearProjectiles();
    this.input2.enabled = false;
    this.gf.locked = true;
    this.bf.collapse();
    this.hud.setCombo(0);
    this.hud.setObjective('');
    SaveManager.progress.chaseCompleted = true;
    SaveManager.saveProgress();
    unlockAchievement('mumma-wins');
    AudioManager.stopChase(2.5);
    this.time.timeScale = 1;
    this.physics.world.timeScale = 1;

    // slow, quiet beat before the cinematic
    this.bf.rig.pose = 'stumble';
    this.bf.rig.setExpression('cry');
    this.time.delayedCall(500, () => {
      this.bf.rig.pose = 'kneel';
    });
    this.gf.rig.setExpression('evil');
    this.cameras.main.stopFollow();
    this.cameras.main.pan((this.gf.x + this.bf.x) / 2, 360, 1400, 'Sine.easeInOut');
    if (!SaveManager.settings.reducedMotion) this.cameras.main.zoomTo(1.15, 1600);
    this.time.delayedCall(2200, () => {
      this.hud.hide(true);
      this.cameras.main.fadeOut(900, 255, 236, 214);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Cinematic', { fromChase: true }));
    });
  }

  // ------------------------------------------------------- pause menu

  pause() {
    if (this.paused || this.phase === 'finale') return;
    this.paused = true;
    this.input2.resetTouch();
    this.weapons.cancelCharge();
    this.physics.pause();
    this.time.paused = true;
    this.tweens.pauseAll();
    AudioManager.duck(0.35);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') resume();
    };
    const resume = () => {
      if (!this.paused) return;
      document.removeEventListener('keydown', onKey);
      this.pauseEl?.remove();
      this.pauseEl = null;
      this.paused = false;
      this.physics.resume();
      this.time.paused = false;
      this.tweens.resumeAll();
      AudioManager.duck(1);
    };
    document.addEventListener('keydown', onKey);
    this.cleanups.push(() => document.removeEventListener('keydown', onKey));
    this.pauseEl = openPause({
      resume,
      restart: () => {
        resume();
        this.scene.restart({ level: this.def.index, hp: [100, 65, 30][this.def.index] });
      },
      exit: () => {
        resume();
        AudioManager.duck(1);
        this.scene.start('Menu');
      },
    });
  }

  // ----------------------------------------------------- off-screen arrow

  private buildIndicator() {
    const g = this.add.graphics();
    g.fillStyle(0xff4f8b, 1);
    g.lineStyle(3, 0xffffff, 1);
    g.fillTriangle(18, 0, -10, -16, -10, 16);
    g.strokeTriangle(18, 0, -10, -16, -10, 16);
    const label = this.add.text(-34, 0, '😭', { fontSize: '30px' }).setOrigin(0.5);
    this.indicator = this.add.container(0, 0, [g, label]).setScrollFactor(0).setDepth(1000).setVisible(false);
  }

  private updateIndicator() {
    const cam = this.cameras.main;
    const view = cam.worldView;
    const visible = this.bf.x > view.x - 20 && this.bf.x < view.right + 20 && this.bf.rig.alpha > 0.1;
    this.indicator.setVisible(!visible);
    if (!visible) {
      const right = this.bf.x > view.centerX;
      const sy = Phaser.Math.Clamp((this.bf.y - view.y) * cam.zoom, 120, GAME_H - 120);
      this.indicator.setPosition(right ? GAME_W - 40 : 70, sy);
      const g = this.indicator.list[0] as Phaser.GameObjects.Graphics;
      g.setScale(right ? 1 : -1, 1);
      const lbl = this.indicator.list[1] as Phaser.GameObjects.Text;
      lbl.setX(right ? -34 : 34);
      this.indicator.setScale(1 + Math.sin(this.time.now / 150) * 0.08);
    }
  }

  // -------------------------------------------------------- tutorial

  private updateTutorial() {
    if (this.def.index !== 0 || this.tutorialStep > 4) return;
    const touch = !!this.mobile;
    const steps = touch
      ? ['Hold <b>◀ ▶</b> to run', 'Tap <b>⬆</b> to jump', 'Tap the big <b>🩴</b> button to throw (auto-aims!)', 'Tap <b>💨</b> to dash', '']
      : ['Run with <kbd>A</kbd> <kbd>D</kbd> or <kbd>←</kbd> <kbd>→</kbd>', 'Jump with <kbd>W</kbd> / <kbd>Space</kbd>', 'Aim with the mouse, <b>click</b> (or <kbd>J</kbd>) to throw', 'Dash with <kbd>Shift</kbd>', ''];
    const done = [this.gf.didMove, this.gf.didJump, this.tutorialStep > 2, this.gf.didDash];
    if (this.tutorialStep < 4 && done[this.tutorialStep]) {
      this.tutorialStep++;
      AudioManager.sfx('sparkle');
    }
    this.hud.showPrompt(steps[Math.min(this.tutorialStep, 4)]);
    if (this.tutorialStep === 4) this.tutorialStep = 5;
  }

  private tutorialAction(a: 'attack') {
    if (a === 'attack' && this.def.index === 0 && this.tutorialStep === 2) {
      this.tutorialStep = 3;
      AudioManager.sfx('sparkle');
    }
  }

  // ---------------------------------------------------------- secrets

  private buildSecret(x: number, y: number) {
    if (SaveManager.hasAchievement('secret')) return;
    this.secret = this.add.image(x, y, 'golden-heart').setDepth(20);
    this.tweens.add({ targets: this.secret, y: y - 12, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private checkSecret() {
    if (!this.secret) return;
    const d = Phaser.Math.Distance.Between(this.gf.x, this.gf.y, this.secret.x, this.secret.y);
    if (d < 60) {
      burst(this, this.secret.x, this.secret.y, 'heart', { count: 16, tint: [0xffc93c, 0xff7eb6], speed: 200, scale: 0.6, life: 900, gravity: -50 });
      this.secret.destroy();
      this.secret = null;
      AudioManager.sfx('sparkle');
      toast(`💛 <span>${esc(personalization.secretMessage)}</span>`, 'toast-secret', 7000);
      unlockAchievement('secret');
    }
  }

  private heartTap() {
    this.heartTaps++;
    AudioManager.sfx('heart');
    const cam = this.cameras.main;
    const hx = cam.worldView.x + GAME_W - 130 + Math.random() * 40;
    const hy = cam.worldView.y + 90;
    const heart = this.add.image(hx, hy, 'heart').setTint(0xff4f8b).setDepth(1001).setScale(0.8);
    this.tweens.add({ targets: heart, y: hy + 160 + Math.random() * 120, x: hx - 60 + Math.random() * 120, alpha: 0, scale: 1.6, duration: 1400, onComplete: () => heart.destroy() });
    if (this.heartTaps >= 10) unlockAchievement('heart-tap');
  }
}
