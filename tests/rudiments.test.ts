import { describe, expect, it } from "vitest";
import { RUDIMENTS, cycleBeats, parsePattern, parseStep, stepLabel } from "../src/music/rudiments";

describe("sticking parser", () => {
  it("parses taps, accents, rests and grace notes", () => {
    expect(parseStep("R")).toEqual({ hand: "R", accent: false });
    expect(parseStep(">L")).toEqual({ hand: "L", accent: true });
    expect(parseStep("lR")).toEqual({ hand: "R", accent: false, grace: "flam" });
    expect(parseStep(">rL")).toEqual({ hand: "L", accent: true, grace: "flam" });
    expect(parseStep("llR")).toEqual({ hand: "R", accent: false, grace: "drag" });
    expect(parseStep("-")).toBeNull();
  });

  it("rejects invalid tokens", () => {
    expect(() => parseStep("X")).toThrow();
    expect(() => parseStep("rR")).toThrow(/other hand/);
    expect(() => parseStep("llL")).toThrow(/other hand/);
  });

  it("labels steps for display", () => {
    expect(parsePattern("lR rrL - >R").map(stepLabel)).toEqual(["lR", "rrL", "·", "R"]);
  });
});

describe("rudiment library", () => {
  it("has unique ids", () => {
    const ids = RUDIMENTS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const r of RUDIMENTS) {
    it(`${r.name} parses and fills whole beats`, () => {
      const steps = parsePattern(r.pattern);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[0]).not.toBeNull();
      expect(Number.isInteger(cycleBeats(r))).toBe(true);
    });
  }

  it("paradiddle sticking is RLRR LRLL", () => {
    const p = RUDIMENTS.find((r) => r.id === "single-paradiddle")!;
    expect(parsePattern(p.pattern).map((s) => s?.hand).join("")).toBe("RLRRLRLL");
  });
});
