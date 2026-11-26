/**
 * Look-ahead step scheduler ("A Tale of Two Clocks" pattern).
 *
 * A coarse JS timer wakes up every ~25 ms and schedules every step that falls
 * inside the next `lookahead` seconds on the audio clock. Audio events are
 * placed at exact audio-clock times, so the beat never drifts even when the
 * JS timer jitters. Step times are computed by accumulation, so a tempo change
 * applies from the next step without a jump.
 */

export interface Clock {
  readonly currentTime: number;
}

export interface Ticker {
  start(intervalMs: number, onTick: () => void): void;
  stop(): void;
}

export interface StepEvent {
  /** Audio-clock time (seconds) at which this step sounds. */
  time: number;
  /** Step counter since start (0, 1, 2, ...). */
  step: number;
  /** Duration of this step in seconds. */
  duration: number;
}

export interface SchedulerOptions {
  clock: Clock;
  /** Seconds per step; read every step, so it may change while running. */
  stepDuration: () => number;
  onStep: (e: StepEvent) => void;
  ticker?: Ticker;
  lookahead?: number;
  intervalMs?: number;
  /** Delay before the first step, so the first note isn't clipped. */
  startDelay?: number;
}

export class Scheduler {
  private nextTime = 0;
  private step = 0;
  private running = false;
  private readonly ticker: Ticker;
  private readonly lookahead: number;
  private readonly intervalMs: number;
  private readonly startDelay: number;

  constructor(private readonly opts: SchedulerOptions) {
    this.ticker = opts.ticker ?? createTicker();
    this.lookahead = opts.lookahead ?? 0.12;
    this.intervalMs = opts.intervalMs ?? 25;
    this.startDelay = opts.startDelay ?? 0.06;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.step = 0;
    this.nextTime = this.opts.clock.currentTime + this.startDelay;
    this.pump();
    this.ticker.start(this.intervalMs, () => this.pump());
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.ticker.stop();
  }

  /** Schedules every step due within the look-ahead window. Public for tests. */
  pump(): void {
    if (!this.running) return;
    const horizon = this.opts.clock.currentTime + this.lookahead;
    // If the tab was frozen and we fell far behind, skip ahead rather than
    // firing a burst of stale notes all at once.
    if (this.nextTime < this.opts.clock.currentTime - 0.25) {
      const d = this.opts.stepDuration();
      const missed = Math.ceil((this.opts.clock.currentTime - this.nextTime) / d);
      this.nextTime += missed * d;
      this.step += missed;
    }
    while (this.nextTime < horizon) {
      const duration = this.opts.stepDuration();
      this.opts.onStep({ time: this.nextTime, step: this.step, duration });
      this.nextTime += duration;
      this.step++;
    }
  }
}

/**
 * Timer that runs in a Web Worker when possible — workers are throttled far
 * less than the main thread when the tab is in the background.
 */
export function createTicker(): Ticker {
  if (typeof Worker !== "undefined" && typeof Blob !== "undefined" && typeof URL?.createObjectURL === "function") {
    try {
      const src = `let id=null;onmessage=e=>{clearInterval(id);if(e.data>0)id=setInterval(()=>postMessage(0),e.data)}`;
      const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
      const worker = new Worker(url);
      let handler: (() => void) | null = null;
      worker.onmessage = () => handler?.();
      return {
        start(ms, onTick) {
          handler = onTick;
          worker.postMessage(ms);
        },
        stop() {
          handler = null;
          worker.postMessage(0);
        },
      };
    } catch {
      /* fall through to setInterval (e.g. CSP blocks blob workers) */
    }
  }
  let id: ReturnType<typeof setInterval> | undefined;
  return {
    start(ms, onTick) {
      clearInterval(id);
      id = setInterval(onTick, ms);
    },
    stop() {
      clearInterval(id);
    },
  };
}

/**
 * Lines visuals up with audio: queue events as they're scheduled, then each
 * animation frame take the ones whose audio time has arrived.
 */
export class VisualQueue<T extends { time: number }> {
  private items: T[] = [];
  push(item: T): void {
    this.items.push(item);
  }
  /** Returns the latest item that is due (discarding older due items), or undefined. */
  takeDue(now: number): T | undefined {
    let latest: T | undefined;
    while (this.items.length && this.items[0]!.time <= now) latest = this.items.shift();
    return latest;
  }
  clear(): void {
    this.items = [];
  }
}
