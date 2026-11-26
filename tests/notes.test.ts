import { describe, expect, it } from "vitest";
import { TUNINGS, centsBetween, frequencyToMidi, median, midiToFrequency, midiToName, nearestString, readNote } from "../src/music/notes";

describe("pitch math", () => {
  it("maps A4 to MIDI 69 at any reference", () => {
    expect(frequencyToMidi(440)).toBe(69);
    expect(frequencyToMidi(432, 432)).toBe(69);
    expect(midiToFrequency(69, 442)).toBe(442);
  });

  it("names notes with octaves", () => {
    expect(midiToName(60)).toEqual({ name: "C", octave: 4 });
    expect(midiToName(40)).toEqual({ name: "E", octave: 2 });
    expect(midiToName(70)).toEqual({ name: "A♯", octave: 4 });
  });

  it("reads cents sharp and flat", () => {
    const sharp = readNote(440 * 2 ** (10 / 1200))!;
    expect(sharp.name).toBe("A");
    expect(sharp.cents).toBeCloseTo(10, 6);
    const flat = readNote(midiToFrequency(64) * 2 ** (-20 / 1200))!;
    expect(flat.name).toBe("E");
    expect(flat.octave).toBe(4);
    expect(flat.cents).toBeCloseTo(-20, 6);
  });

  it("respects the A4 reference", () => {
    const r = readNote(432, 432)!;
    expect(r.name).toBe("A");
    expect(r.cents).toBeCloseTo(0, 6);
    // 432 Hz against a 440 reference is ~32 cents flat of A
    expect(readNote(432, 440)!.cents).toBeCloseTo(-31.77, 1);
  });

  it("rejects bad frequencies", () => {
    expect(readNote(0)).toBeNull();
    expect(readNote(NaN)).toBeNull();
  });

  it("finds the nearest guitar string", () => {
    const guitar = TUNINGS.find((t) => t.id === "guitar")!.strings;
    // Slightly flat low E
    const r = nearestString(81.5, guitar)!;
    expect(r.midi).toBe(40);
    expect(r.cents).toBeLessThan(0);
    expect(nearestString(196, guitar)!.midi).toBe(55);
  });

  it("measures cents between frequencies", () => {
    expect(centsBetween(880, 440)).toBeCloseTo(1200, 9);
  });

  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNaN();
  });
});
