// The design language's values, `specs/ui/design-language.md`, as the samples draw them on GTK.
// Every number and colour of the samples is here, shaped as the tokens will be: a theme's roles,
// then one set per height, per part, and per open choice. The tokens lift this file.

export type Mode = "dark" | "light";

/**
 * The colours a theme gives. The defaults are the shipped Catppuccin Mocha and Latte: in Latte the
 * accents and the faint ink are the theme's own darkened ones, which reach 4.5:1 on its page.
 */
export interface Roles {
  backdrop: string;
  /** The backdrop's two washes, the accents at `backdrop.wash`'s share. */
  backdropWash1: string;
  backdropWash2: string;
  well: string;
  surface: string;
  raised: string;
  edge: string;
  edgeQuiet: string;
  /** The 1 px of light under a raised surface's top edge. */
  lip: string;
  /** The 1 px of shade under a recessed surface's top edge. */
  shade: string;
  /** What glass is tinted with, before `glass.tint` warms it. */
  glassTint: string;
  glassRim: string;
  lightFocus: string;
  lightFocus2: string;
  lightRunning: string;
  text: string;
  text2: string;
  text3: string;
  accent: string;
  accent2: string;
  needs: string;
  running: string;
  added: string;
  removed: string;
  warn: string;
  onAccent: string;
  h1: string;
  h2: string;
  h3: string;
}

export const roles: Record<Mode, Roles> = {
  dark: {
    backdrop: "#11111b",
    backdropWash1: "#cba6f7",
    backdropWash2: "#89b4fa",
    well: "#181824",
    surface: "#1e1e2e",
    raised: "#2a2b3e",
    edge: "#70748b",
    edgeQuiet: "#3b3d52",
    lip: "rgba(255, 255, 255, 0.09)",
    shade: "rgba(0, 0, 0, 0.42)",
    glassTint: "#181824",
    glassRim: "#ffffff",
    lightFocus: "#cba6f7",
    lightFocus2: "#89b4fa",
    lightRunning: "#94e2d5",
    text: "#cdd6f4",
    text2: "#a6adc8",
    text3: "#9399b2",
    accent: "#cba6f7",
    accent2: "#89b4fa",
    needs: "#fab387",
    running: "#94e2d5",
    added: "#a6e3a1",
    removed: "#f38ba8",
    warn: "#f9e2af",
    onAccent: "#11111b",
    h1: "#cba6f7",
    h2: "#89b4fa",
    h3: "#a6e3a1",
  },
  light: {
    backdrop: "#dce0e8",
    backdropWash1: "#7d26ed",
    backdropWash2: "#0a54e5",
    well: "#e4e7ee",
    surface: "#eff1f5",
    raised: "#fbfbfd",
    edge: "#7c7f93",
    edgeQuiet: "#bcc0cc",
    lip: "rgba(255, 255, 255, 0.95)",
    shade: "rgba(40, 42, 60, 0.16)",
    glassTint: "#eff1f5",
    glassRim: "#ffffff",
    lightFocus: "#7d26ed",
    lightFocus2: "#0a54e5",
    lightRunning: "#116a6f",
    text: "#4c4f69",
    text2: "#5c5f77",
    text3: "#5e6173",
    accent: "#7d26ed",
    accent2: "#0a54e5",
    needs: "#a83e01",
    running: "#116a6f",
    added: "#2d711e",
    removed: "#be0e34",
    warn: "#875612",
    onAccent: "#ffffff",
    h1: "#7d26ed",
    h2: "#0a54e5",
    h3: "#2d711e",
  },
};

/** The open choices of the language, each one token, at the value the build takes. */
export const choices = {
  "light.running.motion": "steady" as "steady" | "breathe" | "off",
  "backdrop.wash": true,
  "pane.gap": 8,
  "light.mode": true,
  "button.main.motion": "breathe" as "breathe" | "steady",
  "caret.trail": true,
  "pane.title": "wrap" as "wrap" | "tab" | "border",
  "height.depth": "lips" as "lips" | "soft" | "tone",
  "key.look": "chip" as "chip" | "glow" | "cap",
  "button.main.look": "lamp" as "lamp" | "glow" | "tube",
};

const channels = (hex: string) =>
  [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)) as [number, number, number];

/** `share` of `a`, the rest of `b`, mixed in sRGB as CSS's `color-mix` does. */
export function mix(a: string, b: string, share: number): string {
  const [x, y] = [channels(a), channels(b)];
  const part = (i: number) =>
    Math.round(x[i]! * share + y[i]! * (1 - share))
      .toString(16)
      .padStart(2, "0");
  return `#${part(0)}${part(1)}${part(2)}`;
}

/** A colour at an opacity. */
export function alpha(hex: string, opacity: number): string {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** The language's values in one theme. */
export function values(mode: Mode) {
  const role = roles[mode];
  const dark = mode === "dark";
  const black = dark ? "#000000" : "#282a3c";
  return {
    mode,
    role,
    type: {
      mono: "JetBrains Mono, DejaVu Sans Mono, monospace",
      reading: "Atkinson Hyperlegible, Inter, DejaVu Sans, sans-serif",
      /** The reading size in monospace, with its line. */
      size: 13,
      line: 20,
      /** Long prose. */
      prose: 15,
      proseLine: 24,
      under: 12,
      over: 15,
      over2: 18,
    },
    space: {
      /** A row of a list, and the unit every height is a multiple of. */
      row: 24,
      /** The gap between panes: 8 on a wide window, 4 on a narrow one, 2 on a phone. */
      gap: { wide: choices["pane.gap"], narrow: 4, phone: 2 },
      panePadding: 12,
    },
    backdrop: {
      fill: role.backdrop,
      /** The share of each accent at the heart of its wash. */
      wash: choices["backdrop.wash"] ? (dark ? [0.11, 0.1] : [0.05, 0.04]) : [0, 0],
      grain: dark ? 0.05 : 0.035,
      /** How much the page dims behind an overlay that takes the focus. */
      dim: dark ? "rgba(0, 0, 0, 0.2)" : "rgba(40, 42, 60, 0.1)",
    },
    height: {
      recessed: {
        fill: role.well,
        /** A well inside a raised surface, and inside a well or glass. */
        fillIn: {
          raised: role.surface,
          deeper: dark ? "rgba(0, 0, 0, 0.24)" : "rgba(40, 42, 60, 0.06)",
        },
        edge: role.edge,
        lip: `inset 0 1px 0 ${role.shade}`,
        shadow: "none",
        glass: false,
      },
      standard: { fill: role.surface, edge: role.edge, lip: "none", shadow: "none", glass: false },
      raised: {
        fill: role.raised,
        edge: role.edge,
        lip: `inset 0 1px 0 ${role.lip}`,
        shadow: "none",
        glass: false,
      },
      overlay: {
        fill: "glass",
        /** The line under the rim. */
        edge: alpha(role.edge, 0.45),
        lip: "none",
        shadow: dark
          ? "0 1px 0 rgba(0, 0, 0, 0.5), 0 22px 50px -12px rgba(0, 0, 0, 0.65)"
          : "0 1px 0 rgba(40, 42, 60, 0.15), 0 22px 50px -12px rgba(40, 42, 60, 0.3)",
        glass: true,
      },
      /** A raised surface that content scrolls under: glass, with a short shadow. */
      raisedGlass: {
        shadow: dark
          ? "0 9px 16px -10px rgba(0, 0, 0, 0.6)"
          : "0 9px 16px -10px rgba(40, 42, 60, 0.3)",
      },
    },
    pane: {
      fill: role.surface,
      edge: role.edge,
      /** How far the title stands above the pane's top edge, and its whole height. */
      titleRise: 12,
      titleHeight: 22,
      titlePadding: [10, 11] as const,
    },
    light: {
      focus: role.lightFocus,
      focus2: role.lightFocus2,
      /**
       * The glow that follows the focused pane's outline: two lights, each moved by `offset` toward
       * its own end, of `blur` px, drawn within `reach` of the pane. A light theme has one, under
       * the pane, as a tinted shadow.
       */
      glow: dark
        ? { blur: 15, offset: 4, strength: 0.42, reach: 30 }
        : { blur: 9, offset: 5, strength: 0.24, reach: 24 },
      glide: 300,
      running: role.lightRunning,
      runningGlow: dark
        ? `0 0 10px ${alpha(role.lightRunning, 0.6)}, 0 0 2px ${role.lightRunning}`
        : `0 2px 8px ${alpha(role.lightRunning, 0.4)}`,
      runningWidth: dark ? 1 : 2,
      needs: role.needs,
      mode: {
        normal: role.accent,
        insert: role.added,
        visual: role.accent2,
        replace: role.removed,
      },
      /** The glow of the focused field, in the mode's colour. */
      field: dark ? { blur: 14, y: 0, strength: 0.32 } : { blur: 10, y: 3, strength: 0.22 },
    },
    row: {
      selected: role.raised,
      bar: 2,
      /** The bar is lit; the row is not. */
      barGlow: dark ? `0 0 8px ${alpha(role.accent, 0.6)}` : "none",
    },
    glass: {
      /** The tint's colour: the theme's, warmed by 5% of `glass.tint`. */
      tint: dark ? mix(role.glassTint, "#fab387", 0.95) : role.glassTint,
      /** The tint's share over a dark page, and what it gains over the brightest one. */
      strength: dark ? 0.62 : 0.72,
      thicken: dark ? 0.3 : 0.2,
      /** The frost: a Gaussian blur of this deviation, so 14 px across. */
      frost: 7,
      /** The share of the frost left at the very edge, which is sharper than the middle. */
      edgeFrost: 0.35,
      saturate: dark ? 1.8 : 1.5,
      brightness: dark ? 0.92 : 1,
      /** The bent band: its width, and the pull at the very edge, in bands. */
      band: 22,
      bandMin: 12,
      pull: 1.6,
      fringe: 0.025,
      rim: role.glassRim,
      rimCorner: dark ? 0.6 : 1,
      rimBetween: dark ? 0.07 : 0.35,
      /** Light inside: the line under the top edge, the sheen, and the shade above the bottom. */
      line: dark ? 0.18 : 0.9,
      sheen: dark ? 0.07 : 0.5,
      glow: dark ? 0.035 : 0.3,
      shade: dark ? 0.45 : 0.12,
      grain: dark ? 0.05 : 0.015,
      /** A well in glass. */
      well: dark ? "rgba(0, 0, 0, 0.24)" : "rgba(40, 42, 60, 0.06)",
      /** The plate an overlay's title sits on. */
      plate: alpha(role.surface, 0.92),
    },
    button: {
      height: 28,
      padding: 14,
      main: {
        fill: (tone: string) =>
          `linear-gradient(180deg, ${mix(tone, "#ffffff", 0.86)}, ${tone} 55%, ${mix(tone, "#000000", 0.9)})`,
        rest: (tone: string) =>
          `inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 5px 14px -2px ${alpha(tone, 0.45)}`,
        hot: (tone: string) =>
          `inset 0 1px 0 rgba(255, 255, 255, 0.34), 0 6px 24px 0 ${alpha(tone, 0.68)}`,
        pressed: "inset 0 2px 4px rgba(0, 0, 0, 0.35)",
        /** The two ends of a breath, which takes `motion.breath`. */
        breathLow: (tone: string) =>
          `inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 4px 10px -2px ${alpha(tone, 0.32)}`,
        breathHigh: (tone: string) => `0 6px 26px 2px ${alpha(tone, 0.7)}`,
        hotBrightness: 1.07,
        pressedBrightness: 0.9,
      },
      tube: {
        fill: alpha(role.well, 0.72),
        edge: role.edge,
        hotFill: (tone: string) => mix(tone, role.well, 0.1),
        hotText: (tone: string) => mix(tone, role.text, 0.75),
        /** Light fills a hot tube from its two long edges, and spills round it. */
        hotLight: (tone: string) =>
          `linear-gradient(180deg, ${alpha(tone, 0.24)}, ${alpha(tone, 0.06)} 50%, ${alpha(tone, 0.24)})`,
        hot: (tone: string) => `0 0 16px ${alpha(tone, 0.5)}`,
        pressedFill: role.well,
        pressed: "inset 0 2px 4px rgba(0, 0, 0, 0.45)",
        dangerEdge: alpha(role.removed, 0.75),
        /** A dangerous tube is lit a little even at rest. */
        dangerLight: `linear-gradient(180deg, ${alpha(role.removed, 0.13)}, ${alpha(role.removed, 0.03)} 50%, ${alpha(role.removed, 0.13)})`,
      },
      disabledEdge: role.edgeQuiet,
      focusRing: (tone: string) => mix(tone, "#ffffff", 0.7),
      focusOffset: 3,
    },
    key: {
      size: 19,
      padding: 5,
      text: role.accent,
      /** The block: dark in a dark theme, the lightest in a light one, so the letter reads anywhere. */
      fill: dark ? mix(role.accent, role.backdrop, 0.2) : mix(role.accent, "#ffffff", 0.1),
      hot: dark ? mix(role.accent, role.backdrop, 0.32) : mix(role.accent, "#ffffff", 0.18),
      pressed: dark ? mix(role.accent, role.backdrop, 0.08) : mix(role.accent, "#ffffff", 0.04),
      /** On the main button: the letter in the button's text colour, on a faint block. */
      onMain: alpha(role.onAccent, 0.14),
    },
    status: { height: 26, padding: 12 },
    motion: {
      in: { duration: 180, curve: [0.05, 0.7, 0.1, 1] as const },
      out: { duration: 120, curve: [0.3, 0, 0.8, 0.15] as const },
      rise: 8,
      press: 90,
      breath: 6000,
      runDraw: 700,
      runFade: 1200,
      caretTrail: 480,
    },
    black,
  };
}

export type Values = ReturnType<typeof values>;
