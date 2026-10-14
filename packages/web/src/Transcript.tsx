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
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useState } from "react";
import { useFateClient } from "react-fate";
import type { Item } from "uraeda-server/fate";
import { useAgent, useTurn, useTurnLog } from "./data.ts";
import { refusal } from "./errors.ts";
import { stepLabel } from "./labels.ts";
import { statusStyles } from "./Question.tsx";
import { StatusMark } from "./StatusMark.tsx";
import { currentEntry, updateEntry } from "./routes.tsx";
import { SessionView } from "./views.ts";

const styles = stylex.create({
  message: {
    // A message keeps its line breaks, and a long path wraps instead of running off screen.
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
  },
  notice: {
    // Astryx centres a system line, as a chat's date separators are; the UI layout decision keeps
    // text left-aligned.
    justifyContent: "flex-start",
    textAlign: "start",
  },
  opening: {
    // The chat's opening line, muted above the human's text.
    color: colorVars["--color-text-secondary"],
    display: "block",
    marginBlockEnd: spacingVars["--spacing-2"],
    whiteSpace: "pre-wrap",
  },
  pending: {
    // A message the agent has not read yet.
    color: colorVars["--color-text-secondary"],
  },
  turn: {
    // A turn's lines, spaced as the list spaces them, in a box the address's anchor scrolls to.
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-3"],
  },
});

/** A line of a turn, as the server keeps it. */
type TranscriptItem = Item & { seq: number };
type ToolItem = Extract<TranscriptItem, { kind: "tool" }>;
type MessageItem = Extract<TranscriptItem, { kind: "message" }>;
type DenialItem = Extract<TranscriptItem, { kind: "denial" }>;

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

/** The groups of tool calls opened, by their turn and first call, and how to open or close one. */
type OpenGroups = {
  onOpenChange: (key: string, isOpen: boolean) => void;
  open: ReadonlyArray<string>;
};

/** The groups of tool calls opened in the transcript, kept in the history entry for Back and reloads. */
export function useOpenGroups(): OpenGroups {
  const [open, setOpen] = useState<ReadonlyArray<string>>(() => currentEntry().open ?? []);
  // The entry this view was opened on: still shown while the next page loads, it must not write
  // into the next one's entry.
  const [id] = useState(() => currentEntry().id);
  return {
    onOpenChange: (key, isOpen) => {
      const next = isOpen ? [...open.filter((k) => k !== key), key] : open.filter((k) => k !== key);
      setOpen(next);
      if (currentEntry().id === id) {
        updateEntry({ open: next });
      }
    },
    open,
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
 * Shows the end of a session's transcript as it opens, unless Back or a reload brings a saved
 * position, or the address names a turn: the pane beside the feature page on wide screens, the
 * window on narrow ones.
 */
export function useOpenAtEnd(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = ref.current;
    const { pane, scroll } = currentEntry();
    if (!element || scroll !== undefined || pane !== undefined) {
      return;
    }
    if (window.location.hash.startsWith("#turn-")) {
      return;
    }
    const box = scroller(element);
    if (box) {
      box.scrollTo(0, box.scrollHeight);
    } else {
      window.scrollTo(0, document.documentElement.scrollHeight);
    }
    // Once, as the view opens.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  /** Whether a blocked action can be allowed now: not while the session works. */
  canAllow: boolean;
  /** Whether a message not read yet can be taken back. */
  canTakeBack: boolean;
  groups?: OpenGroups;
  /** Allows a blocked action. */
  onAllow?: (turn: string, seq: number) => Promise<void>;
  /** Called with a message's text once it is taken back. */
  onTakenBack?: (text: string) => void;
  session: string;
};

/** When a message was sent: its time today, else its date too, as `Oct 12, 14:05`. */
export function sentAt(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const time = at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (at.toDateString() === now.toDateString()) {
    return time;
  }
  const date = at.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(at.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
  return `${date}, ${time}`;
}

/**
 * A message sent to the agent: on the right, its opening line muted, greyed until read, with when
 * it was sent.
 */
function Message({
  actions,
  canTakeBack,
  item,
}: {
  actions: Actions;
  canTakeBack: boolean;
  item: MessageItem;
}) {
  const fate = useFateClient();
  const [error, setError] = useState<string>();
  const pending = item.state === "pending";
  const takeBack = async () => {
    setError(undefined);
    const result = await fate.mutations.session.takeBack({
      input: { message: item.id, session: actions.session },
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
      metadata={
        item.at || pending || error ? (
          <HStack align="center" gap={2} justify="end">
            {item.at && (
              <Text color="secondary" type="supporting">
                <time dateTime={item.at}>{sentAt(item.at)}</time>
              </Text>
            )}
            {pending && (
              <Text color="secondary" type="supporting">
                Not read yet
              </Text>
            )}
            {pending && canTakeBack && (
              <Button
                clickAction={takeBack}
                icon={<Icon icon="close" />}
                isIconOnly
                label="Take back"
                size="sm"
                variant="ghost"
              />
            )}
            {error && <span {...stylex.props(statusStyles.error)}>{error}</span>}
          </HStack>
        ) : undefined
      }
      sender="user"
    >
      <ChatMessageBubble variant={pending ? "ghost" : "filled"}>
        {item.opening && <span {...stylex.props(styles.opening)}>{item.opening}</span>}
        <span {...stylex.props(styles.message, pending && styles.pending)}>{item.text}</span>
      </ChatMessageBubble>
    </ChatMessage>
  );
}

/**
 * An action `auto` mode blocked, with "Allow and retry", disabled while the session works: it
 * reopens the process. An action no allow rule can match alone, like a command with a `*`, says so
 * instead.
 */
function Denial({ actions, item, turn }: { actions: Actions; item: DenialItem; turn: string }) {
  const { canAllow, onAllow } = actions;
  return (
    <Banner
      collapsible={false}
      description={
        item.allowed
          ? "Allowed for the session's process."
          : item.rule === undefined
            ? "No allow rule can match only this action."
            : undefined
      }
      endContent={
        !item.allowed && item.rule !== undefined && onAllow ? (
          <Button
            clickAction={() => onAllow(turn, item.seq)}
            isDisabled={!canAllow}
            label="Allow and retry"
          />
        ) : undefined
      }
      status="warning"
      title={`Blocked by auto mode: ${item.target ? `${item.tool} ${item.target}` : item.tool}`}
    />
  );
}

/**
 * A page of a turn's items in order: messages on the right, the agent's texts as markdown, each run
 * of tool calls in one group, a sub-agent and its tools in a group of their own, and the system
 * lines and blocked actions as notices.
 */
function TranscriptItems({
  actions,
  ended,
  firstMessage,
  items,
  queued,
  turn,
}: {
  actions: Actions;
  ended: boolean;
  /** The turn's own first message, which started it: taken back only while queued. */
  firstMessage: string | undefined;
  items: ReadonlyArray<TranscriptItem>;
  queued: boolean;
  turn: string;
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
        <Message actions={actions} canTakeBack={canTakeBack} item={item} key={item.seq} />,
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
      shown.push(<Denial actions={actions} item={item} key={item.seq} turn={turn} />);
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
              isExpanded={groups ? groups.open.includes(key) : undefined}
              label={label}
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
  actions,
  ended,
  firstPage,
  id,
  latest,
  queued,
  turn,
}: {
  actions: Actions;
  ended: boolean;
  firstPage: boolean;
  id: string;
  /** The latest page of the session's latest turn, which may still grow. */
  latest: boolean;
  queued: boolean;
  turn: string;
}) {
  const page = useTurnLog(id, latest);
  // The turn's first message, which started it, is the first of its first page.
  const first = firstPage ? page?.items.find((item) => item.kind === "message") : undefined;
  return page ? (
    <TranscriptItems
      actions={actions}
      ended={ended}
      firstMessage={first?.kind === "message" ? first.id : undefined}
      items={page.items}
      queued={queued}
      turn={turn}
    />
  ) : null;
}

/** A running turn's activity shows how long it lasted from this long on. */
const SHOW_ELAPSED_MS = 10_000;

/** How long an activity lasted: `45 s`, `2 min 5 s`, or `12 min` from ten minutes on. */
export function elapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) {
    return `${seconds} s`;
  }
  return minutes >= 10 || seconds % 60 === 0
    ? `${minutes} min`
    : `${minutes} min ${seconds % 60} s`;
}

/**
 * The line at the end of a running turn: what the agent does now, "Thinking" or "Writing
 * spec.md", and for how long once it lasts, so a quiet agent reads apart from a stuck one. The
 * conversation is a live region: screen readers hear the dot's label as the activity changes, not
 * the time, which changes every second.
 */
function Activity({ label, since }: { label: string; since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const lasted = now - Date.parse(since);
  return (
    <ChatSystemMessage xstyle={styles.notice}>
      <HStack align="center" gap={2}>
        <StatusMark label={label} small status="working" />
        <Text aria-hidden color="secondary">
          {lasted >= SHOW_ELAPSED_MS ? `${label} · ${elapsed(lasted)}` : `${label}…`}
        </Text>
      </HStack>
    </ChatSystemMessage>
  );
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
function Turn({ actions, id, latest }: { actions: Actions; id: string; latest: boolean }) {
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
          actions={actions}
          ended={ended}
          firstPage={page === 0}
          id={`${turn.id}:${page}`}
          key={page}
          latest={latest && page === turn.pages - 1}
          queued={turn.state === "queued"}
          turn={turn.id}
        />
      ))}
      {turn.state === "running" && turn.activity && (
        <Activity label={turn.activity.label} since={turn.activity.since} />
      )}
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
 * address's `#turn-<id>` scrolls to its turn once drawn. `onAllow` allows a blocked action, while
 * `canAllow`.
 */
export function Transcript({
  canAllow = true,
  groups,
  onAllow,
  onTakenBack,
  session,
}: {
  canAllow?: boolean;
  groups?: OpenGroups;
  onAllow?: (turn: string, seq: number) => Promise<void>;
  onTakenBack?: (text: string) => void;
  session: { id: string; turns: ReadonlyArray<string> };
}) {
  const agent = useAgent();
  useEffect(() => {
    const { hash } = window.location;
    if (hash.startsWith("#turn-")) {
      document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: "start" });
    }
  }, []);
  const actions: Actions = {
    canAllow,
    canTakeBack: Boolean(agent?.capabilities.takeBack),
    groups,
    onAllow,
    onTakenBack,
    session: session.id,
  };
  return (
    <ChatMessageList align="top" aria-label="Conversation" density="compact">
      {session.turns.map((id, index) => (
        <Turn actions={actions} id={id} key={id} latest={index === session.turns.length - 1} />
      ))}
    </ChatMessageList>
  );
}
