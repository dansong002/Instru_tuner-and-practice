/** Practice-session log. Storage is injectable so the logic is testable. */

export interface Session {
  /** Start time, ms since epoch. */
  start: number;
  /** Duration in seconds. */
  seconds: number;
  activity: string;
  detail?: string;
  bpm?: number;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = "practice-room:sessions:v1";
/** Sessions shorter than this aren't worth logging (a quick check, not practice). */
export const MIN_SESSION_SECONDS = 20;

export class PracticeLog {
  constructor(private store: KeyValueStore | null) {}

  all(): Session[] {
    try {
      const raw = this.store?.getItem(KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as Session[]) : [];
    } catch {
      return [];
    }
  }

  /** Records the session if it is long enough. Returns whether it was saved. */
  add(session: Session): boolean {
    if (session.seconds < MIN_SESSION_SECONDS) return false;
    const sessions = this.all();
    sessions.push(session);
    try {
      this.store?.setItem(KEY, JSON.stringify(sessions.slice(-1000)));
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    try {
      this.store?.setItem(KEY, "[]");
    } catch {
      /* storage unavailable */
    }
  }
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface Totals {
  todaySeconds: number;
  weekSeconds: number;
  /** Consecutive days with any practice, counting back from today (or yesterday if none yet today). */
  streakDays: number;
  byActivity: Record<string, number>;
}

export function totals(sessions: Session[], now = Date.now()): Totals {
  const today = startOfDay(now);
  const weekAgo = today - 6 * 86400000;
  const days = new Set<number>();
  const byActivity: Record<string, number> = {};
  let todaySeconds = 0;
  let weekSeconds = 0;
  for (const s of sessions) {
    const day = startOfDay(s.start);
    days.add(day);
    if (day === today) todaySeconds += s.seconds;
    if (day >= weekAgo) {
      weekSeconds += s.seconds;
      byActivity[s.activity] = (byActivity[s.activity] ?? 0) + s.seconds;
    }
  }
  let streakDays = 0;
  let cursor = days.has(today) ? today : today - 86400000;
  while (days.has(cursor)) {
    streakDays++;
    // Step back one calendar day (DST-safe: go to noon yesterday, then snap to midnight).
    cursor = startOfDay(cursor - 12 * 3600000);
  }
  return { todaySeconds, weekSeconds, streakDays, byActivity };
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
