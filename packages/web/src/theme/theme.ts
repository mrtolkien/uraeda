// The app's theme: Astryx's neutral theme, sized by the UI layout decision. Built into `built/` by
// `vp run --filter uraeda-web theme`: edit this file, then rebuild, and commit both.
import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";

/** From 1024 px wide, text, controls, and spacing grow as at the browser's 120% zoom. */
const WIDE = 1.2;

// The neutral theme's sizes, Astryx's defaults (`@astryxdesign/core/theme/tokens.stylex`): its base
// font size, its spacing steps, and its element heights, in px. The theme build only accepts the
// neutral theme as the base to extend, so they are listed here; recheck them on an Astryx upgrade.
const BASE = 14;
const SPACING = {
  "0-5": 2,
  1: 4,
  "1-5": 6,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
};
const ELEMENTS = { sm: 28, md: 32, lg: 36 };

const px = (value: number) => `${Math.round(value * WIDE * 100) / 100}px`;

/** Every spacing and element-size token multiplied by `WIDE`. */
const grown = {
  ...Object.fromEntries(
    Object.entries(SPACING).map(([step, value]) => [`--spacing-${step}`, px(value)]),
  ),
  ...Object.fromEntries(
    Object.entries(ELEMENTS).map(([size, value]) => [`--size-element-${size}`, px(value)]),
  ),
};

export const uraedaTheme = defineTheme({
  name: "uraeda",
  extends: neutralTheme,
  tokens: {
    // Secondary text, lighter in dark than the neutral theme's #9e9e9e, which reads at 4.1:1 on a
    // segmented control's track: #a8a8a8 reaches WCAG AA's 4.5:1 there. Light is the neutral theme's.
    "--color-text-secondary": ["#474747", "#a8a8a8"],
  },
  localTokens: {
    // Reading text: paragraphs of documents, questions, and stories.
    "--text-reading-size": "17px",
    "--text-reading-line": "1.5",
    // About 110 characters of text a line: `ch` is the width of a "0", wider than most letters, so
    // 90ch holds about 110 of them. The layout checks hold reading text to it.
    "--size-reading-measure": "90ch",
    // A page's column on wide screens, which holds the reading measure and the rows beside it.
    "--size-page-max": "720px",
    // The detail pane beside a list on wide screens: at least this wide, and at most the window's
    // height, scrolling on its own.
    "--size-pane-min": "400px",
    "--size-viewport-height": "100dvh",
    // The round's index, a column beside its questions on wide screens.
    "--size-round-index": "240px",
    // The repository menu's popover on wide screens, and the add form's field in the first run.
    "--size-menu": "360px",
    "--size-form": "560px",
    // The selected block of a review: an amber tint and bar, apart from the muted background.
    "--color-selection": "var(--color-background-yellow)",
    "--color-selection-edge": "var(--color-border-yellow)",
  },
  components: {
    // Astryx gap: a tool call's name and target are cut with an ellipsis at the row's edge, with no
    // prop to wrap them, and StyleX cannot reach them. The theme, which owns component overrides,
    // wraps them, so a run's log shows a long path or command whole on the phone (the UI checks
    // decision's "no text cut"). The `:is(*)` key is how the theme appends a descendant selector.
    "chat-tool-calls": {
      base: {
        minWidth: "0",
        maxWidth: "100%",
        ":is(*) span": { whiteSpace: "normal", overflowWrap: "anywhere" },
        // The tool's name, after its status icon, keeps its width. Important, as the app's own
        // StyleX may emit Astryx's atomic `flex-shrink: 1` class outside any layer, where it wins
        // over the theme's layer: then an ellipsis cuts the name by a fraction of a pixel.
        ":is(*) span:nth-child(2)": { flexShrink: "0 !important" },
      },
    },
    // Astryx gap: a navigation row's label is cut with an ellipsis, with no prop to wrap it. The
    // theme wraps it, so a feature's or a chat's title shows whole in the sidebar, its row growing
    // past a control's height instead of overlapping the next.
    "side-nav-item": {
      base: {
        height: "auto",
        minHeight: "var(--size-element-md)",
        paddingBlock: "var(--spacing-1)",
        ":is(*) span": { whiteSpace: "normal", overflowWrap: "anywhere" },
      },
    },
  },
  adaptations: {
    rules: [
      {
        when: { width: { from: "lg" } },
        value: {
          typography: { scale: { base: BASE * WIDE } },
          tokens: grown,
          localTokens: { "--text-reading-size": "19px", "--size-page-max": "1200px" },
        },
      },
      // Last, so a wide touch screen keeps 44 px controls.
      {
        when: { pointer: "coarse" },
        value: {
          tokens: {
            "--size-element-sm": "44px",
            "--size-element-md": "44px",
            "--size-element-lg": "44px",
          },
          components: {
            // A row a finger taps is a control's height at least.
            item: { base: { minHeight: "var(--size-element-md)" } },
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
              "size:sm": { height: "var(--size-element-sm)" },
              "size:md": { height: "var(--size-element-md)" },
              "size:lg": { height: "var(--size-element-lg)" },
            },
          },
        },
      },
    ],
  },
});
