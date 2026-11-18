/**
 * 1-Euro Filter implementation (Casiez et al., 2012)
 *
 * Adaptive low-pass filter specifically designed for noisy human motion tracking:
 * - At rest / low speeds: low cutoff frequency eliminates micro-jitter.
 * - At high speeds: cutoff increases dynamically to eliminate lag.
 */

class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  constructor(private alpha: number = 0) {
    this.setAlpha(alpha);
  }

  setAlpha(alpha: number) {
    if (alpha <= 0 || alpha > 1.0) {
      this.alpha = Math.max(0.0001, Math.min(1.0, alpha));
    } else {
      this.alpha = alpha;
    }
  }

  filter(value: number): number {
    if (this.y === null) {
      this.s = value;
      this.y = value;
      return value;
    }
    this.s = this.alpha * value + (1.0 - this.alpha) * (this.s as number);
    this.y = this.s;
    return this.y;
  }

  filterWithAlpha(value: number, alpha: number): number {
    this.setAlpha(alpha);
    return this.filter(value);
  }

  lastValue(): number | null {
    return this.y;
  }

  reset() {
    this.y = null;
    this.s = null;
  }
}

export class OneEuroFilter {
  private xFilt: LowPassFilter;
  private dxFilt: LowPassFilter;
  private lastTime: number | null = null;

  /**
   * @param minCutoff Minimum cutoff frequency in Hz (default 1.0 Hz). Lower values reduce jitter at rest.
   * @param beta Speed coefficient (default 0.25). Higher values reduce lag during motion.
   * @param dCutoff Cutoff frequency for derivative in Hz (default 1.0 Hz).
   */
  constructor(
    private minCutoff: number = 1.0,
    private beta: number = 0.25,
    private dCutoff: number = 1.0
  ) {
    this.xFilt = new LowPassFilter();
    this.dxFilt = new LowPassFilter();
  }

  private alpha(rate: number, cutoff: number): number {
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }

  filter(value: number, timestamp: number = Date.now()): number {
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      return this.xFilt.filterWithAlpha(value, 1.0);
    }

    const dt = Math.max(0.001, (timestamp - this.lastTime) / 1000.0);
    this.lastTime = timestamp;
    const rate = 1.0 / dt;

    const prevX = this.xFilt.lastValue();
    const dx = prevX !== null ? (value - prevX) * rate : 0;
    const edx = this.dxFilt.filterWithAlpha(dx, this.alpha(rate, this.dCutoff));

    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilt.filterWithAlpha(value, this.alpha(rate, cutoff));
  }

  reset() {
    this.lastTime = null;
    this.xFilt.reset();
    this.dxFilt.reset();
  }
}
