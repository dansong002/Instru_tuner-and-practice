/** Tiny DOM helpers — enough to avoid a framework for an app this size. */

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;
type Child = Node | string | number | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = String(v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  append(el, ...children);
  return el;
}

export function append(el: Node, ...children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
  }
}

/** A labelled range slider with a live value readout. */
export function slider(opts: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  format?: (v: number) => string;
  onInput: (v: number) => void;
}): { el: HTMLElement; set: (v: number) => void } {
  const fmt = opts.format ?? String;
  const out = h("output", {}, fmt(opts.value));
  const input = h("input", {
    type: "range",
    min: opts.min,
    max: opts.max,
    step: opts.step ?? 1,
    value: opts.value,
    "aria-label": opts.label,
  });
  input.addEventListener("input", () => {
    const v = Number(input.value);
    out.textContent = fmt(v);
    opts.onInput(v);
  });
  return {
    el: h("label", { class: "field" }, h("span", { class: "field-label" }, opts.label, " ", out), input),
    set(v) {
      input.value = String(v);
      out.textContent = fmt(v);
    },
  };
}

export function select<T extends string>(opts: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}): { el: HTMLElement; input: HTMLSelectElement } {
  const input = h("select", { "aria-label": opts.label });
  for (const o of opts.options) input.appendChild(h("option", { value: o.value, selected: o.value === opts.value }, o.label));
  input.addEventListener("change", () => opts.onChange(input.value as T));
  return { el: h("label", { class: "field" }, h("span", { class: "field-label" }, opts.label), input), input };
}

/** Per-viewer preferences. Storage can be unavailable (private mode), so failures are ignored. */
export function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`practice-room:${key}`);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function savePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(`practice-room:${key}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
