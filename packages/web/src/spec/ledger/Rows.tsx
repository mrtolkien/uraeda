// A decision's parts, as its ledger draws them: a part, tappable for a comment while the spec waits
// for review, and a fold of parts, open while one holds a pending comment or the selection.
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import {
  borderVars,
  colorVars,
  radiusVars,
  sizeVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { PartChange } from "uraeda-binding";
import { Tappable } from "../../Selection.tsx";
import { useOpenKeys } from "../../useOpenKeys.ts";
import { PartText } from "../RuleLine.tsx";
import { type Context, holds, rangeOf } from "./context.ts";
import { KindBadge } from "./KindBadge.tsx";

const styles = stylex.create({
  foldLabel: {
    // A fold's label, its row a control's height for a finger, as a story's "More scenarios" is.
    alignItems: "center",
    display: "flex",
    minHeight: sizeVars["--size-element-md"],
  },
  removed: {
    // A part removed whole: a red tint over it, its words readable, never struck, inside a dashed
    // red edge that stands 3:1 from the card, as a pale tint alone does not (WCAG 1.4.11).
    backgroundColor: colorVars["--color-background-red"],
    borderColor: colorVars["--color-icon-red"],
    borderRadius: radiusVars["--radius-element"],
    borderStyle: "dashed",
    borderWidth: borderVars["--border-width"],
    padding: spacingVars["--spacing-2"],
  },
});

/** A part: its pill when changed or added, its text, tappable while the spec waits for review. */
export function Part({ context, part }: { context: Context; part: PartChange }) {
  const { heading, intent, name, parts, whole } = context;
  const range = rangeOf(name, heading, part);
  const removed = part.kind === "removed";
  const pill = !whole && (part.kind === "changed" || part.kind === "added");
  const text = (
    <VStack gap={1} xstyle={removed && styles.removed}>
      {pill && (
        <HStack>
          <KindBadge kind={part.kind} />
        </HStack>
      )}
      <PartText
        check={part.check}
        intent={intent}
        runs={part.runs}
        strength={part.strength}
        whole={part.kind === "added" || removed}
      />
    </VStack>
  );
  if (!parts || !range) {
    return text;
  }
  return (
    <Tappable
      after={parts.after(range)}
      lines={`${range.start}-${range.end}`}
      onTap={(element) => parts.onTap(range, element)}
      pressed={parts.isSelected(range)}
    >
      {text}
    </Tappable>
  );
}

/**
 * Parts folded behind a label, open while one holds a pending comment or the selection, or as the
 * history entry keeps it by `foldKey`, for Back and reloads.
 */
export function Fold({
  context,
  foldKey,
  label,
  parts,
}: {
  context: Context;
  foldKey: string;
  label: ReactNode;
  parts: ReadonlyArray<PartChange>;
}) {
  const keys = useOpenKeys();
  const held = parts.some((part) => {
    const range = rangeOf(context.name, context.heading, part);
    return holds(context.comments, range) || (!!range && !!context.parts?.isSelected(range));
  });
  return (
    <Collapsible
      chevronPosition="start"
      isOpen={keys.open.includes(foldKey) || held}
      onOpenChange={(isOpen: boolean) => keys.onOpenChange(foldKey, isOpen)}
      trigger={<span {...stylex.props(styles.foldLabel)}>{label}</span>}
    >
      <VStack gap={2}>
        {parts.map((part, index) => (
          <Part context={context} key={index} part={part} />
        ))}
      </VStack>
    </Collapsible>
  );
}
