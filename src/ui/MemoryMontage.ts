/**
 * The memory album. Plays by itself (each photo stays long enough to read its caption,
 * then the next slides in; after the last one the story continues). Swipe, arrow keys
 * or the dots still let her go back to a photo, and Skip closes it. Photos come from memoryConfig.ts; missing photos
 * become a decorated placeholder card.
 */
import { h, btn, uiRoot } from './dom';
import { memories, type MemoryCard } from '../config/memoryConfig';
import { AudioManager } from '../systems/AudioManager';

export function openMemoryMontage(opts: { onDone: () => void; replay?: boolean }) {
  let index = 0;
  let done = false;
  const list: MemoryCard[] = memories.slice(0, 8);

  const stage = h('div', { class: 'mem-stage' });
  const dots = h('div', { class: 'mem-dots' });
  const counter = h('div', { class: 'mem-counter' });
  const hearts = h('div', { class: 'mem-hearts' });
  for (let i = 0; i < 14; i++) {
    const s = h('span', { text: ['💗', '💕', '✨', '💖'][i % 4] });
    s.style.left = `${(i * 7.3) % 100}%`;
    s.style.animationDelay = `${(i * 0.9) % 8}s`;
    s.style.animationDuration = `${8 + (i % 5)}s`;
    hearts.append(s);
  }

  const skip = btn('Skip', () => close(), 'btn-link mem-skip');
  const bar = h('div', { class: 'mem-progress' }, h('span'));
  let timer: number | null = null;

  const wrap = h('div', { class: 'memory-overlay' },
    hearts,
    h('div', { class: 'mem-head' }, h('div', { class: 'mem-kicker', text: 'Our Love Story' }), skip),
    stage,
    h('div', { class: 'mem-nav' }, h('div', { class: 'mem-mid' }, dots, bar, counter)),
  );

  /** how long a card stays: enough to look at the photo and read the caption */
  const holdFor = (m: MemoryCard) => Math.min(9500, Math.max(5500, 4200 + m.caption.length * 45));

  function schedule() {
    if (timer) clearTimeout(timer);
    const ms = holdFor(list[index]);
    const fill = bar.firstElementChild as HTMLElement;
    fill.style.transition = 'none';
    fill.style.width = '0%';
    void fill.offsetWidth;
    fill.style.transition = `width ${ms}ms linear`;
    fill.style.width = '100%';
    timer = window.setTimeout(() => {
      if (index < list.length - 1) show(index + 1, 1);
      else close();
    }, ms);
  }

  list.forEach((_, i) => {
    const d = h('button', { class: 'dot', type: 'button', 'aria-label': `Memory ${i + 1}` });
    d.addEventListener('click', () => {
      if (i !== index) show(i, i > index ? 1 : -1);
    });
    dots.append(d);
  });

  function card(m: MemoryCard, i: number) {
    const tilt = [-3, 2.5, -1.5, 3, -2.5, 1.5, -2, 2][i % 8];
    const photo = h('div', { class: 'polaroid-photo' });
    if (m.photo) {
      const img = h('img', { src: m.photo, alt: m.title, loading: 'eager', draggable: 'false' });
      img.addEventListener('error', () => {
        img.remove();
        photo.classList.add('placeholder');
        photo.append(h('div', { class: 'ph-sticker', text: m.sticker }));
      });
      photo.append(img);
    } else {
      photo.classList.add('placeholder');
      photo.append(h('div', { class: 'ph-sticker', text: m.sticker }));
    }
    const c = h('div', { class: 'polaroid' },
      h('div', { class: 'tape' }),
      photo,
      h('div', { class: 'polaroid-caption' },
        h('div', { class: 'pc-title', text: m.title }),
        m.date ? h('div', { class: 'pc-date', text: m.date }) : null,
        h('p', { class: 'pc-text', text: m.caption }),
      ),
      h('div', { class: 'pc-sticker', text: m.sticker }),
    );
    c.style.setProperty('--tilt', `${tilt}deg`);
    return c;
  }

  function show(i: number, dir: number) {
    index = i;
    const old = stage.querySelector('.polaroid:not(.leaving)');
    if (old) {
      old.classList.add('leaving');
      (old as HTMLElement).style.setProperty('--dir', String(-dir));
      window.setTimeout(() => old.remove(), 600);
    }
    const c = card(list[i], i);
    c.style.setProperty('--dir', String(dir));
    stage.append(c);
    AudioManager.sfx('whoosh');
    Array.from(dots.children).forEach((d, k) => d.classList.toggle('on', k === i));
    counter.textContent = `${i + 1} / ${list.length}`;
    schedule();
  }

  function go(d: number) {
    const ni = Math.max(0, Math.min(list.length - 1, index + d));
    if (ni !== index) show(ni, d);
  }

  function close() {
    if (done) return;
    done = true;
    if (timer) clearTimeout(timer);
    document.removeEventListener('keydown', onKey);
    wrap.classList.add('closing');
    window.setTimeout(() => wrap.remove(), 700);
    opts.onDone();
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'Enter' || e.key === ' ') {
      if (index < list.length - 1) go(1);
      else close();
    }
  };
  document.addEventListener('keydown', onKey);

  let sx = 0;
  stage.addEventListener('pointerdown', (e) => (sx = e.clientX));
  stage.addEventListener('pointerup', (e) => {
    const d = e.clientX - sx;
    if (Math.abs(d) > 50) go(d < 0 ? 1 : -1);
  });

  uiRoot().append(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  show(0, 1);
  return { close };
}
