import { audio, holdWakeLock, releaseWakeLock } from "../audio/context";
import { Scheduler, VisualQueue, type StepEvent } from "../audio/scheduler";
import { click, type ClickSound } from "../audio/sounds";
import {
  COMMON_SIGNATURES,
  MAX_BPM,
  MIN_BPM,
  clampBpm,
  defaultAccents,
  formatSignature,
  stepDuration,
  stepPosition,
  tapTempo,
  type BeatLevel,
  type TimeSignature,
} from "../music/timing";
import { SessionTimer, type AppServices, type Screen } from "../ui/app";
import { h, loadPref, savePref, select, slider } from "../ui/dom";

interface MetronomePrefs {
  bpm: number;
  signature: TimeSignature;
  subdivision: number;
  accents: BeatLevel[];
  sound: ClickSound;
  volume: number;
  /** Bars of click, then bars of silence (0 = off) — for testing your internal time. */
  playBars: number;
  muteBars: number;
}

const SUBDIVISIONS = [
  { value: "1", label: "Beats only" },
  { value: "2", label: "8ths (2 per beat)" },
  { value: "3", label: "Triplets (3 per beat)" },
  { value: "4", label: "16ths (4 per beat)" },
  { value: "5", label: "Quintuplets (5)" },
  { value: "6", label: "Sextuplets (6)" },
];

const TEMPO_NAMES: [number, string][] = [
  [40, "Grave"],
  [60, "Largo"],
  [66, "Larghetto"],
  [76, "Adagio"],
  [108, "Andante"],
  [120, "Moderato"],
  [156, "Allegro"],
  [176, "Vivace"],
  [200, "Presto"],
  [Infinity, "Prestissimo"],
];

function tempoName(bpm: number): string {
  return TEMPO_NAMES.find(([max]) => bpm < max)?.[1] ?? "";
}

export function metronomeScreen(services: AppServices): Screen {
  const prefs = loadPref<MetronomePrefs>("metronome", {
    bpm: 100,
    signature: { beats: 4, unit: 4 },
    subdivision: 1,
    accents: defaultAccents({ beats: 4, unit: 4 }),
    sound: "beep",
    volume: 0.8,
    playBars: 0,
    muteBars: 0,
  });
  if (prefs.accents.length !== prefs.signature.beats) prefs.accents = defaultAccents(prefs.signature);
  const save = () => savePref("metronome", prefs);
  const timer = new SessionTimer(services, "Metronome");

  // --- Engine ---
  const visuals = new VisualQueue<StepEvent & { beat: number; sub: number; muted: boolean }>();
  let scheduler: Scheduler | null = null;
  let raf = 0;

  function onStep(e: StepEvent) {
    const { beat, sub, bar } = stepPosition(e.step, prefs.signature.beats, prefs.subdivision);
    const cycle = prefs.playBars + prefs.muteBars;
    const muted = prefs.muteBars > 0 && prefs.playBars > 0 && bar % cycle >= prefs.playBars;
    const level = prefs.accents[beat] ?? "normal";
    if (!muted && level !== "mute") {
      if (sub === 0) click(e.time, level === "accent" ? "accent" : "normal", prefs.sound, prefs.volume);
      else click(e.time, "sub", prefs.sound, prefs.volume);
    }
    visuals.push({ ...e, beat, sub, muted });
  }

  function start() {
    const ctx = audio();
    scheduler = new Scheduler({ clock: ctx, stepDuration: () => stepDuration(prefs.bpm, prefs.subdivision), onStep });
    scheduler.start();
    timer.start();
    void holdWakeLock();
    playBtn.textContent = "Stop";
    playBtn.classList.add("playing");
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const due = visuals.takeDue(ctx.currentTime);
      if (due && due.sub === 0) flash(due.beat, due.muted);
    };
    frame();
  }

  function stop() {
    scheduler?.stop();
    scheduler = null;
    cancelAnimationFrame(raf);
    visuals.clear();
    timer.stop(`${formatSignature(prefs.signature)}`, prefs.bpm);
    releaseWakeLock();
    playBtn.textContent = "Start";
    playBtn.classList.remove("playing");
    beatsEl.querySelectorAll(".beat").forEach((b) => b.classList.remove("on"));
  }

  const toggle = () => (scheduler ? stop() : start());

  // --- Tempo controls ---
  const bpmNum = h("span", { class: "bpm-num" }, String(prefs.bpm));
  const bpmName = h("span", { class: "bpm-name muted" }, tempoName(prefs.bpm));
  const bpmSlider = slider({
    label: "Tempo",
    min: MIN_BPM,
    max: MAX_BPM,
    value: prefs.bpm,
    format: (v) => `${v} BPM`,
    onInput: (v) => setBpm(v, false),
  });
  function setBpm(v: number, moveSlider = true) {
    prefs.bpm = clampBpm(v);
    bpmNum.textContent = String(prefs.bpm);
    bpmName.textContent = tempoName(prefs.bpm);
    if (moveSlider) bpmSlider.set(prefs.bpm);
    save();
  }
  const nudge = (d: number) => h("button", { class: "btn", onclick: () => setBpm(prefs.bpm + d) }, d > 0 ? `+${d}` : String(d));

  const taps: number[] = [];
  const tapBtn = h("button", { class: "btn tap" }, "Tap");
  tapBtn.addEventListener("pointerdown", () => {
    taps.push(performance.now());
    if (taps.length > 12) taps.shift();
    const bpm = tapTempo(taps);
    if (bpm) setBpm(bpm);
  });

  // --- Beats / accents ---
  const beatsEl = h("div", { class: "beats", role: "group", "aria-label": "Beats — tap to cycle accent, normal, mute" });
  function renderBeats() {
    beatsEl.replaceChildren(
      ...prefs.accents.map((lvl, i) => {
        const b = h("button", { class: `beat ${lvl}`, title: "Tap: accent → normal → mute", "aria-label": `Beat ${i + 1}: ${lvl}` }, String(i + 1));
        b.addEventListener("click", () => {
          const next: BeatLevel = lvl === "accent" ? "normal" : lvl === "normal" ? "mute" : "accent";
          prefs.accents[i] = next;
          save();
          renderBeats();
        });
        return b;
      }),
    );
  }
  function flash(beat: number, muted: boolean) {
    beatsEl.querySelectorAll(".beat").forEach((b, i) => {
      b.classList.toggle("on", i === beat);
      b.classList.toggle("ghost", i === beat && muted);
    });
  }

  // --- Time signature ---
  const sigChips = h("div", { class: "chips" });
  const beatsInput = h("input", { type: "number", min: 1, max: 32, value: prefs.signature.beats, "aria-label": "Beats per bar", class: "num" });
  const unitInput = h("select", { "aria-label": "Beat unit", class: "num" });
  for (const u of [2, 4, 8, 16]) unitInput.appendChild(h("option", { value: u, selected: u === prefs.signature.unit }, String(u)));
  function setSignature(sig: TimeSignature) {
    prefs.signature = sig;
    prefs.accents = defaultAccents(sig);
    beatsInput.value = String(sig.beats);
    unitInput.value = String(sig.unit);
    save();
    renderBeats();
    renderSigChips();
  }
  function renderSigChips() {
    sigChips.replaceChildren(
      ...COMMON_SIGNATURES.map((s) =>
        h(
          "button",
          {
            class: `btn chip ${s.beats === prefs.signature.beats && s.unit === prefs.signature.unit ? "active" : ""}`,
            onclick: () => setSignature({ ...s }),
          },
          formatSignature(s),
        ),
      ),
    );
  }
  const customSig = () => {
    const beats = Math.max(1, Math.min(32, Math.round(Number(beatsInput.value) || 4)));
    setSignature({ beats, unit: Number(unitInput.value) as TimeSignature["unit"] });
  };
  beatsInput.addEventListener("change", customSig);
  unitInput.addEventListener("change", customSig);

  const subSel = select({
    label: "Subdivision",
    options: SUBDIVISIONS,
    value: String(prefs.subdivision),
    onChange: (v) => {
      prefs.subdivision = Number(v);
      save();
    },
  });
  const soundSel = select<ClickSound>({
    label: "Sound",
    options: [
      { value: "beep", label: "Beep" },
      { value: "wood", label: "Woodblock" },
      { value: "cowbell", label: "Cowbell" },
    ],
    value: prefs.sound,
    onChange: (v) => {
      prefs.sound = v;
      save();
    },
  });
  const volSlider = slider({
    label: "Volume",
    min: 0,
    max: 100,
    value: Math.round(prefs.volume * 100),
    format: (v) => `${v}%`,
    onInput: (v) => {
      prefs.volume = v / 100;
      save();
    },
  });

  const barNum = (key: "playBars" | "muteBars", label: string) => {
    const input = h("input", { type: "number", min: 0, max: 16, value: prefs[key], class: "num", "aria-label": label });
    input.addEventListener("change", () => {
      prefs[key] = Math.max(0, Math.min(16, Math.round(Number(input.value) || 0)));
      input.value = String(prefs[key]);
      save();
    });
    return input;
  };

  const playBtn = h("button", { class: "btn primary big play" }, "Start");
  playBtn.addEventListener("click", toggle);

  renderBeats();
  renderSigChips();

  const el = h(
    "section",
    { class: "screen metronome" },
    h(
      "div",
      { class: "card tempo-card" },
      h("div", { class: "bpm" }, bpmNum, h("span", { class: "bpm-unit" }, "BPM"), bpmName),
      h("div", { class: "nudges" }, nudge(-5), nudge(-1), tapBtn, nudge(1), nudge(5)),
      bpmSlider.el,
      beatsEl,
    ),
    playBtn,
    h(
      "div",
      { class: "card settings" },
      h("div", { class: "field" }, h("span", { class: "field-label" }, "Time signature"), sigChips, h("div", { class: "custom-sig" }, "Custom:", beatsInput, "/", unitInput)),
      subSel.el,
      soundSel.el,
      volSlider.el,
      h(
        "div",
        { class: "field" },
        h("span", { class: "field-label" }, "Gap click (tests your internal time)"),
        h("div", { class: "custom-sig" }, "Play", barNum("playBars", "Bars with click"), "bars, then mute", barNum("muteBars", "Silent bars"), "bars"),
      ),
      h("p", { class: "muted small" }, "Tip: tap a beat number to cycle accent / normal / mute. Space bar starts and stops."),
    ),
  );

  return {
    el,
    onHide() {
      if (scheduler) stop();
    },
    onShow() {
      bpmSlider.set(prefs.bpm);
    },
    toggle,
  };
}
