/** Time-signature and tempo math. Pure functions — no audio APIs. */

export interface TimeSignature {
  /** Beats per bar (numerator). */
  beats: number;
  /** Note value that gets one beat (denominator): 2, 4, 8 or 16. */
  unit: 2 | 4 | 8 | 16;
}

export type BeatLevel = "accent" | "normal" | "mute";

export const MIN_BPM = 20;
export const MAX_BPM = 320;

export const COMMON_SIGNATURES: TimeSignature[] = [
  { beats: 4, unit: 4 },
  { beats: 3, unit: 4 },
  { beats: 2, unit: 4 },
  { beats: 6, unit: 8 },
  { beats: 5, unit: 4 },
  { beats: 7, unit: 8 },
  { beats: 5, unit: 8 },
  { beats: 9, unit: 8 },
  { beats: 12, unit: 8 },
  { beats: 2, unit: 2 },
];

export function formatSignature(sig: TimeSignature): string {
  return `${sig.beats}/${sig.unit}`;
}

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return 120;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

/**
 * How the beats of a bar group together, e.g. 6/8 → [3, 3], 7/8 → [2, 2, 3].
 * Compound meters (6, 9, 12 over 8 or 16) group in threes; other odd-unit meters
 * group in twos with a three at the end; simple meters are one group.
 */
export function beatGrouping(sig: TimeSignature): number[] {
  const { beats, unit } = sig;
  if (unit < 8 || beats <= 3) return [beats];
  if (beats % 3 === 0) return Array.from({ length: beats / 3 }, () => 3);
  const groups: number[] = [];
  let left = beats;
  while (left > 0) {
    if (left === 3) {
      groups.push(3);
      left = 0;
    } else {
      groups.push(2);
      left -= 2;
    }
  }
  return groups;
}

/** Default accent pattern: beat 1 accented, plus the start of each later group as accented too. */
export function defaultAccents(sig: TimeSignature): BeatLevel[] {
  const levels: BeatLevel[] = Array.from({ length: sig.beats }, () => "normal");
  let i = 0;
  for (const group of beatGrouping(sig)) {
    levels[i] = "accent";
    i += group;
  }
  return levels;
}

/** Seconds per beat (beat = the signature's unit) at the given BPM. */
export function secondsPerBeat(bpm: number): number {
  return 60 / bpm;
}

/** Seconds per scheduler step when each beat is split into `subdivision` parts. */
export function stepDuration(bpm: number, subdivision: number): number {
  return secondsPerBeat(bpm) / subdivision;
}

/** Position of a step counter within the bar. */
export function stepPosition(step: number, beatsPerBar: number, subdivision: number): { beat: number; sub: number; bar: number } {
  const stepsPerBar = beatsPerBar * subdivision;
  const inBar = ((step % stepsPerBar) + stepsPerBar) % stepsPerBar;
  return { bar: Math.floor(step / stepsPerBar), beat: Math.floor(inBar / subdivision), sub: inBar % subdivision };
}

/**
 * Tap tempo: BPM from a list of tap timestamps (ms). Uses the last few intervals,
 * and starts over when the gap is long enough that the player clearly stopped.
 */
export function tapTempo(taps: number[], maxGapMs = 2000, window = 6): number | null {
  const recent: number[] = [];
  for (let i = taps.length - 1; i >= 0; i--) {
    const prev = recent[0];
    const t = taps[i]!;
    if (prev !== undefined && prev - t > maxGapMs) break;
    recent.unshift(t);
    if (recent.length > window) break;
  }
  if (recent.length < 2) return null;
  const intervals = recent.slice(1).map((t, i) => t - recent[i]!);
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  return clampBpm(60000 / avg);
}

/** Speed-trainer: BPM for the given completed-cycle count. */
export function trainerBpm(start: number, target: number, step: number, everyCycles: number, cyclesDone: number): number {
  const increments = Math.floor(cyclesDone / Math.max(1, everyCycles));
  const dir = target >= start ? 1 : -1;
  const bpm = start + dir * Math.abs(step) * increments;
  return dir > 0 ? Math.min(target, bpm) : Math.max(target, bpm);
}
