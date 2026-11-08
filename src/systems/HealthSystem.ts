/** Boyfriend health. Never negative; the zero-HP callback fires exactly once. */
export class HealthSystem {
  hp: number;
  readonly max: number;
  private zeroFired = false;
  private floor = 0;
  onChange: (hp: number, delta: number) => void = () => {};
  onZero: () => void = () => {};
  onFloor: () => void = () => {};

  constructor(max: number, current = max) {
    this.max = max;
    this.hp = Math.max(0, Math.min(max, current));
  }

  /** Damage can't take HP below the level's floor (used to end levels 1 and 2 cleanly). */
  setFloor(f: number) {
    this.floor = f;
  }

  get atFloor() {
    return this.hp <= this.floor;
  }

  damage(amount: number): number {
    if (this.zeroFired || this.hp <= this.floor) return 0;
    const before = this.hp;
    this.hp = Math.max(this.floor, Math.max(0, this.hp - amount));
    const delta = before - this.hp;
    this.onChange(this.hp, delta);
    if (this.hp <= this.floor && this.floor > 0) this.onFloor();
    if (this.hp === 0 && !this.zeroFired) {
      this.zeroFired = true;
      this.onZero();
    }
    return delta;
  }

  get stage(): 0 | 1 | 2 | 3 | 4 {
    if (this.hp <= 0) return 4;
    if (this.hp <= 10) return 3;
    if (this.hp <= 40) return 2;
    if (this.hp <= 70) return 1;
    return 0;
  }
}
