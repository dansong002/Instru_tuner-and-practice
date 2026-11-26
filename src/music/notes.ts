/** Pitch math for the tuner. Pure functions — no audio APIs. */

export const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"] as const;

export interface NoteReading {
  /** Nearest equal-tempered MIDI note number. */
  midi: number;
  /** Note name without octave, e.g. "A". */
  name: string;
  /** Scientific pitch octave, e.g. 4 for A4. */
  octave: number;
  /** Deviation from the nearest note, in cents (-50..+50). */
  cents: number;
  /** The frequency that was measured. */
  frequency: number;
  /** Exact frequency of the nearest note at the current reference. */
  targetFrequency: number;
}

/** Fractional MIDI number for a frequency, given the A4 reference (default 440 Hz). */
export function frequencyToMidi(frequency: number, a4 = 440): number {
  return 69 + 12 * Math.log2(frequency / a4);
}

export function midiToFrequency(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

export function midiToName(midi: number): { name: string; octave: number } {
  const pc = ((midi % 12) + 12) % 12;
  return { name: NOTE_NAMES[pc] ?? "?", octave: Math.floor(midi / 12) - 1 };
}

/** Cents between two frequencies (positive when `frequency` is sharp of `reference`). */
export function centsBetween(frequency: number, reference: number): number {
  return 1200 * Math.log2(frequency / reference);
}

export function readNote(frequency: number, a4 = 440): NoteReading | null {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  const exact = frequencyToMidi(frequency, a4);
  const midi = Math.round(exact);
  const targetFrequency = midiToFrequency(midi, a4);
  const { name, octave } = midiToName(midi);
  return { midi, name, octave, cents: centsBetween(frequency, targetFrequency), frequency, targetFrequency };
}

export interface Tuning {
  id: string;
  label: string;
  /** MIDI note numbers, low string to high. Empty = chromatic. */
  strings: number[];
}

export const TUNINGS: Tuning[] = [
  { id: "chromatic", label: "Chromatic", strings: [] },
  { id: "guitar", label: "Guitar — standard (E A D G B E)", strings: [40, 45, 50, 55, 59, 64] },
  { id: "guitar-dropd", label: "Guitar — drop D (D A D G B E)", strings: [38, 45, 50, 55, 59, 64] },
  { id: "bass4", label: "Bass — 4 string (E A D G)", strings: [28, 33, 38, 43] },
  { id: "ukulele", label: "Ukulele (G C E A)", strings: [67, 60, 64, 69] },
  { id: "violin", label: "Violin (G D A E)", strings: [55, 62, 69, 76] },
];

/** For string-instrument modes: the string whose pitch is closest (in cents) to the measured frequency. */
export function nearestString(frequency: number, strings: number[], a4 = 440): { midi: number; cents: number } | null {
  let best: { midi: number; cents: number } | null = null;
  for (const midi of strings) {
    const cents = centsBetween(frequency, midiToFrequency(midi, a4));
    if (!best || Math.abs(cents) < Math.abs(best.cents)) best = { midi, cents };
  }
  return best;
}

/** Median of the numbers — used to steady the tuner needle against jitter. */
export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
