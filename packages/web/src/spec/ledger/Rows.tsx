// A decision's ledger's rows: a part, its sign first, `+` added, `~` changed, `−` removed, named for
// screen readers, then its words, tappable for a comment while the spec waits for review; and a
// fold of rows, which mounts nothing folded, open while it holds a pending comment or the
// selection, or as the history entry keeps it, for Back and reloads.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/VStack";
import {
  colorVars,
  fontWeightVars,
  sizeVars,
  spacingVars,
  typographyVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import type { PartChange } from "uraeda-binding";
import { linesMark, Tappable } from "../../Selection.tsx";
import { useOpenKeys } from "../../useOpenKeys.ts";
import { PartText } from "../RuleLine.tsx";
import { type Context, holds, rangeOf } from "./context.ts";

const styles = stylex.create({
  // A row's faint tint, its hue's icon colour over the pane, light enough that muted words keep
  // 4.5:1 on it over the page's darker surface on the phone: its sign and its marks say the rest.
  added: {
    backgroundColor: `color-mix(in srgb, ${colorVars["--color-icon-green"]} 6%, transparent)`,
  },
  changed: {
    backgroundColor: `color-mix(in srgb, ${colorVars["--color-icon-yellow"]} 6%, transparent)`,
  },
  // A fold's button, drawn as a muted line of the ledger, a control's height for a finger, its
  // label wrapping on a narrow screen rather than cut.
  fold: {
    color: colorVars["--color-text-secondary"],
    height: "auto",
    justifyContent: "start",
    minHeight: sizeVars["--size-element-md"],
    paddingInline: 0,
    textAlign: "start",
    whiteSpace: "normal",
  },
  foldLabel: {
    alignItems: "center",
    display: "flex",
    gap: spacingVars["--spacing-1"],
  },
  // A kept part reads muted on a summary card: the ledger's news is what changed.
  kept: { color: colorVars["--color-text-secondary"] },
  removed: {
    backgroundColor: `color-mix(in srgb, ${colorVars["--color-icon-red"]} 6%, transparent)`,
  },
  row: {
    paddingBlock: spacingVars["--spacing-1"],
    paddingInlineEnd: spacingVars["--spacing-1"],
  },
  // The sign's column, as wide for every row, so the words line up whether a row has one or not.
  sign: {
    // A character and a half of the code font, which StyleX's width values do not list.
    "--ledger-sign": "1.5em",
    flexShrink: 0,
    fontFamily: typographyVars["--font-family-code"],
    fontWeight: fontWeightVars["--font-weight-bold"],
    textAlign: "center",
    width: "var(--ledger-sign)",
  },
  signAdded: { color: colorVars["--color-text-green"] },
  signChanged: { color: colorVars["--color-text-yellow"] },
  signRemoved: { color: colorVars["--color-text-red"] },
  // A row's words take what the sign leaves.
  words: {
    flexGrow: 1,
    minWidth: 0,
  },
});

/** Each kind's sign, the name a screen reader reads for it, and its row's and its own colours. */
const KINDS: Record<
  string,
  { ink: stylex.StyleXStyles; label: string; mark: string; row: stylex.StyleXStyles }
> = {
  added: { ink: styles.signAdded, label: "Added", mark: "+", row: styles.added },
  changed: { ink: styles.signChanged, label: "Changed", mark: "~", row: styles.changed },
  removed: { ink: styles.signRemoved, label: "Removed", mark: "−", row: styles.removed },
};

/** A row's sign, by its part's kind: an empty column for a part kept. */
function Sign({ kind }: { kind: string }) {
  const sign = KINDS[kind];
  if (!sign) {
    return <span aria-hidden {...stylex.props(styles.sign)} />;
  }
  return (
    <span aria-label={sign.label} role="img" {...stylex.props(styles.sign, sign.ink)}>
      {sign.mark}
    </span>
  );
}

/** A part: its sign, its words, tappable while the spec waits for review. */
export function Part({ context, part }: { context: Context; part: PartChange }) {
  const { full, heading, intent, name, parts } = context;
  // Muted only where the ledger's news comes first: in the file's order, a kept part reads plain.
  const tint = KINDS[part.kind]?.row ?? (full ? undefined : styles.kept);
  const range = rangeOf(name, heading, part);
  const text = (
    <HStack align="start" gap={1} xstyle={[styles.row, tint]}>
      <Sign kind={part.kind} />
      <div {...stylex.props(styles.words)}>
        <PartText
          check={part.check}
          intent={intent}
          runs={part.runs}
          strength={part.strength}
          whole={part.kind === "added" || part.kind === "removed"}
        />
      </div>
    </HStack>
  );
  if (!parts || !range) {
    return text;
  }
  return (
    <Tappable
      after={parts.after(range)}
      lines={linesMark(range.start, range.end, range.decision)}
      onTap={(element) => parts.onTap(range, element)}
      pressed={parts.isSelected(range)}
    >
      {text}
    </Tappable>
  );
}

/** Whether a pending comment or the selection is on one of `parts`, under `heading`. */
export function holdsAny(
  context: Pick<Context, "comments" | "name" | "parts">,
  heading: string,
  parts: ReadonlyArray<PartChange>,
) {
  return parts.some((part) => {
    const range = rangeOf(context.name, heading, part);
    return holds(context.comments, range) || (!!range && !!context.parts?.isSelected(range));
  });
}

/**
 * Rows folded behind a label, open while `held`, unless the human closed it since, or as the
 * history entry keeps it by `foldKey`, for Back and reloads. Folded, its rows are not mounted.
 */
export function Fold({
  children,
  foldKey,
  held,
  label,
}: {
  children: ReactNode;
  foldKey: string;
  held: boolean;
  label: string;
}) {
  const keys = useOpenKeys();
  // Closed by the human while `held`, it stays closed until opened again, as a spec's fold does.
  const [shut, setShut] = useState(false);
  const isOpen = keys.open.includes(foldKey) || (held && !shut);
  return (
    <VStack gap={2}>
      <Button
        aria-expanded={isOpen}
        label={label}
        onClick={() => {
          setShut(isOpen);
          keys.onOpenChange(foldKey, !isOpen);
        }}
        size="sm"
        variant="ghost"
        xstyle={styles.fold}
      >
        <span {...stylex.props(styles.foldLabel)}>
          <Icon icon={isOpen ? "chevronDown" : "chevronRight"} size="sm" />
          {label}
        </span>
      </Button>
      {isOpen && children}
    </VStack>
  );
}
