// The status line, one line at the bottom of the window at every width: the hints of the keys that
// work on the page (the key registry's), the page's own controls (`TopBarSlot`, as the round's count
// and Next on the phone), then how many cards need the human and how many sessions run, left out
// where the page's controls leave them no room (R25 of the spec page), as the spec's Contents,
// count, and Verdict at 390 px: the phone's tabs show them too. An Astryx
// gap (plan, Complexity tracking): no component draws a status line. Astryx's `Kbd` writes keys in
// capitals, "J K", where the line writes them as typed. Its counts are not announced as they change:
// the column's panes and the tabs say them where they are read.
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, type RefObject, useRef } from "react";
import { navigate, sessionIdPath, useRepoPath } from "../routes.tsx";
import { useNavigation } from "../sessionData.ts";
import { type Entry, needsYouEntries, runningSessions } from "../sidebar/entries.ts";
import { statusPath } from "../sidebar/statusPath.ts";
import { useStatusLineCovered } from "../statusHints.tsx";
import { KeyCap } from "../keys/KeyCap.tsx";
import { keepFocus } from "../keys/press.ts";
import { useHints, usePress } from "../keys/registry.tsx";
import { useCountsFit } from "./useCountsFit.ts";
import { ruleStyles } from "../layout/rules.ts";

const styles = stylex.create({
  count: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    gap: spacingVars["--spacing-1"],
  },
  counts: {
    // At the line's end, whatever comes before. The hints give way to them first; short of room
    // still, where no hint shows, the counts wrap onto a second line, each whole, never cut or past
    // the edge; and where even the widest count has no room beside the page's controls, they are
    // left out (`useCountsFit`).
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
  countsLeftOut: {
    // Still laid out at its own width, where nothing sees it, to be measured again as room grows.
    insetInlineEnd: 0,
    pointerEvents: "none",
    position: "absolute",
    visibility: "hidden",
  },
  hint: {
    flexShrink: 0,
  },
  hints: {
    // The hints take the room the counts leave, from none, so they give way first, and those past
    // its end are cut, never wrapped.
    display: "flex",
    flexBasis: 0,
    flexGrow: 1,
    gap: spacingVars["--spacing-4"],
    minWidth: 0,
    overflow: "hidden",
  },
  line: {
    alignItems: "center",
    backgroundColor: colorVars["--color-background-muted"],
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
  press: {
    background: "none",
    border: "none",
    color: { ":hover": colorVars["--color-text-primary"], default: "inherit" },
    cursor: "pointer",
    font: "inherit",
    padding: 0,
  },
  slot: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    gap: spacingVars["--spacing-2"],
  },
});

/** Where the line's "need you" leads: the page of the one card that needs the human, else home. */
function needsYouPath(entries: Array<Entry>) {
  const [only] = entries;
  if (entries.length !== 1 || !only) {
    return "/";
  }
  return only.kind === "feature" ? statusPath(only.feature, only.status) : sessionIdPath(only.row.id);
}

/** The hints, each its keys then what they do, as the registry holds them. */
function Hints() {
  const hints = useHints();
  const press = usePress();
  return (
    <div {...stylex.props(styles.hints)}>
      {hints.map((hint) => (
        <Text
          color="secondary"
          key={`${hint.keys} ${hint.label}`}
          type="supporting"
          xstyle={styles.hint}
        >
          <button
            onClick={() => press(hint.press)}
            onMouseDown={keepFocus}
            type="button"
            {...stylex.props(styles.press)}
          >
            <KeyCap>{hint.keys}</KeyCap> {hint.label}
          </button>
        </Text>
      ))}
    </div>
  );
}

/**
 * The counts: what needs the human, left out at none, and the running sessions; hidden, still
 * measured, when `fits` is false.
 */
function Counts({ fits, measured }: { fits: boolean; measured: RefObject<HTMLDivElement | null> }) {
  const data = useNavigation();
  const here = useRepoPath();
  const entries = needsYouEntries(data);
  const waiting = entries.length;
  return (
    <div
      aria-hidden={fits ? undefined : true}
      ref={measured}
      {...stylex.props(styles.counts, !fits && styles.countsLeftOut)}
    >
      {waiting > 0 && (
        <Text type="supporting" xstyle={[styles.count, styles.needs]}>
          <button
            onClick={() => navigate(here(needsYouPath(entries)))}
            type="button"
            {...stylex.props(styles.press)}
          >
            {waiting} need you
          </button>
        </Text>
      )}
      <Text color="secondary" type="supporting" xstyle={styles.count}>
        <Icon icon="uraeda:activity" size="sm" />
        {runningSessions(data)} running
      </Text>
    </div>
  );
}

/** The line: on the phone, only the page's own controls, else the hints, the page's slot, then the counts. */
export function StatusLine({ isNarrow, slot }: { isNarrow: boolean; slot: ReactNode }) {
  return isNarrow ? <PhoneBar slot={slot} /> : <Line slot={slot} />;
}

/**
 * The phone's bar: only the page's own controls, such as a round's Next, and only while it has
 * any. The hints are for keys and the counts are on the tabs, Sessions' running and Home's need-you.
 */
function PhoneBar({ slot }: { slot: ReactNode }) {
  const isCovered = useStatusLineCovered();
  if (isCovered || slot === null) {
    return null;
  }
  return (
    <footer aria-label="Status line" {...stylex.props(ruleStyles.above, styles.line)}>
      <div {...stylex.props(styles.slot)}>{slot}</div>
    </footer>
  );
}

/** The line of semi-wide and wide screens: the hints, the page's slot, and the counts. */
function Line({ slot }: { slot: ReactNode }) {
  // Left out under a sheet that leaves the page usable, which rises from the same edge.
  const isCovered = useStatusLineCovered();
  const line = useRef<HTMLElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const counts = useRef<HTMLDivElement>(null);
  const fits = useCountsFit(line, controls, counts, slot !== null && !isCovered);
  if (isCovered) {
    return null;
  }
  return (
    <footer aria-label="Status line" ref={line} {...stylex.props(ruleStyles.above, styles.line)}>
      <Hints />
      {slot !== null && (
        <div ref={controls} {...stylex.props(styles.slot)}>
          {slot}
        </div>
      )}
      <Counts fits={fits} measured={counts} />
    </footer>
  );
}
