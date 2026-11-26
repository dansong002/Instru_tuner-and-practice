import { PitchDetector } from "pitchy";
import { audio } from "../audio/context";
import { referenceTone } from "../audio/sounds";
import { TUNINGS, median, midiToFrequency, midiToName, nearestString, readNote } from "../music/notes";
import type { Screen } from "../ui/app";
import { h, loadPref, savePref, select } from "../ui/dom";

const IN_TUNE_CENTS = 5;
const MIN_CLARITY = 0.9;
const MIN_FREQ = 30;
const MAX_FREQ = 4200;

interface TunerPrefs {
  a4: number;
  tuning: string;
}

export function tunerScreen(): Screen {
  const prefs = loadPref<TunerPrefs>("tuner", { a4: 440, tuning: "chromatic" });

  const noteEl = h("div", { class: "tuner-note" }, "–");
  const octaveEl = h("span", { class: "tuner-octave" });
  const centsEl = h("div", { class: "tuner-cents" }, "Tap Start and play a note");
  const freqEl = h("div", { class: "tuner-freq muted" }, " ");
  const needle = svgNeedle();
  const status = h("p", { class: "muted small", role: "status" });
  const startBtn = h("button", { class: "btn primary big" }, "Start tuner");
  const stringsEl = h("div", { class: "string-row" });

  const a4Out = h("output", { class: "a4-value" }, `${prefs.a4} Hz`);
  const a4Down = h("button", { class: "btn small", "aria-label": "Lower A4 reference" }, "−");
  const a4Up = h("button", { class: "btn small", "aria-label": "Raise A4 reference" }, "+");
  const a4Presets = [432, 440, 442].map((f) => h("button", { class: "btn small chip", "data-a4": f }, String(f)));

  const tuningSel = select({
    label: "Instrument",
    options: TUNINGS.map((t) => ({ value: t.id, label: t.label })),
    value: prefs.tuning,
    onChange: (v) => {
      prefs.tuning = v;
      savePref("tuner", prefs);
      renderStrings();
    },
  });

  function setA4(v: number) {
    prefs.a4 = Math.min(466, Math.max(415, Math.round(v)));
    a4Out.textContent = `${prefs.a4} Hz`;
    a4Presets.forEach((b) => b.classList.toggle("active", Number(b.dataset.a4) === prefs.a4));
    savePref("tuner", prefs);
    renderStrings();
  }
  a4Down.addEventListener("click", () => setA4(prefs.a4 - 1));
  a4Up.addEventListener("click", () => setA4(prefs.a4 + 1));
  a4Presets.forEach((b) => b.addEventListener("click", () => setA4(Number(b.dataset.a4))));

  // Reference tones: hold a string button to hear its target pitch.
  let stopTone: (() => void) | null = null;
  function renderStrings() {
    stringsEl.replaceChildren();
    const tuning = TUNINGS.find((t) => t.id === prefs.tuning) ?? TUNINGS[0]!;
    for (const midi of tuning.strings) {
      const { name, octave } = midiToName(midi);
      const b = h("button", { class: "string-btn", "data-midi": midi, title: "Hold to hear the reference pitch" }, name, h("sub", {}, String(octave)));
      const play = (e: Event) => {
        e.preventDefault();
        stopTone?.();
        stopTone = referenceTone(midiToFrequency(midi, prefs.a4));
      };
      const stop = () => {
        stopTone?.();
        stopTone = null;
      };
      b.addEventListener("pointerdown", play);
      b.addEventListener("pointerup", stop);
      b.addEventListener("pointerleave", stop);
      b.addEventListener("pointercancel", stop);
      stringsEl.appendChild(b);
    }
    stringsEl.hidden = tuning.strings.length === 0;
  }

  // --- Microphone + pitch detection ---
  let stream: MediaStream | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let detector: PitchDetector<Float32Array<ArrayBuffer>> | null = null;
  let buf: Float32Array<ArrayBuffer> | null = null;
  let raf = 0;
  const recent: number[] = [];
  let lastHeard = 0;

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent = "This browser can't use the microphone. Try a current Chrome, Safari, Edge or Firefox over HTTPS.";
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (err) {
      status.textContent =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow it in your browser's site settings, then try again."
          : "Couldn't open the microphone.";
      return;
    }
    const ctx = audio();
    source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 4096; // long enough window for low bass strings
    source.connect(analyser);
    detector = PitchDetector.forFloat32Array(analyser.fftSize);
    detector.minVolumeDecibels = -45;
    buf = new Float32Array(analyser.fftSize);
    status.textContent = "";
    startBtn.textContent = "Stop tuner";
    startBtn.classList.remove("primary");
    loop();
  }

  function stop() {
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    source?.disconnect();
    stream = null;
    source = null;
    analyser = null;
    startBtn.textContent = "Start tuner";
    startBtn.classList.add("primary");
    showIdle("Tap Start and play a note");
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!analyser || !detector || !buf) return;
    analyser.getFloatTimeDomainData(buf);
    const [pitch, clarity] = detector.findPitch(buf, analyser.context.sampleRate);
    const now = performance.now();
    if (clarity >= MIN_CLARITY && pitch >= MIN_FREQ && pitch <= MAX_FREQ) {
      // Restart smoothing if the pitch jumped by more than ~a semitone (a new note).
      const prev = recent.at(-1);
      if (prev && Math.abs(1200 * Math.log2(pitch / prev)) > 80) recent.length = 0;
      recent.push(pitch);
      if (recent.length > 7) recent.shift();
      lastHeard = now;
      show(median(recent));
    } else if (now - lastHeard > 1200) {
      recent.length = 0;
      showIdle("Listening…");
    }
  }

  function show(freq: number) {
    const tuning = TUNINGS.find((t) => t.id === prefs.tuning) ?? TUNINGS[0]!;
    let midi: number;
    let cents: number;
    const target = tuning.strings.length ? nearestString(freq, tuning.strings, prefs.a4) : null;
    if (target) {
      ({ midi, cents } = target);
    } else {
      const r = readNote(freq, prefs.a4)!;
      ({ midi, cents } = r);
    }
    const { name, octave } = midiToName(midi);
    noteEl.textContent = name;
    noteEl.appendChild(octaveEl);
    octaveEl.textContent = String(octave);
    const inTune = Math.abs(cents) <= IN_TUNE_CENTS;
    const shown = Math.max(-50, Math.min(50, cents));
    needle.set(shown, inTune);
    const c = Math.round(cents);
    centsEl.textContent = inTune ? "In tune" : c > 0 ? `${c}¢ sharp — tune down` : `${-c}¢ flat — tune up`;
    centsEl.className = `tuner-cents ${inTune ? "good" : Math.abs(cents) < 20 ? "close" : "off"}`;
    freqEl.textContent = `${freq.toFixed(1)} Hz → ${midiToFrequency(midi, prefs.a4).toFixed(1)} Hz`;
    stringsEl.querySelectorAll<HTMLElement>(".string-btn").forEach((b) => b.classList.toggle("active", Number(b.dataset.midi) === midi));
  }

  function showIdle(msg: string) {
    noteEl.textContent = "–";
    centsEl.textContent = msg;
    centsEl.className = "tuner-cents";
    freqEl.textContent = " ";
    needle.set(0, false, true);
    stringsEl.querySelectorAll(".string-btn.active").forEach((b) => b.classList.remove("active"));
  }

  startBtn.addEventListener("click", () => (stream ? stop() : void start()));
  setA4(prefs.a4);

  const el = h(
    "section",
    { class: "screen tuner" },
    h("div", { class: "card tuner-display" }, noteEl, needle.el, centsEl, freqEl),
    stringsEl,
    startBtn,
    status,
    h(
      "div",
      { class: "card settings" },
      tuningSel.el,
      h("div", { class: "field" }, h("span", { class: "field-label" }, "Reference A4"), h("div", { class: "a4-row" }, a4Down, a4Out, a4Up, ...a4Presets)),
    ),
  );

  return {
    el,
    onHide() {
      if (stream) stop();
      stopTone?.();
    },
  };
}

function svgNeedle(): { el: SVGSVGElement; set(cents: number, inTune: boolean, idle?: boolean): void } {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "-110 -105 220 120");
  svg.setAttribute("class", "needle");
  svg.setAttribute("aria-hidden", "true");
  const angle = (c: number) => (c / 50) * 60; // ±50 cents → ±60°
  const pt = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  };
  // In-tune zone arc
  const zone = document.createElementNS(NS, "path");
  zone.setAttribute("d", `M ${pt(angle(-IN_TUNE_CENTS), 92)} A 92 92 0 0 1 ${pt(angle(IN_TUNE_CENTS), 92)}`);
  zone.setAttribute("class", "needle-zone");
  svg.appendChild(zone);
  // Ticks every 10 cents
  for (let c = -50; c <= 50; c += 10) {
    const t = document.createElementNS(NS, "path");
    t.setAttribute("d", `M ${pt(angle(c), c === 0 ? 76 : 82)} L ${pt(angle(c), 98)}`);
    t.setAttribute("class", c === 0 ? "tick major" : "tick");
    svg.appendChild(t);
  }
  const labels: [number, string][] = [
    [-50, "♭"],
    [50, "♯"],
  ];
  for (const [c, s] of labels) {
    const t = document.createElementNS(NS, "text");
    const [x, y] = pt(angle(c), 70).split(" ");
    t.setAttribute("x", x!);
    t.setAttribute("y", y!);
    t.setAttribute("class", "tick-label");
    t.textContent = s;
    svg.appendChild(t);
  }
  const hand = document.createElementNS(NS, "line");
  hand.setAttribute("x1", "0");
  hand.setAttribute("y1", "0");
  hand.setAttribute("x2", "0");
  hand.setAttribute("y2", "-90");
  hand.setAttribute("class", "needle-hand");
  svg.appendChild(hand);
  const hub = document.createElementNS(NS, "circle");
  hub.setAttribute("r", "5");
  hub.setAttribute("class", "needle-hub");
  svg.appendChild(hub);
  return {
    el: svg,
    set(cents, inTune, idle = false) {
      hand.style.transform = `rotate(${angle(cents)}deg)`;
      svg.classList.toggle("in-tune", inTune);
      svg.classList.toggle("idle", idle);
    },
  };
}
