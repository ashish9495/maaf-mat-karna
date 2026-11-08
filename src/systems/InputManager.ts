/**
 * Unifies keyboard, mouse and on-screen touch buttons into one input state.
 * "Pressed" flags are edge-triggered and cleared every frame by endFrame().
 */
import Phaser from 'phaser';

export class InputManager {
  left = false;
  right = false;
  jumpHeld = false;
  jumpPressed = false;
  attackHeld = false;
  attackPressed = false;
  dashPressed = false;
  cycle = 0;
  select = -1;
  pausePressed = false;
  /** world-space aim target while the mouse is being used */
  aimWorld: { x: number; y: number } | null = null;
  private lastMouseMove = -99999;

  // touch button states (set by MobileControls)
  touch = { left: false, right: false, jump: false, attack: false };

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private scene: Phaser.Scene;
  enabled = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({
      a: K.A, d: K.D, w: K.W, left: K.LEFT, right: K.RIGHT, up: K.UP, space: K.SPACE,
      j: K.J, k: K.K, shift: K.SHIFT, q: K.Q, e: K.E, esc: K.ESC, p: K.P,
      one: K.ONE, two: K.TWO, three: K.THREE, four: K.FOUR, five: K.FIVE,
      six: K.SIX, seven: K.SEVEN, eight: K.EIGHT, nine: K.NINE, zero: K.ZERO,
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    // prevent the page from scrolling on arrows/space
    kb.addCapture([K.SPACE, K.UP, K.DOWN, K.LEFT, K.RIGHT]);

    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) return;
      this.lastMouseMove = scene.time.now;
      this.aimWorld = { x: p.worldX, y: p.worldY };
    });
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch || !this.enabled) return;
      if (p.leftButtonDown()) {
        this.attackPressed = true;
        this.lastMouseMove = scene.time.now;
        this.aimWorld = { x: p.worldX, y: p.worldY };
      }
    });
    scene.input.mouse?.disableContextMenu();
  }

  /** Mouse aim counts only if the mouse moved recently; otherwise auto-aim is used. */
  usingMouseAim() {
    return this.aimWorld !== null && this.scene.time.now - this.lastMouseMove < 2500;
  }

  update() {
    const k = this.keys;
    const JD = Phaser.Input.Keyboard.JustDown;
    const p = this.scene.input.activePointer;
    if (p && !p.wasTouch && this.usingMouseAim()) {
      // keep world aim correct while the camera scrolls
      this.aimWorld = { x: p.worldX, y: p.worldY };
    }
    this.left = k.a.isDown || k.left.isDown || this.touch.left;
    this.right = k.d.isDown || k.right.isDown || this.touch.right;
    const jumpDown = k.w.isDown || k.up.isDown || k.space.isDown || this.touch.jump;
    if (JD(k.w) || JD(k.up) || JD(k.space)) this.jumpPressed = true;
    this.jumpHeld = jumpDown;
    if (JD(k.j)) this.attackPressed = true;
    this.attackHeld = k.j.isDown || this.touch.attack || (p && !p.wasTouch && p.leftButtonDown() && this.usingMouseAim());
    if (JD(k.shift) || JD(k.k)) this.dashPressed = true;
    if (JD(k.q)) this.cycle = -1;
    if (JD(k.e)) this.cycle = 1;
    [k.one, k.two, k.three, k.four, k.five, k.six, k.seven, k.eight, k.nine, k.zero].forEach((key, i) => {
      if (JD(key)) this.select = i;
    });
    if (JD(k.esc) || JD(k.p)) this.pausePressed = true;
    if (!this.enabled) {
      this.left = this.right = this.attackHeld = this.jumpHeld = false;
      this.jumpPressed = this.attackPressed = this.dashPressed = false;
      this.cycle = 0;
      this.select = -1;
    }
  }

  endFrame() {
    this.jumpPressed = false;
    this.attackPressed = false;
    this.dashPressed = false;
    this.cycle = 0;
    this.select = -1;
    this.pausePressed = false;
  }

  /** Called by touch buttons for edge-triggered actions. */
  press(action: 'jump' | 'attack' | 'dash' | 'cycle' | 'pause') {
    if (action === 'jump') this.jumpPressed = true;
    if (action === 'attack') this.attackPressed = true;
    if (action === 'dash') this.dashPressed = true;
    if (action === 'cycle') this.cycle = 1;
    if (action === 'pause') this.pausePressed = true;
  }

  resetTouch() {
    this.touch = { left: false, right: false, jump: false, attack: false };
  }
}
