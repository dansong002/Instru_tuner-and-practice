import { audio, holdWakeLock, releaseWakeLock } from "../audio/context";
import { Scheduler, VisualQueue, type StepEvent } from "../audio/scheduler";
import { click, padStroke } from "../audio/sounds";
import { RUDIMENTS, findRudiment, parsePattern, stepLabel, type Rudiment, type Step } from "../music/rudiments";
import { MAX_BPM, MIN_BPM, clampBpm, stepDuration, trainerBpm } from "../music/timing";
import { SessionTimer, type AppServices, type Screen } from "../ui/app";
import { h, loadPref, savePref, slider } from "../ui/dom";

interface RudimentPrefs {
  id: string;
  bpm: number;
  click: boolean;
  pad: boolean;
  countIn: boolean;
  trainer: boolean;
  trainerTarget: number;
  trainerStep: number;
  trainerEvery: number;
}

const FLAM_GAP = 0.03;
const DRAG_GAP = 0.028;

export function rudimentsScreen(services: AppServices): Screen {
  const prefs = loadPref<RudimentPrefs>("rudiments", {
    id: "single-stroke-roll",
    bpm: 70,
    click: true,
    pad: true,
    countIn: true,
    trainer: false,
    trainerTarget: 120,
    trainerStep: 4,
    trainerEvery: 4,
  });
  const save = () => savePref("rudiments", prefs);
  const timer = new SessionTimer(services, "Rudiments");

  let rudiment: Rudiment = findRudiment(prefs.id) ?? RUDIMENTS[0]!;
  let steps: Step[] = parsePattern(rudiment.pattern);

  // --- Engine ---
  let scheduler: Scheduler | null = null;
  let raf = 0;
  let liveBpm = prefs.bpm;
  let cycles = 0;
  let countInSteps = 0;
  const visuals = new VisualQueue<StepEvent & { index: number; counting: number }>();

  function onStep(e: StepEvent) {
    const sub = rudiment.subdivision;
    if (e.step < countInSteps) {
      // Count-in: one bar of 4 beats, clicks only.
      if (e.step % sub === 0) click(e.time, e.step === 0 ? "accent" : "normal", "wood");
      visuals.push({ ...e, index: -1, counting: Math.floor(e.step / sub) + 1 });
      return;
    }
    const n = e.step - countInSteps;
    const index = n % steps.length;
    if (index === 0 && n > 0) {
      cycles++;
      if (prefs.trainer) liveBpm = trainerBpm(prefs.bpm, prefs.trainerTarget, prefs.trainerStep, prefs.trainerEvery, cycles);
    }
    if (prefs.click && n % sub === 0) click(e.time, index === 0 ? "accent" : "normal", "wood", 0.7);
    const s = steps[index];
    if (s && prefs.pad) {
      const v = s.accent ? 1 : 0.45;
      const other = s.hand === "R" ? "L" : "R";
      if (s.grace === "flam") padStroke(e.time - FLAM_GAP, other, 0.22);
      if (s.grace === "drag") {
        padStroke(e.time - 2 * DRAG_GAP, other, 0.2);
        padStroke(e.time - DRAG_GAP, other, 0.2);
      }
      padStroke(e.time, s.hand, v);
    }
    visuals.push({ ...e, index, counting: 0 });
  }

  function start() {
    const ctx = audio();
    liveBpm = prefs.bpm;
    cycles = 0;
    countInSteps = prefs.countIn ? 4 * rudiment.subdivision : 0;
    scheduler = new Scheduler({ clock: ctx, stepDuration: () => stepDuration(liveBpm, rudiment.subdivision), onStep, startDelay: 0.12 });
    scheduler.start();
    timer.start();
    void holdWakeLock();
    playBtn.textContent = "Stop";
    playBtn.classList.add("playing");
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const due = visuals.takeDue(ctx.currentTime);
      if (!due) return;
      highlight(due.index);
      liveEl.textContent = due.counting ? `Count-in ${due.counting}…` : `${Math.round(liveBpm)} BPM · cycle ${cycles + 1}`;
    };
    frame();
  }

  function stop() {
    scheduler?.stop();
    scheduler = null;
    cancelAnimationFrame(raf);
    visuals.clear();
    highlight(-1);
    timer.stop(rudiment.name, Math.round(liveBpm));
    releaseWakeLock();
    liveEl.textContent = prefs.trainer && cycles > 0 ? `Reached ${Math.round(liveBpm)} BPM` : " ";
    playBtn.textContent = "Start";
    playBtn.classList.remove("playing");
  }

  // --- UI ---
  const titleEl = h("h2", { class: "rudiment-title" });
  const familyEl = h("span", { class: "badge" });
  const tipEl = h("p", { class: "muted small" });
  const stickingEl = h("div", { class: "sticking", "aria-label": "Sticking pattern" });
  const liveEl = h("div", { class: "live muted" }, " ");

  function renderRudiment() {
    steps = parsePattern(rudiment.pattern);
    titleEl.textContent = rudiment.name;
    familyEl.textContent = rudiment.family;
    tipEl.textContent = rudiment.tip ?? "";
    tipEl.hidden = !rudiment.tip;
    const sub = rudiment.subdivision;
    stickingEl.style.setProperty("--per-beat", String(sub));
    stickingEl.replaceChildren(
      ...steps.map((s, i) =>
        h(
          "span",
          {
            class: `stroke ${s ? (s.hand === "R" ? "right" : "left") : "rest"} ${s?.accent ? "accent" : ""} ${i % sub === 0 ? "beat-start" : ""}`,
            "data-i": i,
          },
          s?.accent ? h("span", { class: "accent-mark", "aria-label": "accent" }, ">") : null,
          ...strokeContent(s),
        ),
      ),
    );
  }

  function highlight(i: number) {
    stickingEl.querySelectorAll(".stroke").forEach((el, j) => el.classList.toggle("on", j === i));
  }

  const groups = new Map<string, Rudiment[]>();
  for (const r of RUDIMENTS) groups.set(r.family, [...(groups.get(r.family) ?? []), r]);
  const rudimentSel = h("select", { "aria-label": "Rudiment" });
  for (const [family, list] of groups) {
    const og = h("optgroup", { label: family });
    list.forEach((r) => og.appendChild(h("option", { value: r.id, selected: r.id === rudiment.id }, r.name)));
    rudimentSel.appendChild(og);
  }
  rudimentSel.addEventListener("change", () => {
    const wasPlaying = !!scheduler;
    if (wasPlaying) stop();
    rudiment = findRudiment(rudimentSel.value) ?? rudiment;
    prefs.id = rudiment.id;
    save();
    renderRudiment();
    if (wasPlaying) start();
  });

  const bpmSlider = slider({
    label: "Tempo (quarter note)",
    min: MIN_BPM,
    max: Math.min(MAX_BPM, 240),
    value: prefs.bpm,
    format: (v) => `${v} BPM`,
    onInput: (v) => {
      prefs.bpm = clampBpm(v);
      if (!prefs.trainer || !scheduler) liveBpm = prefs.bpm;
      save();
    },
  });

  const check = (key: "click" | "pad" | "countIn" | "trainer", label: string, after?: () => void) => {
    const input = h("input", { type: "checkbox", checked: prefs[key] });
    input.addEventListener("change", () => {
      prefs[key] = input.checked;
      save();
      after?.();
    });
    return h("label", { class: "check" }, input, label);
  };

  const num = (key: "trainerTarget" | "trainerStep" | "trainerEvery", label: string, min: number, max: number) => {
    const input = h("input", { type: "number", min, max, value: prefs[key], class: "num", "aria-label": label });
    input.addEventListener("change", () => {
      prefs[key] = Math.max(min, Math.min(max, Math.round(Number(input.value) || min)));
      input.value = String(prefs[key]);
      save();
    });
    return input;
  };

  const trainerBox = h(
    "div",
    { class: "custom-sig trainer-opts" },
    "Up to",
    num("trainerTarget", "Target BPM", MIN_BPM, 300),
    "BPM, +",
    num("trainerStep", "BPM increase", 1, 20),
    "every",
    num("trainerEvery", "Cycles per increase", 1, 32),
    "cycles",
  );
  const syncTrainer = () => (trainerBox.hidden = !prefs.trainer);
  syncTrainer();

  const playBtn = h("button", { class: "btn primary big play" }, "Start");
  const toggle = () => (scheduler ? stop() : start());
  playBtn.addEventListener("click", toggle);

  renderRudiment();

  const el = h(
    "section",
    { class: "screen rudiments" },
    h("div", { class: "card" }, h("label", { class: "field" }, h("span", { class: "field-label" }, "Rudiment"), rudimentSel)),
    h("div", { class: "card" }, h("div", { class: "rudiment-head" }, titleEl, familyEl), stickingEl, h("div", { class: "legend muted small" }, h("span", { class: "key right" }, "R"), "right ", h("span", { class: "key left" }, "L"), "left · small letters = grace notes · > = accent"), tipEl, liveEl),
    playBtn,
    h(
      "div",
      { class: "card settings" },
      bpmSlider.el,
      h("div", { class: "checks" }, check("click", "Click"), check("pad", "Play the sticking"), check("countIn", "Count-in bar")),
      h("div", { class: "field" }, check("trainer", "Speed trainer", syncTrainer), trainerBox),
      h("p", { class: "muted small" }, "Turn off “Play the sticking” to practise along with just the click."),
    ),
  );

  return {
    el,
    onHide() {
      if (scheduler) stop();
    },
    toggle,
  };
}

/** Grace notes render small and raised before the main stroke, like printed sticking. */
function strokeContent(s: Step): (HTMLElement | string)[] {
  const label = stepLabel(s);
  if (!s?.grace) return [label];
  const graceLen = s.grace === "drag" ? 2 : 1;
  return [h("span", { class: "grace", "aria-label": "grace note" }, label.slice(0, graceLen)), label.slice(graceLen)];
}
