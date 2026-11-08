/**
 * CharacterRig — a procedurally drawn, rigged chibi character.
 *
 * Every body part is its own Graphics object with its pivot at the joint,
 * so poses are produced by rotating parts every frame (anticipation, follow-through,
 * squash & stretch) instead of sliding a static picture around.
 *
 * Origin of the rig = point between the feet. Facing is handled by an inner
 * container that flips, so physics bodies never flip.
 *
 * Looks are taken from personalization.ts (skin, hair, outfit colours).
 */
import Phaser from 'phaser';
import type { CharacterLook } from '../config/personalization';
import { hex } from '../utils/helpers';

export type HairStyle = 'ashish' | 'khushi';

export type Expression =
  | 'normal' | 'happy' | 'evil' | 'panic' | 'cry' | 'hurt' | 'sad' | 'shock'
  | 'closed' | 'tearSmile' | 'puppy' | 'determined' | 'tired' | 'smirk' | 'softSmile' | 'teary';

export type Pose =
  | 'idle' | 'run' | 'panicRun' | 'jump' | 'fall' | 'hurt' | 'kneel' | 'hug' | 'attack'
  | 'aim' | 'laugh' | 'victory' | 'lower' | 'stumble' | 'hide' | 'beg' | 'raise' | 'walk' | 'lookBack' | 'dash';

const HEAD_R = 30;
/** distance from shoulder pivot to the centre of the hand */
const ARM_HAND = 18;

export class CharacterRig extends Phaser.GameObjects.Container {
  readonly look: CharacterLook;
  readonly style: HairStyle;

  private inner: Phaser.GameObjects.Container;
  private shadow: Phaser.GameObjects.Ellipse;
  private hairBack: Phaser.GameObjects.Graphics;
  private legB: Phaser.GameObjects.Graphics;
  private legF: Phaser.GameObjects.Graphics;
  private torso: Phaser.GameObjects.Graphics;
  private armB: Phaser.GameObjects.Graphics;
  private armF: Phaser.GameObjects.Graphics;
  private head: Phaser.GameObjects.Container;
  private face: Phaser.GameObjects.Graphics;
  private features: Phaser.GameObjects.Graphics;
  private hairFront: Phaser.GameObjects.Graphics;
  weaponSprite: Phaser.GameObjects.Image | null = null;

  pose: Pose = 'idle';
  expression: Expression = 'normal';
  facing: 1 | -1 = 1;
  /** angle in radians for 'aim' pose (world angle) */
  aimAngle = 0;
  /** 0..1 run intensity */
  runSpeed = 1;
  private phase = 0;
  private time = 0;
  private attackT = 1; // 0..1 swing progress
  private squash = 1;
  private blinkTimer = 2;
  private blinking = false;
  private crouch = 0;
  private lean = 0;
  private headTilt = 0;
  private lowerProgress = 0;
  baseScale: number;

  constructor(scene: Phaser.Scene, x: number, y: number, look: CharacterLook, style: HairStyle, scale = 1) {
    super(scene, x, y);
    this.look = look;
    this.style = style;
    this.baseScale = scale;

    this.shadow = scene.add.ellipse(0, 0, 54, 12, 0x000000, 0.18);
    this.inner = scene.add.container(0, 0);
    this.add([this.shadow, this.inner]);

    this.hairBack = scene.add.graphics();
    this.legB = scene.add.graphics();
    this.legF = scene.add.graphics();
    this.torso = scene.add.graphics();
    this.armB = scene.add.graphics();
    this.armF = scene.add.graphics();
    this.head = scene.add.container(0, -64);
    this.face = scene.add.graphics();
    this.features = scene.add.graphics();
    this.hairFront = scene.add.graphics();

    this.head.add([this.face, this.features, this.hairFront]);
    // back-to-front order
    this.inner.add([this.armB, this.hairBack, this.legB, this.legF, this.torso, this.head, this.armF]);

    this.legB.setPosition(-7, -26);
    this.legF.setPosition(7, -26);
    // shoulders sit on the visible part of the torso, just below the chin,
    // so arms never sprout out of the cheek
    this.armB.setPosition(-16, -38);
    this.armF.setPosition(16, -38);
    this.hairBack.setPosition(0, -64);

    this.drawStatic();
    this.setExpression('normal', true);
    this.setScale(scale);
    scene.add.existing(this);
  }

  // ------------------------------------------------------------- drawing

  private drawStatic() {
    const L = this.look;
    const outline = 0x2a1a24;

    // legs
    [this.legB, this.legF].forEach((g, i) => {
      g.clear();
      g.fillStyle(hex(i === 0 ? L.bottom : L.bottom), 1);
      g.lineStyle(3, outline, 1);
      g.fillRoundedRect(-6, -2, 12, 24, 5);
      g.strokeRoundedRect(-6, -2, 12, 24, 5);
      g.fillStyle(hex(L.shoes), 1);
      g.fillRoundedRect(-7, 18, 17, 9, 4);
      g.strokeRoundedRect(-7, 18, 17, 9, 4);
      if (i === 0) {
        g.fillStyle(0x000000, 0.12);
        g.fillRoundedRect(-6, -2, 12, 24, 5);
      }
    });

    // torso
    const t = this.torso;
    t.clear();
    t.lineStyle(3, outline, 1);
    t.fillStyle(hex(L.top), 1);
    if (this.style === 'khushi') {
      t.fillRoundedRect(-19, -60, 38, 38, { tl: 14, tr: 14, bl: 8, br: 8 });
      t.strokeRoundedRect(-19, -60, 38, 38, { tl: 14, tr: 14, bl: 8, br: 8 });
      t.fillStyle(hex(L.topShade), 1);
      t.fillRoundedRect(-17, -32, 34, 8, 4);
      // little heart print
      t.fillStyle(0xff7eb6, 1);
      t.fillCircle(-3, -45, 3.4);
      t.fillCircle(3, -45, 3.4);
      t.fillTriangle(-6.4, -44, 6.4, -44, 0, -37);
    } else {
      t.fillRoundedRect(-19, -60, 38, 36, 12);
      t.strokeRoundedRect(-19, -60, 38, 36, 12);
      t.fillStyle(hex(L.topShade), 1);
      t.fillRoundedRect(-17, -32, 34, 7, 3);
      // collar
      t.lineStyle(2.5, hex(L.topShade), 1);
      t.beginPath();
      t.arc(0, -60, 8, 0.2, Math.PI - 0.2, false);
      t.strokePath();
      // red thread necklace from the photos
      t.lineStyle(1.5, 0xd2343c, 0.9);
      t.beginPath();
      t.arc(0, -60, 11, 0.4, Math.PI - 0.4, false);
      t.strokePath();
    }

    // arms (pivot at shoulder, pointing down). Drawn as one silhouette:
    // an outline pass first, then fills on top, so there are no seams between
    // sleeve, forearm and hand. The hand is a little mitten with a thumb.
    [this.armB, this.armF].forEach((g, i) => {
      g.clear();
      const sleeve = hex(i === 0 ? L.topShade : L.top);
      const skin = hex(i === 0 ? L.skinShade : L.skin);
      // outline silhouette
      g.fillStyle(outline, 1);
      g.fillRoundedRect(-6.5, -5.5, 13, 21, 6);
      g.fillCircle(0, ARM_HAND, 7);
      g.fillCircle(3.8, ARM_HAND - 3.2, 3.6);
      // forearm
      g.fillStyle(skin, 1);
      g.fillRoundedRect(-4.2, 2, 8.4, 13, 4);
      // hand + thumb
      g.fillCircle(0, ARM_HAND, 5.4);
      g.fillCircle(3.8, ARM_HAND - 3.2, 2.1);
      // sleeve over the top of the arm
      g.fillStyle(sleeve, 1);
      g.fillRoundedRect(-5, -4, 10, 11, { tl: 5, tr: 5, bl: 2, br: 2 });
      // cuff + knuckle hint
      g.lineStyle(1.5, outline, 0.55);
      g.lineBetween(-4.6, 7, 4.6, 7);
      g.lineStyle(1.2, outline, 0.35);
      g.lineBetween(-2.6, ARM_HAND + 2.6, 1.6, ARM_HAND + 2.6);
    });

    // head base
    const f = this.face;
    f.clear();
    f.lineStyle(3, outline, 1);
    f.fillStyle(hex(L.skin), 1);
    // ears
    f.fillCircle(-HEAD_R + 1, 4, 7);
    f.strokeCircle(-HEAD_R + 1, 4, 7);
    f.fillCircle(HEAD_R - 1, 4, 7);
    f.strokeCircle(HEAD_R - 1, 4, 7);
    f.fillEllipse(0, 2, HEAD_R * 2, HEAD_R * 2 - 4);
    f.strokeEllipse(0, 2, HEAD_R * 2, HEAD_R * 2 - 4);
    if (this.style === 'khushi') {
      // gold hoop earrings
      f.lineStyle(2.4, 0xf2c14e, 1);
      f.strokeCircle(-HEAD_R + 0, 15, 5);
      f.strokeCircle(HEAD_R - 0, 15, 5);
    }

    this.drawHair();
  }

  private drawHair() {
    const L = this.look;
    const outline = 0x2a1a24;
    const hb = this.hairBack;
    const hf = this.hairFront;
    hb.clear();
    hf.clear();
    const hair = hex(L.hair);
    const shine = hex(L.hairShine);

    if (this.style === 'khushi') {
      // long straight hair behind the body
      hb.fillStyle(hair, 1);
      hb.lineStyle(3, outline, 1);
      hb.fillRoundedRect(-33, -18, 66, 78, { tl: 30, tr: 30, bl: 16, br: 16 });
      hb.strokeRoundedRect(-33, -18, 66, 78, { tl: 30, tr: 30, bl: 16, br: 16 });
      hb.lineStyle(2, shine, 0.6);
      hb.lineBetween(-20, 10, -22, 52);
      hb.lineBetween(18, 10, 20, 50);

      // crown with a soft middle part
      hf.fillStyle(hair, 1);
      hf.lineStyle(3, outline, 1);
      hf.beginPath();
      hf.moveTo(-33, 14);
      hf.lineTo(-33, -6);
      hf.arc(0, -4, 33, Math.PI, Math.PI * 2, false);
      hf.lineTo(33, 14);
      hf.lineTo(26, 10);
      hf.lineTo(22, -6);
      hf.lineTo(3, -14);
      hf.lineTo(0, -18);
      hf.lineTo(-3, -14);
      hf.lineTo(-22, -6);
      hf.lineTo(-26, 10);
      hf.closePath();
      hf.fillPath();
      hf.strokePath();
      // face-framing strands
      hf.fillStyle(hair, 1);
      hf.fillRoundedRect(-36, -2, 11, 44, 5);
      hf.fillRoundedRect(25, -2, 11, 44, 5);
      hf.lineStyle(2.5, outline, 1);
      hf.strokeRoundedRect(-36, -2, 11, 44, 5);
      hf.strokeRoundedRect(25, -2, 11, 44, 5);
      hf.lineStyle(2, shine, 0.7);
      hf.beginPath();
      hf.arc(0, -4, 26, Math.PI * 1.15, Math.PI * 1.4, false);
      hf.strokePath();
      // re-draw earrings over strands so they peek out
      hf.lineStyle(2.4, 0xf2c14e, 1);
      hf.strokeCircle(-30, 16, 5);
      hf.strokeCircle(30, 16, 5);
    } else {
      // big voluminous swept-up hair with side volume
      hf.fillStyle(hair, 1);
      hf.lineStyle(3, outline, 1);
      const puffs: [number, number, number][] = [
        [-26, -12, 14], [-18, -26, 16], [-2, -32, 18], [16, -28, 17], [28, -14, 14],
        [-31, 2, 9], [31, 2, 9], [8, -38, 12], [-12, -36, 12],
      ];
      puffs.forEach(([x, y, r]) => hf.strokeCircle(x, y, r));
      puffs.forEach(([x, y, r]) => hf.fillCircle(x, y, r));
      // fringe sweeping across the forehead
      hf.beginPath();
      hf.moveTo(-30, -6);
      hf.lineTo(-20, -18);
      hf.lineTo(0, -24);
      hf.lineTo(22, -20);
      hf.lineTo(31, -6);
      hf.lineTo(24, -10);
      hf.lineTo(12, -14);
      hf.lineTo(-6, -15);
      hf.lineTo(-18, -10);
      hf.closePath();
      hf.fillPath();
      hf.lineStyle(2, shine, 0.8);
      hf.beginPath();
      hf.arc(-4, -26, 16, Math.PI * 1.1, Math.PI * 1.55, false);
      hf.strokePath();
      hf.beginPath();
      hf.arc(14, -22, 12, Math.PI * 1.3, Math.PI * 1.7, false);
      hf.strokePath();
    }
  }

  setExpression(e: Expression, force = false) {
    if (e === this.expression && !force) return;
    this.expression = e;
    this.redrawFeatures();
  }

  private redrawFeatures() {
    const g = this.features;
    const L = this.look;
    const e = this.expression;
    const dark = 0x2a1a24;
    g.clear();

    // stubble & mole (Ashish)
    if (this.style === 'ashish') {
      g.fillStyle(0x2a1a24, 0.18);
      g.fillEllipse(0, 24, 30, 12);
      g.fillStyle(0x2a1a24, 0.22);
      g.fillEllipse(0, 14.5, 14, 3);
      g.fillStyle(0x3a2026, 1);
      g.fillCircle(-1, -10, 2.4); // the forehead mole
    }

    // blush
    g.fillStyle(hex(L.blush), e === 'cry' || e === 'teary' || e === 'softSmile' || e === 'tearSmile' ? 0.55 : 0.32);
    g.fillEllipse(-17, 12, 11, 6);
    g.fillEllipse(17, 12, 11, 6);

    const eyeY = 3;
    const ex = 11;
    const drawOpenEye = (x: number, w = 8, hgt = 10, look = 0) => {
      g.fillStyle(0xffffff, 1);
      g.fillEllipse(x, eyeY, w + 3, hgt + 2);
      g.fillStyle(dark, 1);
      g.fillEllipse(x + look, eyeY + 0.5, w, hgt);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(x + look - 2, eyeY - 2.5, 2.2);
      g.fillCircle(x + look + 2, eyeY + 2.5, 1);
    };
    const drawArcEye = (x: number, up: boolean) => {
      g.lineStyle(3, dark, 1);
      g.beginPath();
      if (up) g.arc(x, eyeY + 3, 5, Math.PI * 1.1, Math.PI * 1.9, false);
      else g.arc(x, eyeY - 2, 5, Math.PI * 0.1, Math.PI * 0.9, false);
      g.strokePath();
    };
    const brow = (x: number, angle: number, y = -8) => {
      g.lineStyle(3, dark, 1);
      const dx = Math.cos(angle) * 6;
      const dy = Math.sin(angle) * 6;
      g.lineBetween(x - dx, y - dy, x + dx, y + dy);
    };

    if (this.blinking && !['closed', 'happy', 'evil', 'cry'].includes(e)) {
      drawArcEye(-ex, false);
      drawArcEye(ex, false);
    } else {
      switch (e) {
        case 'happy':
        case 'tearSmile':
          drawArcEye(-ex, true);
          drawArcEye(ex, true);
          break;
        case 'closed':
        case 'cry':
          drawArcEye(-ex, false);
          drawArcEye(ex, false);
          break;
        case 'evil':
        case 'smirk':
          g.fillStyle(0xffffff, 1);
          g.fillEllipse(-ex, eyeY + 1, 11, 7);
          g.fillEllipse(ex, eyeY + 1, 11, 7);
          g.fillStyle(dark, 1);
          g.fillEllipse(-ex + 1, eyeY + 1.5, 7, 6);
          g.fillEllipse(ex + 1, eyeY + 1.5, 7, 6);
          g.fillStyle(0xffffff, 1);
          g.fillCircle(-ex - 1, eyeY, 1.6);
          g.fillCircle(ex - 1, eyeY, 1.6);
          g.lineStyle(3, dark, 1);
          g.lineBetween(-ex - 6, eyeY - 4, -ex + 6, eyeY - 2);
          g.lineBetween(ex - 6, eyeY - 2, ex + 6, eyeY - 4);
          break;
        case 'panic':
        case 'shock':
          drawOpenEye(-ex, 5, 6);
          drawOpenEye(ex, 5, 6);
          g.lineStyle(2, dark, 1);
          g.strokeEllipse(-ex, eyeY, 13, 14);
          g.strokeEllipse(ex, eyeY, 13, 14);
          break;
        case 'puppy':
        case 'teary':
          drawOpenEye(-ex, 10, 12);
          drawOpenEye(ex, 10, 12);
          g.fillStyle(0x9fd8ff, 0.6);
          g.fillEllipse(-ex, eyeY + 6, 12, 4);
          g.fillEllipse(ex, eyeY + 6, 12, 4);
          break;
        case 'tired':
          drawOpenEye(-ex, 8, 6);
          drawOpenEye(ex, 8, 6);
          g.fillStyle(hex(L.skinShade), 1);
          g.fillRect(-ex - 7, eyeY - 7, 14, 5);
          g.fillRect(ex - 7, eyeY - 7, 14, 5);
          break;
        default:
          drawOpenEye(-ex, 8, 10, e === 'determined' ? 1 : 0);
          drawOpenEye(ex, 8, 10, e === 'determined' ? 1 : 0);
      }
    }

    // brows
    switch (e) {
      case 'evil':
      case 'determined':
        brow(-ex, 0.35, -9);
        brow(ex, -0.35, -9);
        break;
      case 'panic':
      case 'cry':
      case 'sad':
      case 'puppy':
      case 'teary':
      case 'hurt':
      case 'tired':
        brow(-ex, -0.35, -10);
        brow(ex, 0.35, -10);
        break;
      case 'shock':
        brow(-ex, -0.15, -13);
        brow(ex, 0.15, -13);
        break;
      case 'smirk':
        brow(-ex, 0.2, -9);
        brow(ex, -0.1, -12);
        break;
      default:
        brow(-ex, -0.08, -10);
        brow(ex, 0.08, -10);
    }

    // mouth
    g.lineStyle(3, dark, 1);
    const my = 17;
    switch (e) {
      case 'happy':
      case 'softSmile':
      case 'tearSmile':
        g.fillStyle(0x7a2a3a, 1);
        g.beginPath();
        g.arc(0, my - 3, 7, 0.15, Math.PI - 0.15, false);
        g.closePath();
        g.fillPath();
        g.strokePath();
        if (e !== 'softSmile') {
          g.fillStyle(0xffffff, 1);
          g.fillRect(-4, my - 2, 8, 2.5);
        }
        break;
      case 'evil':
        g.fillStyle(0x7a2a3a, 1);
        g.beginPath();
        g.moveTo(-10, my - 3);
        g.lineTo(10, my - 5);
        g.arc(0, my - 4, 10, 0, Math.PI, false);
        g.closePath();
        g.fillPath();
        g.strokePath();
        g.fillStyle(0xffffff, 1);
        g.fillTriangle(-6, my - 4, -3, my - 4, -4.5, my);
        g.fillTriangle(3, my - 4, 6, my - 4, 4.5, my);
        break;
      case 'smirk':
        g.beginPath();
        g.moveTo(-6, my);
        g.lineTo(2, my);
        g.lineTo(8, my - 4);
        g.strokePath();
        break;
      case 'panic':
      case 'shock':
        g.fillStyle(0x7a2a3a, 1);
        g.fillEllipse(0, my + 1, 10, 13);
        g.strokeEllipse(0, my + 1, 10, 13);
        g.fillStyle(0xff8fa8, 1);
        g.fillEllipse(0, my + 4, 6, 4);
        break;
      case 'cry':
        g.fillStyle(0x7a2a3a, 1);
        g.beginPath();
        g.arc(0, my + 6, 8, Math.PI + 0.2, -0.2, false);
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      case 'hurt':
        g.beginPath();
        g.moveTo(-8, my + 2);
        for (let i = 0; i < 4; i++) g.lineTo(-8 + (i + 1) * 4, my + (i % 2 ? 2 : -2));
        g.strokePath();
        break;
      case 'sad':
      case 'teary':
      case 'puppy':
      case 'tired':
        g.beginPath();
        g.arc(0, my + 6, 6, Math.PI + 0.4, -0.4, false);
        g.strokePath();
        break;
      case 'closed':
        g.lineBetween(-4, my + 1, 4, my + 1);
        break;
      case 'determined':
        g.lineBetween(-5, my, 5, my - 1);
        break;
      default:
        g.beginPath();
        g.arc(0, my - 2, 5, 0.3, Math.PI - 0.3, false);
        g.strokePath();
    }

    // tears
    if (e === 'cry' || e === 'tearSmile' || e === 'teary') {
      g.fillStyle(0x7fcfff, 0.9);
      g.fillEllipse(-ex - 2, eyeY + 12, 5, e === 'cry' ? 16 : 8);
      g.fillEllipse(ex + 2, eyeY + 12, 5, e === 'cry' ? 16 : 8);
    }
    // sweat
    if (e === 'panic' || e === 'tired') {
      g.fillStyle(0x9fe0ff, 0.95);
      g.fillTriangle(24, -14, 20, -6, 28, -6);
      g.fillCircle(24, -5, 4);
    }
  }

  // ---------------------------------------------------------- weapon

  holdWeapon(textureKey: string | null, scale = 0.55) {
    if (this.weaponSprite) {
      this.weaponSprite.destroy();
      this.weaponSprite = null;
    }
    if (!textureKey) return;
    const s = this.scene.add.image(0, 0, textureKey).setScale(scale);
    this.weaponSprite = s;
    this.inner.addAt(s, this.inner.getIndex(this.armF));
  }

  triggerAttack() {
    this.attackT = 0;
  }

  bounce(amount = 0.18) {
    this.squash = 1 - amount;
  }

  setFacing(dir: 1 | -1) {
    this.facing = dir;
  }

  // ---------------------------------------------------------- animation

  tick(dt: number) {
    const s = dt / 1000;
    this.time += s;
    this.attackT = Math.min(1, this.attackT + s * 4.5);
    this.squash += (1 - this.squash) * Math.min(1, s * 10);

    // blinking
    this.blinkTimer -= s;
    if (this.blinkTimer <= 0) {
      if (!this.blinking) {
        this.blinking = true;
        this.blinkTimer = 0.12;
      } else {
        this.blinking = false;
        this.blinkTimer = 2 + Math.random() * 3;
      }
      this.redrawFeatures();
    }

    let legF = 0, legB = 0, armF = 0.15, armB = -0.15, bob = 0, lean = 0, crouch = 0, headTilt = 0;
    let hairSwing = 0;
    const t = this.time;

    switch (this.pose) {
      case 'idle':
        bob = Math.sin(t * 3) * 1.4;
        armF = 0.12 + Math.sin(t * 3) * 0.05;
        armB = -0.12 - Math.sin(t * 3) * 0.05;
        headTilt = Math.sin(t * 1.3) * 0.04;
        break;
      case 'walk': {
        this.phase += s * 9;
        const p = Math.sin(this.phase);
        legF = p * 0.45; legB = -p * 0.45;
        armF = -p * 0.4; armB = p * 0.4;
        bob = -Math.abs(Math.cos(this.phase)) * 2;
        break;
      }
      case 'run':
      case 'dash': {
        this.phase += s * (12 + this.runSpeed * 6);
        const p = Math.sin(this.phase);
        legF = p * 0.85; legB = -p * 0.85;
        armF = -p * 1.0; armB = p * 1.0;
        bob = -Math.abs(Math.cos(this.phase)) * 5;
        lean = this.pose === 'dash' ? 0.35 : 0.14;
        hairSwing = -0.12;
        break;
      }
      case 'panicRun':
      case 'lookBack': {
        this.phase += s * (14 + this.runSpeed * 6);
        const p = Math.sin(this.phase);
        legF = p * 0.95; legB = -p * 0.95;
        armF = -2.5 + Math.sin(this.phase * 1.5) * 0.7;
        armB = -2.7 - Math.sin(this.phase * 1.5) * 0.7;
        bob = -Math.abs(Math.cos(this.phase)) * 6;
        lean = 0.1;
        headTilt = this.pose === 'lookBack' ? -0.25 : Math.sin(t * 20) * 0.05;
        break;
      }
      case 'jump':
        legF = -0.7; legB = 0.5; armF = -2.2; armB = -2.6; lean = 0.05;
        break;
      case 'fall':
        legF = 0.3; legB = -0.2;
        armF = -2.4 + Math.sin(t * 25) * 0.4; armB = -2.6 - Math.sin(t * 25) * 0.4;
        break;
      case 'hurt':
        lean = -0.3; armF = -1.6; armB = -1.9; legF = -0.3; legB = 0.3; headTilt = -0.2;
        break;
      case 'kneel':
        crouch = 16; legF = 1.35; legB = 1.5; lean = 0.18;
        armF = 0.3 + Math.sin(t * 9) * 0.03; armB = 0.2;
        headTilt = 0.08 + Math.sin(t * 7) * 0.02; // trembling shoulders
        bob = Math.sin(t * 14) * 0.8;
        break;
      case 'beg':
        crouch = 16; legF = 1.35; legB = 1.5; lean = -0.05;
        armF = -1.3 + Math.sin(t * 4) * 0.1; armB = -1.1 + Math.sin(t * 4) * 0.1;
        headTilt = -0.15;
        break;
      case 'hug':
        armF = -1.5; armB = -1.35; lean = 0.08; headTilt = 0.12;
        bob = Math.sin(t * 2) * 1;
        break;
      case 'attack':
      case 'aim':
      case 'raise':
      case 'lower':
        bob = Math.sin(t * 3) * 1;
        armB = -0.3;
        break;
      case 'laugh':
        bob = Math.abs(Math.sin(t * 16)) * -3;
        armF = 0.7; armB = -0.7; lean = -0.12; headTilt = -0.15;
        break;
      case 'victory':
        armF = -2.9; armB = -2.9 + Math.sin(t * 8) * 0.15; bob = -Math.abs(Math.sin(t * 6)) * 6;
        break;
      case 'stumble':
        lean = 0.7; legF = -0.9; legB = 0.8; armF = -1.4; armB = -0.6;
        break;
      case 'hide':
        crouch = 22; legF = 1.2; legB = 1.3; armF = -2.4; armB = -2.2; lean = 0.25;
        break;
    }

    // weapon arm overrides
    const swing = this.attackT < 1 ? Math.sin(this.attackT * Math.PI) : 0;
    if (this.pose === 'aim' || this.pose === 'attack') {
      const local = this.facing === 1 ? this.aimAngle : Math.PI - this.aimAngle;
      armF = local - Math.PI / 2 - swing * 1.3;
    } else if (this.pose === 'raise') {
      armF = -2.9 + Math.sin(t * 6) * 0.06;
    } else if (this.pose === 'lower') {
      this.lowerProgress = Math.min(1, this.lowerProgress + s * 0.6);
      armF = -2.9 + this.lowerProgress * 3.0;
    } else if (swing > 0) {
      armF = -2.2 * swing + armF * (1 - swing);
    }
    if (this.pose !== 'lower') this.lowerProgress = 0;

    // smooth parts toward targets (follow-through)
    const k = Math.min(1, s * 16);
    this.legF.rotation += (legF - this.legF.rotation) * k;
    this.legB.rotation += (legB - this.legB.rotation) * k;
    this.armF.rotation += (armF - this.armF.rotation) * Math.min(1, s * (swing > 0 ? 30 : 14));
    this.armB.rotation += (armB - this.armB.rotation) * k;
    this.lean += (lean - this.lean) * k;
    this.crouch += (crouch - this.crouch) * k;
    this.headTilt += (headTilt - this.headTilt) * k;

    this.inner.y = bob + this.crouch;
    this.inner.rotation = this.lean * this.facing;
    this.head.rotation = this.headTilt;
    this.hairBack.rotation = hairSwing + Math.sin(t * 2.4) * 0.03;
    this.inner.scaleX = this.facing;
    this.inner.scaleY = 1;
    // squash & stretch
    this.scaleY = this.baseScale * this.squash;
    this.scaleX = this.baseScale * (2 - this.squash);
    this.shadow.scaleX = 1 - Math.min(0.5, Math.abs(bob) / 30);

    // weapon follows the front hand
    if (this.weaponSprite) {
      const a = this.armF.rotation;
      const hx = this.armF.x - Math.sin(a) * ARM_HAND;
      const hy = this.armF.y + Math.cos(a) * ARM_HAND;
      this.weaponSprite.setPosition(hx, hy);
      this.weaponSprite.rotation = a + Math.PI / 2 - 0.3;
    }
  }

  /** Lifts shadow so it stays on the ground when the body is airborne. */
  setAirHeight(h: number) {
    this.shadow.y = h;
    this.shadow.alpha = Math.max(0.05, 0.18 - h / 800);
  }

  /** World position of the head top (for speech bubbles). */
  headTop(): { x: number; y: number } {
    return { x: this.x, y: this.y - (110 - this.crouch) * this.baseScale };
  }
}
