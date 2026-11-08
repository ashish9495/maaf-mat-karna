/**
 * CutsceneManager — runs cinematic beats as an explicit async sequence built on
 * Phaser's own clock (scene.time / tweens), not loose setTimeouts.
 *
 * - Every wait/tween resolves through the scene clock, so pausing or slow-motion apply.
 * - skip() or scene shutdown aborts the running sequence cleanly (a CutsceneAbort is thrown
 *   through the awaiting chain and swallowed by run()).
 * - A token guards against a sequence being started twice (rapid clicking).
 */
import Phaser from 'phaser';

export class CutsceneAbort extends Error {
  constructor() {
    super('cutscene aborted');
  }
}

export class CutsceneManager {
  private scene: Phaser.Scene;
  private token = 0;
  private running = false;
  private pending = new Set<() => void>();
  private skipTarget: string | null = null;
  state = 'idle';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.abort());
  }

  get isRunning() {
    return this.running;
  }

  /** Run a sequence. Returns false if one is already running. */
  async run(fn: (cs: CutsceneManager) => Promise<void>): Promise<boolean> {
    if (this.running) return false;
    this.running = true;
    const my = ++this.token;
    try {
      await fn(this);
    } catch (e) {
      if (!(e instanceof CutsceneAbort)) console.error(e);
    } finally {
      if (my === this.token) this.running = false;
    }
    return true;
  }

  /** Abort the current sequence (resolving all pending waits with an abort). */
  abort() {
    this.token++;
    this.running = false;
    const fns = [...this.pending];
    this.pending.clear();
    fns.forEach((f) => f());
  }

  /** Request skipping to a named beat; the sequence checks this via shouldSkipTo(). */
  skipTo(name: string) {
    this.skipTarget = name;
    const fns = [...this.pending];
    this.pending.clear();
    fns.forEach((f) => f());
  }

  consumeSkip(name: string) {
    if (this.skipTarget === name) {
      this.skipTarget = null;
      return true;
    }
    return false;
  }

  get skipping() {
    return this.skipTarget !== null;
  }

  private guard<T>(make: (resolve: (v: T) => void, done: () => void) => void): Promise<T> {
    const my = this.token;
    return new Promise<T>((resolve, reject) => {
      if (this.skipTarget) {
        resolve(undefined as T);
        return;
      }
      let settled = false;
      const interrupt = () => {
        if (settled) return;
        settled = true;
        if (my !== this.token) reject(new CutsceneAbort());
        else resolve(undefined as T); // skipping: fast-forward
      };
      this.pending.add(interrupt);
      make(
        (v) => {
          if (settled) return;
          settled = true;
          this.pending.delete(interrupt);
          if (my !== this.token) reject(new CutsceneAbort());
          else resolve(v);
        },
        () => this.pending.delete(interrupt),
      );
    });
  }

  wait(ms: number): Promise<void> {
    return this.guard<void>((resolve) => {
      this.scene.time.delayedCall(ms, () => resolve());
    });
  }

  tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return this.guard<void>((resolve) => {
      const userComplete = cfg.onComplete;
      const tw = this.scene.tweens.add({
        ...cfg,
        onComplete: (...args: unknown[]) => {
          (userComplete as ((...a: unknown[]) => void) | undefined)?.(...args);
          resolve();
        },
      });
      // if we skip mid-tween, jump it to the end
      const check = this.scene.time.addEvent({
        delay: 30,
        loop: true,
        callback: () => {
          if (this.skipTarget && tw.isPlaying()) {
            tw.complete();
          }
          if (!tw.isPlaying()) check.remove();
        },
      });
    });
  }

  /** Wrap any promise (e.g. a dialogue line or a DOM prompt) so skip/abort can interrupt it. */
  until<T>(p: Promise<T>): Promise<T> {
    return this.guard<T>((resolve) => {
      p.then(resolve);
    });
  }

  check() {
    // used after a beat to bail if aborted
    return this.running;
  }
}
