/** Short animated intro: the argument, the threat, the panic, the run. */
import Phaser from 'phaser';
import { LEVELS, GROUND_Y } from '../config/gameConfig';
import { personalization } from '../config/personalization';
import { CharacterRig } from '../characters/CharacterRig';
import { buildWorld } from '../systems/Environment';
import { CutsceneManager } from '../systems/CutsceneManager';
import { SpeechBubble, burst, shake } from '../utils/effects';
import { dialogue } from '../config/dialogueConfig';
import { t } from '../utils/helpers';
import { clearUI } from '../ui/dom';
import { skipButton } from '../ui/StoryUI';
import { AudioManager } from '../systems/AudioManager';

export class IntroScene extends Phaser.Scene {
  private gf!: CharacterRig;
  private bf!: CharacterRig;
  private bubble: SpeechBubble | null = null;
  private cs!: CutsceneManager;
  private leaving = false;

  constructor() {
    super('Intro');
  }

  create() {
    clearUI();
    this.leaving = false;
    buildWorld(this, LEVELS[0]);
    this.cameras.main.setBounds(0, 0, LEVELS[0].width, 720);
    this.cameras.main.fadeIn(400, 255, 220, 235);

    this.gf = new CharacterRig(this, 420, GROUND_Y, personalization.girlfriend.look, 'khushi', 1.1).setDepth(50);
    this.gf.setExpression('evil');
    this.gf.holdWeapon('w-chappal', 0.8);
    this.bf = new CharacterRig(this, 820, GROUND_Y, personalization.boyfriend.look, 'ashish', 1.1).setDepth(50);
    this.bf.setFacing(-1);
    this.bf.setExpression('happy');

    AudioManager.startChase();
    const skip = skipButton(() => this.finish());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => skip.remove());

    this.cs = new CutsceneManager(this);
    this.cs.run(async (cs) => {
      const say = async (who: 'gf' | 'bf', text: string, ms = 2300) => {
        this.bubble?.pop();
        this.bubble = new SpeechBubble(this, who === 'gf' ? this.gf : this.bf, text, ms, who === 'gf' ? 0xffe1ef : 0xffffff, true);
        await cs.until(this.waitClickOr(ms));
      };
      await cs.wait(500);
      const lines = dialogue.intro;
      this.gf.pose = 'laugh';
      AudioManager.sfx('laugh');
      await say('gf', t(lines[0].line));
      this.gf.pose = 'idle';
      this.bf.setExpression('shock');
      this.bf.pose = 'hurt';
      AudioManager.sfx('cry', { pitch: 1.2 });
      await say('bf', t(lines[1].line));
      this.bf.pose = 'idle';
      this.bf.setExpression('panic');
      this.gf.pose = 'raise';
      AudioManager.sfx('charge');
      await say('gf', t(lines[2].line));
      this.bf.setFacing(1);
      this.bf.pose = 'panicRun';
      shake(this, 0.004, 200);
      burst(this, this.bf.x, GROUND_Y, 'dot', { count: 14, tint: 0xffffff, speed: 200, scale: 0.6, life: 500, gravity: 0 });
      this.bubble?.pop();
      this.bubble = new SpeechBubble(this, this.bf, t(lines[3].line), 1600, 0xffffff, true);
      this.tweens.add({ targets: this.bf, x: 1500, duration: 1500, ease: 'Quad.easeIn' });
      await cs.wait(500);
      this.gf.pose = 'run';
      this.tweens.add({ targets: this.gf, x: 1400, duration: 1900, ease: 'Quad.easeIn' });
      this.cameras.main.pan(1000, 360, 1600, 'Sine.easeInOut');
      await cs.wait(1300);
      this.finish();
    });
  }

  private waitClickOr(ms: number) {
    return new Promise<void>((resolve) => {
      let done = false;
      const fin = () => {
        if (done) return;
        done = true;
        this.input.off('pointerdown', fin);
        this.input.keyboard?.off('keydown', fin);
        resolve();
      };
      this.time.delayedCall(ms, fin);
      this.time.delayedCall(300, () => {
        if (done) return;
        this.input.once('pointerdown', fin);
        this.input.keyboard?.once('keydown', fin);
      });
    });
  }

  private finish() {
    if (this.leaving) return;
    this.leaving = true;
    this.cs.abort();
    this.cameras.main.fadeOut(400, 255, 220, 235);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Level', { level: 0, hp: 100, fresh: true }));
  }

  update(_t: number, dt: number) {
    this.gf.tick(dt);
    this.bf.tick(dt);
    if (this.bubble) {
      this.bubble.tick(dt);
      if (this.bubble.dead) this.bubble = null;
    }
  }
}
