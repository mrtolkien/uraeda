// A heading's colour by its level, the one home of the rule (US4 of Color themes): `#` takes the
// role `heading-1`, `##` `heading-2`, and `###` and deeper `heading-3`. A document's headings, a
// spec's sections, and a round's title take it; a message's markdown takes the same roles through
// the theme's `markdown` rule (`theme/theme.ts`), and the editor's through its highlighting
// (`fields/editor/markdown.ts`). A page's or a pane's title that is a document's heading takes it
// too (`PageTitle`'s `isDocumentHeading`, `Pane`'s `tint="heading"`), as the spec's `# Spec` and
// its stories' `###` panes; page, pane, and group titles that are not a document's headings keep
// their colours.
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  first: { color: "var(--role-heading-1)" },
  second: { color: "var(--role-heading-2)" },
  third: { color: "var(--role-heading-3)" },
});

/** The colour of a heading of `level`, 1 for `#`. */
export function headingStyle(level: number): stylex.StyleXStyles {
  if (level <= 1) {
    return styles.first;
  }
  return level === 2 ? styles.second : styles.third;
}
