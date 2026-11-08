/**
 * The final cinematic: collapse → final weapon → music → atmosphere change →
 * memory montage → weapon lowered → "Ek hug milega?" → forgiveness choice.
 * Driven by CutsceneManager; every beat waits on the scene clock or the player.
 */
import Phaser from 'phaser';
import { GROUND_Y } from '../config/gameConfig';
import { personalization } from '../config/personalization';
import { dialogue } from '../config/dialogueConfig';
import { CutsceneManager } from '../systems/CutsceneManager';
import { AudioManager } from '../systems/AudioManager';
import { SaveManager } from '../systems/SaveManager';
import { buildStage, Grade, STAGE_CENTER, type Stage } from './stage';
import { DialogueBox, forgivenessModal, skipButton } from '../ui/StoryUI';
import { openMemoryMontage } from '../ui/MemoryMontage';
import { clearUI } from '../ui/dom';
import { burst } from '../utils/effects';
import { t } from '../utils/helpers';

interface CineData {
  fromChase?: boolean;
  startAt?: 'choice';
}

export class FinalCinematicScene extends Phaser.Scene {
  private st!: Stage;
  private cs!: CutsceneManager;
  private dlg!: DialogueBox;
  private grade!: Grade;
  private skipBtn: HTMLButtonElement | null = null;
  private afterMemories = false;
  private aura: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private startAt: CineData['startAt'];
  private choiceMade = false;

  constructor() {
    super('Cinematic');
  }

  init(data: CineData) {
    this.startAt = data.startAt;
    this.afterMemories = false;
    this.choiceMade = false;
  }

  create() {
    clearUI();
    document.body.classList.remove('in-game');
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.st = buildStage(this);
    this.grade = new Grade(this);
    this.dlg = new DialogueBox();
    this.cs = new CutsceneManager(this);
    this.cameras.main.fadeIn(1200, 255, 236, 214);

    const { gf, bf } = this.st;
    bf.pose = 'kneel';
    bf.setExpression('cry');
    gf.holdWeapon('w-ultimate', 0.55);
    gf.setExpression('evil');
    gf.pose = 'idle';

    this.aura = this.add.particles(0, 0, 'star', {
      follow: gf,
      followOffset: { x: 30, y: -100 },
      speed: { min: 20, max: 70 },
      scale: { start: 0.45, end: 0 },
      lifespan: 700,
      frequency: 70,
      tint: [0xff7eb6, 0xc77dff, 0xffe066],
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(55);

    this.skipBtn = skipButton(() => {
      if (this.choiceMade) return;
      this.cs.skipTo(this.afterMemories ? 'choice' : 'memories');
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.dlg.destroy();
      this.skipBtn?.remove();
      this.tweens.timeScale = 1;
    });

    if (this.startAt === 'choice') {
      this.cs.run((cs) => this.toChoice(cs, true));
    } else {
      this.cs.run((cs) => this.play(cs));
    }
  }

  private async play(cs: CutsceneManager) {
    const { gf, bf, warm, vignette, hearts } = this.st;
    const cam = this.cameras.main;
    const bfName = personalization.boyfriend.nickname;
    const L = dialogue.cinematic;

    // ---------- Scene 1: the collapse
    bf.pose = 'stumble';
    bf.setExpression('shock');
    await cs.wait(700);
    bf.pose = 'kneel';
    bf.setExpression('cry');
    AudioManager.sfx('land');
    burst(this, bf.x, GROUND_Y, 'dot', { count: 10, tint: 0xffffff, speed: 120, scale: 0.5, life: 500, gravity: 0 });
    AudioManager.sfx('cry', { pitch: 0.9 });
    await cs.wait(1200);
    gf.setExpression('smirk');
    gf.pose = 'walk';
    // the chase song has faded out; as she walks towards him, the ending song begins
    AudioManager.startRomantic(4);
    cam.zoomTo(1.25, 4000, 'Sine.easeInOut');
    cam.pan(STAGE_CENTER - 40, 400, 4000, 'Sine.easeInOut');
    this.tweens.add({ targets: vignette, alpha: 0.7, duration: 3000 });
    await cs.tween({ targets: gf, x: STAGE_CENTER - 120, duration: 2600, ease: 'Sine.easeInOut' });
    gf.pose = 'idle';
    AudioManager.sfx('whoosh');
    await cs.wait(900);
    await cs.until(this.dlg.show(bfName, t(L.whisper1), 'bf'));
    await cs.wait(400);
    await cs.until(this.dlg.show(bfName, t(L.whisper2), 'bf'));
    this.dlg.hide();
    await cs.wait(1200);

    // ---------- Scene 2: the final weapon
    gf.pose = 'raise';
    gf.setExpression('evil');
    AudioManager.sfx('charge');
    this.aura?.setFrequency(25);
    await cs.wait(500);
    this.tweens.timeScale = 0.35;
    this.setPetalSpeed(0.05);
    await cs.tween({
      targets: this.grade, sat: -0.75, duration: 500,
      onUpdate: () => this.grade.set(this.grade.sat),
    });
    bf.setExpression('closed');
    await cs.wait(900);
    this.tear(bf);
    await cs.wait(1200);
    for (const line of L.sorry) await cs.until(this.dlg.show(bfName, t(line), 'bf'));
    await cs.wait(300);

    // ---------- Scene 3: the music swells
    AudioManager.startRomantic(3); // no-op if already playing
    for (const line of L.still) await cs.until(this.dlg.show(bfName, t(line), 'bf'));
    this.dlg.hide();

    // ---------- Scene 4: the change in atmosphere
    this.tweens.timeScale = 1;
    this.setPetalSpeed(1);
    this.aura?.setFrequency(260);
    this.tweens.add({ targets: this.grade, sat: 0.15, duration: 3500, onUpdate: () => this.grade.set(this.grade.sat) });
    this.tweens.add({ targets: warm, fillAlpha: 0.14, duration: 4000 });
    this.tweens.add({ targets: vignette, alpha: 0.45, duration: 3000 });
    hearts.start();
    gf.pose = 'idle';
    gf.setExpression('shock');
    await cs.wait(1600);
    gf.setExpression('sad');
    bf.setExpression('teary');
    bf.pose = 'beg';
    await cs.wait(900);
    for (let i = 0; i < L.promise.length; i++) {
      if (i === 2) gf.setExpression('teary');
      await cs.until(this.dlg.show(bfName, t(L.promise[i]), 'bf'));
    }
    this.dlg.hide();
    await cs.wait(1200);

    // ---------- Memory montage
    cs.consumeSkip('memories');
    this.clearPrompts();
    SaveManager.progress.cinematicSeen = true;
    SaveManager.saveProgress();
    AudioManager.startRomantic(3); // no-op if already playing a file; ensures music after a skip
    await cs.until(new Promise<void>((resolve) => openMemoryMontage({ onDone: resolve })));
    this.afterMemories = true;

    await this.toChoice(cs, false);
  }

  /** Scene 14–15: weapon lowered, the hug request, the choice. */
  private async toChoice(cs: CutsceneManager, direct: boolean) {
    const { gf, bf, warm, vignette, hearts } = this.st;
    const cam = this.cameras.main;
    const bfName = personalization.boyfriend.nickname;
    const L = dialogue.cinematic;
    this.afterMemories = true;

    if (direct) {
      this.grade.set(0.15);
      warm.fillAlpha = 0.14;
      vignette.alpha = 0.45;
      hearts.start();
      gf.x = STAGE_CENTER - 120;
      gf.pose = 'raise';
      gf.setExpression('teary');
      bf.pose = 'beg';
      bf.setExpression('teary');
      this.aura?.setFrequency(400);
      cam.setZoom(1.25);
      cam.centerOn(STAGE_CENTER - 40, 400);
      AudioManager.startRomantic(2);
      await cs.wait(800);
    }

    // return to the garden: he looks up, she lowers the weapon
    bf.pose = 'beg';
    bf.setExpression('teary');
    gf.setExpression('teary');
    gf.pose = 'lower';
    await cs.wait(1800);
    gf.pose = 'idle';
    gf.setExpression('sad');
    await cs.wait(600);
    this.dropWeapon();
    this.aura?.stop();
    await cs.wait(1100);
    gf.setExpression('teary');
    gf.pose = 'walk';
    await cs.tween({ targets: gf, x: STAGE_CENTER - 30, duration: 1600, ease: 'Sine.easeInOut' });
    gf.pose = 'idle';
    await cs.until(this.dlg.show(bfName, t(L.hug1), 'bf'));
    await cs.until(this.dlg.show(bfName, t(L.hug2), 'bf'));
    this.dlg.hide();
    cam.zoomTo(1.55, 2200, 'Sine.easeInOut');
    cam.pan(STAGE_CENTER + 30, 450, 2200, 'Sine.easeInOut');
    await cs.wait(1700);

    cs.consumeSkip('choice');
    this.clearPrompts();
    this.skipBtn?.remove();
    // make sure the scene looks right even after a skip
    if (gf.weaponSprite) this.dropWeapon();
    gf.x = STAGE_CENTER - 30;
    gf.pose = 'idle';
    gf.setExpression('teary');
    bf.pose = 'beg';
    bf.setExpression('teary');

    forgivenessModal((yes) => {
      if (this.choiceMade) return;
      this.choiceMade = true;
      this.cameras.main.fadeOut(700, 255, 236, 214);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Ending', { forgiven: yes }));
    });
  }

  /** After a skip, remove prompts left on screen by fast-forwarded beats. */
  private clearPrompts() {
    this.dlg.hide();
    document.querySelectorAll('.continue-prompt').forEach((e) => e.remove());
  }

  private tear(bf: Phaser.GameObjects.Container) {
    const tear = this.add.image(bf.x - 10, bf.y - 82, 'dot').setTint(0x7fcfff).setScale(0.45, 0.6).setDepth(80);
    this.tweens.add({ targets: tear, y: bf.y - 50, alpha: 0, duration: 2400, ease: 'Sine.easeIn', onComplete: () => tear.destroy() });
    AudioManager.sfx('sparkle');
  }

  private dropWeapon() {
    const gf = this.st.gf;
    if (!gf.weaponSprite) return;
    const m = gf.weaponSprite.getWorldTransformMatrix();
    const w = this.add.image(m.tx, m.ty, 'w-ultimate').setScale(0.55 * gf.baseScale).setDepth(49);
    gf.holdWeapon(null);
    this.tweens.add({ targets: w, y: GROUND_Y - 14, x: w.x + 30, angle: 160, duration: 800, ease: 'Bounce.easeOut' });
    this.tweens.add({ targets: w, alpha: 0.85, duration: 800 });
    this.time.delayedCall(420, () => AudioManager.sfx('drop'));
  }

  private setPetalSpeed(k: number) {
    this.children.list.forEach((o) => {
      if (o instanceof Phaser.GameObjects.Particles.ParticleEmitter && o !== this.aura) o.timeScale = k;
    });
  }

  update(_t: number, dt: number) {
    this.st.tick(dt);
  }
}
