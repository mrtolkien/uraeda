// A session's, a change's, or a feature's card in the shell: every line about it, a row of its pane.
// Its first line is its kind's icon, its whole name, wrapping when it must, and at the end its
// background command and status, then its "…": a session's actions, or a change's or a feature's
// settings. Under the name, a change's or a feature's step; then, while it has any, its task's
// progress and the lines its branch changed, with its pull request; then its running sub-agents.
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Link } from "@astryxdesign/core/Link";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { SessionStatus } from "uraeda-server/fate";
import { HarnessMark, harnessMark } from "../HarnessMark.tsx";
import { ProgressRing } from "../ProgressRing.tsx";
import { useColumnFold } from "../shell/fold.ts";
import { StatusMark } from "../StatusMark.tsx";
import { needsYou } from "./cards.ts";
import { CardRow } from "./CardRow.tsx";
import { RailLink } from "./Row.tsx";
import { type StepKind, StepIcon } from "./StepIcon.tsx";
import { useMenuPresentation } from "../layout/useWidthClass.ts";
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
  activity: {
    minWidth: 0,
    // Room under the first line, so its selected background never covers the progress.
    paddingBlockEnd: spacingVars["--spacing-1"],
    paddingBlockStart: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
  },
  card: {
    // A row of its pane, which draws the border around its cards.
    marginBlockEnd: spacingVars["--spacing-1"],
    overflow: "hidden",
  },
  progressText: {
    flexGrow: 1,
    minWidth: 0,
  },
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
    item.changes ? `${item.changes.added} lines added, ${item.changes.removed} removed` : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}

/** The end of the first line: the background command, then the status or the action in flight. */
function Status({ item }: { item: CardItem }) {
  return (
    <HStack align="center" gap={1}>
      {item.hasBackgroundCommand && <Icon color="secondary" icon="uraeda:terminal" size="sm" />}
      {item.pending ? (
        // Read in the card's name: a `label` would show as text over the card.
        <Spinner aria-hidden size="sm" />
      ) : (
        // A click on it opens the status's own page: see `onStatus`.
        <span data-card-status>
          <StatusMark label={item.status.label} status={item.status.status} />
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
    return <HarnessMark isDecorative kind={item.agent} />;
  }
  return (
    <Icon color="secondary" icon={item.kind === "change" ? "wrench" : "uraeda:comment"} size="sm" />
  );
}

/**
 * The kind's icon; in the folded rail, with a warning under it while the item needs the human, its
 * status read in the card's name.
 */
function CardIcon({ item }: { item: CardItem }) {
  const { isFolded } = useColumnFold();
  if (!isFolded || !needsYou(item.status)) {
    return <KindIcon item={item} />;
  }
  return (
    <span {...stylex.props(styles.railIcon)}>
      <KindIcon item={item} />
      <Icon
        color={item.status.status === "attention" ? "error" : "warning"}
        icon="warning"
        size="sm"
      />
    </span>
  );
}

/**
 * The line under the first one, only while there is a task or lines changed: the task's progress,
 * the pull request, and the lines changed.
 */
function Activity({ item }: { item: CardItem }) {
  const { changes, progress, pullRequest } = item;
  if (!changes && !progress) {
    return null;
  }
  return (
    <HStack align="center" gap={2} xstyle={styles.activity}>
      {progress && <ProgressRing position={progress.position} total={progress.total} />}
      <span {...stylex.props(styles.progressText)}>
        {progress && (
          <Text color="secondary" type="supporting">
            {`${progress.position}/${progress.total} · ${progress.title}`}
          </Text>
        )}
      </span>
      {pullRequest && (
        <Link
          href={pullRequest.url}
          isExternalLink
          label={`Pull request #${pullRequest.number}`}
          type="supporting"
        >
          {`#${pullRequest.number}`}
        </Link>
      )}
      {changes && (
        // Read in the card's name, in words.
        <DiffCount added={changes.added} isHidden removed={changes.removed} type="supporting" />
      )}
    </HStack>
  );
}

/** A session's actions in its "…". */
export type CardAction = { label: string; onClick: () => void };

/** The "…": a session's actions as a menu, or a change's or a feature's settings. */
function More({
  actions,
  item,
  onSettings,
}: {
  actions: Array<CardAction> | undefined;
  item: CardItem;
  onSettings: (() => void) | undefined;
}) {
  const presentation = useMenuPresentation();
  const icon = <Icon color="secondary" icon="moreHorizontal" />;
  if (actions) {
    return (
      <MoreMenu
        alignment="end"
        icon={icon}
        items={actions}
        label={`Actions of ${item.label}`}
        presentation={presentation}
        size="sm"
      />
    );
  }
  return (
    <IconButton
      icon={icon}
      label={`Settings of ${item.label}`}
      {...(onSettings ? { onClick: onSettings } : {})}
      size="sm"
      variant="ghost"
    />
  );
}

export function ItemCard({
  actions,
  href,
  isSelected = false,
  item,
  onOpen,
  onSettings,
  onStatus,
}: {
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
  if (isFolded) {
    // The rail: its icon alone, its name read in full, its status a warning while it needs you.
    return (
      <RailLink
        href={href}
        icon={<CardIcon item={item} />}
        isSelected={isSelected}
        label={cardName(item)}
        {...(onOpen ? { onOpen } : {})}
      />
    );
  }
  return (
    <div {...stylex.props(styles.card)}>
      <CardRow
        // Always drawn, muted, so the card keeps its size under the pointer (C4).
        actions={<More actions={actions} item={item} onSettings={onSettings} />}
        endContent={<Status item={item} />}
        href={href}
        icon={<CardIcon item={item} />}
        isSelected={isSelected}
        label={item.label}
        name={cardName(item)}
        sub={item.step?.label}
        {...(onOpen || onStatus
          ? {
              onClick: (event: React.MouseEvent) => {
                if (onStatus && (event.target as Element).closest("[data-card-status]")) {
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
      <Activity item={item} />
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
