// The app's theme, the UI look decision's terminal look: Astryx's neutral theme in Catppuccin's
// colours, JetBrains Mono, square corners, and 120% sizes at every width. Built into `built/` by
// `vp run --filter uraeda-web theme`: edit this file, then rebuild, and commit both.
import { defineSyntaxTheme, defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";
// A package import, `package.json`'s `imports`: the theme's build copies the specifier into
// `built/uraeda.js` as it is written, where a relative path would not resolve.
import { uraedaIcons } from "#theme-icons";

/** Text, controls, and spacing at 120% of Astryx's sizes at every width, the UI look decision's. */
const SCALE = 1.2;

// The neutral theme's sizes, Astryx's defaults (`@astryxdesign/core/theme/tokens.stylex`): its base
// font size, its type scale, its spacing steps, and its element heights, in px. The theme build only
// accepts the neutral theme as the base to extend, so they are listed here; recheck them on an
// Astryx upgrade.
const BASE = 14;
const FONT_SIZES = {
  "2xl": 24,
  "2xs": 8,
  "3xl": 29,
  "3xs": 7,
  "4xl": 35,
  "4xs": 6,
  "5xl": 42,
  base: BASE,
  lg: 17,
  sm: 12,
  xl: 20,
  xs: 10,
};
const SPACING = {
  "0-5": 2,
  1: 4,
  "1-5": 6,
  10: 40,
  11: 44,
  12: 48,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
};
const ELEMENTS = { lg: 36, md: 32, sm: 28 };

const px = (value: number) => `${Math.round(value * SCALE * 100) / 100}px`;
const scaled = (prefix: string, sizes: Record<string, number>) =>
  Object.fromEntries(Object.entries(sizes).map(([step, value]) => [`${prefix}${step}`, px(value)]));

/**
 * The type scale at 120%, exact: Astryx's scale rounds each size to a whole pixel, which would set
 * body text at 17 px rather than 16.8.
 */
const fontSizes = scaled("--font-size-", FONT_SIZES);
const typeScale = { base: BASE * SCALE, ratio: 1.2 };

/** Every spacing and element-size token at 120%. */
const grown = { ...scaled("--spacing-", SPACING), ...scaled("--size-element-", ELEMENTS) };

/**
 * Catppuccin, from the mockup's palette (`specs/2026-10-20-layout-look/mockups/terminal-2/style.css`):
 * Latte in the light slot of each pair, Mocha in the dark one. Latte's accents, used as text, are
 * darker steps than Catppuccin's own, which read at about 3:1 on its base; Mocha's dim text is
 * lighter than its overlay, for 4.5:1. `theme-tokens.test.ts` measures every pair.
 */
const LATTE = {
  base: "#eff1f5",
  blue: "#1957d5",
  crust: "#dce0e8",
  cyan: "#0a688e",
  dim: "#636679",
  green: "#2c6f1f",
  lavender: "#4254c8",
  mantle: "#e6e9ef",
  mauve: "#7b2fe0",
  overlay: "#7c7f93",
  peach: "#a63f00",
  pink: "#a72592",
  red: "#bc0d33",
  subtext0: "#6c6f85",
  subtext1: "#5c5f77",
  surface0: "#ccd0da",
  surface1: "#bcc0cc",
  surface2: "#acb0be",
  teal: "#0f6c72",
  text: "#4c4f69",
  yellow: "#875800",
};
const MOCHA = {
  base: "#1e1e2e",
  blue: "#89b4fa",
  crust: "#11111b",
  cyan: "#89dceb",
  dim: "#949bb6",
  green: "#a6e3a1",
  lavender: "#b4befe",
  mantle: "#181825",
  mauve: "#cba6f7",
  overlay: "#6c7086",
  peach: "#fab387",
  pink: "#f5c2e7",
  red: "#f38ba8",
  subtext0: "#a6adc8",
  subtext1: "#bac2de",
  surface0: "#313244",
  surface1: "#45475a",
  surface2: "#585b70",
  teal: "#94e2d5",
  text: "#cdd6f4",
  yellow: "#f9e2af",
};
type Role = keyof typeof LATTE;

/** A role's `[latte, mocha]` pair. */
const pair = (role: Role): [string, string] => [LATTE[role], MOCHA[role]];

/** A `#rrggbb` colour's red, green, and blue, from 0 to 255. */
const channels = (hex: string) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));

/** `colour` at `share` over `under`, as `#rrggbb`: a tint the build writes as a plain colour. */
function mix(colour: string, share: number, under: string) {
  const [top, bottom] = [channels(colour), channels(under)];
  return `#${top
    .map((value, at) => Math.round(value * share + bottom[at]! * (1 - share)))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** A hue's tint over the base, light enough that its own text and secondary text keep 4.5:1 on it. */
const tint = (role: Role): [string, string] => [
  mix(LATTE[role], 0.12, LATTE.base),
  mix(MOCHA[role], 0.12, MOCHA.base),
];

/** Astryx's hue names, and the Catppuccin colour each takes. */
const HUES: Record<string, Role> = {
  blue: "blue",
  cyan: "cyan",
  green: "green",
  orange: "peach",
  pink: "pink",
  purple: "mauve",
  red: "red",
  teal: "teal",
  yellow: "yellow",
};

/** Each hue's background, border, icon, and text. */
const hues = Object.fromEntries(
  Object.entries(HUES).flatMap(([hue, role]) => [
    [`--color-background-${hue}`, tint(role)],
    [`--color-border-${hue}`, pair(role)],
    [`--color-icon-${hue}`, pair(role)],
    [`--color-text-${hue}`, pair(role)],
  ]),
);

/** The monospace fonts a machine has, while JetBrains Mono loads. */
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/** Text on a filled colour: white on Latte's dark steps, crust on Mocha's light ones. */
const ON: [string, string] = ["#ffffff", MOCHA.crust];

export const uraedaTheme = defineTheme({
  adaptations: {
    rules: [
      {
        value: { localTokens: { "--size-page-max": "1200px" } },
        when: { width: { from: "lg" } },
      },
      // Last, so a wide touch screen keeps 44 px controls. Its type scale and sizes undo the neutral
      // theme's rule for touch screens under 1024 px, 16 px text on a re-derived scale: text is 120%
      // on every screen.
      {
        value: {
          components: {
            // A row a finger taps is a control's height at least.
            item: { base: { minHeight: "var(--size-element-md)" } },
            // Not a markdown list's items, which nothing taps: Astryx draws them as rows, and 44 px
            // pushed each bullet off its text. Important, as the row's own rule is the same layer.
            markdown: { base: { ":is(*) li": { minHeight: "0 !important" } } },
            // A session's tool calls, and their group's header, open with a tap on their row.
            "chat-tool-calls": {
              base: { ':is(*) [role="button"]': { minHeight: "var(--size-element-md)" } },
            },
            // A switch's row, which a tap anywhere toggles, as tall as a control.
            "switch-field": { base: { display: "grid", minHeight: "var(--size-element-md)" } },
            // A crumb as tall as a control; its link fills it (`Crumbs.tsx`).
            "breadcrumb-item": { base: { minHeight: "var(--size-element-md)" } },
            // A field's clear button, 20 px in Astryx, as tall and wide as a control inside it.
            "text-input": {
              base: {
                ":is(*) button": {
                  minHeight: "var(--size-element-md)",
                  minWidth: "var(--size-element-md)",
                },
              },
            },
            // The neutral theme draws a segment 8 px shorter than a control, inside its track.
            "segmented-control-item": {
              "size:lg": { height: "var(--size-element-lg)" },
              "size:md": { height: "var(--size-element-md)" },
              "size:sm": { height: "var(--size-element-sm)" },
            },
          },
          tokens: {
            ...fontSizes,
            "--size-element-lg": "44px",
            "--size-element-md": "44px",
            "--size-element-sm": "44px",
          },
          typography: { scale: typeScale },
        },
        when: { pointer: "coarse" },
      },
    ],
    // The UI layout decision's classes: narrow below 768 px, semi-wide to 1280, wide from it.
    widthBreakpoints: { md: 768, xl: 1280 },
  },
  components: {
    // Inline code a step smaller than the text around it, as the monospace font runs wider than the
    // reading font: a path fits the phone's column, where WebKit let a code span's padding pass it.
    code: { base: { fontSize: "0.9em" } },
    // Square badges and switches, as the terminal look's corners; status dots stay round.
    badge: { base: { "--radius-full": "0px" } },
    switch: { base: { "--radius-full": "0px" } },
    // Astryx gap: the lightbox's Close is a ghost button, its icon the colour of text on dark, with
    // no background of its own: over a light screenshot that fills the window, it vanished. The
    // scrim Astryx's thumbnails put under their remove button keeps it seen over any image.
    // Important, as the ghost button's own transparent background may be emitted outside any
    // layer, where it wins over the theme's.
    lightbox: {
      base: { ":is(*) button": { backgroundColor: "var(--color-overlay) !important" } },
    },
    // Astryx gap: a tool call's name and target are cut with an ellipsis at the row's edge, with no
    // prop to wrap them, and StyleX cannot reach them. The theme, which owns component overrides,
    // wraps them, so a run's log shows a long path or command whole on the phone (the UI checks
    // decision's "no text cut"). The `:is(*)` key is how the theme appends a descendant selector.
    "chat-tool-calls": {
      base: {
        ":is(*) span": { overflowWrap: "anywhere", whiteSpace: "normal" },
        maxWidth: "100%",
        minWidth: "0",
        // The tool's name, after its status icon, keeps its width. Important, as the app's own
        // StyleX may emit Astryx's atomic `flex-shrink: 1` class outside any layer, where it wins
        // over the theme's layer: then an ellipsis cuts the name by a fraction of a pixel.
        ":is(*) span:nth-child(2)": { flexShrink: "0 !important" },
      },
    },
  },
  extends: neutralTheme,
  // The neutral theme's icons, and the app's own (R6: the paperclip).
  icons: uraedaIcons,
  localTokens: {
    // Reading text: paragraphs of documents, questions, and stories.
    "--text-reading-line": "1.5",
    "--text-reading-size": "19px",
    // Prose's font, a proportional one where long text reads better than in the monospace font.
    "--font-family-reading":
      '"Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    // Catppuccin's lavender, a hue Astryx has no name for.
    "--color-text-lavender": pair("lavender"),
    // The fills of the neutral theme's badges, status dots, and progress bars, and an info banner's
    // background.
    "--astryx-theme-neutral-color-status-fill-accent": pair("mauve"),
    "--astryx-theme-neutral-color-status-fill-error": pair("red"),
    "--astryx-theme-neutral-color-status-fill-success": pair("green"),
    "--astryx-theme-neutral-color-status-fill-warning": pair("yellow"),
    "--astryx-theme-neutral-color-status-muted-accent": tint("blue"),
    // About 110 characters of text a line: `ch` is the width of a "0", wider than most letters, so
    // 86ch of Inter holds about 110 of them. The layout checks hold reading text to it.
    "--size-reading-measure": "86ch",
    // A page's column on wide screens, which holds the reading measure and the rows beside it.
    "--size-page-max": "720px",
    // A session's column on wide screens: about 115 characters a line.
    "--size-session-max": "95ch",
    // The detail pane beside a list on wide screens: at least this wide, and at most the window's
    // height, scrolling on its own.
    "--size-pane-min": "400px",
    "--size-viewport-height": "100dvh",
    // An image in a document or a message: a tall screenshot stays shorter than the window.
    "--size-image-max-height": "80dvh",
    // A chat message's image, a preview the human opens full screen.
    "--size-message-image": "120px",
    // The chat composer's field at its smallest: 7 rows of Astryx's composer lines, 22 px at every
    // size.
    "--size-composer-input": "154px",
    // The same field on the phone: 3 rows, since width is what a phone's reading lacks, not height.
    "--size-composer-input-narrow": "66px",
    // The round's index, a column beside its questions on wide screens, narrow enough that the
    // questions keep 600 px at 1200 px beside the sidebar (R5).
    "--size-round-index": "230px",
    // The accent line of a follow-up's card, 4 px: `--spacing-1` is 4.8 px at 120%.
    "--size-round-accent": "4px",
    // A question card at least this wide puts its options beside its title and context.
    "--size-round-split": "840px",
    // About 75 characters of text a line, on the round page and the triage, which hold their
    // reading text to it in place of the reading measure.
    "--size-round-measure": "75ch",
    // The settings page's list of categories, beside the open category on wide screens.
    "--size-settings-index": "240px",
    // The session's column of progress and changes, beside its transcript on wide screens.
    "--size-session-aside": "320px",
    // The repository menu's popover on wide screens, and the add form's field in the first run.
    "--size-form": "560px",
    "--size-menu": "360px",
    // The ＋ forms' dialog: its buttons, "Attach an image" to "Add and commit ↵", on one line.
    "--size-quick-add": "640px",
    // A story's frames: the phone's width, the desktop's, scaled to the space left, the height of a
    // story that never reports its own, and the most any frame grows to, a desktop window's 900 px:
    // a story as tall as its window grows the frame with each size it reports, up to it (R55).
    "--size-story-desktop": "1440px",
    "--size-story-height": "560px",
    "--size-story-max-height": "900px",
    "--size-story-phone": "402px",
    // The selected block of a review: a yellow tint, and a bar that stands 3:1 from the card
    // (WCAG 1.4.11).
    "--color-selection": "var(--color-background-yellow)",
    "--color-selection-edge": "var(--color-border-yellow)",
  },
  name: "uraeda",
  syntax: defineSyntaxTheme({
    name: "catppuccin",
    tokens: {
      attribute: pair("yellow"),
      background: pair("mantle"),
      comment: pair("dim"),
      constant: pair("peach"),
      function: pair("blue"),
      keyword: pair("mauve"),
      number: pair("peach"),
      operator: pair("cyan"),
      property: pair("lavender"),
      punctuation: pair("dim"),
      string: pair("green"),
      tag: pair("red"),
      type: pair("yellow"),
      variable: pair("text"),
    },
  }),
  tokens: {
    ...fontSizes,
    ...grown,
    ...hues,
    "--color-accent": pair("mauve"),
    // A selected row's background: a mauve tint, apart from the muted background.
    "--color-accent-muted": [mix(LATTE.mauve, 0.1, LATTE.base), mix(MOCHA.mauve, 0.14, MOCHA.base)],
    "--color-background-body": pair("base"),
    "--color-background-card": pair("base"),
    "--color-background-gray": [LATTE.crust, MOCHA.surface0],
    "--color-background-muted": [LATTE.mantle, MOCHA.crust],
    "--color-background-popover": pair("mantle"),
    "--color-background-surface": pair("mantle"),
    // Panes' and dividers' lines, and the 3:1 border of a control.
    "--color-border": pair("surface1"),
    "--color-border-emphasized": pair("overlay"),
    "--color-border-gray": pair("surface2"),
    "--color-error": pair("red"),
    "--color-error-muted": tint("red"),
    "--color-icon-accent": pair("mauve"),
    "--color-icon-disabled": pair("overlay"),
    "--color-icon-gray": [LATTE.overlay, MOCHA.dim],
    "--color-icon-primary": pair("text"),
    "--color-icon-secondary": [LATTE.subtext0, MOCHA.subtext0],
    "--color-neutral": [`${LATTE.text}0f`, `${MOCHA.text}1a`],
    "--color-on-accent": ON,
    "--color-on-dark": LATTE.base,
    "--color-on-error": ON,
    "--color-on-light": MOCHA.crust,
    "--color-on-success": ON,
    "--color-on-warning": ON,
    "--color-overlay": [`${LATTE.text}80`, `${MOCHA.crust}cc`],
    "--color-overlay-hover": [`${LATTE.text}0d`, `${MOCHA.text}0d`],
    "--color-overlay-pressed": [`${LATTE.text}1a`, `${MOCHA.text}1a`],
    "--color-shadow": [`${LATTE.text}1a`, `${MOCHA.crust}4d`],
    "--color-skeleton": [LATTE.surface0, MOCHA.surface1],
    "--color-success": pair("green"),
    "--color-success-muted": tint("green"),
    "--color-text-accent": pair("mauve"),
    "--color-text-disabled": pair("dim"),
    "--color-text-gray": [LATTE.text, MOCHA.subtext1],
    "--color-text-primary": pair("text"),
    "--color-text-secondary": [LATTE.subtext1, MOCHA.subtext0],
    "--color-warning": pair("yellow"),
    "--color-warning-muted": tint("yellow"),
    // Square corners; `--radius-full` stays round for dots and avatars.
    "--radius-container": "0px",
    "--radius-element": "0px",
    "--radius-inner": "0px",
    "--radius-page": "0px",
    // Flat: a pane stands apart by its border, not a shadow.
    "--shadow-high": "none",
    "--shadow-low": "none",
    "--shadow-med": "none",
  },
  typography: {
    body: { fallbacks: MONO, family: "JetBrains Mono Variable" },
    code: { fallbacks: MONO, family: "JetBrains Mono Variable" },
    heading: { fallbacks: MONO, family: "JetBrains Mono Variable" },
    scale: typeScale,
  },
});
