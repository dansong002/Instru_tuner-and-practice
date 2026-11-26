# Practice Room

A free, installable web app for daily music practice:

- **Tuner** — chromatic or per-instrument (guitar, drop D, bass, ukulele, violin), adjustable A4 reference (415–466 Hz, quick 432/440/442), hold a string button to hear its reference pitch.
- **Metronome** — 20–320 BPM, tap tempo, any time signature (common ones one tap away, plus custom like 7/8 or 11/16), subdivisions up to sextuplets, per-beat accent/normal/mute, three click sounds, and a *gap click* that mutes bars to test your internal time.
- **Rudiments** — 18 core rudiments (rolls, diddles, flams, drags) shown as colour-coded sticking with accents and grace notes. Plays them back panned left/right, with click, count-in, and a speed trainer that raises the tempo every N cycles.
- **Drum set** — a step-sequencer grid for 10 kit pieces with presets (rock, 16th hats, half-time, disco, shuffle, waltz, 6/8, jazz ride), any signature, 8th/triplet/16th grids, and accents.
- **Log** — practice time is logged automatically (today, last 7 days, streak, per-activity breakdown). Stored only in your browser.

All sounds are synthesized with the Web Audio API — no sample files — so the app is ~20 kB gzipped and works offline once installed.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # production build in dist/
npm run preview    # serve the build
```

The tuner needs microphone access, which browsers only allow on `https://` or `localhost`.

To install on a phone, deploy `dist/` to any static host with HTTPS (e.g. GitHub Pages), open it, and choose **Add to Home Screen**.

## How the timing works

Everything rhythmic runs through one look-ahead scheduler (`src/audio/scheduler.ts`): a worker-driven timer wakes every 25 ms and schedules each note at an exact time on the audio clock, about 120 ms ahead. The beat doesn't drift when the UI is busy, and tempo changes take effect on the next step. Visuals are synced by queueing each step's time and lighting it when the audio clock reaches it.

## Layout

```
src/
  music/      pure logic: pitch math, time signatures, rudiments, grooves, practice log
  audio/      AudioContext, scheduler, synthesized sounds
  features/   one file per screen
  ui/         DOM helpers and shared app services
tests/        vitest unit tests for music/ and the scheduler
scripts/      make-icons.mjs renders the PNG app icons from public/icon.svg
```
