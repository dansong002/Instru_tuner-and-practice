import { formatDuration, totals } from "../music/practiceLog";
import type { AppServices, Screen } from "../ui/app";
import { h } from "../ui/dom";

export function logScreen(services: AppServices): Screen {
  const stats = h("div", { class: "stats" });
  const list = h("ol", { class: "sessions" });
  const breakdown = h("div", { class: "breakdown" });

  function render() {
    const sessions = services.log.all();
    const t = totals(sessions);
    stats.replaceChildren(
      stat("Today", formatDuration(t.todaySeconds)),
      stat("Last 7 days", formatDuration(t.weekSeconds)),
      stat("Streak", `${t.streakDays} day${t.streakDays === 1 ? "" : "s"}`),
    );
    const entries = Object.entries(t.byActivity).sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] ?? 1;
    breakdown.replaceChildren(
      ...entries.map(([name, secs]) =>
        h(
          "div",
          { class: "bar-row" },
          h("span", { class: "bar-name" }, name),
          h("span", { class: "bar-track" }, h("span", { class: "bar-fill", style: `width:${Math.max(4, (secs / max) * 100)}%` })),
          h("span", { class: "bar-val" }, formatDuration(secs)),
        ),
      ),
    );
    breakdown.hidden = entries.length === 0;
    const recent = sessions.slice(-30).reverse();
    list.replaceChildren(
      ...(recent.length
        ? recent.map((s) =>
            h(
              "li",
              {},
              h("span", { class: "s-what" }, s.activity, s.detail ? h("span", { class: "muted" }, ` · ${s.detail}`) : null),
              h("span", { class: "s-meta muted" }, [new Date(s.start).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }), formatDuration(s.seconds), s.bpm ? `${s.bpm} BPM` : ""].filter(Boolean).join(" · ")),
            ),
          )
        : [h("li", { class: "muted empty" }, "No sessions yet. Anything you play for 20 seconds or more on the metronome, rudiments or drum set screens is logged here automatically.")]),
    );
  }

  const clearBtn = h("button", { class: "btn small danger" }, "Clear log");
  clearBtn.addEventListener("click", () => {
    if (confirm("Delete all practice history on this device?")) {
      services.log.clear();
      render();
    }
  });

  services.onSessionSaved(render);
  render();

  return {
    el: h(
      "section",
      { class: "screen log" },
      h("div", { class: "card" }, stats, breakdown),
      h("div", { class: "card" }, h("h2", {}, "Recent sessions"), list, h("div", { class: "right" }, clearBtn)),
      h("p", { class: "muted small" }, "Your history is stored only in this browser on this device."),
    ),
    onShow: render,
  };
}

function stat(label: string, value: string): HTMLElement {
  return h("div", { class: "stat" }, h("span", { class: "stat-val" }, value), h("span", { class: "stat-label muted" }, label));
}
