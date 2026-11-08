/** Animated main menu: bouncing title, a chase parade, floating hearts, menu panels. */
import Phaser from 'phaser';
import { GAME_H, GAME_W, GROUND_Y } from '../config/gameConfig';
import { personalization } from '../config/personalization';
import { CharacterRig } from '../characters/CharacterRig';
import { clearUI, h, btn, mount } from '../ui/dom';
import { openCredits, openGallery, openHowToPlay, openSettings } from '../ui/Panels';
import { AudioManager } from '../systems/AudioManager';
import { SaveManager } from '../systems/SaveManager';
import { SpeechBubble, burst } from '../utils/effects';
import { getPortrait } from '../utils/portraits';
import { dialogue } from '../config/dialogueConfig';
import { esc, t } from '../utils/helpers';
import { openMemoryMontage } from '../ui/MemoryMontage';

export class MenuScene extends Phaser.Scene {
  private bf!: CharacterRig;
  private gf!: CharacterRig;
  private bubbles: SpeechBubble[] = [];
  private paradeX = -200;
  private removeUI: (() => void) | null = null;
  private hitZone: Phaser.GameObjects.Zone | null = null;

  constructor() {
    super('Menu');
  }

  create() {
    clearUI();
    document.body.classList.remove('in-game');
    this.bubbles = [];
    this.cameras.main.fadeIn(400, 255, 220, 235);

    const g = this.add.graphics();
    g.fillGradientStyle(0xffc2dc, 0xd7c8ff, 0xfff0c2, 0xffd9ea, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);
    for (let i = 0; i < 6; i++) {
      const c = this.add.image(Math.random() * GAME_W, 60 + Math.random() * 220, 'cloud').setAlpha(0.8).setScale(0.6 + Math.random() * 0.5);
      this.tweens.add({ targets: c, x: c.x + 120, duration: 10000 + Math.random() * 5000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // ground
    g.fillStyle(0xffb3d1, 1);
    g.fillRect(0, GROUND_Y, GAME_W, GAME_H - GROUND_Y);
    g.fillStyle(0xff9ec7, 1);
    g.fillRect(0, GROUND_Y, GAME_W, 12);

    // floating hearts & angry emojis
    this.add.particles(0, GAME_H + 20, 'heart', {
      x: { min: 0, max: GAME_W },
      speedY: { min: -90, max: -40 },
      speedX: { min: -20, max: 20 },
      lifespan: 9000,
      frequency: 500,
      scale: { min: 0.4, max: 0.9 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xff4f8b, 0xff9ec7, 0xb48cff],
    }).setDepth(1);
    this.add.particles(0, GAME_H + 20, 'p-emoji', {
      x: { min: 0, max: GAME_W },
      speedY: { min: -70, max: -30 },
      lifespan: 9000,
      frequency: 1800,
      scale: { min: 0.4, max: 0.6 },
      rotate: { min: -20, max: 20 },
      alpha: { start: 0.7, end: 0 },
    }).setDepth(1);

    this.buildTitle();

    // chase parade
    this.bf = new CharacterRig(this, -200, GROUND_Y, personalization.boyfriend.look, 'ashish', 0.9);
    this.bf.pose = 'panicRun';
    this.bf.setExpression('panic');
    this.bf.setDepth(10);
    this.gf = new CharacterRig(this, -420, GROUND_Y, personalization.girlfriend.look, 'khushi', 0.9);
    this.gf.pose = 'run';
    this.gf.setExpression('evil');
    this.gf.holdWeapon('w-chappal', 0.8);
    this.gf.setDepth(10);

    const hit = this.add.zone(0, 0, 80, 120).setInteractive({ cursor: 'pointer' });
    hit.on('pointerdown', () => {
      AudioManager.unlock();
      AudioManager.sfx('cry', { pitch: 1.3 });
      this.bubbles.push(new SpeechBubble(this, this.bf, t(dialogue.portraitClick), 1400));
    });
    this.hitZone = hit;

    this.time.addEvent({ delay: 1600, loop: true, callback: () => this.throwChappal() });

    this.buildUI();

    const startMusic = () => {
      AudioManager.unlock();
      AudioManager.startChase();
    };
    if (AudioManager.unlocked) startMusic();
    else this.input.once('pointerdown', startMusic);
    const onAny = () => {
      if (this.sys.isActive()) startMusic();
    };
    window.addEventListener('pointerdown', onAny, { once: true });
    window.addEventListener('keydown', onAny, { once: true });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.removeUI?.();
      window.removeEventListener('pointerdown', onAny);
      window.removeEventListener('keydown', onAny);
    });
  }

  private buildTitle() {
    const title = 'MAAF MAT KARNA';
    const style = {
      fontFamily: '"Baloo 2", "Nunito", sans-serif',
      fontSize: '86px',
      fontStyle: '800',
      color: '#ff3d7f',
      stroke: '#ffffff',
      strokeThickness: 12,
    };
    const letters: Phaser.GameObjects.Text[] = [];
    // measure
    let total = 0;
    const widths = Array.from(title).map((ch) => {
      const tmp = this.add.text(0, 0, ch === ' ' ? 'I' : ch, style);
      const w = ch === ' ' ? 26 : tmp.width - 10;
      tmp.destroy();
      total += w;
      return w;
    });
    let x = GAME_W / 2 - total / 2 - 40;
    Array.from(title).forEach((ch, i) => {
      if (ch !== ' ') {
        const l = this.add.text(x + widths[i] / 2, 150, ch, style).setOrigin(0.5).setDepth(5);
        l.setShadow(4, 6, 'rgba(120,30,80,0.35)', 0, true, true);
        letters.push(l);
        this.tweens.add({ targets: l, y: 132, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 70 });
        this.tweens.add({ targets: l, angle: { from: -4, to: 4 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 50 });
      }
      x += widths[i];
    });
    const devil = this.add.text(x + 30, 145, '😈', { fontSize: '76px' }).setOrigin(0.5).setDepth(5);
    this.tweens.add({ targets: devil, angle: { from: -12, to: 12 }, scale: { from: 0.95, to: 1.12 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // glow pulse on letters
    this.time.addEvent({
      delay: 2400,
      loop: true,
      callback: () => {
        letters.forEach((l, i) => this.time.delayedCall(i * 40, () => {
          l.setColor('#ffffff').setStroke('#ff3d7f', 12);
          this.time.delayedCall(140, () => l.setColor('#ff3d7f').setStroke('#ffffff', 12));
        }));
      },
    });
    const sub = this.add.text(GAME_W / 2, 230, personalization.subtitle, {
      fontFamily: '"Caveat", cursive', fontSize: '40px', color: '#7a3a6a', fontStyle: '700',
    }).setOrigin(0.5).setDepth(5);
    this.tweens.add({ targets: sub, alpha: { from: 0.75, to: 1 }, duration: 1200, yoyo: true, repeat: -1 });
  }

  private throwChappal() {
    if (this.gf.x < -100 || this.gf.x > GAME_W + 100) return;
    this.gf.triggerAttack();
    const c = this.add.image(this.gf.x + 20, this.gf.y - 70, 'w-chappal').setDepth(11);
    const tx = this.bf.x + 160;
    this.tweens.add({ targets: c, x: tx, duration: 700, ease: 'Linear' });
    this.tweens.add({ targets: c, y: { from: c.y, to: c.y - 90 }, duration: 350, yoyo: true, ease: 'Sine.easeOut' });
    this.tweens.add({
      targets: c, angle: 720, duration: 700,
      onComplete: () => {
        burst(this, c.x, c.y, 'star', { count: 6, tint: 0xffe066, speed: 160, scale: 0.4, life: 400 });
        c.destroy();
      },
    });
  }

  update(_t: number, dt: number) {
    this.paradeX += dt * 0.25;
    if (this.paradeX > GAME_W + 500) this.paradeX = -250;
    this.bf.x = this.paradeX;
    this.gf.x = this.paradeX - 210;
    this.bf.tick(dt);
    this.gf.tick(dt);
    this.hitZone?.setPosition(this.bf.x, this.bf.y - 50);
    this.bubbles = this.bubbles.filter((b) => {
      b.tick(dt);
      return !b.dead;
    });
  }

  private buildUI() {
    const gf = personalization.girlfriend;
    const bf = personalization.boyfriend;
    const p = SaveManager.progress;

    const card = (who: 'gf' | 'bf') => {
      const c = who === 'gf' ? gf : bf;
      const img = h('img', { src: getPortrait(who), alt: c.name });
      if (who === 'bf') {
        img.addEventListener('click', () => {
          AudioManager.unlock();
          AudioManager.sfx('cry', { pitch: 1.3 });
          img.classList.remove('wiggle');
          void img.offsetWidth;
          img.classList.add('wiggle');
          this.bubbles.push(new SpeechBubble(this, this.bf, t(dialogue.portraitClick), 1400));
        });
      }
      return h('div', { class: `char-card ${who}` },
        img,
        h('div', {},
          h('b', { text: c.name.toUpperCase() }),
          h('div', { class: 'cc-title', text: `"${c.title}"` }),
          h('small', { text: c.personality }),
        ),
      );
    };

    const buttons = [
      btn('▶ PLAY GAME', () => this.play(), 'btn btn-play'),
      btn('🎮 HOW TO PLAY', () => openHowToPlay(), 'btn btn-ghost'),
      btn('⚙️ SETTINGS', () => openSettings(), 'btn btn-ghost'),
      btn('💌 CREDITS', () => openCredits(), 'btn btn-ghost'),
    ];
    if (p.cinematicSeen) {
      buttons.push(btn('🎬 MEMORIES', () => openGallery({
        watchEnding: () => this.go('Cinematic', {}),
        memories: () => openMemoryMontage({ onDone: () => {}, replay: true }),
        level: (i) => this.go('Level', { level: i, hp: [100, 65, 30][i] }),
      }), 'btn btn-ghost'));
    } else {
      buttons[3].classList.add('span-2');
    }
    const inner = h('div', { class: 'menu-inner' },
      h('div', { class: 'menu-tagline', html: `<i>${esc(personalization.tagline)}</i>` }),
      h('div', { class: 'menu-row' },
        h('div', { class: 'menu-cards' }, card('gf'), card('bf')),
        h('div', { class: 'menu-buttons' }, ...buttons),
      ),
    );
    const ui = h('div', { class: 'menu' }, inner);

    // The title is drawn on the canvas, the menu is HTML on top. Place the menu in the
    // space between the subtitle and the ground, and shrink it if it doesn't fit,
    // so the two never overlap on any screen size.
    const fit = () => {
      if (!ui.isConnected) return;
      inner.style.transform = 'none';
      const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 700;
      if (portrait) {
        ui.style.top = '';
        ui.style.height = '';
        return;
      }
      const r = this.game.canvas.getBoundingClientRect();
      const k = r.height / GAME_H;
      const top = r.top + 262 * k;
      const bottom = Math.min(window.innerHeight - 6, r.top + 632 * k);
      const avail = Math.max(60, bottom - top);
      ui.style.top = `${top}px`;
      ui.style.height = `${avail}px`;
      const sc = Math.min(1, avail / inner.offsetHeight, (window.innerWidth * 0.96) / inner.offsetWidth);
      inner.style.transform = `scale(${sc})`;
    };
    const onResize = () => window.setTimeout(fit, 60);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    document.fonts?.ready.then(fit).catch(() => {});
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    });
    this.removeUI = mount(ui);
    requestAnimationFrame(fit);
    window.setTimeout(fit, 300);
  }

  private play() {
    this.go('Intro', {});
  }

  private go(key: string, data: object) {
    this.removeUI?.();
    this.removeUI = null;
    this.cameras.main.fadeOut(350, 255, 220, 235);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key, data));
  }
}
