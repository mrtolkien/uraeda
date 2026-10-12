import {
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
  ChatSystemMessage,
  ChatToolCalls,
} from "@astryxdesign/core/Chat";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Markdown } from "@astryxdesign/core/Markdown";
import type { ReactNode } from "react";
import type { RunLog as RunLogRecord } from "uraeda-server/fate";
import { useRunLog } from "./data.ts";

/** A line of a run's log, as the server keeps it. */
export type RunEvent = RunLogRecord["events"][number];
type ToolEvent = Extract<RunEvent, { kind: "tool" }>;

/** A tool call's duration: `340 ms` below a second, else `2.5 s`. */
export function duration(ms: number) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function toolCalls(tools: Array<ToolEvent>) {
  return tools.map((tool) => ({
    key: tool.id,
    name: tool.name,
    status: tool.status,
    target: tool.target,
    duration: tool.durationMs === undefined ? undefined : duration(tool.durationMs),
    errorMessage: tool.status === "error" ? tool.output : undefined,
    resultDetail: tool.output ? (
      <CodeBlock code={tool.output} size="sm" isWrapped width="100%" />
    ) : undefined,
  }));
}

/**
 * Events in order: the agent's texts as markdown, each run of tool calls in one group, and the
 * system lines and blocked actions as notices.
 */
export function RunEvents({ events }: { events: ReadonlyArray<RunEvent> }) {
  const shown: Array<ReactNode> = [];
  let tools: Array<ToolEvent> = [];
  const flush = () => {
    if (tools.length > 0) {
      shown.push(
        <ChatMessage key={`tools-${tools[0].seq}`} sender="assistant">
          <ChatToolCalls calls={toolCalls(tools)} />
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
      shown.push(<ChatSystemMessage key={event.seq}>{event.text}</ChatSystemMessage>);
    } else {
      shown.push(
        <ChatSystemMessage key={event.seq}>
          Auto mode blocked {event.target ? `${event.tool}: ${event.target}` : event.tool}
        </ChatSystemMessage>,
      );
    }
  }
  flush();
  return <>{shown}</>;
}

function LogPage({ id }: { id: string }) {
  const page = useRunLog(id);
  return page ? <RunEvents events={page.events} /> : null;
}

/** Every page of a run's log, in order, each kept up to date while the run goes on. */
export function RunLog({ run }: { run: { id: string; pages: number } }) {
  return (
    <ChatMessageList align="top" density="compact" className="run-log">
      {Array.from({ length: run.pages }, (_, page) => (
        <LogPage key={page} id={`${run.id}:${page}`} />
      ))}
    </ChatMessageList>
  );
}
