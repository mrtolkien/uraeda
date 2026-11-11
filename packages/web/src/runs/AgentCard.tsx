// A sub-agent's card, the same for a sub-session Uraeda runs and for an agent's own sub-agent: a
// square frame; on its raised head, its state's mark, its title, whole, and how long it ran, then a
// line of who it is; under a rule, its facts, each led by its icon, its values in the primary
// text. On the phone the head's line under the title takes the card's full width, as the facts do
// at every width. A fact that is unknown is left out, so no separator ever stands alone. With an
// `href` the whole card is one link; without, it is read as text. The cards of a list glide to
// their new places (`AgentCards`), as one ends or grows a line.
// Our own (an Astryx gap): `ListItem` and `CardRow` hold one line of supporting text, and Astryx's
// `Card` is no link.
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import {
  borderVars,
  colorVars,
  focusVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import { focusOutlineStyles } from "@astryxdesign/core/utils/focusOutline.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { type ComponentProps, type ReactNode, useRef } from "react";
import { clock, duration as longDuration } from "../feature/times.ts";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { RouterAnchor } from "../links.tsx";
import { useRowShifts } from "../lists/rowShifts.ts";
import { brighten } from "../sidebar/brighten.ts";
import { elapsed } from "../TurnLines.tsx";

const styles = stylex.create({
  // The card: a square frame, apart from its pane, as a job's card.
  card: {
    backgroundColor: colorVars["--color-background-body"],
    borderColor: colorVars["--color-border-emphasized"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    color: "inherit",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    textDecoration: "none",
  },
  duration: { flexShrink: 0 },
  // A fact: its icon and its words, kept whole on a line.
  fact: {
    alignItems: "center",
    display: "inline-flex",
    gap: spacingVars["--spacing-1"],
    whiteSpace: "nowrap",
  },
  // A fact of several values, each a fact of its own: more room between them than inside one.
  factSpaced: { gap: spacingVars["--spacing-2"] },
  // The facts, under a rule that sets them apart from the head; one that does not fit goes to the
  // next line whole.
  facts: {
    alignItems: "center",
    borderBlockStartColor: colorVars["--color-border-emphasized"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    columnGap: spacingVars["--spacing-3"],
    display: "flex",
    flexWrap: "wrap",
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
    rowGap: spacingVars["--spacing-1"],
  },
  // The head, on the raised surface: the mark, the title, and the time, then who it is.
  head: {
    backgroundColor: colorVars["--color-background-surface"],
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-1"],
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-2"],
  },
  headLine: {
    alignItems: "flex-start",
    display: "flex",
    gap: spacingVars["--spacing-2"],
    minWidth: 0,
  },
  // Who it is, under the title: its parts each whole, the next line taking what does not fit.
  line: {
    alignItems: "center",
    columnGap: spacingVars["--spacing-3"],
    display: "flex",
    flexWrap: "wrap",
    minWidth: 0,
    rowGap: spacingVars["--spacing-1"],
  },
  // On wide screens it starts where the title does, past the small mark and its gap; on the phone
  // it takes the card's full width.
  lineIndented: {
    paddingInlineStart: `calc(${spacingVars["--spacing-3"]} + ${spacingVars["--spacing-2"]})`,
  },
  // A link's card in its list: as wide as the list, never wider.
  item: { display: "grid", minWidth: 0 },
  // The cards of a list, one under the other.
  list: { listStyleType: "none", margin: 0, padding: 0 },
  // The mark, in the middle of the title's first line.
  mark: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    height: "var(--size-label-line)",
  },
  // The keyboard's ring just inside the frame, where a column that clips cannot cut it.
  ring: {
    outlineOffset: {
      ":focus-visible": `calc(-1 * ${focusVars["--focus-outline-width"]})`,
      default: null,
    },
  },
  // The title, whole, on as many lines as it takes.
  title: { flexGrow: 1, minWidth: 0, overflowWrap: "anywhere" },
  // At work: the frame's start in the sub-agents' colour, and its running time.
  working: { borderInlineStartColor: "var(--role-sub-agent)" },
  workingText: { color: "var(--role-sub-agent)" },
});

/** An icon's name, as Astryx's `Icon` takes it. */
type IconName = ComponentProps<typeof Icon>["icon"];

/**
 * A fact of the card, or a part of its head's line: `icon`, or a drawn `mark` such as an agent's,
 * then its words, kept on one line. `isSpaced` when its words are facts of their own, such as
 * tokens in and out, which stay together.
 */
export function Fact({
  children,
  icon,
  isSpaced = false,
  mark,
}: {
  children: ReactNode;
  icon?: IconName;
  isSpaced?: boolean;
  mark?: ReactNode;
}) {
  return (
    <span {...stylex.props(styles.fact, isSpaced && styles.factSpaced)}>
      {mark ?? (icon && <Icon color="secondary" icon={icon} size="xsm" />)}
      {children}
    </span>
  );
}

/** A fact's value, in the primary text, its figures aligned. */
export function Value({ children }: { children: ReactNode }) {
  return (
    <Text color="primary" hasTabularNumbers type="supporting">
      {children}
    </Text>
  );
}

/** A value's unit or word, quieter than its value. */
export function Unit({ children }: { children: ReactNode }) {
  return (
    <Text color="secondary" type="supporting">
      {children}
    </Text>
  );
}

/** When something that started at `startedAt` ended, in ms, or that it still runs, or neither. */
export type Ending = { at: number } | "running" | "unknown";

/** An hour, in ms: from it on, a time reads in hours and days, "2 h 05 min", not in minutes. */
const HOUR = 3_600_000;

/**
 * How long it ran, until its end or `now`, "45 s", "12 min", or "2 h 05 min": nothing when its end
 * is unknown.
 */
export function lasted(startedAt: string, ending: Ending, now: number): string | undefined {
  if (ending === "unknown") {
    return undefined;
  }
  const end = ending === "running" ? now : ending.at;
  const ran = Math.max(end - Date.parse(startedAt), 0);
  return ran < HOUR ? elapsed(ran) : longDuration(ran / 1000);
}

/** Its start and its end as words, "started 14:02, ended 14:27", as a card's name reads them. */
export function timesText(startedAt: string, ending: Ending, now: number): string {
  const started = `started ${clock(startedAt, new Date(now).toISOString())}`;
  if (ending === "unknown") {
    return started;
  }
  return ending === "running"
    ? `${started}, still running`
    : `${started}, ended ${clock(new Date(ending.at).toISOString(), startedAt)}`;
}

/**
 * The fact of its times: when it started, with its day when that is not today, an arrow, and when
 * it ended, with its day when that is another, or "running".
 */
export function Times({
  ending,
  now,
  startedAt,
}: {
  ending: Ending;
  now: number;
  startedAt: string;
}) {
  return (
    <Fact icon="uraeda:clock">
      <Value>{clock(startedAt, new Date(now).toISOString())}</Value>
      {ending !== "unknown" && <Icon color="secondary" icon="uraeda:arrow-right" size="xsm" />}
      {ending === "running" && (
        <Text type="supporting" xstyle={styles.workingText}>
          running
        </Text>
      )}
      {typeof ending === "object" && (
        <Value>{clock(new Date(ending.at).toISOString(), startedAt)}</Value>
      )}
    </Fact>
  );
}

/** What a card draws. */
type AgentCardProps = {
  /** Its facts, under the rule: `Fact`s, each left out when unknown. */
  children: ReactNode;
  /** How long it ran, at the head line's end: counted on while `isWorking`. */
  duration?: string | undefined;
  /** The page the whole card opens; without one, the card is no link. */
  href?: string;
  isWorking: boolean;
  /** Who it is or what it does, under the title: `Fact`s, or words. */
  line?: ReactNode;
  /** Its state's mark, before the title. */
  mark: ReactNode;
  /** What screen readers read of a link's card, in full words. */
  name?: string;
  /** Its key among its list's cards, by which it glides to a new place. */
  rowKey: string;
  title: string;
};

export function AgentCard({
  children,
  duration,
  href,
  isWorking,
  line,
  mark,
  name,
  rowKey,
  title,
}: AgentCardProps) {
  const narrow = isNarrow(useWidthClass());
  const content = (
    <>
      <span {...stylex.props(styles.head)}>
        <span {...stylex.props(styles.headLine)}>
          <span {...stylex.props(styles.mark)}>{mark}</span>
          <Text weight="bold" xstyle={styles.title}>
            {title}
          </Text>
          {duration !== undefined && (
            <Text
              color="secondary"
              hasTabularNumbers
              type="supporting"
              wrap="nowrap"
              xstyle={[styles.duration, isWorking && styles.workingText]}
            >
              {duration}
            </Text>
          )}
        </span>
        {line !== undefined && (
          <span {...stylex.props(styles.line, !narrow && styles.lineIndented)}>{line}</span>
        )}
      </span>
      <span {...stylex.props(styles.facts)}>{children}</span>
    </>
  );
  if (href === undefined) {
    return (
      <li data-row-key={rowKey} {...stylex.props(styles.card, isWorking && styles.working)}>
        {content}
      </li>
    );
  }
  return (
    <li data-row-key={rowKey} {...stylex.props(styles.item)}>
      {/* A page of the UI opens without reloading, as every Astryx link's does. */}
      <RouterAnchor
        aria-label={name}
        href={href}
        {...stylex.props(
          styles.card,
          isWorking && styles.working,
          brighten,
          focusOutlineStyles.focusVisible,
          styles.ring,
        )}
      >
        {content}
      </RouterAnchor>
    </li>
  );
}

/**
 * A list of cards, named `label`: each glides to its new place as their order changes, one ending
 * and going after those at work, and as a card before it grows or loses a line.
 */
export function AgentCards({
  children,
  label,
  order,
}: {
  children: ReactNode;
  label: string;
  /** The cards' keys, in the order drawn: its change is what moves them. */
  order: ReadonlyArray<string>;
}) {
  const list = useRef<HTMLElement>(null);
  useRowShifts(list, false, "", order.join("\n"));
  return (
    <VStack aria-label={label} as="ul" gap={2} ref={list} xstyle={styles.list}>
      {children}
    </VStack>
  );
}
