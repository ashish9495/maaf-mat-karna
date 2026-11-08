import Phaser from 'phaser';
import './style.css';
import { GAME_H, GAME_W, PLAYER } from './config/gameConfig';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { IntroScene } from './scenes/IntroScene';
import { LevelScene } from './scenes/LevelScene';
import { FinalCinematicScene } from './scenes/FinalCinematicScene';
import { EndingScene } from './scenes/EndingScene';
import { AudioManager } from './systems/AudioManager';
import { isTouchDevice } from './ui/dom';

if (isTouchDevice()) document.body.classList.add('touch');

// Browsers only allow audio after a user gesture.
const unlock = () => AudioManager.unlock();
// Different mobile browsers only accept certain events as an "unlock" gesture
// (iOS Safari: touchend/click; Android Chrome: pointerdown/up), so listen to all of them.
['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown'].forEach((ev) =>
  window.addEventListener(ev, unlock, { passive: true, capture: true }),
);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#ffd9ea',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { antialias: true, roundPixels: false },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: PLAYER.gravity }, debug: false },
  },
  input: { activePointers: 4 },
  // shorter post-load "panic" period so slower phones reach normal speed quickly
  fps: { target: 60, panicMax: 20 },
  scene: [BootScene, MenuScene, IntroScene, LevelScene, FinalCinematicScene, EndingScene],
});

// expose for debugging / automated tests
(window as unknown as { __game: Phaser.Game }).__game = game;

// Keep the canvas sized correctly when the phone rotates or the window resizes.
// On narrow portrait screens the canvas sits at the top so menus fit underneath it.
function applyLayout() {
  const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 700;
  game.scale.autoCenter = portrait ? Phaser.Scale.CENTER_HORIZONTALLY : Phaser.Scale.CENTER_BOTH;
  game.scale.refresh();
}
window.addEventListener('resize', applyLayout);
window.addEventListener('orientationchange', () => setTimeout(applyLayout, 300));
game.events.once(Phaser.Core.Events.READY, applyLayout);

