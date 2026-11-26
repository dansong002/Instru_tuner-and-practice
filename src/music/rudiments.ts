/**
 * Drum rudiments as sticking patterns.
 *
 * Pattern tokens (space separated, one token per step):
 *   R / L      tap with right / left hand
 *   >R / >L    accented stroke
 *   lR / rL    flam (one grace note before the main stroke)
 *   llR / rrL  drag (two grace notes before the main stroke)
 *   -          rest
 * Grace and accent markers combine, e.g. ">lR" is an accented flam.
 */

export type Hand = "R" | "L";
export type Grace = "flam" | "drag";

export interface Stroke {
  hand: Hand;
  accent: boolean;
  grace?: Grace;
}

/** A step is either a stroke or a rest (null). */
export type Step = Stroke | null;

export type RudimentFamily = "Roll" | "Diddle" | "Flam" | "Drag";

export interface Rudiment {
  id: string;
  name: string;
  family: RudimentFamily;
  /** Steps per beat: 2 = 8ths, 3 = triplets, 4 = 16ths, 6 = sextuplets. */
  subdivision: number;
  pattern: string;
  tip?: string;
}

export function parseStep(token: string): Step {
  if (token === "-") return null;
  const m = /^(>)?(ll|rr|l|r)?(R|L)$/.exec(token);
  if (!m) throw new Error(`Bad sticking token: "${token}"`);
  const [, accent, grace, hand] = m;
  const stroke: Stroke = { hand: hand as Hand, accent: accent === ">" };
  if (grace) {
    // The grace note is always played by the other hand.
    if (grace[0]!.toUpperCase() === hand) throw new Error(`Grace note must use the other hand: "${token}"`);
    stroke.grace = grace.length === 2 ? "drag" : "flam";
  }
  return stroke;
}

export function parsePattern(pattern: string): Step[] {
  return pattern.trim().split(/\s+/).map(parseStep);
}

/** Display label for a step, e.g. "R", "lR", "llR". */
export function stepLabel(step: Step): string {
  if (!step) return "·";
  const g = step.hand === "R" ? "l" : "r";
  const prefix = step.grace === "flam" ? g : step.grace === "drag" ? g + g : "";
  return prefix + step.hand;
}

/** Beats one cycle of the pattern lasts. */
export function cycleBeats(r: Rudiment): number {
  return parsePattern(r.pattern).length / r.subdivision;
}

export const RUDIMENTS: Rudiment[] = [
  // Rolls
  {
    id: "single-stroke-roll",
    name: "Single Stroke Roll",
    family: "Roll",
    subdivision: 4,
    pattern: "R L R L R L R L",
    tip: "Even height and volume in both hands. Let the stick rebound — don't push it into the head.",
  },
  {
    id: "double-stroke-roll",
    name: "Double Stroke Open Roll",
    family: "Roll",
    subdivision: 4,
    pattern: "R R L L R R L L",
    tip: "The second stroke of each pair should be as loud as the first. Slow down until it is.",
  },
  {
    id: "five-stroke-roll",
    name: "Five Stroke Roll",
    family: "Roll",
    subdivision: 4,
    pattern: "R R L L >R - - - L L R R >L - - -",
  },
  {
    id: "seven-stroke-roll",
    name: "Seven Stroke Roll",
    family: "Roll",
    subdivision: 4,
    pattern: "L L R R L L >R - R R L L R R >L -",
  },
  {
    id: "nine-stroke-roll",
    name: "Nine Stroke Roll",
    family: "Roll",
    subdivision: 4,
    pattern: "R R L L R R L L >R - - - L L R R L L R R >L - - -",
  },
  // Diddles
  {
    id: "single-paradiddle",
    name: "Single Paradiddle",
    family: "Diddle",
    subdivision: 4,
    pattern: ">R L R R >L R L L",
    tip: "Keep the accent tall and the taps low. The lead hand switches every group.",
  },
  {
    id: "inverted-paradiddle",
    name: "Inverted Paradiddle",
    family: "Diddle",
    subdivision: 4,
    pattern: ">R L L R >L R R L",
  },
  {
    id: "double-paradiddle",
    name: "Double Paradiddle",
    family: "Diddle",
    subdivision: 3,
    pattern: ">R L R L R R >L R L R L L",
  },
  {
    id: "triple-paradiddle",
    name: "Triple Paradiddle",
    family: "Diddle",
    subdivision: 4,
    pattern: ">R L R L R L R R >L R L R L R L L",
  },
  {
    id: "paradiddle-diddle",
    name: "Paradiddle-diddle",
    family: "Diddle",
    subdivision: 6,
    pattern: ">R L R R L L >R L R R L L",
    tip: "Great around the kit: lead hand on the tom, doubles on the snare.",
  },
  // Flams
  {
    id: "flam",
    name: "Flam",
    family: "Flam",
    subdivision: 2,
    pattern: "lR rL",
    tip: "Grace note from about an inch, main stroke from full height. Both hands hit almost together.",
  },
  {
    id: "flam-accent",
    name: "Flam Accent",
    family: "Flam",
    subdivision: 3,
    pattern: ">lR L R >rL R L",
  },
  {
    id: "flam-tap",
    name: "Flam Tap",
    family: "Flam",
    subdivision: 4,
    pattern: "lR R rL L",
  },
  {
    id: "flamacue",
    name: "Flamacue",
    family: "Flam",
    subdivision: 4,
    pattern: "lR >L R L lR - - - rL >R L R rL - - -",
  },
  {
    id: "flam-paradiddle",
    name: "Flam Paradiddle",
    family: "Flam",
    subdivision: 4,
    pattern: "lR L R R rL R L L",
  },
  {
    id: "swiss-army-triplet",
    name: "Swiss Army Triplet",
    family: "Flam",
    subdivision: 3,
    pattern: "lR R L lR R L",
  },
  // Drags
  {
    id: "drag",
    name: "Drag",
    family: "Drag",
    subdivision: 2,
    pattern: "llR rrL",
    tip: "The two grace notes are a relaxed double bounce, played low.",
  },
  {
    id: "single-drag-tap",
    name: "Single Drag Tap",
    family: "Drag",
    subdivision: 2,
    pattern: "llR >L rrL >R",
  },
];

export function findRudiment(id: string): Rudiment | undefined {
  return RUDIMENTS.find((r) => r.id === id);
}
