/** Cinematic overlays: dialogue box, continue prompts, skip button, forgiveness popup, ending panels. */
import { h, btn, uiRoot } from './dom';
import { AudioManager } from '../systems/AudioManager';

export class DialogueBox {
  root: HTMLDivElement;
  private name: HTMLDivElement;
  private text: HTMLDivElement;
  private hint: HTMLDivElement;
  private resolve: (() => void) | null = null;
  private typing: number | null = null;
  private full = '';
  private readyAt = 0;
  private autoTimer: number | null = null;
  private onKey = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.advance();
    }
  };

  constructor() {
    this.name = h('div', { class: 'dlg-name' });
    this.text = h('div', { class: 'dlg-text' });
    // lines advance on their own; a tap/Enter just speeds things up
    this.hint = h('div', { class: 'dlg-hint' });
    this.root = h('div', { class: 'dialogue' }, this.name, this.text, this.hint);
    this.root.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.advance();
    });
    document.addEventListener('keydown', this.onKey);
    uiRoot().append(this.root);
  }

  /** Shows a line, types it out, holds it long enough to read, then moves on by itself. */
  show(speaker: string, text: string, tone: 'bf' | 'gf' | 'narrator' = 'bf'): Promise<void> {
    this.clearAuto();
    this.root.className = `dialogue show tone-${tone}`;
    this.name.textContent = speaker;
    this.name.style.display = speaker ? '' : 'none';
    this.full = text;
    this.text.textContent = '';
    this.hint.classList.remove('ready');
    if (this.typing) clearInterval(this.typing);
    let i = 0;
    const chars = Array.from(text);
    this.typing = window.setInterval(() => {
      i++;
      this.text.textContent = chars.slice(0, i).join('');
      if (i >= chars.length) this.finishTyping();
    }, 38);
    this.readyAt = performance.now() + 250;
    return new Promise((r) => (this.resolve = r));
  }

  private finishTyping() {
    if (this.typing) clearInterval(this.typing);
    this.typing = null;
    this.text.textContent = this.full;
    this.hint.classList.add('ready');
    // reading time grows with the line's length
    const hold = Math.min(5200, Math.max(1800, 1300 + Array.from(this.full).length * 55));
    this.clearAuto();
    this.autoTimer = window.setTimeout(() => this.next(false), hold);
  }

  private clearAuto() {
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.autoTimer = null;
  }

  private next(clicked: boolean) {
    this.clearAuto();
    const r = this.resolve;
    if (!r) return;
    this.resolve = null;
    if (clicked) AudioManager.sfx('click');
    r();
  }

  private advance() {
    if (performance.now() < this.readyAt) return;
    if (this.typing) {
      this.finishTyping();
      this.readyAt = performance.now() + 200;
      return;
    }
    this.next(true);
  }

  hide() {
    this.root.classList.remove('show');
  }

  destroy() {
    this.clearAuto();
    if (this.typing) clearInterval(this.typing);
    document.removeEventListener('keydown', this.onKey);
    this.root.remove();
  }
}

/** A small floating "Continue" prompt (used between dramatic beats). */
export function continuePrompt(label = 'Continue'): Promise<void> {
  return new Promise((resolve) => {
    const b = h('button', { class: 'continue-prompt', type: 'button' }, `${label} ▸`);
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      AudioManager.sfx('click');
      document.removeEventListener('keydown', onKey);
      b.classList.add('out');
      window.setTimeout(() => b.remove(), 300);
      resolve();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') go();
    };
    b.addEventListener('click', go);
    document.addEventListener('keydown', onKey);
    uiRoot().append(b);
  });
}

export function skipButton(onSkip: () => void) {
  const b = btn('Skip ⏭', onSkip, 'btn-link skip-btn');
  uiRoot().append(b);
  return b;
}

export function forgivenessModal(onChoice: (yes: boolean) => void) {
  let chosen = false;
  const choose = (yes: boolean) => () => {
    if (chosen) return;
    chosen = true;
    wrap.classList.add('closing');
    window.setTimeout(() => wrap.remove(), 500);
    onChoice(yes);
  };
  const wrap = h('div', { class: 'forgive-backdrop' },
    h('div', { class: 'forgive-card' },
      h('div', { class: 'fc-glow' }),
      h('div', { class: 'fc-header', text: 'ONE LAST QUESTION... ❤️' }),
      h('div', { class: 'fc-main', text: '"Mumma, did you forgive your baby?"' }),
      h('div', { class: 'fc-sub', text: 'He has no HP left, but he still has all his love for you.' }),
      h('div', { class: 'fc-buttons' },
        btn('YES, COME HERE BABY ❤️', choose(true), 'btn btn-yes'),
        btn('NOT YET, BADMASH 😈', choose(false), 'btn btn-no'),
      ),
    ),
  );
  uiRoot().append(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
}

export function achievementReveal(title: string, sub?: string) {
  const el = h('div', { class: 'ach-reveal' }, h('small', { text: 'ACHIEVEMENT UNLOCKED' }), h('b', { text: title }), sub ? h('span', { text: sub }) : null);
  uiRoot().append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  return el;
}

export function captionLines(lines: string[], stepMs = 2200): Promise<void> {
  return new Promise((resolve) => {
    const el = h('div', { class: 'caption-lines' });
    uiRoot().append(el);
    lines.forEach((l, i) => {
      window.setTimeout(() => {
        const p = h('p', { text: l });
        el.append(p);
        requestAnimationFrame(() => p.classList.add('show'));
      }, i * stepMs);
    });
    window.setTimeout(() => resolve(), lines.length * stepMs + 400);
  });
}

export function handwrittenNote(text: string, signature: string, buttons: HTMLElement[]) {
  const wrap = h('div', { class: 'note-backdrop' },
    h('div', { class: 'note-paper' },
      h('div', { class: 'note-text', text }),
      h('div', { class: 'note-sign', text: signature }),
    ),
    h('div', { class: 'note-buttons' }, ...buttons),
  );
  uiRoot().append(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  return wrap;
}

export function endingButtons(buttons: HTMLElement[], title?: string, sub?: string) {
  const wrap = h('div', { class: 'ending-panel' },
    title ? h('div', { class: 'ep-title', text: title }) : null,
    sub ? h('div', { class: 'ep-sub', text: sub }) : null,
    h('div', { class: 'note-buttons' }, ...buttons),
  );
  uiRoot().append(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  return wrap;
}
