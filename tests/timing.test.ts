import { describe, expect, it } from "vitest";
import { beatGrouping, clampBpm, defaultAccents, stepDuration, stepPosition, tapTempo, trainerBpm } from "../src/music/timing";

describe("time signatures", () => {
  it("groups simple and compound meters", () => {
    expect(beatGrouping({ beats: 4, unit: 4 })).toEqual([4]);
    expect(beatGrouping({ beats: 5, unit: 4 })).toEqual([5]);
    expect(beatGrouping({ beats: 6, unit: 8 })).toEqual([3, 3]);
    expect(beatGrouping({ beats: 9, unit: 8 })).toEqual([3, 3, 3]);
    expect(beatGrouping({ beats: 12, unit: 8 })).toEqual([3, 3, 3, 3]);
    expect(beatGrouping({ beats: 5, unit: 8 })).toEqual([2, 3]);
    expect(beatGrouping({ beats: 7, unit: 8 })).toEqual([2, 2, 3]);
    expect(beatGrouping({ beats: 3, unit: 8 })).toEqual([3]);
  });

  it("accents the start of each group", () => {
    expect(defaultAccents({ beats: 4, unit: 4 })).toEqual(["accent", "normal", "normal", "normal"]);
    expect(defaultAccents({ beats: 6, unit: 8 })).toEqual(["accent", "normal", "normal", "accent", "normal", "normal"]);
    expect(defaultAccents({ beats: 7, unit: 8 })).toEqual(["accent", "normal", "accent", "normal", "accent", "normal", "normal"]);
  });

  it("computes step durations", () => {
    expect(stepDuration(120, 1)).toBe(0.5);
    expect(stepDuration(120, 4)).toBe(0.125);
    expect(stepDuration(60, 3)).toBeCloseTo(1 / 3, 12);
  });

  it("locates steps in the bar", () => {
    expect(stepPosition(0, 4, 2)).toEqual({ bar: 0, beat: 0, sub: 0 });
    expect(stepPosition(3, 4, 2)).toEqual({ bar: 0, beat: 1, sub: 1 });
    expect(stepPosition(8, 4, 2)).toEqual({ bar: 1, beat: 0, sub: 0 });
  });

  it("clamps BPM", () => {
    expect(clampBpm(5)).toBe(20);
    expect(clampBpm(1000)).toBe(320);
    expect(clampBpm(99.6)).toBe(100);
    expect(clampBpm(NaN)).toBe(120);
  });
});

describe("tap tempo", () => {
  it("needs two taps", () => {
    expect(tapTempo([1000])).toBeNull();
  });
  it("averages recent intervals", () => {
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120);
  });
  it("forgets taps after a long pause", () => {
    // Old taps at 60 BPM, then a pause, then taps at 150 BPM
    expect(tapTempo([0, 1000, 2000, 10000, 10400, 10800])).toBe(150);
  });
});

describe("speed trainer", () => {
  it("steps up every N cycles and stops at target", () => {
    expect(trainerBpm(60, 80, 5, 4, 0)).toBe(60);
    expect(trainerBpm(60, 80, 5, 4, 3)).toBe(60);
    expect(trainerBpm(60, 80, 5, 4, 4)).toBe(65);
    expect(trainerBpm(60, 80, 5, 4, 100)).toBe(80);
  });
  it("can step down", () => {
    expect(trainerBpm(120, 100, 10, 1, 1)).toBe(110);
    expect(trainerBpm(120, 100, 10, 1, 9)).toBe(100);
  });
});
