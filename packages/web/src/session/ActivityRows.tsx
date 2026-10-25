// A run's rows in the Activity: each call or thought with its kind's icon, what it acted on, and
// its word, `stretches.ts`'s (ruling R6). A call with output, a thought with text, and a
// sub-agent's group unfold, their content mounted only while open, kept open in the history entry.
// The rows of the stretch the address names are marked, and a call still going in a running turn is
// live. An open group mounts its latest 200 rows, and "Show earlier calls" adds 200 more, as the
// runs do.
import { Button } from "@astryxdesign/core/Button";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, typeScaleVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, startTransition, useRef, useState } from "react";
import { scroller } from "../following.ts";
import { keepPlace, topOf } from "../keepPlace.ts";
import { ProseMarkdown } from "../Prose.tsx";
import { StatusMark } from "../StatusMark.tsx";
import type { OpenKeys } from "../useOpenKeys.ts";
import type { Run } from "./activityRuns.ts";
import { Path } from "./Path.tsx";
import { type ActivityItem, type RowWords, rowWords, type ToolItem } from "./stretches.ts";

const styles = stylex.create({
  // A part of a row's word, never broken.
  group: { whiteSpace: "nowrap" },
  // What a row acted on breaks after its slashes first, then anywhere, a long path or command whole
  // on the row's lines, as the changes' paths: no text is cut. In a fold's toggle, which sets a
  // larger text and grows to its content, it takes the row's text, and no width of its own, so it
  // wraps rather than widening the list.
  label: {
    contain: "inline-size",
    display: "block",
    fontSize: typeScaleVars["--text-body-size"],
    lineHeight: typeScaleVars["--text-body-leading"],
    overflowWrap: "anywhere",
    textAlign: "start",
  },
  // In a narrow part of the column, a row's word, "sub-agent · 2 calls", wraps between its parts,
  // so the row's description keeps the most room (approval comment C2).
  end: {
    maxInlineSize: { "@container (max-width: 360px)": "min-content", default: "none" },
  },
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

/** A call or a thought of a run, marked when it belongs to the stretch the address names. */
function ActivityRow({ item, view }: { item: ActivityItem; view: RunView }) {
  const { calls, end, label } = wordsOf(item, view);
  const fold = foldOf(item, view);
  const key = foldKey(view.run.turn, item.seq);
  const isOpen = view.keys.open.includes(key);
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
  return (
    <ListItem
      align="first-line"
      endContent={
        end === undefined ? undefined : (
          <Text color="secondary" type="supporting" xstyle={styles.end}>
            {calls === undefined ? (
              end
            ) : (
              <>
                <span {...stylex.props(styles.group)}>{end}</span>{" "}
                <span {...stylex.props(styles.group)}>{`· ${calls}`}</span>
              </>
            )}
          </Text>
        )
      }
      isSelected={marked}
      label={
        fold ? (
          <Collapsible
            isOpen={isOpen}
            onOpenChange={(open: boolean) => view.keys.onOpenChange(key, open)}
            trigger={
              <span {...stylex.props(styles.label)}>
                <Path inText path={label} />
              </span>
            }
          >
            {isOpen ? fold() : null}
          </Collapsible>
        ) : (
          <span {...stylex.props(styles.label)}>
            <Path inText path={label} />
          </span>
        )
      }
      startContent={
        live ? (
          <StatusMark label="Live" small status="working" />
        ) : (
          <Icon icon={iconOf(item)} size="sm" />
        )
      }
      xstyle={live ? styles.live : undefined}
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
    <List aria-label={label} density="compact">
      {items.map((item) => (
        <ActivityRow item={item} key={item.seq} view={view} />
      ))}
    </List>
  );
}
