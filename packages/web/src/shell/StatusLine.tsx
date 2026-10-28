// The status line, at the bottom of the window. On semi-wide and wide screens, one line: the hints
// of the keys that work on the page (the key registry's), then how many cards need the human and
// how many sessions run. On the phone, a bar of the page's own controls only (`TopBarSlot`, as a
// round's count and Next), while it has any: the phone's tabs show the counts. An Astryx gap
// (plan, Complexity tracking): no component draws a status line. Astryx's `Kbd` writes keys in
// capitals, "J K", where the line writes them as typed. Its counts are not announced as they change:
// the column's panes and the tabs say them where they are read.
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { navigate, sessionIdPath, useRepoPath } from "../routes.tsx";
import { useNavigation } from "../sessionData.ts";
import { type Entry, needsYouEntries, runningSessions } from "../sidebar/entries.ts";
import { statusPath } from "../sidebar/statusPath.ts";
import { useStatusLineCovered } from "../statusHints.tsx";
import { KeyCap } from "../keys/KeyCap.tsx";
import { keepFocus } from "../keys/press.ts";
import { useHints, usePress } from "../keys/registry.tsx";
import { useHidesOnScroll } from "./useHidesOnScroll.ts";
import { bareButtonStyles } from "../layout/bareButton.ts";
import { glassStyles } from "../layout/glass.ts";
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
    // the edge.
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
  // The phone's bar slid out of the way as the page scrolls down, its shadow too.
  phoneHidden: { pointerEvents: "none", transform: "translateY(calc(100% + 2rem))" },
  // The phone's bar: on glass, over the page scrolling under it, its controls its whole width.
  // It slides out of the way as the page scrolls down, and back as it scrolls up.
  phoneLine: {
    paddingInline: spacingVars["--spacing-1"],
    transform: "translateY(0)",
    transitionDuration: { "@media (prefers-reduced-motion: reduce)": "0s", default: "200ms" },
    transitionProperty: "transform",
    transitionTimingFunction: "ease-out",
  },
  phoneSlot: { alignSelf: "stretch", flexGrow: 1 },
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
  return only.kind === "feature"
    ? statusPath(only.feature, only.status)
    : sessionIdPath(only.row.id);
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
          {/* oxlint-disable-next-line react/forbid-elements -- a hint pressed as its keys are, drawn as the status line's text, in its font and with no padding or surface, which Astryx's Button does not draw (an Astryx gap) */}
          <button
            onClick={() => press(hint.press)}
            onMouseDown={keepFocus}
            type="button"
            {...stylex.props(bareButtonStyles.bare, bareButtonStyles.lit)}
          >
            <KeyCap>{hint.keys}</KeyCap> {hint.label}
          </button>
        </Text>
      ))}
    </div>
  );
}

/** The counts: what needs the human, left out at none, and the running sessions. */
function Counts() {
  const data = useNavigation();
  const here = useRepoPath();
  const entries = needsYouEntries(data);
  const waiting = entries.length;
  return (
    <div {...stylex.props(styles.counts)}>
      {waiting > 0 && (
        <Text type="supporting" xstyle={[styles.count, styles.needs]}>
          {/* oxlint-disable-next-line react/forbid-elements -- the "need you" count, pressed to open its page, drawn as the status line's text, in its font and with no padding or surface, which Astryx's Button does not draw (an Astryx gap) */}
          <button
            onClick={() => navigate(here(needsYouPath(entries)))}
            type="button"
            {...stylex.props(bareButtonStyles.bare, bareButtonStyles.lit)}
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

/**
 * The line: on the phone, only the page's own controls, `slot`, which only the phone's pages fill,
 * else the hints, then the counts.
 */
export function StatusLine({ isNarrow, slot }: { isNarrow: boolean; slot: ReactNode }) {
  return isNarrow ? <PhoneBar slot={slot} /> : <Line />;
}

/**
 * The phone's bar: only the page's own controls, such as a round's Next, and only while it has
 * any. The hints are for keys and the counts are on the tabs, Sessions' running and Home's need-you.
 * It goes as the page scrolls down, out of the reading's way, and comes back as it scrolls up.
 */
function PhoneBar({ slot }: { slot: ReactNode }) {
  const isCovered = useStatusLineCovered();
  const isHidden = useHidesOnScroll();
  if (isCovered || slot === null) {
    return null;
  }
  return (
    <footer
      aria-label="Status line"
      {...stylex.props(
        styles.line,
        glassStyles.surface,
        glassStyles.docked,
        styles.phoneLine,
        isHidden && styles.phoneHidden,
      )}
    >
      <div {...stylex.props(styles.slot, styles.phoneSlot)}>{slot}</div>
    </footer>
  );
}

/** The line of semi-wide and wide screens: the hints, and the counts. */
function Line() {
  // Left out under a sheet that leaves the page usable, which rises from the same edge.
  const isCovered = useStatusLineCovered();
  if (isCovered) {
    return null;
  }
  return (
    <footer aria-label="Status line" {...stylex.props(ruleStyles.above, styles.line)}>
      <Hints />
      <Counts />
    </footer>
  );
}
