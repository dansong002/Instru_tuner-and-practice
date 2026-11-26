import { describe, expect, it } from "vitest";
import { KIT_PIECES, PRESET_GROOVES, resizeGroove, row, stepsPerBar } from "../src/music/grooves";
import { PracticeLog, formatDuration, totals, type KeyValueStore } from "../src/music/practiceLog";

describe("grooves", () => {
  it("parses rows", () => {
    expect(row("xX- .x")).toEqual([1, 2, 0, 0, 1]);
  });

  for (const g of PRESET_GROOVES) {
    it(`${g.name} rows match the bar length`, () => {
      const n = stepsPerBar(g);
      for (const piece of KIT_PIECES) {
        const r = g.rows[piece.id];
        if (r) expect(r.length, piece.id).toBe(n);
      }
    });
  }

  it("resizes 8ths to 16ths keeping hits on the same beat positions", () => {
    const rock = PRESET_GROOVES.find((g) => g.id === "rock")!;
    const r = resizeGroove(rock, rock.signature, 4);
    expect(stepsPerBar(r)).toBe(16);
    expect(r.rows.snare).toEqual(row("---- 2--- ---- 2---".replace(/2/g, "X")));
    expect(r.rows.hihat!.filter(Boolean).length).toBe(8);
  });

  it("trims when the bar gets shorter", () => {
    const rock = PRESET_GROOVES.find((g) => g.id === "rock")!;
    const r = resizeGroove(rock, { beats: 3, unit: 4 }, 2);
    expect(r.rows.kick).toEqual(row("x- -- x-"));
  });
});

function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe("practice log", () => {
  it("ignores very short sessions and stores the rest", () => {
    const log = new PracticeLog(memoryStore());
    expect(log.add({ start: 0, seconds: 5, activity: "Metronome" })).toBe(false);
    expect(log.add({ start: 0, seconds: 60, activity: "Metronome" })).toBe(true);
    expect(log.all()).toHaveLength(1);
  });

  it("survives missing or corrupt storage", () => {
    expect(new PracticeLog(null).all()).toEqual([]);
    const bad: KeyValueStore = { getItem: () => "{not json", setItem: () => {} };
    expect(new PracticeLog(bad).all()).toEqual([]);
  });

  it("totals today, week and streak", () => {
    const now = new Date(2026, 10, 26, 18, 0).getTime();
    const day = (d: number, h = 12) => new Date(2026, 10, d, h).getTime();
    const t = totals(
      [
        { start: day(26), seconds: 600, activity: "Rudiments" },
        { start: day(25), seconds: 300, activity: "Metronome" },
        { start: day(24), seconds: 120, activity: "Rudiments" },
        { start: day(10), seconds: 999, activity: "Drum set" },
      ],
      now,
    );
    expect(t.todaySeconds).toBe(600);
    expect(t.weekSeconds).toBe(1020);
    expect(t.streakDays).toBe(3);
    expect(t.byActivity).toEqual({ Rudiments: 720, Metronome: 300 });
  });

  it("keeps a streak alive until the day is over", () => {
    const now = new Date(2026, 10, 26, 9, 0).getTime();
    const t = totals([{ start: new Date(2026, 10, 25, 20).getTime(), seconds: 60, activity: "x" }], now);
    expect(t.streakDays).toBe(1);
  });

  it("formats durations", () => {
    expect(formatDuration(42)).toBe("42s");
    expect(formatDuration(125)).toBe("2m 5s");
    expect(formatDuration(3720)).toBe("1h 2m");
  });
});
