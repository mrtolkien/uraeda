// A turn's tool calls, drawn as groups: a run of calls, or a sub-agent and its own calls.
import { ChatMessage, ChatToolCalls } from "@astryxdesign/core/Chat";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { memo, useState } from "react";
import type { Item } from "uraeda-server/fate";
import type { OpenKeys } from "./useOpenKeys.ts";

/** A tool call of a turn, as the server keeps it. */
export type ToolItem = Extract<Item, { kind: "tool" }>;

/** A group of tool calls: `key` names its open state, and a sub-agent's has its `label`. */
export type ToolGroupSlot = { key: string; label?: string; tools: Array<ToolItem> };

/** A tool call's duration: `340 ms` below a second, else `2.5 s`. */
export function duration(ms: number) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** What a tool call left going by a turn that ended shows. */
const UNFINISHED = "Not finished: the turn ended.";

const STATUS = {
  cancelled: "error",
  completed: "complete",
  failed: "error",
  in_progress: "running",
  pending: "pending",
} as const;

function toolCalls(tools: Array<ToolItem>, ended: boolean) {
  return tools.map((tool) => {
    // The turn ended before the call did: it will never end, and must not spin.
    const unfinished = ended && (tool.status === "pending" || tool.status === "in_progress");
    const output = unfinished ? UNFINISHED : tool.output;
    const status = unfinished ? ("error" as const) : STATUS[tool.status];
    return {
      duration: tool.durationMs === undefined ? undefined : duration(tool.durationMs),
      errorMessage:
        status === "error"
          ? (output ?? (tool.status === "cancelled" ? "Cancelled" : undefined))
          : undefined,
      key: tool.id,
      name: tool.name,
      resultDetail: output ? (
        <CodeBlock code={output} isWrapped size="sm" width="100%" />
      ) : undefined,
      status,
      target: tool.subagent?.description ?? tool.target,
    };
  });
}

/** A group of tool calls, open as `groups` keeps it, in a turn that `ended` or goes on. */
function ToolGroupView({
  ended,
  group: { key, label, tools },
  groups,
}: {
  ended: boolean;
  group: ToolGroupSlot;
  groups: OpenKeys | undefined;
}) {
  const [local, setLocal] = useState(false);
  const isOpen = groups ? groups.open.includes(key) : local;
  const setOpen = (open: boolean) => (groups ? groups.onOpenChange(key, open) : setLocal(open));
  const calls = toolCalls(tools, ended);
  // Folded, Astryx still maps every call into a hidden row. Its header reads only the count and
  // the latest call, and `map` skips holes: a sparse array of the same length mounts one row.
  const folded = !isOpen && calls.length > 1;
  const shown = folded
    ? Object.assign(new Array(calls.length), { [calls.length - 1]: calls.at(-1) })
    : calls;
  return (
    <ChatMessage sender="assistant">
      <ChatToolCalls
        calls={shown}
        isExpanded={groups || calls.length > 1 ? isOpen : undefined}
        label={label}
        onExpandedChange={setOpen}
      />
    </ChatMessage>
  );
}

const last = (tools: Array<ToolItem>) => tools.at(-1);

/** Redraws only when the group's size, last call, open state or turn's end changed. */
export const ToolGroup = memo(
  ToolGroupView,
  (a, b) =>
    a.ended === b.ended &&
    a.group.key === b.group.key &&
    a.group.tools.length === b.group.tools.length &&
    last(a.group.tools)?.status === last(b.group.tools)?.status &&
    last(a.group.tools)?.output === last(b.group.tools)?.output &&
    a.groups?.open.includes(a.group.key) === b.groups?.open.includes(b.group.key),
);
