/** Drum-set grooves as step grids. Pure data + helpers — no audio APIs. */

import type { TimeSignature } from "./timing";

export const KIT_PIECES = [
  { id: "crash", label: "Crash" },
  { id: "ride", label: "Ride" },
  { id: "hihat", label: "Hi-hat" },
  { id: "openhat", label: "Open hat" },
  { id: "hightom", label: "High tom" },
  { id: "midtom", label: "Mid tom" },
  { id: "snare", label: "Snare" },
  { id: "floortom", label: "Floor tom" },
  { id: "kick", label: "Kick" },
  { id: "pedalhat", label: "Hat pedal" },
] as const;

export type KitPiece = (typeof KIT_PIECES)[number]["id"];

/** 0 = off, 1 = hit, 2 = accented hit. */
export type Velocity = 0 | 1 | 2;

export interface Groove {
  id: string;
  name: string;
  signature: TimeSignature;
  /** Steps per beat. */
  subdivision: number;
  bpm: number;
  /** One row per kit piece; each row has beats × subdivision steps. Missing rows = silent. */
  rows: Partial<Record<KitPiece, Velocity[]>>;
}

/**
 * Build a row from a compact string: "x" hit, "X" accent, "-" or "." rest.
 * Spaces are ignored so rows can be grouped by beat for readability.
 */
export function row(s: string): Velocity[] {
  return [...s.replace(/\s+/g, "")].map((c) => (c === "X" ? 2 : c === "x" ? 1 : 0));
}

export function stepsPerBar(g: Pick<Groove, "signature" | "subdivision">): number {
  return g.signature.beats * g.subdivision;
}

/** Return a copy of the groove resized to a new signature/subdivision, keeping hits that still fit. */
export function resizeGroove(g: Groove, signature: TimeSignature, subdivision: number): Groove {
  const sameSub = subdivision === g.subdivision;
  const length = signature.beats * subdivision;
  const rows: Groove["rows"] = {};
  for (const piece of KIT_PIECES) {
    const old = g.rows[piece.id];
    if (!old) continue;
    const next: Velocity[] = Array.from({ length }, () => 0);
    if (sameSub) {
      for (let i = 0; i < Math.min(length, old.length); i++) next[i] = old[i]!;
    } else {
      // Map each old hit to the nearest new step at the same beat position.
      old.forEach((v, i) => {
        if (!v) return;
        const pos = i / g.subdivision; // in beats
        const j = Math.round(pos * subdivision);
        if (j < length) next[j] = Math.max(next[j]!, v) as Velocity;
      });
    }
    rows[piece.id] = next;
  }
  return { ...g, signature, subdivision, rows };
}

export function emptyGroove(signature: TimeSignature, subdivision: number): Groove {
  return { id: "custom", name: "Custom", signature, subdivision, bpm: 90, rows: {} };
}

const FOUR_FOUR: TimeSignature = { beats: 4, unit: 4 };

export const PRESET_GROOVES: Groove[] = [
  {
    id: "rock",
    name: "Basic rock",
    signature: FOUR_FOUR,
    subdivision: 2,
    bpm: 96,
    rows: {
      hihat: row("xx xx xx xx"),
      snare: row("-- X- -- X-"),
      kick: row("x- -- x- --"),
    },
  },
  {
    id: "rock-16",
    name: "Rock, 16th hats",
    signature: FOUR_FOUR,
    subdivision: 4,
    bpm: 84,
    rows: {
      hihat: row("Xxxx Xxxx Xxxx Xxxx"),
      snare: row("---- X--- ---- X---"),
      kick: row("x--- --x- x-x- ----"),
    },
  },
  {
    id: "halftime",
    name: "Half-time",
    signature: FOUR_FOUR,
    subdivision: 2,
    bpm: 140,
    rows: {
      hihat: row("xx xx xx xx"),
      snare: row("-- -- X- --"),
      kick: row("x- -- -- x-"),
    },
  },
  {
    id: "disco",
    name: "Disco / four on the floor",
    signature: FOUR_FOUR,
    subdivision: 2,
    bpm: 118,
    rows: {
      hihat: row("x- x- x- x-"),
      openhat: row("-x -x -x -x"),
      snare: row("-- X- -- X-"),
      kick: row("x- x- x- x-"),
    },
  },
  {
    id: "shuffle",
    name: "Shuffle",
    signature: FOUR_FOUR,
    subdivision: 3,
    bpm: 100,
    rows: {
      hihat: row("x-x x-x x-x x-x"),
      snare: row("--- X-- --- X--"),
      kick: row("x-- --- x-- ---"),
    },
  },
  {
    id: "waltz",
    name: "Waltz (3/4)",
    signature: { beats: 3, unit: 4 },
    subdivision: 2,
    bpm: 120,
    rows: {
      ride: row("x- x- x-"),
      snare: row("-- x- x-"),
      kick: row("x- -- --"),
    },
  },
  {
    id: "six-eight",
    name: "6/8 ballad",
    signature: { beats: 6, unit: 8 },
    subdivision: 1,
    bpm: 150,
    rows: {
      hihat: row("xxx xxx"),
      snare: row("--- X--"),
      kick: row("x-- ---"),
    },
  },
  {
    id: "jazz-ride",
    name: "Jazz ride",
    signature: FOUR_FOUR,
    subdivision: 3,
    bpm: 132,
    rows: {
      ride: row("x-- x-x x-- x-x"),
      pedalhat: row("--- x-- --- x--"),
    },
  },
];
