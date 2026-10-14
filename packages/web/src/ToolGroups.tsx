// A turn's tool calls, drawn as groups: a run of calls, or a sub-agent and its own calls.
import { ChatMessage, ChatToolCalls } from "@astryxdesign/core/Chat";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
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
export function ToolGroup({
  ended,
  group: { key, label, tools },
  groups,
}: {
  ended: boolean;
  group: ToolGroupSlot;
  groups: OpenKeys | undefined;
}) {
  return (
    <ChatMessage sender="assistant">
      <ChatToolCalls
        calls={toolCalls(tools, ended)}
        isExpanded={groups ? groups.open.includes(key) : undefined}
        label={label}
        onExpandedChange={groups ? (open: boolean) => groups.onOpenChange(key, open) : undefined}
      />
    </ChatMessage>
  );
}
