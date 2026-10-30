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
 * Catppuccin, from the terminal-2 prototype's palette (see `specs/done/2026-10-20-layout-look.md`):
 * Latte in the light slot of each pair, Mocha in the dark one. Latte's accents, used as text, are
 * darker steps than Catppuccin's own, which read at about 3:1 on its base; the dim text is a step
 * past the mockup's in both, for 4.5:1 on a selected row. `theme-tokens.test.ts` measures every pair.
 */
const LATTE = {
  base: "#eff1f5",
  blue: "#1957d5",
  crust: "#dce0e8",
  cyan: "#0a688e",
  dim: "#5f6276",
  green: "#2c6f1f",
  lavender: "#4254c8",
  mantle: "#e6e9ef",
  mauve: "#7b2fe0",
  overlay: "#7c7f93",
  peach: "#a63f00",
  pink: "#a72592",
  red: "#bc0d33",
  sapphire: "#04699a",
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
  dim: "#969db8",
  green: "#a6e3a1",
  lavender: "#b4befe",
  mantle: "#181825",
  mauve: "#cba6f7",
  overlay: "#6c7086",
  peach: "#fab387",
  pink: "#f5c2e7",
  red: "#f38ba8",
  sapphire: "#74c7ec",
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
    // Buttons and badges in the UI's font, where Astryx has them inherit it: inside reading text,
    // a control keeps the monospace font (the UI look decision).
    button: { base: { fontFamily: "var(--font-family-body)" } },
    // Square badges, status dots, switches and progress bars, as the terminal look's corners.
    badge: { base: { "--radius-full": "0px", fontFamily: "var(--font-family-body)" } },
    // A markdown list as a document's (`BlockList.tsx`), through prose's rhythm: on the text's
    // edge, its items' text the list room in, its bullet in the room's end, in the secondary colour
    // of a document's markers, and no room between items but the item gap. Astryx draws its items
    // as rows, which StyleX cannot reach inside: the theme does, with `:is(*)` for a descendant.
    // Important, as the rows' atomic padding and gaps may be emitted outside any layer, where they
    // win over the theme's.
    markdown: {
      base: {
        ":is(*) li": {
          columnGap: "0 !important",
          marginBlockEnd: "var(--prose-item-gap)",
          padding: "0 !important",
        },
        ":is(*) li:last-child": { marginBlockEnd: "0" },
        // The bullet's box: the list room, the bullet at its end, the bullet gap before the text.
        ":is(*) li > span:first-child": {
          justifyContent: "flex-end !important",
          paddingInlineEnd: "var(--prose-bullet-gap)",
          width: "var(--prose-list-room) !important",
        },
        ":is(*) li > span:first-child > span:only-child": {
          backgroundColor: "var(--color-text-secondary) !important",
        },
        ":is(*) ul, :is(*) ol": { marginInline: "0 !important", rowGap: "0 !important" },
      },
    },
    "progress-bar": { base: { "--radius-full": "0px" } },
    "status-dot": { base: { "--radius-full": "0px" } },
    switch: { base: { "--radius-full": "0px" } },
    // A popover, a menu's included, stands apart by a border, as a terminal's floating window does,
    // where the flat look sets every shadow to none and left its text floating over the page.
    popover: {
      base: {
        borderColor: "var(--color-border)",
        borderStyle: "solid",
        borderWidth: "var(--border-width)",
      },
    },
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
    // wraps them, so a run's log shows a long path or command whole on the phone. The `:is(*)` key
    // is how the theme appends a descendant selector.
    // Important, as the shell's panes emit Astryx's atomic `white-space: nowrap` class outside any
    // layer, where it would win over the theme's layer, as `flex-shrink` below.
    "chat-tool-calls": {
      base: {
        ":is(*) span": { overflowWrap: "anywhere", whiteSpace: "normal !important" },
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
    "--text-reading-line": "1.4",
    "--text-reading-size": "19px",
    // Prose's rhythm, a document's and every markdown text's, an agent's message included
    // (`Prose.tsx`'s `proseRhythm`, the `markdown` rule above): the room between paragraphs, around
    // a list and between its items; a list's room for its bullets (`marks.stylex.ts`), and a
    // drawn bullet's gap before the text, about where the browser's own disc sits.
    "--prose-bullet-gap": "0.5em",
    "--prose-item-gap": "var(--spacing-2)",
    "--prose-list-room": "1.25em",
    "--prose-paragraph-gap": "var(--spacing-3)",
    // A pane's title in its border, and what is set like it: between the supporting text's size
    // and the body's, so it holds its own over the pane's text.
    "--text-title-size": "calc((var(--font-size-sm) + var(--font-size-base)) / 2)",
    // Prose's font, a proportional one where long text reads better than in the monospace font.
    "--font-family-reading":
      '"Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    // Catppuccin's lavender, a hue Astryx has no name for.
    "--color-text-lavender": pair("lavender"),
    // Catppuccin's teal, the fill of a sub-agent's mark, apart from its session's blue and from the
    // red of what is wrong. Latte's own teal, not the darker step its text takes: a mark stands
    // 3:1 from the page, as a control does.
    "--color-fill-teal": ["#179299", MOCHA.teal],
    // Catppuccin's sapphire, a live window's border and title, apart from the panes' lavender.
    "--color-border-sapphire": pair("sapphire"),
    "--color-text-sapphire": pair("sapphire"),
    // The fills of the neutral theme's badges, status dots, and progress bars, and an info banner's
    // background.
    "--astryx-theme-neutral-color-status-fill-accent": pair("mauve"),
    "--astryx-theme-neutral-color-status-fill-error": pair("red"),
    "--astryx-theme-neutral-color-status-fill-success": pair("green"),
    "--astryx-theme-neutral-color-status-fill-warning": pair("yellow"),
    "--astryx-theme-neutral-color-status-muted-accent": tint("blue"),
    // About 80 characters of prose a line: 60 of Inter's "0", at the reading size. Inter's "0" is
    // 0.631 em, and its average character in English prose, spaces included, 0.471 em, three
    // quarters of it, so 60 of them hold about 80 characters (59.7 for 80, measured on the
    // repository's prose). A length of the reading size, not `60ch`: `ch` and `em` resolve in the
    // font of the element that uses them, and a pane, in the UI's monospace font, sizes itself on
    // this measure too (`--size-reading-pane`). The layout checks hold reading text to it.
    "--size-reading-measure": "calc(37.85 * var(--text-reading-size))",
    // A pane of prose's widest on wide screens: the reading measure, its inset at each side, and
    // its border, so that its text fills it and ends at its border. The inset is the theme's,
    // `--spacing-3`, as a reading page sets no narrower one: a custom property's `var()` resolves
    // where it is declared, not in the pane.
    "--size-reading-pane":
      "calc(var(--size-reading-measure) + 2 * var(--spacing-3) + 2 * var(--border-width))",
    // A page's column on wide screens, which holds the reading measure and the rows beside it.
    "--size-page-max": "720px",
    // A session's column on wide screens: about 115 characters a line.
    "--size-session-max": "95ch",
    // The detail pane beside a list on wide screens: at least this wide, and at most the window's
    // height, scrolling on its own.
    "--size-pane-min": "400px",
    // The detail overlay of a proposal or a note on wide screens: 108 characters of the page's font
    // wide (the page's font is monospace, so `ch` is one character), and 60% of the window tall.
    "--size-detail": "108ch",
    "--size-detail-height": "60dvh",
    // The decisions' palette on wide and semi-wide screens: its list, about 30 characters wide,
    // and the preview of the entry under the cursor beside it, in a dialog that leaves the page's
    // edges in view.
    "--size-palette": "min(1024px, 92vw)",
    "--size-palette-height": "min(600px, 76dvh)",
    "--size-palette-list": "360px",
    "--size-viewport-height": "100dvh",
    // An image in a document or a message: a tall screenshot stays shorter than the window.
    "--size-image-max-height": "80dvh",
    // A chat message's image, a preview the human opens full screen.
    "--size-message-image": "120px",
    // An inbox note's image, under its selected row: twice a message's, to be read in place.
    "--size-note-image": "240px",
    // The chat composer's field at its smallest: 7 rows of Astryx's composer lines, 22 px at every
    // size.
    "--size-composer-input": "154px",
    // The same field on the phone: 3 rows, since width is what a phone's reading lacks, not height.
    "--size-composer-input-narrow": "66px",
    // The accent line of a follow-up's card, 4 px: `--spacing-1` is 4.8 px at 120%.
    "--size-round-accent": "4px",
    // A question card at least this wide puts its options beside its title and context.
    "--size-round-split": "840px",
    // The settings page's search field, at the end of its heading row on wide screens.
    "--size-settings-search": "240px",
    // The shell's rail: its icons' column, folded, and on semi-wide screens.
    "--size-rail": "52px",
    // The rail's inset, which centres a button in it: the column's rows keep the same edge.
    "--size-rail-inset": "calc((var(--size-rail) - var(--size-element-md)) / 2)",
    // One line of a nav row's label: a card's icon and status sit on its name's first line.
    "--size-label-line": "calc(var(--text-label-size) * var(--text-label-leading))",
    // A form's field, as the add form's in the first run, and the sign-in's.
    "--size-form": "560px",
    // A picker with no preview beside its list, the repositories' on wide and semi-wide screens: as
    // wide as the ＋ forms' dialog, and, as the palette, leaving the page's edges in view.
    "--size-picker": "min(640px, 92vw)",
    // The ＋ forms' dialog: its buttons, "Attach an image" to "Add as a file", on one line.
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
    // Panes' and dividers' lines, and the border of a control, each 3:1 from the backgrounds (the UI
    // look decision): Mocha's overlay0 and Latte's overlay2, Catppuccin's lightest steps that reach it.
    "--color-border": pair("overlay"),
    "--color-border-emphasized": pair("overlay"),
    // The "Later" edge of a list too: 3:1 like every border, so as strong as "Next"'s; its heading's
    // secondary text is what makes it the dimmer one.
    "--color-border-gray": pair("overlay"),
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
    // A scrim: dialogs' backdrop, and under the on-dark icon over media, 3:1 over a white image.
    "--color-overlay": [`${LATTE.text}b3`, `${MOCHA.crust}cc`],
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
    // Square corners; `--radius-full` stays round for avatars, as the components that square theirs
    // set it apart (`components` above).
    "--radius-chat": "0px",
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
