// A session's, a change's, or a feature's card in the shell: every line about it, a row of its pane.
// Its first line is its kind's icon, its whole name, wrapping when it must, and at the end its
// background command and status, then its "…": a session's actions, or a change's or a feature's
// settings. Under the name, a change's or a feature's step; then, while it has any, its task's
// progress and the lines its branch changed, with its pull request; then its running sub-agents.
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { SessionStatus } from "uraeda-server/fate";
import { HarnessMark, harnessMark } from "../HarnessMark.tsx";
import { useColumnFold } from "../shell/fold.ts";
import { StatusMark } from "../StatusMark.tsx";
import { needsYou } from "./cards.ts";
import { CardRow } from "./CardRow.tsx";
import { RailLink } from "./Row.tsx";
import { brighten } from "./brighten.ts";
import { type StepKind, StepIcon } from "./StepIcon.tsx";
import { DiffCount } from "../layout/DiffCount.tsx";

/** What the sidebar shows of a session, a change, or a feature. */
export type CardItem = {
  /** A session's agent kind, which its mark and its name tell. */
  agent?: string;
  /** Lines its branch added and removed outside its folder, once it changed any. */
  changes?: { added: number; removed: number };
  /** Its folder, or a session's ID. */
  folder: string;
  /** Whether a background command of its run is still going. */
  hasBackgroundCommand?: boolean;
  kind: "session" | "change" | "feature";
  /** Its name in the sidebar: its label, or its slug; a session's title. */
  label: string;
  /** What a button just started for it, until the server's status arrives: "Committing…". */
  pending?: string;
  /** Its current task, during the implementation. */
  progress?: { position: number; title: string; total: number };
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
    display: "flex",
    height: "calc(1.35 * var(--size-label-line))",
    justifyContent: "center",
    width: "calc(1.35 * var(--size-label-line))",
  },
  nextSmall: {
    // The rail's, the size of its small status mark.
    height: spacingVars["--spacing-3"],
    width: spacingVars["--spacing-3"],
  },
  // Out under the status at the first line's end, so the diff ends at the card's right edge.
  reachStatus: {
    marginInlineEnd: `calc(-1 * (${spacingVars["--spacing-2"]} + ${spacingVars["--spacing-4"]}))`,
  },
  reachGap: { marginInlineEnd: `calc(-1 * ${spacingVars["--spacing-2"]})` },
  // The closed rail's mark of the card's status, under its icon: shown by the column's rail rule.
  railMark: {
    display: "none",
    insetInlineStart: "7.7px",
    pointerEvents: "none",
    position: "absolute",
    top: "calc(var(--size-label-line) + 12px)",
    zIndex: 1,
  },
  spacer: { flexGrow: 1 },
  railIcon: {
    alignItems: "center",
    display: "inline-flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-1"],
  },
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
    item.progress
      ? `Task ${item.progress.position} of ${item.progress.total}, ${item.progress.title}`
      : undefined,
    item.hasBackgroundCommand ? "background command running" : undefined,
    item.pullRequest ? `pull request #${item.pullRequest.number}` : undefined,
    item.changes ? `${item.changes.added} lines added, ${item.changes.removed} removed` : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}

/** The end of the first line: the background command, then the status or the action in flight. */
function Status({ hasNext, item }: { hasNext: boolean; item: CardItem }) {
  return (
    <HStack align="center" gap={1}>
      {item.hasBackgroundCommand && <Icon color="secondary" icon="uraeda:terminal" size="sm" />}
      {item.pending ? (
        // Read in the card's name: a `label` would show as text over the card.
        <Spinner aria-hidden size="sm" />
      ) : item.status.status === "idle" ? null : (
        // A click on it opens the status's own page: see `onStatus`.
        <span data-card-status>
          {hasNext ? (
            // A step waits on the human: a chevron on the accent leads to it, where a "!" read as
            // an alert; the fill, as the status mark's, shows it is a button.
            <NextMark />
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
 * The kind's icon; in the folded rail, with a warning under it while the item needs the human, its
 * status read in the card's name.
 */
function CardIcon({ hasNext, item }: { hasNext: boolean; item: CardItem }) {
  const { isFolded } = useColumnFold();
  if (!isFolded || !needsYou(item.status)) {
    return <KindIcon item={item} />;
  }
  return (
    <span {...stylex.props(styles.railIcon)}>
      <KindIcon item={item} />
      {hasNext ? (
        <NextMark isSmall />
      ) : (
        <Icon
          color={item.status.status === "attention" ? "error" : "warning"}
          icon="warning"
          size="sm"
        />
      )}
    </span>
  );
}

/** The chevron on the accent that leads to the next step: the card's button, or its small rail mark. */
function NextMark({ isSmall = false }: { isSmall?: boolean }) {
  return (
    <span {...stylex.props(styles.next, isSmall ? styles.nextSmall : brighten)}>
      <Icon color="inherit" icon="chevronRight" size={isSmall ? "xsm" : "md"} />
    </span>
  );
}

/** The card's second line: its step, its task's position, its pull request, its lines changed. */
function Meta({
  detail,
  hasNext,
  item,
}: {
  detail?: string | undefined;
  hasNext: boolean;
  item: CardItem;
}) {
  const { changes, progress, pullRequest, step } = item;
  return (
    <>
      <HStack
        align="center"
        gap={2}
        xstyle={[
          styles.meta,
          // Beside a two-line button, the line ends where its room does.
          !hasNext && (item.status.status === "idle" ? styles.reachGap : styles.reachStatus),
        ]}
      >
        <Text color="secondary" type="supporting">
          {step?.label}
        </Text>
        {progress && (
          <Text color="secondary" hasTabularNumbers type="supporting">
            {`${progress.position}/${progress.total}`}
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

/** A session's actions in its "…". */
export type CardAction = { label: string; onClick: () => void };

export function ItemCard({
  detail,
  href,
  isSelected = false,
  item,
  onOpen,
  onStatus,
}: {
  /** More about it on a third line, as home's cards say: what it asks, how long it takes. */
  detail?: string | undefined;
  /** A session's actions, which its "…" lists. */
  actions?: Array<CardAction>;
  href: string;
  isSelected?: boolean;
  item: CardItem;
  /** Opens the item's page inside the app, instead of loading `href`. */
  onOpen?: () => void;
  /** Opens a change's or a feature's settings. */
  onSettings?: () => void;
  /** Opens what its status points to, on a click on the status: its session, or what it asks. */
  onStatus?: () => void;
}) {
  const { isFolded } = useColumnFold();
  // A step waits on the human: its status is a button to it, two lines high.
  const hasNext =
    onStatus !== undefined && item.status.status === "needs-you" && item.step?.kind !== "problem";
  if (isFolded) {
    // The rail: its icon alone, its name read in full, its status a warning while it needs you.
    return (
      <RailLink
        href={href}
        icon={<CardIcon hasNext={hasNext} item={item} />}
        isSelected={isSelected}
        label={cardName(item)}
        {...(onOpen ? { onOpen } : {})}
      />
    );
  }
  return (
    <div
      data-card
      // A card of one line is too short for its icon with the mark under it: the rail shows the mark alone.
      {...(!detail && !item.step && item.status.status !== "idle" ? { "data-rail-mark-only": "" } : {})}
      {...stylex.props(styles.card)}
    >
      <span aria-hidden="true" data-rail-only {...stylex.props(styles.railMark)}>
        {hasNext ? (
          <NextMark isSmall />
        ) : (
          <StatusMark label={item.status.label} small status={item.status.status} />
        )}
      </span>
      <CardRow
        endContent={<Status hasNext={hasNext} item={item} />}
        href={href}
        icon={<CardIcon hasNext={hasNext} item={item} />}
        isEndTall={hasNext}
        isSelected={isSelected}
        label={item.label}
        name={cardName(item)}
        sub={
          detail ? (
            // Home's card: its detail is the second line, in place of the step's.
            <Text color="secondary" type="supporting">
              {detail}
            </Text>
          ) : item.step ? (
            <Meta hasNext={hasNext} item={item} />
          ) : undefined
        }
        {...(onOpen || onStatus
          ? {
              onClick: (event: React.MouseEvent) => {
                const pr = (event.target as Element).closest("[data-card-pr]");
                if (pr) {
                  event.preventDefault();
                  window.open(pr.getAttribute("data-card-pr") ?? "", "_blank", "noopener");
                } else if (onStatus && (event.target as Element).closest("[data-card-status]")) {
                  event.preventDefault();
                  onStatus();
                } else if (onOpen) {
                  event.preventDefault();
                  onOpen();
                }
              },
            }
          : {})}
      />
      {item.subagents?.map((subagent) => (
        <HStack align="center" gap={2} key={subagent.id} xstyle={styles.subagent}>
          <StatusMark label="Working" small status="working" />
          <Text color="secondary" type="supporting">
            {subagent.description}
          </Text>
        </HStack>
      ))}
    </div>
  );
}
