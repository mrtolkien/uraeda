// A feature's or a change's card in the sidebar: every line about it inside one border. Its first
// line is its step's icon, its name, and at the end its background command and status; its "…" opens
// its settings. Under it, while it has any: its task's progress, its pull request, and the lines its
// branch changed; then its running sub-agents.
import { Badge } from "@astryxdesign/core/Badge";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Link } from "@astryxdesign/core/Link";
import { SideNavItem, useSideNavCollapse } from "@astryxdesign/core/SideNav";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import {
  borderVars,
  colorVars,
  radiusVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import type { SessionStatus } from "uraeda-server/fate";
import { ProgressRing } from "../ProgressRing.tsx";
import { StatusMark } from "../StatusMark.tsx";
import { type StepKind, StepIcon } from "./StepIcon.tsx";

/** The colours a feature can be given, from the theme's palette. */
export const COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
] as const;
export type CardColor = (typeof COLORS)[number];

/** What the sidebar shows of a feature or a change. */
export type CardItem = {
  /** Lines its branch added and removed outside its folder, once it changed any. */
  changes?: { added: number; removed: number };
  color?: CardColor;
  folder: string;
  /** Whether a background command of its run is still going. */
  hasBackgroundCommand?: boolean;
  kind: "feature" | "change";
  /** Its name in the sidebar: its label, or its slug. */
  label: string;
  /** What a button just started for it, until the server's status arrives: "Committing…". */
  pending?: string;
  /** Its current task, during the implementation. */
  progress?: { position: number; title: string; total: number };
  pullRequest?: { number: number; url: string };
  status: { label: string; status: SessionStatus };
  step: { kind: StepKind; label: string };
  subagents?: Array<{ description: string; id: string }>;
  title: string;
};

const styles = stylex.create({
  activity: {
    minWidth: 0,
    paddingBlockEnd: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
  },
  card: {
    borderColor: colorVars["--color-border"],
    borderRadius: radiusVars["--radius-element"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    marginBlockEnd: spacingVars["--spacing-1"],
    overflow: "hidden",
  },
  changes: {
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  mark: {
    // The status over the step's icon's corner, in the folded rail.
    insetBlockStart: `calc(-1 * ${spacingVars["--spacing-1"]})`,
    insetInlineEnd: `calc(-1 * ${spacingVars["--spacing-2"]})`,
    position: "absolute",
  },
  progressText: {
    flexGrow: 1,
    minWidth: 0,
  },
  railIcon: {
    display: "inline-flex",
    position: "relative",
  },
  stripe: {
    borderInlineStartWidth: spacingVars["--spacing-1"],
  },
  subagent: {
    paddingBlockEnd: spacingVars["--spacing-1"],
    paddingInlineStart: spacingVars["--spacing-6"],
  },
});

/** The stripe at a card's start, in its colour. */
const stripes = stylex.create({
  blue: { borderInlineStartColor: colorVars["--color-border-blue"] },
  green: { borderInlineStartColor: colorVars["--color-border-green"] },
  orange: { borderInlineStartColor: colorVars["--color-border-orange"] },
  pink: { borderInlineStartColor: colorVars["--color-border-pink"] },
  purple: { borderInlineStartColor: colorVars["--color-border-purple"] },
  red: { borderInlineStartColor: colorVars["--color-border-red"] },
  teal: { borderInlineStartColor: colorVars["--color-border-teal"] },
  yellow: { borderInlineStartColor: colorVars["--color-border-yellow"] },
});

/**
 * The card's accessible name, in full words: its name, its title, its kind for a change, its step,
 * its status or the action in flight, its background command, and the lines its branch changed.
 */
export function cardName(item: CardItem) {
  return [
    item.label,
    item.title,
    item.kind === "change" ? "change" : undefined,
    item.step.label,
    item.pending ?? item.status.label,
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
        <Spinner label={item.pending} size="sm" />
      ) : (
        <StatusMark label={item.status.label} status={item.status.status} />
      )}
    </HStack>
  );
}

/** The step's icon; in the folded rail, with the status over its corner. */
function CardIcon({ item }: { item: CardItem }) {
  const { isCollapsed } = useSideNavCollapse();
  if (!isCollapsed) {
    return <StepIcon step={item.step.kind} />;
  }
  return (
    <span {...stylex.props(styles.railIcon)}>
      <StepIcon step={item.step.kind} />
      <span {...stylex.props(styles.mark)}>
        {item.pending ? (
          <Spinner label={item.pending} size="sm" />
        ) : (
          <StatusMark label={item.status.label} small status={item.status.status} />
        )}
      </span>
    </span>
  );
}

/**
 * The line under the first one: "Change" where changes and features share a section, the task's
 * progress, the pull request, and the lines changed.
 */
function Activity({ hasChangeTag, item }: { hasChangeTag: boolean; item: CardItem }) {
  const { changes, progress, pullRequest } = item;
  const tag = hasChangeTag && item.kind === "change";
  if (!changes && !progress && !pullRequest && !tag) {
    return null;
  }
  return (
    <HStack align="center" gap={2} xstyle={styles.activity}>
      {tag && <Badge aria-hidden label="Change" variant="neutral" />}
      {progress && <ProgressRing position={progress.position} total={progress.total} />}
      <span {...stylex.props(styles.progressText)}>
        {progress && (
          <Text color="secondary" maxLines={1} type="supporting">
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
        <span aria-hidden {...stylex.props(styles.changes)}>
          <Text color="success" hasTabularNumbers type="supporting">{`+${changes.added}`}</Text>{" "}
          <Text color="error" hasTabularNumbers type="supporting">{`−${changes.removed}`}</Text>
        </span>
      )}
    </HStack>
  );
}

export function ItemCard({
  hasChangeTag = false,
  href,
  isRevealed: revealedByStory,
  isSelected = false,
  item,
  onSettings,
}: {
  /** Whether a change says so with a tag: where changes and features share a section. */
  hasChangeTag?: boolean;
  href: string;
  /** Shows the "…" as under the pointer, for a story. */
  isRevealed?: boolean;
  isSelected?: boolean;
  item: CardItem;
  onSettings: () => void;
}) {
  const { isCollapsed } = useSideNavCollapse();
  const [pointer, setPointer] = useState(false);
  const [focused, setFocused] = useState(false);
  // A touch screen has no pointer to wait for, and the keyboard reaches it from the card's link.
  const touch = useMediaQuery("(hover: none)");
  const revealed = revealedByStory ?? (pointer || focused || touch);
  return (
    <div
      {...stylex.props(styles.card, item.color && [styles.stripe, stripes[item.color]])}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
        }
      }}
      onFocus={() => setFocused(true)}
      onPointerEnter={() => setPointer(true)}
      onPointerLeave={() => setPointer(false)}
    >
      <SideNavItem
        actions={
          revealed ? (
            <IconButton
              icon={<Icon icon="moreHorizontal" />}
              label={`Settings of ${item.label}`}
              onClick={onSettings}
              size="sm"
              variant="ghost"
            />
          ) : undefined
        }
        aria-label={cardName(item)}
        endContent={<Status item={item} />}
        href={href}
        icon={<CardIcon item={item} />}
        isSelected={isSelected}
        label={item.label}
      />
      {!isCollapsed && <Activity hasChangeTag={hasChangeTag} item={item} />}
      {!isCollapsed &&
        item.subagents?.map((subagent) => (
          <HStack align="center" gap={2} key={subagent.id} xstyle={styles.subagent}>
            <StatusMark label="Working" small status="working" />
            <Text color="secondary" maxLines={1} type="supporting">
              {subagent.description}
            </Text>
          </HStack>
        ))}
    </div>
  );
}
