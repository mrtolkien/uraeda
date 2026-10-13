import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import {
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
  ChatSystemMessage,
  ChatToolCalls,
} from "@astryxdesign/core/Chat";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Markdown } from "@astryxdesign/core/Markdown";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, type RefObject, useEffect, useState } from "react";
import { useFateClient } from "react-fate";
import type { Item } from "uraeda-server/fate";
import { useAgent, useTurn, useTurnLog } from "./data.ts";
import { refusal } from "./errors.ts";
import { stepLabel } from "./labels.ts";
import { statusStyles } from "./Question.tsx";
import { currentEntry, updateEntry } from "./routes.tsx";
import { SessionView } from "./views.ts";

const styles = stylex.create({
  // Astryx centres a system line, as a chat's date separators are; the UI layout decision keeps
  // text left-aligned.
  notice: {
    justifyContent: "flex-start",
    textAlign: "start",
  },
  // A turn's lines, spaced as the list spaces them, in a box the address's anchor scrolls to.
  turn: {
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-3"],
  },
  // A message keeps its line breaks, and a long path wraps instead of running off screen.
  message: {
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  // The chat's opening line, muted above the human's text.
  opening: {
    display: "block",
    whiteSpace: "pre-wrap",
    color: colorVars["--color-text-secondary"],
    marginBlockEnd: spacingVars["--spacing-2"],
  },
  // A message the agent has not read yet.
  pending: {
    color: colorVars["--color-text-secondary"],
  },
});

/** A line of a turn, as the server keeps it. */
export type TranscriptItem = Item & { seq: number };
type ToolItem = Extract<TranscriptItem, { kind: "tool" }>;
type MessageItem = Extract<TranscriptItem, { kind: "message" }>;
type DenialItem = Extract<TranscriptItem, { kind: "denial" }>;

/** A tool call's duration: `340 ms` below a second, else `2.5 s`. */
export function duration(ms: number) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** What a tool call left going by a turn that ended shows. */
export const UNFINISHED = "Not finished: the turn ended.";

const STATUS = {
  pending: "pending",
  in_progress: "running",
  completed: "complete",
  failed: "error",
  cancelled: "error",
} as const;

function toolCalls(tools: Array<ToolItem>, ended: boolean) {
  return tools.map((tool) => {
    // The turn ended before the call did: it will never end, and must not spin.
    const unfinished = ended && (tool.status === "pending" || tool.status === "in_progress");
    const output = unfinished ? UNFINISHED : tool.output;
    const status = unfinished ? ("error" as const) : STATUS[tool.status];
    return {
      key: tool.id,
      name: tool.name,
      status,
      target: tool.subagent?.description ?? tool.target,
      duration: tool.durationMs === undefined ? undefined : duration(tool.durationMs),
      errorMessage:
        status === "error"
          ? (output ?? (tool.status === "cancelled" ? "Cancelled" : undefined))
          : undefined,
      resultDetail: output ? (
        <CodeBlock code={output} size="sm" isWrapped width="100%" />
      ) : undefined,
    };
  });
}

/** The groups of tool calls opened, by their turn and first call, and how to open or close one. */
export type OpenGroups = {
  open: ReadonlyArray<string>;
  onOpenChange: (key: string, isOpen: boolean) => void;
};

/** The groups of tool calls opened in the transcript, kept in the history entry for Back and reloads. */
export function useOpenGroups(): OpenGroups {
  const [open, setOpen] = useState<ReadonlyArray<string>>(() => currentEntry().open ?? []);
  // The entry this view was opened on: still shown while the next page loads, it must not write
  // into the next one's entry.
  const [id] = useState(() => currentEntry().id);
  return {
    open,
    onOpenChange: (key, isOpen) => {
      const next = isOpen ? [...open.filter((k) => k !== key), key] : open.filter((k) => k !== key);
      setOpen(next);
      if (currentEntry().id === id) {
        updateEntry({ open: next });
      }
    },
  };
}

/** How close to its end, in pixels, the transcript still counts as read to the end. */
const AT_END = 24;

/** The element that scrolls an element: the nearest that scrolls on its own, or the window. */
function scroller(element: HTMLElement): HTMLElement | undefined {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll") {
      return node;
    }
  }
  return undefined;
}

/**
 * Keeps the end of an element in view as it grows, while `enabled` and while the human is at the
 * end: scrolled up, nothing moves. It scrolls the element's pane on wide screens, the window on
 * narrow ones.
 */
export function useFollowEnd(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element || typeof ResizeObserver === "undefined") {
      return;
    }
    const box = scroller(element);
    const atEnd = () =>
      box
        ? box.scrollHeight - box.scrollTop - box.clientHeight <= AT_END
        : document.documentElement.scrollHeight - window.scrollY - window.innerHeight <= AT_END;
    // Growing does not scroll: the last position read, at the end or not, holds until the human
    // scrolls.
    let following = atEnd();
    const onScroll = () => {
      following = atEnd();
    };
    const target = box ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(() => {
      if (following) {
        if (box) {
          box.scrollTo(0, box.scrollHeight);
        } else {
          window.scrollTo(0, document.documentElement.scrollHeight);
        }
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      target.removeEventListener("scroll", onScroll);
    };
  }, [ref, enabled]);
}

/** What the transcript does with a message or a blocked action, from the session's view. */
export type Actions = {
  session: string;
  /** Whether a message not read yet can be taken back. */
  canTakeBack: boolean;
  /** Called with a message's text once it is taken back. */
  onTakenBack?: (text: string) => void;
  /** Allows a blocked action; absent while the session works. */
  onAllow?: (turn: string, seq: number) => Promise<void>;
  groups?: OpenGroups;
};

/** A message sent to the agent: on the right, its opening line muted, greyed until read. */
function Message({
  item,
  canTakeBack,
  actions,
}: {
  item: MessageItem;
  canTakeBack: boolean;
  actions: Actions;
}) {
  const fate = useFateClient();
  const [error, setError] = useState<string>();
  const pending = item.state === "pending";
  const takeBack = async () => {
    setError(undefined);
    const result = await fate.mutations.session.takeBack({
      input: { session: actions.session, message: item.id },
      view: SessionView,
    });
    if (result.error) {
      setError(refusal(result.error).message);
    } else {
      actions.onTakenBack?.(item.text);
    }
  };
  return (
    <ChatMessage
      sender="user"
      metadata={
        pending || error ? (
          <HStack gap={2} align="center" justify="end">
            {pending && (
              <Text type="supporting" color="secondary">
                Not read yet
              </Text>
            )}
            {pending && canTakeBack && (
              <Button
                variant="ghost"
                size="sm"
                label="Take back"
                isIconOnly
                icon={<Icon icon="close" />}
                clickAction={takeBack}
              />
            )}
            {error && <span {...stylex.props(statusStyles.error)}>{error}</span>}
          </HStack>
        ) : undefined
      }
    >
      <ChatMessageBubble variant={pending ? "ghost" : "filled"}>
        {item.opening && <span {...stylex.props(styles.opening)}>{item.opening}</span>}
        <span {...stylex.props(styles.message, pending && styles.pending)}>{item.text}</span>
      </ChatMessageBubble>
    </ChatMessage>
  );
}

/** An action `auto` mode blocked, with "Allow and retry" while the session waits. */
function Denial({ item, turn, actions }: { item: DenialItem; turn: string; actions: Actions }) {
  const { onAllow } = actions;
  return (
    <Banner
      status="warning"
      title={`Blocked by auto mode: ${item.target ? `${item.tool} ${item.target}` : item.tool}`}
      collapsible={false}
      description={item.allowed ? "Allowed for the session's process." : undefined}
      endContent={
        !item.allowed && onAllow ? (
          <Button label="Allow and retry" clickAction={() => onAllow(turn, item.seq)} />
        ) : undefined
      }
    />
  );
}

/**
 * A page of a turn's items in order: messages on the right, the agent's texts as markdown, each run
 * of tool calls in one group, a sub-agent and its tools in a group of their own, and the system
 * lines and blocked actions as notices.
 */
export function TranscriptItems({
  items,
  turn,
  ended,
  firstMessage,
  queued,
  actions,
}: {
  items: ReadonlyArray<TranscriptItem>;
  turn: string;
  ended: boolean;
  /** The turn's own first message, which started it: taken back only while queued. */
  firstMessage: string | undefined;
  queued: boolean;
  actions: Actions;
}) {
  const { groups } = actions;
  // Each slot holds a group of tools, or one of the other lines.
  type Group = { key: string; label?: string; tools: Array<ToolItem> };
  const shown: Array<ReactNode | Group> = [];
  const subagents = new Map<string, Group>();
  let current: Group | undefined;
  for (const item of items) {
    if (item.kind === "tool") {
      if (item.subagent) {
        const group: Group = {
          key: `${turn}:${item.seq}`,
          label: item.subagent.description,
          tools: [item],
        };
        subagents.set(item.id, group);
        shown.push(group);
        current = undefined;
        continue;
      }
      const parent = item.parent === undefined ? undefined : subagents.get(item.parent);
      if (parent) {
        parent.tools.push(item);
        continue;
      }
      if (item.parent !== undefined) {
        // Its sub-agent started on an earlier page: its tools are a group of their own here.
        const group: Group = { key: `${turn}:${item.seq}`, tools: [item] };
        subagents.set(item.parent, group);
        shown.push(group);
        current = undefined;
        continue;
      }
      if (!current) {
        current = { key: `${turn}:${item.seq}`, tools: [] };
        shown.push(current);
      }
      current.tools.push(item);
      continue;
    }
    current = undefined;
    if (item.kind === "message") {
      const canTakeBack = actions.canTakeBack && (item.id !== firstMessage || queued);
      shown.push(
        <Message key={item.seq} item={item} canTakeBack={canTakeBack} actions={actions} />,
      );
    } else if (item.kind === "text") {
      shown.push(
        <ChatMessage key={item.seq} sender="assistant">
          <ChatMessageBubble>
            <Markdown density="compact" headingLevelStart={4}>
              {item.text}
            </Markdown>
          </ChatMessageBubble>
        </ChatMessage>,
      );
    } else if (item.kind === "system") {
      shown.push(
        <ChatSystemMessage key={item.seq} xstyle={styles.notice}>
          {item.text}
        </ChatSystemMessage>,
      );
    } else {
      shown.push(<Denial key={item.seq} item={item} turn={turn} actions={actions} />);
    }
  }
  return (
    <>
      {shown.map((slot) => {
        if (!slot || typeof slot !== "object" || !("tools" in slot)) {
          return slot as ReactNode;
        }
        const { key, label, tools } = slot;
        return (
          <ChatMessage key={`tools-${key}`} sender="assistant">
            <ChatToolCalls
              calls={toolCalls(tools, ended)}
              label={label}
              isExpanded={groups ? groups.open.includes(key) : undefined}
              onExpandedChange={
                groups ? (open: boolean) => groups.onOpenChange(key, open) : undefined
              }
            />
          </ChatMessage>
        );
      })}
    </>
  );
}

function TurnPage({
  id,
  turn,
  ended,
  firstPage,
  latest,
  queued,
  actions,
}: {
  id: string;
  turn: string;
  ended: boolean;
  firstPage: boolean;
  /** The latest page of the session's latest turn, which may still grow. */
  latest: boolean;
  queued: boolean;
  actions: Actions;
}) {
  const page = useTurnLog(id, latest);
  // The turn's first message, which started it, is the first of its first page.
  const first = firstPage ? page?.items.find((item) => item.kind === "message") : undefined;
  return page ? (
    <TranscriptItems
      items={page.items}
      turn={turn}
      ended={ended}
      firstMessage={first?.kind === "message" ? first.id : undefined}
      queued={queued}
      actions={actions}
    />
  ) : null;
}

/** How a turn that did not end well ended. */
function ending(state: string, reason: string | null): string | undefined {
  if (state === "stopped") {
    return reason ? (reason.startsWith("Stopped") ? reason : `Stopped: ${reason}`) : "Stopped";
  }
  if (state === "failed") {
    return reason ? `Failed: ${reason}` : "Failed";
  }
  return undefined;
}

/**
 * A turn: a workflow turn opened by its step, its items, and how it ended when it went wrong.
 * `latest` for the session's latest turn, which may still go on.
 */
function Turn({ id, latest, actions }: { id: string; latest: boolean; actions: Actions }) {
  const turn = useTurn(id, latest);
  if (!turn) {
    return null;
  }
  const ended = turn.state !== "running" && turn.state !== "queued";
  const end = ending(turn.state, turn.reason);
  return (
    <div id={`turn-${turn.id}`} {...stylex.props(styles.turn)}>
      {turn.kind === "workflow" && (
        <ChatSystemMessage variant="divider">Run: {stepLabel(turn.step ?? "")}</ChatSystemMessage>
      )}
      {Array.from({ length: turn.pages }, (_, page) => (
        <TurnPage
          key={page}
          id={`${turn.id}:${page}`}
          turn={turn.id}
          ended={ended}
          firstPage={page === 0}
          latest={latest && page === turn.pages - 1}
          queued={turn.state === "queued"}
          actions={actions}
        />
      ))}
      {end && (
        <ChatSystemMessage xstyle={styles.notice}>
          <Text color={turn.state === "failed" ? "error" : "secondary"}>{end}</Text>
        </ChatSystemMessage>
      )}
    </div>
  );
}

/**
 * A session's turns in order, named "Conversation", each kept up to date while it goes on. The
 * address's `#turn-<id>` scrolls to its turn once drawn. `onAllow` allows a blocked action; it is
 * given only while the session does not work.
 */
export function Transcript({
  session,
  onAllow,
  onTakenBack,
  groups,
}: {
  session: { id: string; turns: ReadonlyArray<string> };
  onAllow?: (turn: string, seq: number) => Promise<void>;
  onTakenBack?: (text: string) => void;
  groups?: OpenGroups;
}) {
  const agent = useAgent();
  useEffect(() => {
    const { hash } = window.location;
    if (hash.startsWith("#turn-")) {
      document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: "start" });
    }
  }, []);
  const actions: Actions = {
    session: session.id,
    canTakeBack: Boolean(agent?.capabilities.takeBack),
    onTakenBack,
    onAllow,
    groups,
  };
  return (
    <ChatMessageList align="top" density="compact" aria-label="Conversation">
      {session.turns.map((id, index) => (
        <Turn key={id} id={id} latest={index === session.turns.length - 1} actions={actions} />
      ))}
    </ChatMessageList>
  );
}
