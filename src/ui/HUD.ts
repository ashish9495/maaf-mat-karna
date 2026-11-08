/** In-game HUD (HTML overlay): health, weapons, cooldowns, stage, objective, combo, prompts. */
import { h, btn } from './dom';
import { WEAPONS, WEAPON_ORDER, type WeaponId } from '../config/weaponConfig';
import { personalization } from '../config/personalization';
import { esc } from '../utils/helpers';
import { getPortrait } from '../utils/portraits';

export interface HUDHandlers {
  onPause: () => void;
  onSelect: (id: WeaponId) => void;
  onPortrait: () => void;
  onHeart: () => void;
}

export class HUD {
  root: HTMLDivElement;
  private hpFill: HTMLDivElement;
  private hpText: HTMLSpanElement;
  private hpBox: HTMLDivElement;
  private stage: HTMLDivElement;
  private objective: HTMLDivElement;
  private slots = new Map<WeaponId, HTMLButtonElement>();
  private combo: HTMLDivElement;
  private prompt: HTMLDivElement;
  private dash: HTMLDivElement;
  private weaponName: HTMLDivElement;
  private lastHp = -1;

  constructor(handlers: HUDHandlers) {
    const bf = personalization.boyfriend;
    const portrait = h('img', { class: 'hud-portrait', alt: bf.name, src: getPortrait('bf'), title: `${bf.nickname}` });
    portrait.addEventListener('click', handlers.onPortrait);

    this.hpFill = h('div', { class: 'hp-fill' });
    this.hpText = h('span', { class: 'hp-text', text: '100/100' });
    this.hpBox = h('div', { class: 'hud-hp' },
      portrait,
      h('div', { class: 'hp-col' },
        h('div', { class: 'hp-label', html: `${esc(bf.nickname.toUpperCase())}'S HEALTH <span class="beat">❤️</span>` }),
        h('div', { class: 'hp-bar' }, this.hpFill, h('div', { class: 'hp-shine' })),
        this.hpText,
      ),
    );

    this.stage = h('div', { class: 'hud-stage' });
    this.objective = h('div', { class: 'hud-objective' });

    const heart = btn('💗', handlers.onHeart, 'btn-icon hud-heart');
    heart.title = 'Tap me';
    const pause = btn('⏸', handlers.onPause, 'btn-icon hud-pause');
    pause.setAttribute('aria-label', 'Pause');

    const slotsRow = h('div', { class: 'hud-weapons' });
    WEAPON_ORDER.forEach((id, i) => {
      const w = WEAPONS[id];
      const b = h('button', { class: 'slot locked', type: 'button', title: w.name },
        h('span', { class: 'slot-icon', text: w.icon }),
        h('span', { class: 'slot-key', text: i < 9 ? String(i + 1) : i === 9 ? '0' : '' }),
        h('span', { class: 'slot-cd' }),
      );
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        handlers.onSelect(id);
      });
      this.slots.set(id, b);
      slotsRow.append(b);
    });
    this.weaponName = h('div', { class: 'hud-weapon-name' });
    this.dash = h('div', { class: 'hud-dash', title: 'Dash' }, h('span', { text: '💨' }));

    this.combo = h('div', { class: 'hud-combo' });
    this.prompt = h('div', { class: 'hud-prompt' });

    this.root = h('div', { class: 'hud' },
      h('div', { class: 'hud-top' }, this.hpBox, h('div', { class: 'hud-center' }, this.stage, this.objective), h('div', { class: 'hud-right' }, heart, pause)),
      h('div', { class: 'hud-bottom-left' }, this.weaponName, h('div', { class: 'hud-weapon-row' }, slotsRow, this.dash)),
      this.combo,
      this.prompt,
    );
  }

  setHp(hp: number, max: number) {
    if (hp === this.lastHp) return;
    const hit = this.lastHp > hp && this.lastHp !== -1;
    this.lastHp = hp;
    const pct = Math.max(0, hp / max) * 100;
    this.hpFill.style.width = `${pct}%`;
    this.hpFill.style.background =
      pct > 70 ? 'linear-gradient(90deg,#ff7eb6,#ff4f8b)' : pct > 40 ? 'linear-gradient(90deg,#ffb36b,#ff7e6b)' : pct > 10 ? 'linear-gradient(90deg,#ff8a5c,#ff4f4f)' : 'linear-gradient(90deg,#ff3d3d,#c2185b)';
    this.hpText.textContent = `${Math.round(hp)}/${max}`;
    if (hit) {
      this.hpBox.classList.remove('hit');
      void this.hpBox.offsetWidth;
      this.hpBox.classList.add('hit');
    }
    this.hpBox.classList.toggle('critical', pct <= 10 && pct > 0);
  }

  setStage(text: string, objective: string) {
    this.stage.textContent = text;
    this.objective.textContent = objective;
  }

  setObjective(objective: string) {
    this.objective.textContent = objective;
  }

  setWeapons(unlocked: WeaponId[], current: WeaponId) {
    this.slots.forEach((b, id) => {
      const has = unlocked.includes(id);
      b.classList.toggle('locked', !has);
      b.classList.toggle('active', id === current);
      (b.querySelector('.slot-icon') as HTMLElement).textContent = has ? WEAPONS[id].icon : '🔒';
      b.title = has ? WEAPONS[id].name : 'Locked — keep chasing to unlock!';
    });
    this.weaponName.textContent = `${WEAPONS[current].icon} ${WEAPONS[current].name}`;
    this.weaponName.classList.remove('pop');
    void this.weaponName.offsetWidth;
    this.weaponName.classList.add('pop');
  }

  setCooldown(id: WeaponId, progress: number) {
    const b = this.slots.get(id);
    if (!b) return;
    const cd = b.querySelector('.slot-cd') as HTMLElement;
    cd.style.background = progress >= 1 ? 'transparent' : `conic-gradient(rgba(40,20,40,.55) ${(1 - progress) * 360}deg, transparent 0)`;
  }

  setDash(progress: number) {
    this.dash.style.background = progress >= 1 ? '' : `conic-gradient(rgba(255,255,255,.85) ${progress * 360}deg, rgba(60,30,60,.35) 0)`;
    this.dash.classList.toggle('ready', progress >= 1);
  }

  setCombo(n: number) {
    if (n < 2) {
      this.combo.classList.remove('show');
      return;
    }
    this.combo.innerHTML = `<b>${n}</b> HIT COMBO!`;
    this.combo.classList.remove('show');
    void this.combo.offsetWidth;
    this.combo.classList.add('show');
  }

  showPrompt(html: string) {
    this.prompt.innerHTML = html;
    this.prompt.classList.toggle('show', !!html);
  }

  banner(text: string, sub = '') {
    const b = h('div', { class: 'stage-banner' }, h('div', { class: 'sb-title', text }), sub ? h('div', { class: 'sb-sub', text: sub }) : null);
    this.root.append(b);
    window.setTimeout(() => b.remove(), 2600);
  }

  unlockBanner(icon: string, name: string, desc: string) {
    const b = h('div', { class: 'unlock-banner' }, h('div', { class: 'ub-icon', text: icon }), h('div', {}, h('small', { text: 'NEW WEAPON UNLOCKED' }), h('b', { text: name }), h('span', { text: desc })));
    this.root.append(b);
    window.setTimeout(() => b.remove(), 3200);
  }

  hide(v: boolean) {
    this.root.classList.toggle('hidden', v);
  }
}
