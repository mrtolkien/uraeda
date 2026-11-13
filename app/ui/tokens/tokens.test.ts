// Run by `nsh test`, without a display: what the tokens give of a theme, and how they follow it.
import { effect, token } from "nsh";
import { expect, test } from "nsh/test";
import { applyFonts, applyTheme, pickTheme, shownTheme } from "../theme";
import defaults from "./defaults.json";
import { DEFAULT_THEMES, FONTS, tokens, tokensOf } from "./index";
import { ROLE_NAMES } from "./roles";

const { dark, light } = DEFAULT_THEMES;

test("the tokens name every role the core reads", () => {
  expect(ROLE_NAMES.toSorted()).toEqual(Object.keys(defaults.dark.roles).toSorted());
  expect(tokens.role.inkFaint).toBe(dark.roles["ink-faint"]);
  expect(tokens.role.lightFocus2).toBe(dark.roles["light-focus-2"]);
});

test("a token read in an effect follows the theme", () => {
  applyTheme(dark);
  const fills: string[] = [];
  effect(() => {
    fills.push(tokens.height.raised.fill);
  });
  expect(applyTheme(light)).toBe(true);
  expect(fills).toEqual([dark.roles.raised, light.roles.raised]);
  expect(tokens.mode).toBe("light");
  expect(shownTheme().id).toBe(light.id);
  applyTheme(dark);
});

test("a theme without the new roles inherits them", () => {
  const old = { id: "old", mode: "light", roles: { page: "#ffffff", ink: "#000000" } };
  const read = tokensOf(old);
  expect(read.role.page).toBe("#ffffff");
  expect(read.role.backdrop).toBe(light.roles.backdrop);
  expect(read.glass.tint).toBe(tokensOf(light).glass.tint);
  expect(read.light.focus).toBe(light.roles["light-focus"]);
});

test("a theme whose colours cannot be read leaves the one shown", () => {
  applyTheme(dark);
  const broken = { id: "broken", mode: "dark", roles: { ...dark.roles, "glass-tint": "warm" } };
  expect(applyTheme(broken)).toBe(false);
  expect(shownTheme().id).toBe(dark.id);
  expect(tokens.glass.tint).toBe(tokensOf(dark).glass.tint);
});

test("Native Shell's own tokens take the theme's roles", async () => {
  applyTheme(light);
  await new Promise((done) => setTimeout(done, 50));
  expect(token("background").slice(0, 7)).toBe(light.roles.page);
  expect(token("primary").slice(0, 7)).toBe(light.roles.action);
  expect(token("radius")).toBe(0);
  applyTheme(dark);
});

test("every height gives its fill, border, shadow, blur, tint, and glow", () => {
  for (const name of ["recessed", "standard", "raised", "overlay"] as const) {
    const height = tokens.height[name];
    for (const part of ["fill", "border", "lip", "shadow", "glass", "blur", "tint", "glow"]) {
      expect(Object.keys(height)).toContain(part);
    }
  }
  expect(tokens.height.overlay.glass).toBe(true);
  expect(tokens.height.standard.glow?.reach).toBe(30);
});

test("every bundled font names its family, and a part takes the font picked for it", () => {
  for (const font of FONTS) {
    expect(font.family).toMatch(
      /^[A-Z][A-Za-z ]+, (Monaspace Neon, )?(monospace|sans-serif|serif)$/,
    );
  }
  expect(tokens.type.body).toContain("Monaspace Neon");
  applyFonts({ body: "jetbrains", code: "no such font" });
  expect(tokens.type.body).toContain("JetBrains Mono");
  expect(tokens.type.code).toContain("JetBrains Mono");
  applyFonts(undefined);
  expect(tokens.type.body).toContain("Monaspace Neon");
});

test("a device's choice picks the theme of its mode", () => {
  const themes = [dark, light, { id: "nord", mode: "dark", roles: dark.roles }];
  const choice = { mode: "system" as const, dark: "nord", light: "gone" };
  expect(pickTheme(themes, choice, "dark").id).toBe("nord");
  expect(pickTheme(themes, choice, "light").id).toBe(light.id);
  expect(pickTheme(themes, { ...choice, mode: "light" }, "dark").id).toBe(light.id);
  expect(pickTheme([], undefined, "dark").id).toBe(dark.id);
});
