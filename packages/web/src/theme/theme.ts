// The app's theme: Astryx's neutral theme, sized by the UI layout decision. Built into `built/` by
// `vp run --filter uraeda-web theme`: edit this file, then rebuild, and commit both.
import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";
// A package import, `package.json`'s `imports`: the theme's build copies the specifier into
// `built/uraeda.js` as it is written, where a relative path would not resolve.
import { uraedaIcons } from "#theme-icons";

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
  adaptations: {
    rules: [
      {
        value: {
          localTokens: { "--size-page-max": "1200px", "--text-reading-size": "19px" },
          tokens: grown,
          typography: { scale: { base: BASE * WIDE } },
        },
        when: { width: { from: "lg" } },
      },
      // Last, so a wide touch screen keeps 44 px controls.
      {
        value: {
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
              "size:lg": { height: "var(--size-element-lg)" },
              "size:md": { height: "var(--size-element-md)" },
              "size:sm": { height: "var(--size-element-sm)" },
            },
          },
          tokens: {
            "--size-element-lg": "44px",
            "--size-element-md": "44px",
            "--size-element-sm": "44px",
          },
        },
        when: { pointer: "coarse" },
      },
    ],
  },
  components: {
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
    "--text-reading-size": "17px",
    // About 110 characters of text a line: `ch` is the width of a "0", wider than most letters, so
    // 90ch holds about 110 of them. The layout checks hold reading text to it.
    "--size-reading-measure": "90ch",
    // A page's column on wide screens, which holds the reading measure and the rows beside it.
    "--size-page-max": "720px",
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
    // The round's index, a column beside its questions on wide screens.
    "--size-round-index": "240px",
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
    // The selected block of a review: an amber tint and bar, apart from the muted background. The
    // bar stands 3:1 from the card (WCAG 1.4.11): the neutral theme's light yellow border, #e3c36c,
    // reads 1.7:1 on white, so light takes the data palette's darkest yellow, #8a5001, 6.5:1.
    "--color-selection": "var(--color-background-yellow)",
    "--color-selection-edge": "light-dark(var(--color-data-yellow-5), var(--color-border-yellow))",
  },
  name: "uraeda",
  tokens: {
    // A selected row's background. The neutral theme's dark value is its surface's, #262626, so the
    // row open in a pane did not show apart from the list; #303030 is its grey background, which
    // shows on the surface and on the sidebar's #1b1b1b. Light is the neutral theme's.
    "--color-accent-muted": ["#f1f1f1", "#303030"],
    // Secondary text, lighter in dark than the neutral theme's #9e9e9e, which reads at 4.1:1 on a
    // segmented control's track: #a8a8a8 reaches WCAG AA's 4.5:1 there. Light is the neutral theme's.
    "--color-text-secondary": ["#474747", "#a8a8a8"],
  },
});
