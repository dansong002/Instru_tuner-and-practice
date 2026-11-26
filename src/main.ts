import "./style.css";
import { registerSW } from "virtual:pwa-register";
import { screens as factories } from "./screens";
import { createServices, type Screen } from "./ui/app";
import { h } from "./ui/dom";

const services = createServices();
const root = document.getElementById("app")!;
const nav = h("nav", { class: "tabs", role: "tablist" });
const main = h("main", { id: "main" });

type Built = { id: string; label: string; icon: string; screen: Screen };
const built: Built[] = [];
let current: Built | null = null;

function show(id: string) {
  let target = built.find((b) => b.id === id);
  if (!target) {
    const f = factories.find((x) => x.id === id) ?? factories[0]!;
    target = { id: f.id, label: f.label, icon: f.icon, screen: f.create(services) };
    built.push(target);
    main.appendChild(target.screen.el);
  }
  if (current && current !== target) {
    current.screen.onHide?.();
    current.screen.el.hidden = true;
  }
  target.screen.el.hidden = false;
  current = target;
  target.screen.onShow?.();
  nav.querySelectorAll<HTMLElement>("[data-tab]").forEach((b) => {
    const active = b.dataset.tab === target.id;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", String(active));
  });
  if (location.hash !== `#${target.id}`) history.replaceState(null, "", `#${target.id}`);
}

for (const f of factories) {
  nav.appendChild(
    h("button", { class: "tab", role: "tab", "data-tab": f.id, onclick: () => show(f.id) }, h("span", { class: "tab-icon", "aria-hidden": "true" }, f.icon), h("span", { class: "tab-label" }, f.label)),
  );
}

root.append(h("header", { class: "top" }, h("h1", {}, "Practice Room")), main, nav);

document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || e.repeat) return;
  const t = e.target as HTMLElement | null;
  if (t && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(t.tagName)) return;
  if (current?.screen.toggle) {
    e.preventDefault();
    current.screen.toggle();
  }
});

// Stop playback if the page is being hidden for good (e.g. app switched on mobile).
window.addEventListener("pagehide", () => current?.screen.onHide?.());

show(location.hash.slice(1) || "tuner");

registerSW({ immediate: true });
