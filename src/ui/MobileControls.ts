/**
 * On-screen touch controls. Each button tracks its own pointer, so moving and
 * attacking at the same time (multitouch) works.
 */
import { h } from './dom';
import type { InputManager } from '../systems/InputManager';
import { AudioManager } from '../systems/AudioManager';

type HoldKey = 'left' | 'right' | 'jump' | 'attack';

export class MobileControls {
  root: HTMLDivElement;

  constructor(input: InputManager) {
    const hold = (label: string, key: HoldKey, cls: string, onPress?: () => void) => {
      const b = h('button', { class: `tc ${cls}`, type: 'button', 'aria-label': key }, label);
      const down = (e: PointerEvent) => {
        e.preventDefault();
        AudioManager.unlock();
        try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        input.touch[key] = true;
        onPress?.();
        b.classList.add('down');
      };
      const up = (e: PointerEvent) => {
        e.preventDefault();
        input.touch[key] = false;
        b.classList.remove('down');
      };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', () => {
        input.touch[key] = false;
        b.classList.remove('down');
      });
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      return b;
    };
    const tap = (label: string, action: 'dash' | 'cycle', cls: string) => {
      const b = h('button', { class: `tc ${cls}`, type: 'button', 'aria-label': action }, label);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        AudioManager.unlock();
        input.press(action);
        b.classList.add('down');
        window.setTimeout(() => b.classList.remove('down'), 120);
      });
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      return b;
    };

    this.root = h('div', { class: 'touch-controls' },
      h('div', { class: 'tc-left' }, hold('◀', 'left', 'tc-move'), hold('▶', 'right', 'tc-move')),
      h('div', { class: 'tc-right' },
        tap('🔄', 'cycle', 'tc-small tc-cycle'),
        tap('💨', 'dash', 'tc-small tc-dash'),
        hold('⬆', 'jump', 'tc-jump', () => input.press('jump')),
        hold('🩴', 'attack', 'tc-attack', () => input.press('attack')),
      ),
    );
  }

  setAttackIcon(icon: string) {
    const b = this.root.querySelector('.tc-attack');
    if (b) b.textContent = icon;
  }
}
