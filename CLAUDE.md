# Practice Room — tuner, metronome, rudiments, drum-set practice

Installable web app (PWA). Vite + TypeScript, no UI framework, no runtime deps except `pitchy` (pitch detection).

## Commands
- `npm test` — vitest unit tests; `npm run typecheck`; `npm run build` (typecheck + build)
- `node scripts/make-icons.mjs` — regenerate PNG icons after editing `public/icon.svg`

## Conventions
- Pure, testable logic goes in `src/music/` (no DOM or Web Audio). Add tests in `tests/` for it.
- All rhythmic playback goes through `Scheduler` in `src/audio/scheduler.ts`. Never use `setTimeout`/`setInterval` to time notes — schedule at audio-clock times.
- Sounds are synthesized in `src/audio/sounds.ts`; no sample files.
- `localStorage` may be unavailable: always go through `loadPref`/`savePref`/`safeStorage` (they swallow errors).
- Original code only. This repo began as a fork of a third-party tuner with no license; none of that code is used. Don't copy from it or other unlicensed sources.
