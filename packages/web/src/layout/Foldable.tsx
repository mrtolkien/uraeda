// A fold: a toggle that opens what it holds, as a document's folds, a story's other scenarios, or a
// banner's message do. Every fold in a page's text is drawn here, so a toggle looks and reads the
// same on every page (UI coherence), and what it holds is mounted only while open (UI behaviour).
// A session's Activity rows fold their output their own way, as rows of a log (`ActivityRows.tsx`).
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { sizeVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import { proseStyles } from "../Prose.tsx";

const styles = stylex.create({
  // The toggle's label, its row a control's height for a finger.
  label: {
    alignItems: "center",
    display: "flex",
    minHeight: sizeVars["--size-element-md"],
  },
});

/**
 * A toggle named `label`, its chevron first, at the reading size, and what it holds under it while
 * open. Given `isOpen`, its caller keeps whether it is open, as in the address; without, it keeps
 * it itself, closed at first.
 */
export function Foldable({
  children,
  isOpen,
  label,
  onOpenChange,
}: {
  children: ReactNode;
  isOpen?: boolean;
  label: ReactNode;
  onOpenChange?: (isOpen: boolean) => void;
}) {
  const [own, setOwn] = useState(false);
  const open = isOpen ?? own;
  return (
    <Collapsible
      chevronPosition="start"
      isOpen={open}
      onOpenChange={(next: boolean) => {
        if (isOpen === undefined) {
          setOwn(next);
        }
        onOpenChange?.(next);
      }}
      trigger={<span {...stylex.props(styles.label, proseStyles.size)}>{label}</span>}
    >
      {open ? children : null}
    </Collapsible>
  );
}
