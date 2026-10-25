// A turn's items cut into stretches, the main agent's calls and thoughts between two other lines,
// and every word said of them: a recap line's counts, the live line, an activity row's words, and a
// sub-agent's row's. One table of the kinds' words serves them all, so a word changes in one place.
import type { TranscriptItem } from "../TranscriptMessages.tsx";
import { elapsed } from "../TurnLines.tsx";

/** A tool call of a turn, as the chat draws it. */
export type ToolItem = Extract<TranscriptItem, { kind: "tool" }>;

/** A line a stretch holds: a tool call or a thought. */
export type ActivityItem = Extract<TranscriptItem, { kind: "thought" | "tool" }>;

/**
 * The main agent's calls and thoughts between two other items of a turn, its sub-agents' starting
 * calls included. `key` is `stretchKey` of its turn and first item.
 *
 * A turn's pages cut a stretch where they end, so a stretch says where it may go on: `continued`,
 * the page's items before it are only a sub-agent's, so on a page after the turn's first it goes on
 * from the page before; `open`, the page's items after it are only a sub-agent's, so it may go on in
 * the page after. `joinStretches` makes the two halves one stretch, under the first half's key.
 */
export type Stretch = {
  continued: boolean;
  items: ReadonlyArray<ActivityItem>;
  key: string;
  open: boolean;
};

/** A place in a page of a turn: one of its other items, or a stretch. */
export type Slot = { item: TranscriptItem; kind: "item" } | { kind: "stretch"; stretch: Stretch };

/** The address parameter that names the stretch a recap line opened. */
export const STRETCH_PARAMETER = "stretch";

/** What the words call a call: its kind, or a sub-agent, whatever its kind. */
type CallKind = "read" | "edit" | "delete" | "move" | "search" | "fetch" | "execute" | "subagent";

/**
 * A kind's words: its past verb, its present verb, and its row's word. A recap line counts distinct
 * `files`, `calls` of its `unit`, or `times`, "once", "twice", "3 times", for a kind with no unit.
 */
type Words = { doing: string; kind: CallKind; past: string; row: string } & (
  | { count: "files" | "calls"; unit: string }
  | { count: "times" }
);

/**
 * The words of each kind of call, in the order a recap line counts them (ruling R5), and its row's
 * word (ruling R6). An array, so that order is the table's and no sort of keys changes it.
 */
const WORDS: ReadonlyArray<Words> = [
  { count: "files", doing: "reading", kind: "read", past: "read", row: "read", unit: "file" },
  { count: "files", doing: "editing", kind: "edit", past: "edited", row: "edit", unit: "file" },
  {
    count: "files",
    doing: "deleting",
    kind: "delete",
    past: "deleted",
    row: "delete",
    unit: "file",
  },
  { count: "files", doing: "moving", kind: "move", past: "moved", row: "move", unit: "file" },
  { count: "times", doing: "searching", kind: "search", past: "searched", row: "search" },
  { count: "calls", doing: "fetching", kind: "fetch", past: "fetched", row: "fetch", unit: "page" },
  {
    count: "calls",
    doing: "running",
    kind: "execute",
    past: "ran",
    row: "run",
    unit: "command",
  },
  {
    count: "calls",
    doing: "running",
    kind: "subagent",
    past: "ran",
    row: "sub-agent",
    unit: "sub-agent",
  },
];

/** The words of each kind, by kind. */
const KINDS = new Map(WORDS.map((words) => [words.kind, words]));

/** The counts after the kinds of `WORDS`: other tools, then thoughts. */
const OTHER = { doing: "using", past: "used", unit: "other tool" };
const THOUGHT = "thought";

/** "once", "twice", "3 times". */
function times(count: number): string {
  return count === 1 ? "once" : count === 2 ? "twice" : `${count} times`;
}

/** "read 3 files", "ran 1 command", or with no unit "searched twice". */
function counted(past: string, count: number, unit?: string): string {
  return unit === undefined
    ? `${past} ${times(count)}`
    : `${past} ${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** What a kind acts on when no target names it, "a file", or nothing for a search. */
function what(words: Words): string | undefined {
  return words.count === "times" ? undefined : `a ${words.unit}`;
}

/** The words of a call's kind, a sub-agent whatever its kind, or undefined for another tool. */
function wordsOf(tool: { subagent?: unknown; toolKind: ToolItem["toolKind"] }): Words | undefined {
  return KINDS.get(tool.subagent ? "subagent" : (tool.toolKind as CallKind));
}

/** `${turn}:${seq}`: the stretch of a turn that starts at that item. */
export function stretchKey(turn: string, seq: number): string {
  return `${turn}:${seq}`;
}

/** The address of `path` with its Activity open at the stretch `key`, or at none without one. */
export function stretchAddress(path: string, key?: string): string {
  return `${path}?${new URLSearchParams([
    ["tab", "activity"],
    ...(key === undefined ? [] : [[STRETCH_PARAMETER, key]]),
  ])}`;
}

/**
 * A page's items in order, each run of the main agent's calls and thoughts one stretch. Items of a
 * sub-agent, with a `parent`, are left out, and do not end a stretch: they arrive whenever the
 * sub-agent works, after the main agent's text as well as between its calls.
 */
export function slotsOf(turn: string, items: ReadonlyArray<TranscriptItem>): Array<Slot> {
  const slots: Array<Slot> = [];
  let current: Array<ActivityItem> | undefined;
  for (const item of items) {
    if ((item.kind === "tool" || item.kind === "thought") && item.parent !== undefined) {
      continue;
    }
    if (item.kind === "tool" || item.kind === "thought") {
      if (!current) {
        current = [];
        slots.push({
          kind: "stretch",
          stretch: {
            continued: slots.length === 0,
            items: current,
            key: stretchKey(turn, item.seq),
            open: false,
          },
        });
      }
      current.push(item);
      continue;
    }
    current = undefined;
    slots.push({ item, kind: "item" });
  }
  const last = slots.at(-1);
  if (last?.kind === "stretch") {
    last.stretch.open = true;
  }
  return slots;
}

/** What a page of a sub-agent's items alone is to the stretches around it: see-through. */
export const THROUGH = "through";

/**
 * How a page's `slots` end, for the page after: at the stretch open at their end, which the page
 * after may go on; closed by another item, undefined; or `THROUGH`, a page with no item of the main
 * agent's, a sub-agent's alone, which neither ends a stretch nor starts one, so the page after goes
 * on from the page before it. Every join across pages reads a page's end here.
 */
export function pageEnd(slots: ReadonlyArray<Slot>): Stretch | typeof THROUGH | undefined {
  const last = slots.at(-1);
  if (last === undefined) {
    return THROUGH;
  }
  return last.kind === "stretch" && last.stretch.open ? last.stretch : undefined;
}

/**
 * One stretch from a stretch `open` at a page's end and the `continued` one that starts the next
 * page: the items of both, under the earlier one's key, so a recap line counts the whole stretch and
 * the Activity marks its rows by one key.
 */
export function joinStretches(earlier: Stretch, later: Stretch): Stretch {
  return {
    continued: earlier.continued,
    items: [...earlier.items, ...later.items],
    key: earlier.key,
    open: later.open,
  };
}

/** The sum of the items' lengths, in ms: a call cached without one counts 0. */
export function lengthOf(items: ReadonlyArray<ActivityItem>): number {
  return items.reduce((sum, item) => sum + (item.durationMs ?? 0), 0);
}

/** A single call's words: its past verb and target, "read src/tasks/undo.ts". */
function single(tool: ToolItem): string {
  const words = wordsOf(tool);
  if (!words) {
    return `${OTHER.past} ${tool.name}`;
  }
  // A sub-agent's target is its description, which its activity row shows (ruling R17). A call
  // with no target reads what it acts on, "read a file", and a search, which has no word for it,
  // "searched once".
  const acted = words.kind === "subagent" ? what(words) : (tool.target ?? what(words));
  return acted ? `${words.past} ${acted}` : counted(words.past, 1);
}

/** Each kind's count, in the table's order, from a stretch's calls. */
function counts(tools: ReadonlyArray<ToolItem>): Array<string> {
  const parts: Array<string> = [];
  for (const words of WORDS) {
    const calls = tools.filter((tool) => wordsOf(tool) === words);
    // A file read twice is one file read.
    const count =
      words.count === "files"
        ? new Set(calls.map((tool) => tool.target ?? tool.id)).size
        : calls.length;
    if (count > 0) {
      parts.push(counted(words.past, count, words.count === "times" ? undefined : words.unit));
    }
  }
  const others = tools.filter((tool) => !wordsOf(tool)).length;
  if (others > 0) {
    parts.push(counted(OTHER.past, others, OTHER.unit));
  }
  return parts;
}

/**
 * A recap line's words: the stretch's time, then each kind's count, "2 min · read 3 files ·
 * searched once · thought twice"; a single call reads the call, "4 s · read src/tasks/undo.ts".
 */
export function recapText(items: ReadonlyArray<ActivityItem>): string {
  const tools = items.filter((item): item is ToolItem => item.kind === "tool");
  const thoughts = items.length - tools.length;
  const alone = tools.length === 1 ? single(tools[0]!) : undefined;
  const parts = [elapsed(lengthOf(items)), ...(alone ? [alone] : counts(tools))];
  if (thoughts > 0) {
    parts.push(counted(THOUGHT, thoughts));
  }
  return parts.join(" · ");
}

/**
 * What a running call does, "reading src/tasks/undo.ts": a call of the chat, or a sub-agent's
 * latest call as the session record has it.
 */
export function doingText(tool: {
  name?: string;
  subagent?: unknown;
  target?: string | null;
  toolKind: ToolItem["toolKind"];
}): string {
  const words = wordsOf(tool);
  if (!words) {
    return `${OTHER.doing} ${tool.name ?? "a tool"}`;
  }
  const acted = words.kind === "subagent" ? what(words) : (tool.target ?? what(words));
  return acted ? `${words.doing} ${acted}` : words.doing;
}

/**
 * What the main agent does when no call of its is going: its activity's label, "Working" or
 * "Thinking", as the live line reads it, "thinking".
 */
export function activityText(label: string): string {
  return `${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

/** "1 call", or "N calls". */
export function callCount(count: number): string {
  return `${count} ${count === 1 ? "call" : "calls"}`;
}

/**
 * A sub-agent's line under its description: its calls, then what its latest does, "2 calls ·
 * reading src/tasks/undo.ts", or "no call yet".
 */
export function subagentText({
  calls,
  latest,
}: {
  calls: number;
  latest: Parameters<typeof doingText>[0] | null;
}): string {
  return latest === null ? "no call yet" : `${callCount(calls)} · ${doingText(latest)}`;
}

/**
 * The live line of a running turn: how long its current call or thought lasts, what it does, and
 * its running sub-agents, "12 s · reading src/tasks/undo.ts · 2 sub-agents running".
 */
export function liveText(lastingMs: number, doing: string, subagents: number): string {
  const running =
    subagents > 0 ? ` · ${subagents} sub-agent${subagents === 1 ? "" : "s"} running` : "";
  return `${elapsed(lastingMs)} · ${doing}${running}`;
}

/**
 * An activity row's end word: its kind's, "read" or "run", or its tool's name; "failed" for a
 * failed or cancelled call; "not finished" for a call left going by a turn that `ended`.
 */
export function rowWord(tool: ToolItem, ended: boolean): string {
  if (tool.status === "failed" || tool.status === "cancelled") {
    return "failed";
  }
  if (ended && (tool.status === "pending" || tool.status === "in_progress")) {
    return "not finished";
  }
  return wordsOf(tool)?.row ?? tool.name;
}

/** An activity row's words: its `label`, its `end` word, and a sub-agent's count of `calls`. */
export type RowWords = { calls?: string; end?: string; label: string };

/**
 * An activity row's words: what it acted on, "Thought", or the sub-agent's description; then its
 * word, a thought's length from a second, or a sub-agent's word and its own `calls`, "sub-agent · 6
 * calls". `ended`, as `rowWord`'s.
 */
export function rowWords(item: ActivityItem, ended: boolean, calls: number): RowWords {
  if (item.kind === "thought") {
    return item.durationMs >= 1000
      ? { end: elapsed(item.durationMs), label: "Thought" }
      : { label: "Thought" };
  }
  const word = rowWord(item, ended);
  if (item.subagent) {
    return { calls: callCount(calls), end: word, label: item.subagent.description };
  }
  return { end: word, label: item.target ?? item.name };
}
