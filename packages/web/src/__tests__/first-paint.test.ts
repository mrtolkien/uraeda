// The first paint's script in `index.html`, the second reader of the picks this browser stored
// (testing decision: stored formats): before any module loads, it draws what the app would, the
// palette rule of the drawn cache, the mode the stored picks resolve, and the browser's bar in the
// page's colour, with `storedPicks` and `storedDrawn` (`theme.tsx`) as the reference.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { storedDrawn, storedPicks } from "../theme.tsx";
import { paletteCss } from "../theme/palette.ts";

const html = readFileSync(join(import.meta.dirname, "../../index.html"), "utf8");
/** The one classic inline script of the page's head. */
const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;
/** The page's `theme-color` metas, as written: one per system mode. */
const metas = [...html.matchAll(/<meta name="theme-color"[^>]*>/g)].map(([meta]) => meta).join("");

const DARK = { "--color-background-body": "#282a36", "--color-text-primary": "#f8f8f2" };
const LIGHT = { "--color-background-body": "#fffbeb", "--color-text-primary": "#1f1f1f" };
const DARK_BODY = DARK["--color-background-body"];
const LIGHT_BODY = LIGHT["--color-background-body"];
const BOTH = JSON.stringify({ dark: DARK, light: LIGHT });
/** The built Catppuccin's bar, which the metas say until a cache gives the page's colour. */
const BUILT = { dark: "#1e1e2e", light: "#eff1f5" };

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-theme");
  document.head.innerHTML = "";
});

/** What the browser's bar says in `mode`, by its `theme-color` meta. */
const bar = (mode: string) =>
  document.querySelector(`meta[name="theme-color"][media*="${mode}"]`)!.getAttribute("content");

/** Runs the script over `stored`, the system in `system` mode, as a reload does. */
function firstPaint(stored: Record<string, string>, system: "dark" | "light") {
  for (const [key, value] of Object.entries(stored)) {
    localStorage.setItem(key, value);
  }
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(prefers-color-scheme: dark)" && system === "dark",
  }));
  document.head.innerHTML = metas;
  new Function(script)();
  return {
    css: document.getElementById("uraeda-palette")?.textContent ?? "",
    dark: bar("dark"),
    light: bar("light"),
    theme: document.documentElement.getAttribute("data-theme"),
  };
}

/** The bars each meta should say: under a picked mode both say its page, under System their own. */
const bars = (dark: string, light: string) => ({ dark, light });

// Breaks: the script reading a stored pick or the cache differently from the app, or leaving the
// browser's bar in Catppuccin over a picked theme's page until the app mounts.
test.each([
  [
    "mocha",
    { "uraeda.theme": "mocha", "uraeda.theme.drawn": BOTH },
    "light",
    bars(DARK_BODY, DARK_BODY),
  ],
  [
    "latte",
    { "uraeda.theme": "latte", "uraeda.theme.drawn": BOTH },
    "dark",
    bars(LIGHT_BODY, LIGHT_BODY),
  ],
  ["nothing stored", {}, "dark", bars(BUILT.dark, BUILT.light)],
  [
    "a corrupt cache",
    { "uraeda.theme": "dark", "uraeda.theme.drawn": "{" },
    "light",
    bars(BUILT.dark, BUILT.dark),
  ],
  [
    "a cache of one mode",
    { "uraeda.theme.drawn": JSON.stringify({ dark: DARK }) },
    "light",
    bars(DARK_BODY, BUILT.light),
  ],
] as const)("the first paint over %s draws what the app reads", (_, stored, system, bar) => {
  const read = (key: string) => (stored as Record<string, string>)[key] ?? null;
  const painted = firstPaint(stored, system);
  expect(painted.css).toBe(paletteCss(storedDrawn(read("uraeda.theme.drawn"))));
  const { mode } = storedPicks(read);
  expect(painted.theme).toBe(mode === "system" ? system : mode);
  expect({ dark: painted.dark, light: painted.light }).toEqual(bar);
});
