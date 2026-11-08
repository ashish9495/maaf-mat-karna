import type { Line } from '../config/dialogueConfig';
import { SaveManager } from '../systems/SaveManager';

/** Pick the line in the current language. */
export function t(line: Line): string {
  return SaveManager.settings.language === 'en' ? line.en : line.hi;
}

export function pick<T>(arr: T[], avoid?: T): T {
  if (arr.length === 1) return arr[0];
  let v = arr[Math.floor(Math.random() * arr.length)];
  let guard = 0;
  while (v === avoid && guard++ < 8) v = arr[Math.floor(Math.random() * arr.length)];
  return v;
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const hex = (c: string) => parseInt(c.replace('#', ''), 16);

/** Personal text never goes into innerHTML unescaped. */
export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export function motionScale() {
  return SaveManager.settings.reducedMotion ? 0.35 : 1;
}

/** Checks whether an asset under /public actually exists (dev server returns HTML for misses). */
export async function assetExists(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const type = r.headers.get('content-type') || '';
    return r.ok && !type.includes('text/html');
  } catch {
    return false;
  }
}
