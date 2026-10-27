// A row's whole content in a pane just below it, as Enter shows it: a floating pane that is
// no dialog, on a surface of its own with a blue border, so that it reads as laid over the list. It
// takes no focus and holds no keys: the list's keys go on moving the selection, and the pane follows
// the selected row; Escape or Enter again closes it (see `WorkList`).
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useLayoutEffect, useRef } from "react";
import type { WorkRow } from "./Card.tsx";

const styles = stylex.create({
  // Over the cards, under the dialogs; placed by `place`, from the row's own box.
  box: {
    // A lighter surface than the cards', and the blue of the theme's text, not its dim border.
    backgroundColor: colorVars["--color-background-gray"],
    borderColor: colorVars["--color-text-blue"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    boxShadow: "0 6px 20px rgb(0 0 0 / 0.35)",
    boxSizing: "border-box",
    padding: spacingVars["--spacing-3"],
    position: "fixed",
    zIndex: 5,
  },
  line: { display: "flex", gap: spacingVars["--spacing-2"] },
});

/** The gap between the row and its pane, and the least room kept to the window's edges. */
const GAP = 6;

/** The pane's width, in the manner of an editor's hover: long, whatever the row's. */
const WIDTH = 600;

/** How far its left edge is shifted right of the row's, so that it reads as hovering over it. */
const SHIFT = 32;

/**
 * Puts `box` under the row `key`, 600 px wide and shifted right of the row's left edge; over the
 * row when there is no room under it, and kept inside the window.
 */
function place(box: HTMLElement, key: string) {
  const row = document.querySelector(`[data-row-key="${CSS.escape(key)}"]`);
  if (!row) {
    return;
  }
  const at = row.getBoundingClientRect();
  const width = Math.min(WIDTH, window.innerWidth - 2 * GAP);
  box.style.width = `${width}px`;
  const height = box.offsetHeight;
  const below = at.bottom + GAP;
  const top = below + height <= window.innerHeight - GAP ? below : at.top - GAP - height;
  box.style.left = `${Math.max(GAP, Math.min(at.left + SHIFT, window.innerWidth - width - GAP))}px`;
  box.style.top = `${Math.max(GAP, top)}px`;
}

/**
 * The pane of `row`, whole: its text with its formatting, and every child line. It follows the row
 * as the list scrolls or the window resizes.
 */
export function Peek({ row }: { row: WorkRow }) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) {
      return undefined;
    }
    const follow = () => place(element, row.key);
    follow();
    window.addEventListener("resize", follow);
    // Any scroller: the page, or the row of columns.
    window.addEventListener("scroll", follow, true);
    return () => {
      window.removeEventListener("resize", follow);
      window.removeEventListener("scroll", follow, true);
    };
  }, [row]);
  return (
    <div ref={box} {...stylex.props(styles.box)}>
      <VStack gap={2}>
        <Text display="block">{row.label ?? row.text}</Text>
        {row.lines.map((line, at) => (
          <span key={at} {...stylex.props(styles.line)}>
            <span aria-hidden="true">•</span>
            <Text color="secondary" display="block">
              {line}
            </Text>
          </span>
        ))}
      </VStack>
    </div>
  );
}
