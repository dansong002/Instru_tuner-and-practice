/**
 * Synthesized sounds — no sample files, so the app is tiny and works offline.
 * Every function schedules at an exact audio-clock `time`.
 */

import type { KitPiece } from "../music/grooves";
import { audio, output } from "./context";

let noise: AudioBuffer | null = null;

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise;
  const len = Math.floor(ctx.sampleRate * 1.5);
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

function envelope(ctx: AudioContext, time: number, peak: number, decay: number, attack = 0.001): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  return g;
}

function panner(ctx: AudioContext, pan: number): AudioNode {
  if (!pan || typeof ctx.createStereoPanner !== "function") return output();
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  p.connect(output());
  return p;
}

function noiseBurst(time: number, opts: { type: BiquadFilterType; freq: number; q?: number; peak: number; decay: number; pan?: number }): void {
  const ctx = audio();
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = opts.type;
  filter.frequency.value = opts.freq;
  if (opts.q) filter.Q.value = opts.q;
  const env = envelope(ctx, time, opts.peak, opts.decay);
  src.connect(filter).connect(env).connect(panner(ctx, opts.pan ?? 0));
  src.start(time, Math.random() * 0.5);
  src.stop(time + opts.decay + 0.05);
}

function tone(time: number, opts: { type: OscillatorType; from: number; to?: number; sweep?: number; peak: number; decay: number; pan?: number }): void {
  const ctx = audio();
  const osc = ctx.createOscillator();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.from, time);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, time + (opts.sweep ?? opts.decay));
  const env = envelope(ctx, time, opts.peak, opts.decay);
  osc.connect(env).connect(panner(ctx, opts.pan ?? 0));
  osc.start(time);
  osc.stop(time + opts.decay + 0.05);
}

export type ClickLevel = "accent" | "normal" | "sub";

export type ClickSound = "beep" | "wood" | "cowbell";

/** Metronome click. */
export function click(time: number, level: ClickLevel, sound: ClickSound = "beep", volume = 1): void {
  const peak = (level === "accent" ? 0.9 : level === "normal" ? 0.6 : 0.3) * volume;
  if (sound === "wood") {
    const f = level === "accent" ? 1900 : level === "normal" ? 1300 : 1000;
    noiseBurst(time, { type: "bandpass", freq: f, q: 12, peak: peak * 2.2, decay: 0.035 });
    tone(time, { type: "sine", from: f, peak: peak * 0.5, decay: 0.03 });
  } else if (sound === "cowbell") {
    const f = level === "accent" ? 800 : level === "normal" ? 560 : 480;
    tone(time, { type: "square", from: f, peak: peak * 0.25, decay: 0.12 });
    tone(time, { type: "square", from: f * 1.48, peak: peak * 0.18, decay: 0.1 });
  } else {
    const f = level === "accent" ? 1760 : level === "normal" ? 1320 : 990;
    tone(time, { type: "sine", from: f, peak, decay: level === "sub" ? 0.03 : 0.05 });
  }
}

/** A snare-pad stroke for rudiments. Right hand pans right, left hand pans left. */
export function padStroke(time: number, hand: "R" | "L", velocity: number): void {
  const pan = hand === "R" ? 0.35 : -0.35;
  noiseBurst(time, { type: "highpass", freq: 1800, peak: 0.55 * velocity, decay: 0.09 + 0.05 * velocity, pan });
  tone(time, { type: "triangle", from: hand === "R" ? 240 : 225, to: 160, sweep: 0.05, peak: 0.45 * velocity, decay: 0.07, pan });
}

/** Drum-kit voices. `velocity` is 0..1. */
export function drum(piece: KitPiece, time: number, velocity = 1): void {
  const v = velocity;
  switch (piece) {
    case "kick":
      tone(time, { type: "sine", from: 140, to: 42, sweep: 0.12, peak: 1.0 * v, decay: 0.42 });
      noiseBurst(time, { type: "lowpass", freq: 900, peak: 0.25 * v, decay: 0.015 });
      break;
    case "snare":
      noiseBurst(time, { type: "highpass", freq: 1200, peak: 0.7 * v, decay: 0.2 });
      tone(time, { type: "triangle", from: 200, to: 150, sweep: 0.06, peak: 0.5 * v, decay: 0.1 });
      break;
    case "hihat":
      noiseBurst(time, { type: "highpass", freq: 7500, peak: 0.35 * v, decay: 0.045, pan: 0.25 });
      break;
    case "openhat":
      noiseBurst(time, { type: "highpass", freq: 7000, peak: 0.32 * v, decay: 0.35, pan: 0.25 });
      break;
    case "pedalhat":
      noiseBurst(time, { type: "bandpass", freq: 6000, q: 1.2, peak: 0.25 * v, decay: 0.03, pan: 0.25 });
      break;
    case "ride":
      noiseBurst(time, { type: "bandpass", freq: 9000, q: 0.8, peak: 0.16 * v, decay: 0.5, pan: -0.3 });
      tone(time, { type: "square", from: 620, peak: 0.035 * v, decay: 0.35, pan: -0.3 });
      tone(time, { type: "square", from: 917, peak: 0.03 * v, decay: 0.3, pan: -0.3 });
      break;
    case "crash":
      noiseBurst(time, { type: "highpass", freq: 4000, peak: 0.4 * v, decay: 1.2, pan: 0.4 });
      break;
    case "hightom":
      tone(time, { type: "sine", from: 260, to: 190, sweep: 0.2, peak: 0.75 * v, decay: 0.3, pan: 0.2 });
      break;
    case "midtom":
      tone(time, { type: "sine", from: 190, to: 140, sweep: 0.22, peak: 0.75 * v, decay: 0.34 });
      break;
    case "floortom":
      tone(time, { type: "sine", from: 130, to: 90, sweep: 0.25, peak: 0.8 * v, decay: 0.42, pan: -0.25 });
      break;
  }
}

/** Steady reference tone for tuning by ear. Returns a stop function. */
export function referenceTone(frequency: number): () => void {
  const ctx = audio();
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = frequency;
  const g = ctx.createGain();
  const now = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.25, now + 0.05);
  osc.connect(g).connect(output());
  osc.start();
  return () => {
    const t = ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.stop(t + 0.1);
  };
}
