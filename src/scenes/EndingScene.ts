/** The two endings: A — the hug (forgiven) and B — the playful pillow bonk (not yet). */
import Phaser from 'phaser';
import { GAME_H, GAME_W, GROUND_Y } from '../config/gameConfig';
import { personalization } from '../config/personalization';
import { dialogue } from '../config/dialogueConfig';
import { CutsceneManager } from '../systems/CutsceneManager';
import { AudioManager } from '../systems/AudioManager';
import { SaveManager } from '../systems/SaveManager';
import { unlockAchievement } from '../systems/AchievementSystem';
import { buildStage, Grade, STAGE_CENTER, type Stage } from './stage';
import { achievementReveal, captionLines, endingButtons, handwrittenNote } from '../ui/StoryUI';
import { openMemoryMontage } from '../ui/MemoryMontage';
import { btn, clearUI, toast } from '../ui/dom';
import { burst, starsOverHead } from '../utils/effects';
import { t, motionScale } from '../utils/helpers';

export class EndingScene extends Phaser.Scene {
  private st!: Stage;
  private cs!: CutsceneManager;
  private forgiven = true;
  private fireworks: Phaser.Time.TimerEvent | null = null;
  private hugging = false;

  constructor() {
    super('Ending');
  }

  init(data: { forgiven?: boolean }) {
    this.forgiven = data.forgiven !== false;
    this.hugging = false;
  }

  create() {
    clearUI();
    this.st = buildStage(this);
    this.cs = new CutsceneManager(this);
    const grade = new Grade(this);
    grade.set(0.15);
    const cam = this.cameras.main;
    cam.setZoom(1.5);
    cam.centerOn(STAGE_CENTER + 30, 450);
    cam.fadeIn(700, 255, 236, 214);
    const { gf, bf, warm, vignette, hearts } = this.st;
    warm.fillAlpha = 0.14;
    vignette.alpha = 0.45;
    gf.x = STAGE_CENTER - 30;
    gf.pose = 'idle';
    gf.setExpression('teary');
    bf.pose = 'beg';
    bf.setExpression('teary');
    const dropped = this.add.image(STAGE_CENTER - 120, GROUND_Y - 14, 'w-ultimate').setScale(0.6).setAngle(160).setDepth(49).setAlpha(0.85);
    hearts.start();
    AudioManager.startRomantic(2);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.fireworks?.remove();
    });

    if (this.forgiven) this.cs.run((cs) => this.endingA(cs));
    else this.cs.run((cs) => this.endingB(cs, dropped));
  }

  // ------------------------------------------------------------ Ending A

  private async endingA(cs: CutsceneManager) {
    const { gf, bf, warm, hearts } = this.st;
    const cam = this.cameras.main;
    await cs.wait(500);
    gf.setExpression('tearSmile');
    AudioManager.sfx('sparkle');
    await cs.wait(900);
    bf.setExpression('shock');
    await cs.wait(700);
    bf.setExpression('teary');
    gf.pose = 'walk';
    await cs.tween({ targets: gf, x: STAGE_CENTER + 20, duration: 1000, ease: 'Sine.easeInOut' });
    gf.pose = 'idle';
    bf.pose = 'idle';
    bf.setExpression('tearSmile');
    bf.bounce(-0.15);
    await cs.wait(700);
    await this.hug(cs);

    cam.zoomTo(1.3, 3000, 'Sine.easeInOut');
    cam.pan(STAGE_CENTER + 60, 380, 3000, 'Sine.easeInOut');
    this.tweens.add({ targets: warm, fillAlpha: 0.22, duration: 3000 });
    hearts.setFrequency(Math.round(90 / motionScale()));
    this.startFireworks();

    SaveManager.unlockEnding('forgiven');
    unlockAchievement('soft-heart');
    await cs.wait(1200);
    const reveal = achievementReveal('"FORGIVEN BY MUMMA ❤️"');
    await cs.wait(3200);
    reveal.classList.remove('show');
    await cs.until(captionLines(["Turns out the strongest weapon was never the chappal...", 'It was love.'], 2600));
    await cs.wait(1500);
    document.querySelector('.caption-lines')?.classList.add('fade');
    await cs.wait(800);
    this.showNote();
  }

  private async hug(cs: CutsceneManager) {
    const { gf, bf } = this.st;
    this.hugging = true;
    gf.pose = 'hug';
    bf.pose = 'hug';
    gf.setExpression('happy');
    bf.setExpression('happy');
    AudioManager.sfx('hug');
    const tg = cs.tween({ targets: gf, x: STAGE_CENTER + 62, duration: 600, ease: 'Sine.easeOut' });
    await cs.tween({ targets: bf, x: STAGE_CENTER + 104, duration: 600, ease: 'Sine.easeOut' });
    await tg;
    gf.setDepth(51);
    burst(this, STAGE_CENTER + 83, GROUND_Y - 120, 'heart', { count: 24, tint: [0xff4f8b, 0xff9ec7, 0xffc93c], speed: 240, scale: 0.7, life: 1400, gravity: -80 });
    gf.setExpression('closed');
    bf.setExpression('closed');
    // gentle squeezes
    for (let i = 0; i < 3; i++) {
      gf.bounce(0.07);
      bf.bounce(0.07);
      await cs.wait(520);
    }
    gf.setExpression('happy');
    bf.setExpression('tearSmile');
    this.hugging = false;
  }

  private startFireworks() {
    if (this.fireworks) return;
    const fire = () => {
      const cam = this.cameras.main.worldView;
      const x = cam.x + 80 + Math.random() * (cam.width - 160);
      const y = cam.y + 40 + Math.random() * cam.height * 0.35;
      const cols = [[0xff4f8b, 0xffc93c], [0xb48cff, 0xffffff], [0x7fd3ff, 0xff9ec7], [0xffe066, 0xff7e6b]][Math.floor(Math.random() * 4)];
      burst(this, x, y, Math.random() < 0.5 ? 'heart' : 'star', { count: 26, tint: cols, speed: 260, scale: 0.45, life: 1300, gravity: 60, depth: 30 });
      burst(this, x, y, 'dot', { count: 12, tint: 0xffffff, speed: 120, scale: 0.3, life: 900, gravity: 40, depth: 30 });
      AudioManager.sfx('firework');
    };
    fire();
    this.fireworks = this.time.addEvent({ delay: SaveManager.settings.reducedMotion ? 2600 : 1300, loop: true, callback: fire });
  }

  private showNote() {
    const p = personalization;
    let note: HTMLDivElement | null = null;
    const buttons = [
      btn('🤗 Hug Again', async () => {
        if (this.hugging || !note) return;
        note.classList.add('peek');
        await this.cs.run(async (cs) => {
          this.st.gf.x = STAGE_CENTER + 20;
          this.st.bf.x = STAGE_CENTER + 110;
          this.st.gf.pose = 'idle';
          this.st.bf.pose = 'idle';
          await cs.wait(300);
          await this.hug(cs);
          await cs.wait(800);
        });
        note?.classList.remove('peek');
      }, 'btn'),
      btn('📸 Replay Our Memories', () => {
        note?.classList.add('peek');
        openMemoryMontage({ replay: true, onDone: () => note?.classList.remove('peek') });
      }, 'btn btn-ghost'),
      btn('🔁 Play Again', () => this.leave('Intro'), 'btn btn-ghost'),
      btn('💾 Save Our Ending', () => this.saveEnding(), 'btn btn-ghost'),
      btn('🏠 Menu', () => this.leave('Menu'), 'btn-link'),
    ];
    note = handwrittenNote(p.finalNote, p.signature, buttons);
  }

  // ------------------------------------------------------------ Ending B

  private async endingB(cs: CutsceneManager, dropped: Phaser.GameObjects.Image) {
    const { gf, bf } = this.st;
    const L = dialogue.endingB;
    await cs.wait(600);
    gf.setExpression('smirk');
    AudioManager.sfx('laugh', { pitch: 1.1 });
    await cs.wait(800);
    gf.setExpression('evil');
    gf.holdWeapon('w-pillow', 0.4);
    AudioManager.sfx('sparkle');
    burst(this, gf.x + 20, gf.y - 70, 'star', { count: 8, tint: 0xffe066, speed: 100, scale: 0.4, life: 500 });
    await cs.wait(900);
    bf.setExpression('shock');
    await cs.wait(400);
    gf.triggerAttack();
    await cs.wait(160);
    AudioManager.sfx('bonk');
    AudioManager.hitVoice();
    bf.pose = 'hurt';
    bf.setExpression('hurt');
    bf.bounce(0.3);
    burst(this, bf.x - 10, bf.y - 110, 'feather', { count: 10, tint: 0xffffff, speed: 160, scale: 0.7, life: 900, gravity: 100, rotate: true });
    starsOverHead(this, () => bf.headTop(), 2200);
    await cs.wait(500);
    bf.pose = 'kneel';
    bf.setExpression('cry');
    this.st.say('bf', t(L.ouch), 2000);
    AudioManager.sfx('cry', { pitch: 1.2 });
    await cs.wait(2200);
    bf.setExpression('tearSmile');
    bf.pose = 'beg';
    this.st.say('bf', t(L.promise), 3000);
    await cs.wait(2400);
    gf.pose = 'laugh';
    gf.setExpression('smirk');
    AudioManager.sfx('laugh');
    await cs.wait(1200);
    gf.pose = 'idle';

    SaveManager.unlockEnding('boss');
    unlockAchievement('still-angry');
    achievementReveal('"MUMMA IS STILL THE BOSS 😈"', 'Some boss fights take a little more patience.');
    await cs.wait(2200);
    endingButtons([
      btn('💞 Try the Ending Again', () => this.leave('Cinematic', { startAt: 'choice' }), 'btn'),
      btn('📸 Replay Memories', () => openMemoryMontage({ replay: true, onDone: () => {} }), 'btn btn-ghost'),
      btn('🔁 Play Again', () => this.leave('Intro'), 'btn btn-ghost'),
      btn('🏠 Menu', () => this.leave('Menu'), 'btn-link'),
    ]);
    void dropped;
  }

  // ------------------------------------------------------------ helpers

  private leaving = false;
  private leave(key: string, data: object = {}) {
    if (this.leaving) return;
    this.leaving = true;
    clearUI();
    if (key !== 'Cinematic') AudioManager.stopRomantic(1.2);
    this.cameras.main.fadeOut(600, 255, 220, 235);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.leaving = false;
      this.scene.start(key, data);
    });
  }

  /** Builds a keepsake image of the ending and downloads (or shares) it. */
  private saveEnding() {
    const p = personalization;
    this.game.renderer.snapshot((snap) => {
      const img = snap as HTMLImageElement;
      const c = document.createElement('canvas');
      c.width = GAME_W;
      c.height = GAME_H + 170;
      const ctx = c.getContext('2d')!;
      const grad = ctx.createLinearGradient(0, 0, 0, c.height);
      grad.addColorStop(0, '#ffe1ef');
      grad.addColorStop(1, '#d7c8ff');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, c.width, c.height);
      try {
        ctx.drawImage(img, 0, 0, GAME_W, GAME_H);
      } catch {
        /* snapshot unavailable */
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, GAME_H, c.width, 170);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff3d7f';
      ctx.font = '800 54px "Baloo 2", sans-serif';
      ctx.fillText('FORGIVEN BY MUMMA ❤️', GAME_W / 2, GAME_H + 70);
      ctx.fillStyle = '#6a2a4a';
      ctx.font = '700 38px "Caveat", cursive';
      const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
      ctx.fillText(`${p.girlfriend.name} & ${p.boyfriend.name} · ${date}`, GAME_W / 2, GAME_H + 125);
      c.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'our-ending.png', { type: 'image/png' });
        const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
        if (nav.canShare && nav.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
          try {
            await navigator.share({ files: [file], title: 'Our ending ❤️' });
            return;
          } catch {
            /* fall through to download */
          }
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'maaf-mat-karna-our-ending.png';
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast('💾 Saved <b>our-ending.png</b>', '', 2500);
      }, 'image/png');
    });
  }

  update(_t: number, dt: number) {
    this.st.tick(dt);
  }
}
