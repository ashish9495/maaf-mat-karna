/**
 * Character portraits for menus/HUD.
 * Priority: your portrait image from personalization.ts → a snapshot of the in-game rig → emoji fallback.
 */
import Phaser from 'phaser';
import { personalization } from '../config/personalization';
import { CharacterRig } from '../characters/CharacterRig';
import { assetExists } from './helpers';

const portraits: Record<'gf' | 'bf', string> = {
  gf: emojiSvg('😈'),
  bf: emojiSvg('😭'),
};

function emojiSvg(e: string) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='#ffd1e3'/><text x='50' y='68' font-size='54' text-anchor='middle'>${e}</text></svg>`)}`;
}

export function getPortrait(who: 'gf' | 'bf') {
  return portraits[who];
}

function snapshotRig(scene: Phaser.Scene, who: 'gf' | 'bf'): Promise<string> {
  return new Promise((resolve) => {
    const look = who === 'gf' ? personalization.girlfriend.look : personalization.boyfriend.look;
    const rig = new CharacterRig(scene, 80, 205, look, who === 'gf' ? 'khushi' : 'ashish', 1.55);
    rig.setExpression(who === 'gf' ? 'evil' : 'panic');
    rig.tick(16);
    const rt = scene.make.renderTexture({ x: 0, y: 0, width: 160, height: 160 }, false);
    rt.fill(who === 'gf' ? 0xffd1e3 : 0xd7c8ff, 1);
    rt.draw(rig);
    rt.snapshot((img) => {
      resolve((img as HTMLImageElement).src || '');
      rig.destroy();
      rt.destroy();
    });
  });
}

export async function preparePortraits(scene: Phaser.Scene) {
  for (const who of ['gf', 'bf'] as const) {
    const path = who === 'gf' ? personalization.girlfriend.look.portrait : personalization.boyfriend.look.portrait;
    if (path && (await assetExists(path))) {
      portraits[who] = path;
      continue;
    }
    try {
      const src = await snapshotRig(scene, who);
      if (src) portraits[who] = src;
    } catch {
      /* keep emoji fallback */
    }
  }
}
