// Text set in a box's top border, as a pane's title, a card's marks, or an option's letter are:
// centred on the border, hiding it behind it with the surface the box sits on. Every such legend
// starts from these styles, so they sit the same way (UI look, UI coherence).
import { colorVars, spacingVars, typeScaleVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

export const legendStyles = stylex.create({
  // On the border's middle line, at the box's start, its room the border's run behind it.
  legend: {
    insetBlockStart: 0,
    insetInlineStart: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-1"],
    position: "absolute",
    transform: "translateY(-50%)",
  },
  // Over the page's background, as a pane on the page.
  onBody: { backgroundColor: colorVars["--color-background-body"] },
  // Over a card's background, as an option in a question's card.
  onCard: { backgroundColor: colorVars["--color-background-card"] },
  // At a pane title's size.
  text: {
    fontSize: typeScaleVars["--text-supporting-size"],
    lineHeight: typeScaleVars["--text-supporting-leading"],
  },
});
