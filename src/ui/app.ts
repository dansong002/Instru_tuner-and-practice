import { PracticeLog, type Session } from "../music/practiceLog";
import { safeStorage } from "./dom";

/** Something a screen can do when it becomes visible or hidden. */
export interface Screen {
  el: HTMLElement;
  onShow?(): void;
  onHide?(): void;
  /** Start/stop playback — bound to the space bar while the screen is visible. */
  toggle?(): void;
}

export interface AppServices {
  log: PracticeLog;
  /** Notify the log view that a session was saved. */
  sessionSaved(session: Session): void;
  onSessionSaved(fn: (s: Session) => void): void;
}

export function createServices(): AppServices {
  const log = new PracticeLog(safeStorage());
  const listeners: ((s: Session) => void)[] = [];
  return {
    log,
    sessionSaved(s) {
      listeners.forEach((fn) => fn(s));
    },
    onSessionSaved(fn) {
      listeners.push(fn);
    },
  };
}

/** Times a practice run and logs it when it ends. */
export class SessionTimer {
  private startedAt: number | null = null;
  constructor(
    private services: AppServices,
    private activity: string,
  ) {}

  start(): void {
    this.startedAt ??= Date.now();
  }

  /** Ends the run and logs it if long enough. */
  stop(detail?: string, bpm?: number): void {
    if (this.startedAt === null) return;
    const session: Session = { start: this.startedAt, seconds: (Date.now() - this.startedAt) / 1000, activity: this.activity, detail, bpm };
    this.startedAt = null;
    if (this.services.log.add(session)) this.services.sessionSaved(session);
  }
}
