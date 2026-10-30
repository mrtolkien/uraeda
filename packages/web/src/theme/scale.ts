// The scale of widths (the UI layout decision): every page and pane takes one of these, picked by
// what it holds, never a number of its own. The widths made of the reading measure follow the
// reading font and size the human picks: the theme declares them, and the fonts' root
// (`fonts.ts`) declares them again, as a token holding a `var()` takes its value where it is set.
// At the default fonts: a reading pane 692 px, big text 865 px, a split card about 1,080 px, two
// panes 1,424 px. The theme holds the others: the code's and a session's columns, in characters,
// and a setting's control.

/** About 80 characters of prose a line, in the reading size, at the default reading font. */
export const MEASURE = 37.85;

/** The reading measure, `measure` times the reading size: about 80 characters of prose. */
export const measureOf = (measure: number) => `calc(${measure} * var(--text-reading-size))`;

/** The widths made of the reading measure, by token. */
export const WIDTHS = {
  // A pane of prose's widest, and a page of rows' text column: the reading measure, its inset at
  // each side, and its border, so that its text fills it and ends at its border. The inset is the
  // theme's, `--spacing-3`, as a reading page sets no narrower one.
  "--size-reading-pane":
    "calc(var(--size-reading-measure) + 2 * var(--spacing-3) + 2 * var(--border-width))",
  // A pane of large text, a spec's decision card: a quarter wider, so its title, pills, and fields'
  // change keep to fewer lines.
  "--size-big-text": "calc(1.25 * var(--size-reading-pane))",
  // A question's card split in two: its question at about 50 characters a line and its options at
  // about 60, a measure and a half shared 5 to 6, with the gap between them, the card's padding,
  // and its border (`QuestionCard.tsx`).
  "--size-split-card":
    "calc(1.5 * var(--size-reading-measure) + var(--spacing-8) + 2 * var(--spacing-6) + 2 * var(--border-width))",
  // Two reading panes side by side and the gap between them: the home, New, a reading page.
  "--size-two-panes": "calc(2 * var(--size-reading-pane) + var(--spacing-4))",
} as const;
