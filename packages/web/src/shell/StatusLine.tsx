// The status line, one line at the bottom of the window at every width: the hints of the keys that
// work on the page (`statusHints.tsx`), the page's own controls (`TopBarSlot`, as the round's count
// and Next on the phone), then how many cards need the human and how many sessions run. An Astryx
// gap (plan, Complexity tracking): no component draws a status line. Astryx's `Kbd` writes keys in
// capitals, "J K", where the line writes them as typed. Its counts are not announced as they change:
// the column's panes and the tabs say them where they are read.
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import {
  borderVars,
  colorVars,
  fontWeightVars,
  spacingVars,
  typographyVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { useNavigation } from "../sessionData.ts";
import { needsYou } from "../sidebar/cards.ts";
import { type Data, entriesOf, runningSessions } from "../sidebar/entries.ts";
import { useDeclaredHints, useStatusLineCovered } from "../statusHints.tsx";

const styles = stylex.create({
  count: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    gap: spacingVars["--spacing-1"],
  },
  counts: {
    // At the line's end, whatever comes before. Short of room, as at 320 px beside a round's
    // controls, the counts wrap onto a second line, each whole, never cut or past the edge.
    alignItems: "center",
    columnGap: spacingVars["--spacing-4"],
    display: "flex",
    flexShrink: 1,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    marginInlineStart: "auto",
    minWidth: 0,
    rowGap: 0,
  },
  hint: {
    flexShrink: 0,
  },
  hints: {
    // The hints take the room the counts leave, and those past its end are cut, never wrapped.
    display: "flex",
    flexGrow: 1,
    gap: spacingVars["--spacing-4"],
    minWidth: 0,
    overflow: "hidden",
  },
  key: {
    color: colorVars["--color-text-orange"],
    // The UI's font, where a browser sets a `kbd` in its own monospace one.
    fontFamily: typographyVars["--font-family-body"],
    fontWeight: fontWeightVars["--font-weight-bold"],
  },
  line: {
    alignItems: "center",
    backgroundColor: colorVars["--color-background-muted"],
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    boxSizing: "border-box",
    display: "flex",
    gap: spacingVars["--spacing-4"],
    height: "var(--size-status-line)",
    insetBlockEnd: 0,
    insetInline: 0,
    paddingInline: spacingVars["--spacing-3"],
    position: "fixed",
    whiteSpace: "nowrap",
    zIndex: 2,
  },
  needs: {
    color: colorVars["--color-text-orange"],
  },
  slot: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    gap: spacingVars["--spacing-2"],
  },
});

/** How many cards of the shell's panes need the human: those its Needs you pane holds. */
function needsYouCount(data: Data) {
  return entriesOf(data, { found: undefined, query: "" }).filter((entry) => needsYou(entry.status))
    .length;
}

/** The hints, each its keys then what they do. */
function Hints() {
  const hints = useDeclaredHints();
  return (
    <div {...stylex.props(styles.hints)}>
      {hints.map((hint) => (
        <Text
          color="secondary"
          key={`${hint.keys} ${hint.label}`}
          type="supporting"
          xstyle={styles.hint}
        >
          <kbd {...stylex.props(styles.key)}>{hint.keys}</kbd> {hint.label}
        </Text>
      ))}
    </div>
  );
}

/** The counts: what needs the human, left out at none, and the running sessions. */
function Counts() {
  const data = useNavigation();
  const waiting = needsYouCount(data);
  return (
    <div {...stylex.props(styles.counts)}>
      {waiting > 0 && (
        <Text type="supporting" xstyle={[styles.count, styles.needs]}>
          {waiting} need you
        </Text>
      )}
      <Text color="secondary" type="supporting" xstyle={styles.count}>
        <Icon icon="uraeda:activity" size="sm" />
        {runningSessions(data)} running
      </Text>
    </div>
  );
}

/** The line: the hints, left out on the phone, which has no keys, or the page's slot, then the counts. */
export function StatusLine({ isNarrow, slot }: { isNarrow: boolean; slot: ReactNode }) {
  // Left out under a sheet that leaves the page usable, which rises from the same edge.
  const isCovered = useStatusLineCovered();
  if (isCovered) {
    return null;
  }
  return (
    <footer aria-label="Status line" {...stylex.props(styles.line)}>
      {!isNarrow && <Hints />}
      {slot !== null && <div {...stylex.props(styles.slot)}>{slot}</div>}
      <Counts />
    </footer>
  );
}
