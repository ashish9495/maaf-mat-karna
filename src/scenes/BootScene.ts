/** Boot + preload: generates all textures, waits for fonts, prepares portraits, then routes. */
import Phaser from 'phaser';
import { generateTextures } from '../utils/textures';
import { preparePortraits } from '../utils/portraits';
import { GAME_H, GAME_W } from '../config/gameConfig';
import { memories } from '../config/memoryConfig';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0xffd1e3, 0xffd1e3, 0xd7c8ff, 0xd7c8ff, 1);
    bg.fillRect(0, 0, GAME_W, GAME_H);
    const label = this.add.text(GAME_W / 2, GAME_H / 2 - 50, 'Loading chappals… 🩴', {
      fontFamily: 'sans-serif', fontSize: '34px', color: '#6a2a4a', fontStyle: 'bold',
    }).setOrigin(0.5);
    const barBg = this.add.rectangle(GAME_W / 2, GAME_H / 2 + 20, 420, 22, 0xffffff, 0.7).setStrokeStyle(3, 0x6a2a4a);
    const bar = this.add.rectangle(GAME_W / 2 - 206, GAME_H / 2 + 20, 0, 14, 0xff4f8b).setOrigin(0, 0.5);
    const setP = (p: number) => (bar.width = 412 * p);

    const steps: (() => Promise<unknown>)[] = [
      async () => generateTextures(this),
      () => Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 2500))]),
      () => preparePortraits(this),
      // warm the browser cache for memory photos so the montage opens instantly
      () => Promise.all(memories.filter((m) => m.photo).map((m) => new Promise<void>((res) => {
        const img = new Image();
        img.onload = () => res();
        img.onerror = () => res();
        img.src = m.photo;
        setTimeout(res, 4000);
      }))),
    ];

    (async () => {
      for (let i = 0; i < steps.length; i++) {
        try {
          await steps[i]();
        } catch (e) {
          console.warn('boot step failed (continuing):', e);
        }
        setP((i + 1) / steps.length);
      }
      label.setText('Ready! 😈');
      barBg.destroy();
      this.time.delayedCall(150, () => this.route());
    })();
  }

  /** URL hash shortcuts for testing: #level1 #level2 #level3 #cinematic #ending-yes #ending-no */
  private route() {
    const hsh = location.hash.replace('#', '');
    const m = hsh.match(/^level([123])$/);
    if (m) this.scene.start('Level', { level: Number(m[1]) - 1, hp: [100, 65, 30][Number(m[1]) - 1] });
    else if (hsh === 'cinematic') this.scene.start('Cinematic', {});
    else if (hsh === 'ending-yes') this.scene.start('Ending', { forgiven: true });
    else if (hsh === 'ending-no') this.scene.start('Ending', { forgiven: false });
    else this.scene.start('Menu');
  }
}
