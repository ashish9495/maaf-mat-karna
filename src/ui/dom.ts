/** Tiny DOM helpers for HTML overlays (menus, HUD, modals). */
import { AudioManager } from '../systems/AudioManager';

export const uiRoot = () => document.getElementById('ui') as HTMLDivElement;

type Attrs = Record<string, string | number | boolean | undefined> & { class?: string; text?: string; html?: string };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Node | string | null | undefined)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') e.className = String(v);
    else if (k === 'text') e.textContent = String(v);
    else if (k === 'html') e.innerHTML = String(v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined) continue;
    e.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}

/** A button that plays a click, unlocks audio and ignores rapid double presses. */
export function btn(label: string, onClick: () => void, cls = 'btn'): HTMLButtonElement {
  const b = h('button', { class: cls, type: 'button' }, label);
  let last = 0;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    const now = performance.now();
    if (now - last < 350) return;
    last = now;
    AudioManager.unlock();
    AudioManager.sfx('click');
    onClick();
  });
  return b;
}

export function clearUI() {
  uiRoot().innerHTML = '';
}

/** Mount a layer; returns a remover. */
export function mount(node: HTMLElement): () => void {
  uiRoot().append(node);
  return () => node.remove();
}

/** Simple modal panel with title, body and a close button. */
export function panel(title: string, body: HTMLElement, onClose?: () => void, extraClass = ''): HTMLDivElement {
  const wrap = h('div', { class: `modal-backdrop ${extraClass}` });
  const close = () => {
    wrap.classList.add('closing');
    window.setTimeout(() => wrap.remove(), 180);
    onClose?.();
  };
  const card = h('div', { class: 'modal-card', role: 'dialog', 'aria-label': title },
    h('div', { class: 'modal-head' }, h('h2', { text: title }), btn('✕', close, 'btn-icon')),
    h('div', { class: 'modal-body' }, body),
  );
  wrap.append(card);
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) close();
  });
  (wrap as HTMLDivElement & { close: () => void }).close = close;
  uiRoot().append(wrap);
  return wrap;
}

let toastStack: HTMLDivElement | null = null;
export function toast(html: string, cls = '', ms = 3200) {
  if (!toastStack || !toastStack.isConnected) {
    toastStack = h('div', { class: 'toast-stack' });
    document.body.append(toastStack);
  }
  const t = h('div', { class: `toast ${cls}`, html });
  toastStack.append(t);
  window.setTimeout(() => {
    t.classList.add('out');
    window.setTimeout(() => t.remove(), 400);
  }, ms);
}

export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
