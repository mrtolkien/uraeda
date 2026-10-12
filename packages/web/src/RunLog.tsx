import {
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
  ChatSystemMessage,
  ChatToolCalls,
} from "@astryxdesign/core/Chat";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Markdown } from "@astryxdesign/core/Markdown";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { RunLog as RunLogRecord } from "uraeda-server/fate";
import { useRunLog } from "./data.ts";

const styles = stylex.create({
  // Astryx centres a system line, as a chat's date separators are; the UI layout decision keeps
  // text left-aligned.
  notice: {
    justifyContent: "flex-start",
    textAlign: "start",
  },
});

/** A line of a run's log, as the server keeps it. */
export type RunEvent = RunLogRecord["events"][number];
type ToolEvent = Extract<RunEvent, { kind: "tool" }>;

/** A tool call's duration: `340 ms` below a second, else `2.5 s`. */
export function duration(ms: number) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** What a tool call left going by a run that ended shows. */
export const UNFINISHED = "Not finished: the run ended.";

function toolCalls(tools: Array<ToolEvent>, ended: boolean) {
  return tools.map((tool) => {
    // The run ended before the call did: it will never end, and must not spin.
    const unfinished = ended && tool.status === "running";
    const output = unfinished ? UNFINISHED : tool.output;
    return {
      key: tool.id,
      name: tool.name,
      status: unfinished ? ("error" as const) : tool.status,
      target: tool.target,
      duration: tool.durationMs === undefined ? undefined : duration(tool.durationMs),
      errorMessage: unfinished || tool.status === "error" ? output : undefined,
      resultDetail: output ? (
        <CodeBlock code={output} size="sm" isWrapped width="100%" />
      ) : undefined,
    };
  });
}

/** The groups of tool calls opened, by their first call's `seq`, and how to open or close one. */
export type OpenGroups = {
  open: ReadonlyArray<number>;
  onOpenChange: (seq: number, isOpen: boolean) => void;
};

/**
 * Events in order: the agent's texts as markdown, each run of tool calls in one group, and the
 * system lines and blocked actions as notices. `ended` shows the calls the run left going as
 * failed; `groups`, when given, holds which groups are open.
 */
export function RunEvents({
  events,
  ended = false,
  groups,
}: {
  events: ReadonlyArray<RunEvent>;
  ended?: boolean;
  groups?: OpenGroups;
}) {
  const shown: Array<ReactNode> = [];
  let tools: Array<ToolEvent> = [];
  const flush = () => {
    if (tools.length > 0) {
      const seq = tools[0].seq;
      shown.push(
        <ChatMessage key={`tools-${seq}`} sender="assistant">
          <ChatToolCalls
            calls={toolCalls(tools, ended)}
            isExpanded={groups ? groups.open.includes(seq) : undefined}
            onExpandedChange={
              groups ? (open: boolean) => groups.onOpenChange(seq, open) : undefined
            }
          />
        </ChatMessage>,
      );
      tools = [];
    }
  };
  for (const event of events) {
    if (event.kind === "tool") {
      tools.push(event);
      continue;
    }
    flush();
    if (event.kind === "text") {
      shown.push(
        <ChatMessage key={event.seq} sender="assistant">
          <ChatMessageBubble>
            <Markdown density="compact" headingLevelStart={4}>
              {event.text}
            </Markdown>
          </ChatMessageBubble>
        </ChatMessage>,
      );
    } else if (event.kind === "system") {
      shown.push(
        <ChatSystemMessage key={event.seq} xstyle={styles.notice}>
          {event.text}
        </ChatSystemMessage>,
      );
    } else {
      shown.push(
        <ChatSystemMessage key={event.seq} xstyle={styles.notice}>
          Auto mode blocked {event.target ? `${event.tool}: ${event.target}` : event.tool}
        </ChatSystemMessage>,
      );
    }
  }
  flush();
  return <>{shown}</>;
}

function LogPage({ id, ended, groups }: { id: string; ended: boolean; groups?: OpenGroups }) {
  const page = useRunLog(id);
  return page ? <RunEvents events={page.events} ended={ended} groups={groups} /> : null;
}

/** Every page of a run's log, in order, each kept up to date while the run goes on. */
export function RunLog({
  run,
  groups,
}: {
  run: { id: string; pages: number; state: string };
  groups?: OpenGroups;
}) {
  const ended = run.state !== "running";
  return (
    <ChatMessageList align="top" density="compact" aria-label="Run log">
      {Array.from({ length: run.pages }, (_, page) => (
        <LogPage key={page} id={`${run.id}:${page}`} ended={ended} groups={groups} />
      ))}
    </ChatMessageList>
  );
}
