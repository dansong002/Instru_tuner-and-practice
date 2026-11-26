import { describe, expect, it } from "vitest";
import { Scheduler, VisualQueue, type StepEvent, type Ticker } from "../src/audio/scheduler";

function setup(stepDuration: () => number) {
  const clock = { currentTime: 10 };
  const events: StepEvent[] = [];
  const ticker: Ticker = { start() {}, stop() {} };
  const s = new Scheduler({ clock, stepDuration, onStep: (e) => events.push(e), ticker, lookahead: 0.1, startDelay: 0.05 });
  return { clock, events, s };
}

describe("Scheduler", () => {
  it("schedules steps within the look-ahead window at exact times", () => {
    const { clock, events, s } = setup(() => 0.25);
    s.start();
    expect(events.map((e) => e.time)).toEqual([10.05]);
    // Advance the audio clock in jittery chunks; steps must stay on the grid.
    for (const t of [10.13, 10.31, 10.32, 10.71, 11.0]) {
      clock.currentTime = t;
      s.pump();
    }
    expect(events.map((e) => e.step)).toEqual([0, 1, 2, 3, 4]);
    events.forEach((e, i) => expect(e.time).toBeCloseTo(10.05 + i * 0.25, 9));
  });

  it("applies tempo changes from the next step without jumping", () => {
    let d = 0.5;
    const { clock, events, s } = setup(() => d);
    s.start(); // step 0 at 10.05
    d = 0.25;
    clock.currentTime = 10.5;
    s.pump(); // step 1 at 10.55
    clock.currentTime = 10.75;
    s.pump(); // step 2 at 10.80
    expect(events.map((e) => +e.time.toFixed(3))).toEqual([10.05, 10.55, 10.8]);
  });

  it("skips ahead instead of bursting after a long stall", () => {
    const { clock, events, s } = setup(() => 0.1);
    s.start();
    clock.currentTime = 20;
    s.pump();
    // Only a window's worth of steps, none in the past.
    expect(events.length).toBeLessThan(5);
    expect(events.slice(1).every((e) => e.time >= 19.75)).toBe(true);
  });

  it("does nothing once stopped", () => {
    const { clock, events, s } = setup(() => 0.1);
    s.start();
    s.stop();
    clock.currentTime = 12;
    s.pump();
    expect(events.length).toBe(1);
  });
});

describe("VisualQueue", () => {
  it("returns the latest due item", () => {
    const q = new VisualQueue<{ time: number; id: number }>();
    [1, 2, 3].forEach((t) => q.push({ time: t, id: t }));
    expect(q.takeDue(0.5)).toBeUndefined();
    expect(q.takeDue(2.5)?.id).toBe(2);
    expect(q.takeDue(3)?.id).toBe(3);
    expect(q.takeDue(4)).toBeUndefined();
  });
});
