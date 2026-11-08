// A session's, a change's, or a feature's card in the shell: every line about it, a row of its pane.
// Its first line is its kind's icon, its whole name, wrapping when it must, and at the end its
// background command and status, then, for a run that asks until dismissed, its Dismiss. Under the
// name, a change's or a feature's step; then its task's progress and the lines its branch changed,
// with its pull request, while it has any; then its running sub-agents. On the phone, the icon, the
// name, and the status are a head line, the rest at the card's full width under it, and a card whose
// step waits on the human has no chevron: the whole card leads to the step.
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { createContext, use } from "react";
import { useClosedRail } from "../layout/closedRail.ts";
import { usePaneTone } from "../layout/paneContext.tsx";
import { columnVars } from "../shell/column.stylex.ts";
import type { SessionStatus } from "uraeda-server/fate";
import { HarnessMark, harnessMark } from "../HarnessMark.tsx";
import { StatusMark } from "../StatusMark.tsx";
import { CardRow } from "./CardRow.tsx";
import { cardClick } from "./cardClick.ts";
import { brighten } from "./brighten.ts";
import { type StepKind, StepIcon } from "./StepIcon.tsx";
import { DiffCount } from "../layout/DiffCount.tsx";
import { StatusText } from "../fields/StatusText.tsx";
import { pickedStyles } from "../layout/picked.ts";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";

/**
 * Whether the cards are stacked, as in the sidebar's narrow column: the name on a row of its own,
 * the status after the second line's words, never a two-line button beside a name it would break.
 */
export const StackedCards = createContext(false);

/** What the sidebar shows of a session, a change, or a feature. */
export type CardItem = {
  /** A session's agent kind, which its mark and its name tell. */
  agent?: string;
  /** Lines its branch added and removed outside its folder, once it changed any. */
  changes?: { added: number; removed: number };
  /** Its folder, or a session's ID. */
  folder: string;
  /**
   * The agent kind of the session at work on a feature or a change, whose mark its working button
   * wears. Not in the card's name, which the step and the status already tell.
   */
  harness?: string;
  /** Whether a background command of its run is still going. */
  hasBackgroundCommand?: boolean;
  kind: "session" | "change" | "feature";
  /** Its name in the sidebar: its label, or its slug; a session's title. */
  label: string;
  /** What a button just started for it, until the server's status arrives: "Committing…". */
  pending?: string;
  /** Its plan's tasks done, of its total, and its current task, during the implementation. */
  progress?: { done: number; title: string; total: number };
  pullRequest?: { number: number; url: string };
  status: { label: string; status: SessionStatus };
  /** A change's or a feature's step; a session has none. */
  step?: { kind: StepKind; label: string };
  subagents?: Array<{ description: string; id: string }>;
  title: string;
};

const styles = stylex.create({
  card: {
    marginBlockEnd: spacingVars["--spacing-1"],
    overflow: "hidden",
    position: "relative",
  },
  meta: { flexGrow: 1, minWidth: 0 },
  next: {
    // A square of a line and a half, centred on the card's two lines.
    alignItems: "center",
    backgroundColor: colorVars["--color-accent"],
    color: colorVars["--color-on-accent"],
    // Its side as a property of its own, as the token lint takes a `var()` only whole, not in a
    // calc.
    "--card-next-side": "calc(1.35 * var(--size-label-line))",
    display: "flex",
    height: "var(--card-next-side)",
    justifyContent: "center",
    width: "var(--card-next-side)",
  },
  nextSmall: {
    // The rail's, the size of its small status mark.
    height: spacingVars["--spacing-3"],
    width: spacingVars["--spacing-3"],
  },
  // Out under the status at the first line's end, so the diff ends at the card's right edge.
  reachGap: { marginInlineEnd: `calc(-1 * ${spacingVars["--spacing-2"]})` },
  reachStatus: {
    marginInlineEnd: `calc(-1 * (${spacingVars["--spacing-2"]} + ${spacingVars["--spacing-4"]}))`,
  },
  // In the closed rail: a bar the rail's row wide, framing the card's icon and its mark, which no
  // longer clips them. The frame's colour is its pane's, `needs-you` where it needs the human.
  rail: {
    "::after": {
      borderColor: colorVars["--color-border"],
      borderStyle: "solid",
      borderWidth: borderVars["--border-width"],
      content: '""',
      insetBlockEnd: 0,
      insetBlockStart: 0,
      insetInlineStart: `calc(-1 * ${columnVars["--rail-frame-pull"]})`,
      pointerEvents: "none",
      position: "absolute",
      width: columnVars["--rail-row-box"],
    },
    isolation: "isolate",
    overflow: "visible",
  },
  railAttention: { "::after": { borderColor: "var(--role-needs-you)" } },
  // The selected card's grey fills its frame, behind its icons: its row's, as wide as the open
  // card, would run past the frame.
  railSelected: { "::after": { backgroundColor: colorVars["--color-neutral"], zIndex: -1 } },
  // A sub-agent's mark under the card's, its description hidden.
  railGone: { display: "none" },
  railSubagent: { paddingInlineStart: columnVars["--rail-mark-start"] },
  // The closed rail's mark of the card's status, under its icon, shown by `railMarkShown`. Its top
  // is a property of its own, as the token lint takes a `var()` only whole, not in a calc.
  railMark: {
    "--card-rail-mark-top": `calc(var(--size-label-line) + ${columnVars["--rail-mark-below"]})`,
    display: "none",
    insetInlineStart: columnVars["--rail-mark-start"],
    pointerEvents: "none",
    position: "absolute",
    top: "var(--card-rail-mark-top)",
    zIndex: 1,
  },
  railMarkShown: { display: "flex" },
  // A card of one line: its mark alone, in the middle of its height, in place of its icon.
  railMarkCentred: {
    bottom: 0,
    height: "fit-content",
    marginBlock: "auto",
    top: 0,
  },
  // Why its Dismiss was refused, under its name.
  refused: { paddingInlineStart: spacingVars["--spacing-6"] },
  spacer: { flexGrow: 1 },
  statusFlat: { display: "flex" },
  step: { whiteSpace: "nowrap" },
  subagent: {
    paddingBlockEnd: spacingVars["--spacing-1"],
    paddingInlineStart: spacingVars["--spacing-6"],
  },
});

/**
 * The card's accessible name, in full words: its name and its step, as the card shows them, then its
 * title, its kind, its status or the action in flight, its task, its background command, and the
 * lines its branch changed.
 */
export function cardName(item: CardItem) {
  return [
    item.label,
    item.step?.label,
    item.title,
    item.kind,
    item.agent === undefined ? undefined : harnessMark(item.agent).name,
    item.pending ?? item.status.label,
    item.progress ? `${item.progress.done} of ${item.progress.total} tasks done` : undefined,
    item.hasBackgroundCommand ? "background command running" : undefined,
    item.pullRequest ? `pull request #${item.pullRequest.number}` : undefined,
    item.changes ? `${item.changes.added} lines added, ${item.changes.removed} removed` : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}

/** The end of the first line: the background command, then the status or the action in flight. */
function Status({
  hasNext,
  hasWork,
  isHeaded = false,
  item,
}: {
  hasNext: boolean;
  hasWork: boolean;
  /** On the phone's head line, its mark centred on the line, not on a baseline below its middle. */
  isHeaded?: boolean;
  item: CardItem;
}) {
  return (
    <HStack align="center" gap={1}>
      {item.hasBackgroundCommand && <Icon color="secondary" icon="uraeda:terminal" size="sm" />}
      {item.pending ? (
        // Read in the card's name: a `label` would show as text over the card.
        <Spinner aria-hidden size="sm" />
      ) : item.status.status === "idle" ? null : (
        // A click on it opens the status's own page: see `onStatus`.
        <span data-card-status {...stylex.props(isHeaded && styles.statusFlat)}>
          {hasNext ? (
            // A step waits on the human: a chevron on the accent leads to it, where a "!" read as
            // an alert; the fill, as the status mark's, shows it is a button.
            <ActionMark kind="next" />
          ) : hasWork ? (
            // A session works on it: its page is one click away, from a button as big.
            <ActionMark harness={item.harness ?? item.agent} kind="work" />
          ) : (
            <StatusMark label={item.status.label} status={item.status.status} />
          )}
        </span>
      )}
    </HStack>
  );
}

/**
 * The icon telling its kind: its harness's mark for a session, named in the card's name, else a
 * speech bubble; a wrench for a change, and a feature's step, its steps being its own.
 */
function KindIcon({ item }: { item: CardItem }) {
  if (item.kind === "feature" && item.step) {
    return <StepIcon step={item.step.kind} />;
  }
  if (item.kind === "session" && item.agent !== undefined) {
    return <HarnessMark isDecorative kind={item.agent} size="md" />;
  }
  return (
    <Icon color="secondary" icon={item.kind === "change" ? "wrench" : "uraeda:comment"} size="md" />
  );
}

/**
 * A card's icon and status as another list draws its item, the key picker's: the icon of its kind
 * or step, and the mark of its status, the agent's at work on it, or the chevron of its next step.
 */
export const CardKindIcon = KindIcon;
export function CardStatus({ item }: { item: CardItem }) {
  const hasNext = item.status.status === "needs-you" && item.step?.kind !== "problem";
  return <Status hasNext={hasNext} hasWork={item.status.status === "working"} item={item} />;
}

/**
 * The square that leads from the card to what its status points at, as the card's button or its
 * small rail mark, on the accent as every button is: a chevron for the next step, which waits on
 * the human, and, for the session at work on it, its agent's mark, or the activity icon when it
 * names none.
 */
function ActionMark({
  harness,
  isSmall = false,
  kind,
}: {
  harness?: string | undefined;
  isSmall?: boolean;
  kind: "next" | "work";
}) {
  const size = isSmall ? "xsm" : "md";
  return (
    <span {...stylex.props(styles.next, isSmall ? styles.nextSmall : brighten)}>
      {kind === "work" && harness !== undefined ? (
        <HarnessMark color="inherit" isDecorative kind={harness} size={size} />
      ) : (
        <Icon
          color="inherit"
          icon={kind === "work" ? "uraeda:activity" : "chevronRight"}
          size={size}
        />
      )}
    </span>
  );
}

/** The card's second line: its step, its task's position, its pull request, its lines changed. */
function Meta({
  detail,
  hasButton,
  item,
}: {
  detail?: string | undefined;
  /** Its end is a two-line button. */
  hasButton: boolean;
  item: CardItem;
}) {
  const { changes, progress, pullRequest, step } = item;
  return (
    <>
      <HStack
        align="center"
        gap={2}
        // A step reads whole: what follows it goes to a line of its own rather than breaking it.
        wrap="wrap"
        xstyle={[
          styles.meta,
          // Beside a two-line button, the line ends where its room does.
          !hasButton && (item.status.status === "idle" ? styles.reachGap : styles.reachStatus),
        ]}
      >
        <Text color="secondary" type="supporting" xstyle={styles.step}>
          {step?.label}
        </Text>
        {progress && (
          <Text color="secondary" hasTabularNumbers type="supporting">
            {`${progress.done}/${progress.total}`}
          </Text>
        )}
        <span {...stylex.props(styles.spacer)} />
        {pullRequest && (
          // Opened by the card's click: a link cannot sit inside the card's own.
          <span data-card-pr={pullRequest.url}>
            <Text color="secondary" type="supporting">{`#${pullRequest.number}`}</Text>
          </span>
        )}
        {changes && (
          <DiffCount added={changes.added} isHidden removed={changes.removed} type="supporting" />
        )}
      </HStack>
      {detail && (
        <Text color="secondary" type="supporting">
          {detail}
        </Text>
      )}
    </>
  );
}

/**
 * The closed rail's mark of the card's status, under its icon: the next step's chevron, the agent
 * at work on it, or its status mark.
 */
function RailMark({
  hasNext,
  isMarkOnly,
  item,
}: {
  hasNext: boolean;
  isMarkOnly: boolean;
  item: CardItem;
}) {
  const isRail = useClosedRail();
  return (
    <span
      aria-hidden="true"
      data-rail-only
      {...stylex.props(
        styles.railMark,
        isRail && styles.railMarkShown,
        isRail && isMarkOnly && styles.railMarkCentred,
      )}
    >
      {hasNext ? (
        <ActionMark isSmall kind="next" />
      ) : item.status.status === "working" ? (
        // The size of the next step's chevron: one mark for whatever the rail shows.
        <ActionMark harness={item.harness ?? item.agent} isSmall kind="work" />
      ) : (
        <StatusMark label={item.status.label} small status={item.status.status} />
      )}
    </span>
  );
}

/** The card's Dismiss, after its link, at its first line's end, named by its card's `label`. */
function Dismiss({ label, onDismiss }: { label: string; onDismiss: () => void }) {
  return (
    <IconButton
      icon={<Icon icon="close" />}
      label={`Dismiss ${label}'s run`}
      onClick={onDismiss}
      size="sm"
      variant="ghost"
    />
  );
}

/** Why the server refused the card's Dismiss, under its name, gone in the closed rail. */
function Refused({ error, isRail }: { error: string; isRail: boolean }) {
  return (
    <div {...stylex.props(styles.refused, isRail && styles.railGone)}>
      <StatusText role="alert" tone="error" type="supporting">
        {error}
      </StatusText>
    </div>
  );
}

/** Its running sub-agents, a line each, their descriptions gone in the closed rail. */
function Subagents({ isRail, item }: { isRail: boolean; item: CardItem }) {
  return item.subagents?.map((subagent) => (
    <HStack
      align="center"
      gap={2}
      key={subagent.id}
      xstyle={[styles.subagent, isRail && styles.railSubagent]}
    >
      <StatusMark isSubagent label="Working" small status="working" />
      <Text color="secondary" type="supporting" xstyle={isRail && styles.railGone}>
        {subagent.description}
      </Text>
    </HStack>
  ));
}

export function ItemCard({
  detail,
  dismissError,
  href,
  isPicked = false,
  isSelected = false,
  item,
  onDismiss,
  onOpen,
  onStatus,
  statusHref,
}: {
  /** More about it on a third line, as home's cards say: what it asks, how long it takes. */
  detail?: string | undefined;
  /** Why the server refused its Dismiss, under it. */
  dismissError?: string | undefined;
  href: string;
  /**
   * The keys or the pointer picked it: tinted as a list's selected row, the keyboard's ring around
   * the whole card, its sub-agents too, not around its row alone.
   */
  isPicked?: boolean;
  isSelected?: boolean;
  item: CardItem;
  /** Dismisses the run its status asks about, a failed or a stopped one: Dismiss ends its first line. */
  onDismiss?: (() => void) | undefined;
  /** Opens the item's page inside the app, instead of loading `href`. */
  onOpen?: () => void;
  /** Opens what its status points to, on a click on the status: its session, or what it asks. */
  onStatus?: () => void;
  /** Where its status points, the card's link on the phone while its step waits on the human. */
  statusHref?: string;
}) {
  // A step waits on the human: its status is a button to it, two lines high.
  const hasNext =
    onStatus !== undefined && item.status.status === "needs-you" && item.step?.kind !== "problem";
  // A session works on it: its status is a button to the session, as big.
  const hasWork = onStatus !== undefined && item.status.status === "working";
  const isStacked = use(StackedCards);
  const isRail = useClosedRail();
  const isHeaded = isNarrow(useWidthClass()) && !isRail;
  // On the phone, the card is the step's own button: a chevron beside it squeezed its text.
  const leadsToStep = isHeaded && hasNext;
  const hasButton = (hasNext && !leadsToStep) || hasWork;
  const open = leadsToStep ? onStatus : onOpen;
  const tone = usePaneTone();
  // A card of one line is too short for its icon with the mark under it: the rail shows the mark alone.
  const isMarkOnly = !detail && !item.step && item.status.status !== "idle";
  return (
    <div
      data-card
      {...stylex.props(
        styles.card,
        isPicked && pickedStyles.picked,
        isPicked && pickedStyles.ringWithin,
        isRail && [
          styles.rail,
          tone === "attention" && styles.railAttention,
          isSelected && styles.railSelected,
        ],
      )}
    >
      <RailMark hasNext={hasNext} isMarkOnly={isMarkOnly} item={item} />
      <CardRow
        {...(isRail ? { rail: isMarkOnly ? "mark" : "card" } : {})}
        {...(onDismiss ? { after: <Dismiss label={item.label} onDismiss={onDismiss} /> } : {})}
        endContent={
          leadsToStep ? null : (
            <Status hasNext={hasNext} hasWork={hasWork} isHeaded={isHeaded} item={item} />
          )
        }
        hasRing={!isPicked}
        href={leadsToStep ? (statusHref ?? href) : href}
        icon={<KindIcon item={item} />}
        isEndTall={hasButton && (isHeaded || !isStacked)}
        isHeaded={isHeaded}
        isSelected={isSelected}
        isStacked={isStacked}
        label={item.label}
        name={cardName(item)}
        sub={
          detail ? (
            // Home's card: its detail is the second line, in place of the step's.
            <Text color="secondary" type="supporting">
              {detail}
            </Text>
          ) : item.step ? (
            // Stacked, the status follows the line: it reaches no further than its room.
            <Meta hasButton={hasButton || isStacked || isHeaded} item={item} />
          ) : undefined
        }
        {...(onOpen || onStatus ? { onClick: cardClick(open, onStatus) } : {})}
      />
      {dismissError && <Refused error={dismissError} isRail={isRail} />}
      <Subagents isRail={isRail} item={item} />
    </div>
  );
}
