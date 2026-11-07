// The app's theme, the UI look decision's terminal look: Astryx's neutral theme in Catppuccin's
// colours, JetBrains Mono, square corners, and 120% sizes at every width. Built into `built/` by
// `vp run --filter uraeda-web theme`: edit this file, then rebuild, and commit both.
import { defineSyntaxTheme, defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";
// A package import, `package.json`'s `imports`: the theme's build copies the specifier into
// `built/uraeda.js` as it is written, where a relative path would not resolve.
import { uraedaIcons } from "#theme-icons";
import { MEDIA, type Roles, tokensOf } from "#theme-roles";
import { MEASURE, measureOf, WIDTHS } from "#theme-scale";

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
 * Catppuccin's roles, Latte's and Mocha's, as `crates/core/themes/` ships them, every role resolved
 * to its colour: the theme's build runs before the core's binding loads, so they are written here
 * too, and `theme-roles.test.ts` holds the two equal. The colours of every token come from them
 * through the mapping (`roles.ts`), the one the palette rule draws a picked theme with, so a
 * browser that never picked a theme draws Catppuccin as the shipped files do.
 */
const LATTE_ROLES: Roles = {
  action: "#7d26ed",
  added: "#2d711e",
  caution: "#875612",
  changed: "#7d26ed",
  chip: "#dce0e8",
  "code-ground": "#e6e9ef",
  "code-inline": "#a83e01",
  context: "#0a54e5",
  "cursor-row": "#e4ddf4",
  example: "#116a6f",
  "heading-1": "#7d26ed",
  "heading-2": "#0a54e5",
  "heading-3": "#2d711e",
  ink: "#4c4f69",
  "ink-faint": "#5e6173",
  "ink-quiet": "#5c5f77",
  link: "#0a54e5",
  live: "#177282",
  marked: "#875612",
  "mode-command": "#a83e01",
  "mode-insert": "#2d711e",
  "mode-normal": "#0a54e5",
  "mode-replace": "#be0e34",
  "mode-visual": "#7d26ed",
  "needs-you": "#a83e01",
  "on-action": "#ffffff",
  page: "#eff1f5",
  "pane-title": "#3654fc",
  quote: "#5c5f77",
  raised: "#e6e9ef",
  removed: "#be0e34",
  rule: "#7c7f93",
  "sub-agent": "#179299",
  sunken: "#e6e9ef",
  "syntax-attribute": "#875612",
  "syntax-comment": "#5e6173",
  "syntax-constant": "#a83e01",
  "syntax-function": "#0a54e5",
  "syntax-keyword": "#7d26ed",
  "syntax-number": "#a83e01",
  "syntax-operator": "#036991",
  "syntax-property": "#3654fc",
  "syntax-punctuation": "#5e6173",
  "syntax-string": "#2d711e",
  "syntax-tag": "#be0e34",
  "syntax-type": "#875612",
  "syntax-variable": "#4c4f69",
  working: "#0a54e5",
  yours: "#0a54e5",
};
const MOCHA_ROLES: Roles = {
  action: "#cba6f7",
  added: "#a6e3a1",
  caution: "#f9e2af",
  changed: "#cba6f7",
  chip: "#313244",
  "code-ground": "#181825",
  "code-inline": "#fab387",
  context: "#89b4fa",
  "cursor-row": "#36314a",
  example: "#94e2d5",
  "heading-1": "#cba6f7",
  "heading-2": "#89b4fa",
  "heading-3": "#a6e3a1",
  ink: "#cdd6f4",
  "ink-faint": "#979db5",
  "ink-quiet": "#a6adc8",
  link: "#89b4fa",
  live: "#74c7ec",
  marked: "#f9e2af",
  "mode-command": "#fab387",
  "mode-insert": "#a6e3a1",
  "mode-normal": "#89b4fa",
  "mode-replace": "#f38ba8",
  "mode-visual": "#cba6f7",
  "needs-you": "#fab387",
  "on-action": "#11111b",
  page: "#1e1e2e",
  "pane-title": "#b4befe",
  quote: "#a6adc8",
  raised: "#181825",
  removed: "#f38ba8",
  rule: "#6c7086",
  "sub-agent": "#94e2d5",
  sunken: "#11111b",
  "syntax-attribute": "#f9e2af",
  "syntax-comment": "#979db5",
  "syntax-constant": "#fab387",
  "syntax-function": "#89b4fa",
  "syntax-keyword": "#cba6f7",
  "syntax-number": "#fab387",
  "syntax-operator": "#89dceb",
  "syntax-property": "#b4befe",
  "syntax-punctuation": "#979db5",
  "syntax-string": "#a6e3a1",
  "syntax-tag": "#f38ba8",
  "syntax-type": "#f9e2af",
  "syntax-variable": "#cdd6f4",
  working: "#89b4fa",
  yours: "#89b4fa",
};

const LIGHT = tokensOf(LATTE_ROLES, "light");
const DARK = tokensOf(MOCHA_ROLES, "dark");

/** The tokens the theme declares as its own, which Astryx's token names do not include. */
const LOCAL =
  /^--(role-|astryx-theme-neutral-color-status-|color-(text-lavender|fill-teal|border-sapphire|text-sapphire|selection))/;
/** The syntax theme's tokens; a diff's lines and markers are Astryx's tokens. */
const SYNTAX = /^--color-syntax-(?!added|removed)/;

/** The mapped tokens `which` picks, each a `[latte, mocha]` pair. */
const colours = (which: (name: string) => boolean) =>
  Object.fromEntries(
    Object.keys(LIGHT)
      .filter(which)
      .map((name): [string, [string, string]] => [name, [LIGHT[name]!, DARK[name]!]]),
  );

/** The monospace fonts a machine has, while JetBrains Mono loads. */
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

export const uraedaTheme = defineTheme({
  adaptations: {
    rules: [
      // On the phone, prose a step smaller, as a chat app's messages on a phone: 16 px, where the
      // reading size's 19 px left too few words a line on a narrow screen.
      {
        value: { localTokens: { "--text-reading-size": "16px" } },
        when: { width: { below: "md" } },
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
        // Headings take their level's role (`layout/headings.ts`), by the level written: prose sets
        // `#` as an h4 (`Prose.tsx`), and deeper levels take the third's. Important, as Astryx's own
        // colour for them is an atomic class, which may be emitted outside any layer.
        ":is(*) h4": { color: "var(--role-heading-1) !important" },
        ":is(*) h5": { color: "var(--role-heading-2) !important" },
        ":is(*) h6": { color: "var(--role-heading-3) !important" },
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
    // The colours the theme names itself: lavender, teal, and sapphire, the status fills, the
    // selection, and the views' roles (R1).
    ...colours((name) => LOCAL.test(name)),
    // About 80 characters of prose a line: 60 of Inter's "0", at the reading size. Inter's "0" is
    // 0.631 em, and its average character in English prose, spaces included, 0.471 em, three
    // quarters of it, so 60 of them hold about 80 characters (59.7 for 80, measured on the
    // repository's prose). A length of the reading size, not `60ch`: `ch` and `em` resolve in the
    // font of the element that uses them, and a pane, in the UI's monospace font, sizes itself on
    // this measure too (`--size-reading-pane`). The layout checks hold reading text to it.
    "--size-reading-measure": measureOf(MEASURE),
    // The scale's widths made of it (`scale.ts`): a reading pane, big text, a split card, two panes.
    ...WIDTHS,
    // The scale's widths in characters of the UI's monospace font: a draft's editor's panes, the
    // formatter's 100 columns with the pane's and the field's room around them; a session's
    // column, about 115 characters a line.
    "--size-code": "108ch",
    "--size-session-max": "95ch",
    // What sits beside a setting's text, on a page of rows: its widest control, a 32 characters'
    // field (`OtherSettings.tsx`), and the gap before it.
    "--size-setting-control": "calc(32ch + var(--spacing-3))",
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
    // A buffer's text at least, on a short window: 12 lines, the page scrolling past it.
    "--size-buffer-min": "12lh",
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
  },
  name: "uraeda",
  syntax: defineSyntaxTheme({
    name: "catppuccin",
    tokens: Object.fromEntries(
      Object.entries(colours((name) => SYNTAX.test(name))).map(([name, pair]) => [
        name.slice("--color-syntax-".length),
        pair,
      ]),
    ),
  }),
  tokens: {
    ...fontSizes,
    ...grown,
    ...colours((name) => !LOCAL.test(name) && !SYNTAX.test(name)),
    // Text and icons over media, constants (R5).
    ...MEDIA,
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
