/** One shared AudioContext for the app, created on first user gesture. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function audio(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: "interactive" });
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Output bus that all synthesized sounds connect to. */
export function output(): GainNode {
  audio();
  return master!;
}

export function setMasterVolume(v: number): void {
  output().gain.value = Math.max(0, Math.min(1, v));
}

/** Keeps the screen awake while something is playing (where supported). */
let wakeLock: { release(): Promise<void> } | null = null;
let wakeUsers = 0;

export async function holdWakeLock(): Promise<void> {
  wakeUsers++;
  if (wakeLock) return;
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } };
    wakeLock = (await nav.wakeLock?.request("screen")) ?? null;
  } catch {
    wakeLock = null;
  }
}

export function releaseWakeLock(): void {
  wakeUsers = Math.max(0, wakeUsers - 1);
  if (wakeUsers === 0 && wakeLock) {
    void wakeLock.release().catch(() => undefined);
    wakeLock = null;
  }
}
