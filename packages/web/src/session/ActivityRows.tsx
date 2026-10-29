// A run's rows in the Activity: each call or thought a head line, its kind's icon, how it ended,
// a check or a cross, and how long it ran, over what it acted on, across the row's whole width,
// three lines at most (`CallTarget.tsx`); a sub-agent's head says its calls, a thought's is the
// thought. A call with output, a thought with text, and a sub-agent's group unfold, their content
// mounted only while open, kept open in the history entry; an open call shows what it acted on
// whole. The rows of the stretch the address names are marked, and a call still going in a running
// turn is live. An open group mounts its latest 200 rows, and "Show earlier calls" adds 200 more,
// as the runs do.
import { Button } from "@astryxdesign/core/Button";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { VStack } from "@astryxdesign/core/VStack";
import {
  colorVars,
  fontWeightVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, startTransition, useRef, useState } from "react";
import { scroller } from "../following.ts";
import { keepPlace, topOf } from "../keepPlace.ts";
import { ProseMarkdown } from "../Prose.tsx";
import { StatusMark } from "../StatusMark.tsx";
import type { OpenKeys } from "../useOpenKeys.ts";
import type { Run } from "./activityRuns.ts";
import { CallTarget, LineCharsRoom } from "./CallTarget.tsx";
import { type ActivityItem, type RowWords, rowWords, type ToolItem } from "./stretches.ts";

const styles = stylex.create({
  // The head line: the icon, how it ended, and the time at its end; in the row's text, not a fold
  // toggle's larger and bolder one.
  head: {
    alignItems: "center",
    display: "flex",
    fontSize: typeScaleVars["--text-body-size"],
    fontWeight: fontWeightVars["--font-weight-normal"],
    gap: spacingVars["--spacing-2"],
    lineHeight: typeScaleVars["--text-body-leading"],
    minWidth: 0,
  },
  // The time, at the head's end.
  time: { marginInlineStart: "auto", whiteSpace: "nowrap" },
  // A row: a little less room at its sides than a list's, for what it acted on.
  row: { paddingInline: spacingVars["--spacing-1"] },
  // A row's head and what it acted on, one under the other, across the row.
  stack: { display: "flex", flexDirection: "column", gap: spacingVars["--spacing-1"], minWidth: 0 },
  // A sub-agent's row icon, in the teal of its marks elsewhere (`StatusMark`).
  subagentIcon: { color: "var(--color-fill-teal)" },
  // A finished call's check, and a failed one's cross.
  done: { color: colorVars["--color-text-green"] },
  failed: { color: colorVars["--color-text-red"] },
  // A row of the stretch the address names, on the muted background, a step darker than the
  // column's: the selection's tint was too bright under the text.
  marked: { backgroundColor: colorVars["--color-background-muted"] },
  // The live row, tinted in the accent, as the mockup's `.on`.
  live: { backgroundColor: colorVars["--color-accent-muted"] },
});

/** How many rows an open sub-agent's group mounts at first, and how many its button adds. */
const GROUP_ROWS = 200;

/** The icon of each kind of call; another tool's is a wrench. */
const ICONS: Partial<Record<ToolItem["toolKind"], string>> = {
  delete: "uraeda:trash",
  edit: "uraeda:file-pen-line",
  execute: "uraeda:square-terminal",
  fetch: "uraeda:globe",
  move: "uraeda:arrow-right-left",
  read: "uraeda:file-text",
  search: "search",
};

/** What a run's rows draw from: the run, its turn's state, its open folds, its marked stretch. */
type RunView = {
  /** Whether its turn ended, so a call still going will not end. */
  ended: boolean;
  keys: OpenKeys;
  /** The key of the stretch the address names. */
  marked: string | undefined;
  run: Run;
  /** Whether its turn runs, so a call still going is live. */
  running: boolean;
};

/** The key, among the history entry's open ones, of a row of the turn `turn`. */
export function foldKey(turn: string, seq: number) {
  return `activity:${turn}:${seq}`;
}

/** A row's icon: a thought's brain, a sub-agent's bot, or its kind's. */
function iconOf(item: ActivityItem): string {
  if (item.kind === "thought") {
    return "uraeda:brain";
  }
  return item.subagent ? "uraeda:bot" : (ICONS[item.toolKind] ?? "wrench");
}

/** A row's words, `stretches.ts`'s, its sub-agent's own calls counted from its group. */
function wordsOf(item: ActivityItem, view: RunView): RowWords {
  const calls = item.kind === "tool" && item.subagent ? (view.run.groups.get(item.id) ?? []) : [];
  return rowWords(item, view.ended, calls.filter((own) => own.kind === "tool").length);
}

/** What a row unfolds, drawn only while open: a thought's text, a call's output, a group's rows. */
function foldOf(item: ActivityItem, view: RunView): (() => ReactNode) | undefined {
  if (item.kind === "thought") {
    const { text } = item;
    return text ? () => <ProseMarkdown>{text}</ProseMarkdown> : undefined;
  }
  const group = item.subagent ? view.run.groups.get(item.id) : undefined;
  if (group && group.length > 0) {
    return () => <GroupRows items={group} view={view} />;
  }
  const { output } = item;
  return output ? () => <CodeBlock code={output} isWrapped size="sm" width="100%" /> : undefined;
}

/**
 * A row's weight against the Activity's bound: one, and the rows its sub-agent's group mounts at
 * first while it is open.
 */
export function rowWeight(run: Run, item: ActivityItem, keys: OpenKeys): number {
  const open = item.kind === "tool" && keys.open.includes(foldKey(run.turn, item.seq));
  const group = open ? (run.groups.get((item as ToolItem).id)?.length ?? 0) : 0;
  return 1 + Math.min(group, GROUP_ROWS);
}

/** Scrolls `element`'s start to the top of its scroller, smoothly unless motion is reduced. */
function toStart(element: HTMLElement | null) {
  const box = element ? scroller(element) : undefined;
  if (!element || !box) {
    return;
  }
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  box.scrollTo({
    behavior: reduced ? "auto" : "smooth",
    top: box.scrollTop + element.getBoundingClientRect().top - box.getBoundingClientRect().top,
  });
}

/** How a call ended, on its head: a check, a cross, or "not finished" once its turn ended. */
function Outcome({ item, view }: { item: ActivityItem; view: RunView }) {
  if (item.kind !== "tool") {
    return null;
  }
  if (item.status === "completed") {
    return <Icon icon="check" label="Done" size="sm" xstyle={styles.done} />;
  }
  if (item.status === "failed" || item.status === "cancelled") {
    return <Icon icon="close" label="Failed" size="sm" xstyle={styles.failed} />;
  }
  return view.ended ? <Text color="secondary">not finished</Text> : null;
}

/**
 * A row's head line: its icon, or the live mark, how it ended, a thought's word or a sub-agent's
 * calls, and its time at the end.
 */
function RowHead({ item, live, view }: { item: ActivityItem; live: boolean; view: RunView }) {
  const { calls, label, time } = wordsOf(item, view);
  return (
    <span {...stylex.props(styles.head)}>
      {live ? (
        <StatusMark label="Live" small status="working" />
      ) : (
        <Icon
          icon={iconOf(item)}
          size="sm"
          xstyle={item.kind === "tool" && item.subagent ? styles.subagentIcon : undefined}
        />
      )}
      <Outcome item={item} view={view} />
      {item.kind === "thought" ? (
        <span>Thought</span>
      ) : (
        // Shown under the head, whole or cut: the head, the fold's toggle, is named by it too.
        <VisuallyHidden>{label}</VisuallyHidden>
      )}
      {calls !== undefined && <Text color="secondary">{`sub-agent · ${calls}`}</Text>}
      {time !== undefined && (
        <Text color="secondary" xstyle={styles.time}>
          {time}
        </Text>
      )}
    </span>
  );
}

/** A call or a thought of a run, marked when it belongs to the stretch the address names. */
function ActivityRow({ item, view }: { item: ActivityItem; view: RunView }) {
  const fold = foldOf(item, view);
  const key = foldKey(view.run.turn, item.seq);
  const isOpen = view.keys.open.includes(key);
  const row = useRef<HTMLLIElement>(null);
  const open = (next: boolean) => {
    view.keys.onOpenChange(key, next);
    if (next) {
      // After the Activity kept its end in view, which would grow the row upwards: the row's start
      // at the top of its part instead, where its content reads down.
      requestAnimationFrame(() => toStart(row.current));
    }
  };
  // Live is a call the main agent runs now: a sub-agent's row keeps its bot, and the sub-agent's
  // own calls are its own work, not the run's.
  const live =
    view.running &&
    item.kind === "tool" &&
    item.parent === undefined &&
    !item.subagent &&
    (item.status === "in_progress" || item.status === "pending");
  const marked =
    view.marked !== undefined &&
    item.parent === undefined &&
    view.run.stretches.get(item.seq) === view.marked;
  // A thought's head says it all; a call's target, or a sub-agent's description, goes under it.
  const target = item.kind === "thought" ? undefined : wordsOf(item, view).label;
  const head = <RowHead item={item} live={live} view={view} />;
  return (
    <ListItem
      isSelected={marked}
      label={
        <span {...stylex.props(styles.stack)}>
          {fold ? (
            <Collapsible isOpen={isOpen} onOpenChange={open} trigger={head}>
              {isOpen ? (
                <VStack gap={1}>
                  {target !== undefined && <CallTarget isWhole label={target} />}
                  {fold()}
                </VStack>
              ) : null}
            </Collapsible>
          ) : (
            head
          )}
          {target !== undefined && !(fold && isOpen) && (
            <CallTarget label={target} onWhole={fold ? () => open(true) : undefined} />
          )}
        </span>
      }
      ref={row}
      xstyle={[styles.row, live ? styles.live : marked ? styles.marked : undefined]}
    />
  );
}

/**
 * An open sub-agent's group: its latest rows, 200 at first, with "Show earlier calls" above them
 * while some are left out, which adds 200 and keeps the first row drawn in place.
 */
function GroupRows({ items, view }: { items: ReadonlyArray<ActivityItem>; view: RunView }) {
  const [shown, setShown] = useState(GROUP_ROWS);
  const box = useRef<HTMLDivElement>(null);
  const more = () => {
    const first = box.current?.querySelector("li");
    void keepPlace(
      first ? topOf(first) : () => Number.NaN,
      () => startTransition(() => setShown((count) => count + GROUP_ROWS)),
      first ? scroller(first) : undefined,
    );
  };
  return (
    <VStack gap={1} ref={box}>
      {items.length > shown && (
        <Button clickAction={more} label="Show earlier calls" size="sm" variant="ghost" />
      )}
      <RowList items={items.slice(-shown)} view={view} />
    </VStack>
  );
}

/** Calls and thoughts as the rows of a list: a run's, or a sub-agent's group's. */
export function RowList({
  items,
  label,
  view,
}: {
  items: ReadonlyArray<ActivityItem>;
  label?: string;
  view: RunView;
}) {
  return (
    <LineCharsRoom>
      <List aria-label={label} density="compact" hasDividers>
        {items.map((item) => (
          <ActivityRow item={item} key={item.seq} view={view} />
        ))}
      </List>
    </LineCharsRoom>
  );
}
