import { audio, holdWakeLock, releaseWakeLock } from "../audio/context";
import { Scheduler, VisualQueue, type StepEvent } from "../audio/scheduler";
import { click, drum } from "../audio/sounds";
import { KIT_PIECES, PRESET_GROOVES, emptyGroove, resizeGroove, stepsPerBar, type Groove, type KitPiece, type Velocity } from "../music/grooves";
import { COMMON_SIGNATURES, MAX_BPM, MIN_BPM, clampBpm, formatSignature, stepDuration } from "../music/timing";
import { SessionTimer, type AppServices, type Screen } from "../ui/app";
import { h, loadPref, savePref, select, slider } from "../ui/dom";

interface GroovePrefs {
  groove: Groove;
  click: boolean;
}

const clone = (g: Groove): Groove => JSON.parse(JSON.stringify(g)) as Groove;

export function groovesScreen(services: AppServices): Screen {
  const prefs = loadPref<GroovePrefs>("grooves", { groove: clone(PRESET_GROOVES[0]!), click: false });
  const save = () => savePref("grooves", prefs);
  const timer = new SessionTimer(services, "Drum set");
  let g = prefs.groove;

  // --- Engine ---
  let scheduler: Scheduler | null = null;
  let raf = 0;
  const visuals = new VisualQueue<StepEvent & { index: number }>();

  function onStep(e: StepEvent) {
    const index = e.step % stepsPerBar(g);
    for (const piece of KIT_PIECES) {
      const v = g.rows[piece.id]?.[index] ?? 0;
      if (v) drum(piece.id, e.time, v === 2 ? 1 : 0.6);
    }
    if (prefs.click && index % g.subdivision === 0) click(e.time, index === 0 ? "accent" : "normal", "beep", 0.5);
    visuals.push({ ...e, index });
  }

  function start() {
    const ctx = audio();
    scheduler = new Scheduler({ clock: ctx, stepDuration: () => stepDuration(g.bpm, g.subdivision), onStep });
    scheduler.start();
    timer.start();
    void holdWakeLock();
    playBtn.textContent = "Stop";
    playBtn.classList.add("playing");
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const due = visuals.takeDue(ctx.currentTime);
      if (due) highlight(due.index);
    };
    frame();
  }

  function stop() {
    scheduler?.stop();
    scheduler = null;
    cancelAnimationFrame(raf);
    visuals.clear();
    highlight(-1);
    timer.stop(g.name, g.bpm);
    releaseWakeLock();
    playBtn.textContent = "Start";
    playBtn.classList.remove("playing");
  }
  const toggle = () => (scheduler ? stop() : start());

  // --- Grid ---
  const grid = h("div", { class: "grid", role: "grid", "aria-label": "Groove grid" });

  function renderGrid() {
    const n = stepsPerBar(g);
    grid.style.setProperty("--steps", String(n));
    grid.style.setProperty("--sub", String(g.subdivision));
    grid.replaceChildren();
    // Header row with beat numbers
    grid.appendChild(h("span", { class: "grid-label" }));
    for (let i = 0; i < n; i++) {
      const onBeat = i % g.subdivision === 0;
      grid.appendChild(h("span", { class: `grid-head ${onBeat ? "on-beat" : ""}`, "data-i": i }, onBeat ? String(i / g.subdivision + 1) : subLabel(i % g.subdivision, g.subdivision)));
    }
    for (const piece of KIT_PIECES) {
      grid.appendChild(
        h(
          "button",
          { class: "grid-label", title: `Preview ${piece.label}`, onclick: () => drum(piece.id, audio().currentTime + 0.01) },
          piece.label,
        ),
      );
      for (let i = 0; i < n; i++) {
        const v = g.rows[piece.id]?.[i] ?? 0;
        const cell = h("button", {
          class: `cell v${v} ${i % g.subdivision === 0 ? "beat-start" : ""}`,
          "data-i": i,
          role: "gridcell",
          "aria-label": `${piece.label} step ${i + 1}: ${v === 2 ? "accent" : v ? "on" : "off"}`,
        });
        cell.addEventListener("click", () => cycleCell(piece.id, i, cell));
        grid.appendChild(cell);
      }
    }
  }

  function cycleCell(piece: KitPiece, i: number, cell: HTMLElement) {
    const n = stepsPerBar(g);
    const rowData = (g.rows[piece] ??= Array.from({ length: n }, () => 0 as Velocity));
    const next = (((rowData[i] ?? 0) + 1) % 3) as Velocity;
    rowData[i] = next;
    cell.className = cell.className.replace(/\bv[0-2]\b/, `v${next}`);
    cell.setAttribute("aria-label", cell.getAttribute("aria-label")!.replace(/: \w+$/, `: ${next === 2 ? "accent" : next ? "on" : "off"}`));
    if (next && !scheduler) drum(piece, audio().currentTime + 0.01, next === 2 ? 1 : 0.6);
    markCustom();
    save();
  }

  function highlight(i: number) {
    grid.querySelectorAll<HTMLElement>("[data-i]").forEach((el) => el.classList.toggle("now", Number(el.dataset.i) === i));
  }

  function markCustom() {
    if (!g.name.endsWith("(edited)") && g.id !== "custom") g.name = `${g.name} (edited)`;
    presetSel.input.value = "";
  }

  // --- Controls ---
  const presetSel = select({
    label: "Groove",
    options: [{ value: "", label: "— choose a preset —" }, ...PRESET_GROOVES.map((p) => ({ value: p.id, label: p.name })), { value: "custom", label: "Blank grid" }],
    value: PRESET_GROOVES.some((p) => p.id === g.id && p.name === g.name) ? g.id : "",
    onChange: (id) => {
      if (!id) return;
      const preset = id === "custom" ? emptyGroove(g.signature, g.subdivision) : PRESET_GROOVES.find((p) => p.id === id);
      if (!preset) return;
      g = prefs.groove = clone(preset);
      bpmSlider.set(g.bpm);
      syncControls();
      renderGrid();
      save();
    },
  });

  const bpmSlider = slider({
    label: "Tempo",
    min: MIN_BPM,
    max: MAX_BPM,
    value: g.bpm,
    format: (v) => `${v} BPM`,
    onInput: (v) => {
      g.bpm = clampBpm(v);
      save();
    },
  });

  const sigSel = select({
    label: "Time signature",
    options: COMMON_SIGNATURES.map((s) => ({ value: formatSignature(s), label: formatSignature(s) })),
    value: formatSignature(g.signature),
    onChange: (v) => {
      const sig = COMMON_SIGNATURES.find((s) => formatSignature(s) === v);
      if (sig) applyShape({ ...sig }, g.subdivision);
    },
  });
  const subSel = select({
    label: "Grid",
    options: [
      { value: "1", label: "Beats" },
      { value: "2", label: "8ths" },
      { value: "3", label: "Triplets" },
      { value: "4", label: "16ths" },
    ],
    value: String(g.subdivision),
    onChange: (v) => applyShape(g.signature, Number(v)),
  });

  function applyShape(signature: Groove["signature"], subdivision: number) {
    g = prefs.groove = resizeGroove(g, signature, subdivision);
    markCustom();
    renderGrid();
    save();
  }

  function syncControls() {
    sigSel.input.value = formatSignature(g.signature);
    subSel.input.value = String(g.subdivision);
  }

  const clickInput = h("input", { type: "checkbox", checked: prefs.click });
  clickInput.addEventListener("change", () => {
    prefs.click = clickInput.checked;
    save();
  });

  const clearBtn = h("button", { class: "btn small" }, "Clear grid");
  clearBtn.addEventListener("click", () => {
    g.rows = {};
    markCustom();
    renderGrid();
    save();
  });

  const playBtn = h("button", { class: "btn primary big play" }, "Start");
  playBtn.addEventListener("click", toggle);

  renderGrid();

  const el = h(
    "section",
    { class: "screen grooves" },
    h("div", { class: "card" }, presetSel.el),
    h("div", { class: "card grid-card" }, h("div", { class: "grid-scroll" }, grid), h("p", { class: "muted small" }, "Tap a cell: off → hit → accent. Tap an instrument name to hear it.")),
    playBtn,
    h(
      "div",
      { class: "card settings" },
      bpmSlider.el,
      h("div", { class: "row2" }, sigSel.el, subSel.el),
      h("div", { class: "checks" }, h("label", { class: "check" }, clickInput, "Click on beats"), clearBtn),
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

function subLabel(sub: number, of: number): string {
  if (of === 2) return "&";
  if (of === 3) return sub === 1 ? "&" : "a";
  if (of === 4) return ["", "e", "&", "a"][sub] ?? "";
  return "·";
}
