import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import {
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
  ChatSystemMessage,
} from "@astryxdesign/core/Chat";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Markdown } from "@astryxdesign/core/Markdown";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { ChatImage, Item } from "uraeda-server/fate";
import { agentStories, MessageStories } from "./AgentStories.tsx";
import { useAgent } from "./data.ts";
import { useTurn, useTurnLog } from "./sessionData.ts";
import { refusal } from "./errors.ts";
import { stepLabel } from "./labels.ts";
import { statusStyles } from "./Question.tsx";
import { MessageBody } from "./MessageBody.tsx";
import { StatusMark } from "./StatusMark.tsx";
import { ToolGroup, type ToolGroupSlot } from "./ToolGroups.tsx";
import type { OpenKeys } from "./useOpenKeys.ts";
import { SessionView } from "./views.ts";

const styles = stylex.create({
  notice: {
    // Astryx centres a system line, as a chat's date separators are; the UI layout decision keeps
    // text left-aligned.
    justifyContent: "flex-start",
    textAlign: "start",
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
type MessageItem = Extract<TranscriptItem, { kind: "message" }>;
type DenialItem = Extract<TranscriptItem, { kind: "denial" }>;

/** What the transcript does with a message or a blocked action, from the session's view. */
export type Actions = {
  /** Whether a blocked action can be allowed now: not while the session works. */
  canAllow: boolean;
  /** Whether a message not read yet can be taken back. */
  canTakeBack: boolean;
  groups?: OpenKeys;
  /** Allows a blocked action. */
  onAllow?: (turn: string, seq: number) => Promise<void>;
  /** Called with a message's text and images once it is taken back. */
  onTakenBack?: (text: string, images: ReadonlyArray<ChatImage>) => void;
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
      actions.onTakenBack?.(item.text, item.images ?? []);
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
        <MessageBody item={item} pending={pending} />
      </ChatMessageBubble>
    </ChatMessage>
  );
}

/**
 * An agent's message, as markdown, with the stories it links once it ended: its bubble takes the
 * column's width while a story shows in it, so the story's two widths have room.
 */
function AgentMessage({ streaming, text }: { streaming: boolean; text: string }) {
  const [shown, setShown] = useState(0);
  const stories = useMemo<MessageStories>(
    () => ({
      ended: !streaming,
      shown: () => {
        setShown((count) => count + 1);
        return () => setShown((count) => count - 1);
      },
    }),
    [streaming],
  );
  return (
    <ChatMessage sender="assistant">
      <ChatMessageBubble width={shown > 0 ? "100%" : undefined}>
        <MessageStories value={stories}>
          <Markdown components={agentStories} density="compact" headingLevelStart={4}>
            {text}
          </Markdown>
        </MessageStories>
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
  const shown: Array<ReactNode | ToolGroupSlot> = [];
  const subagents = new Map<string, ToolGroupSlot>();
  let current: ToolGroupSlot | undefined;
  for (const item of items) {
    if (item.kind === "tool") {
      if (item.subagent) {
        const group: ToolGroupSlot = {
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
        const group: ToolGroupSlot = { key: `${turn}:${item.seq}`, tools: [item] };
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
      shown.push(<AgentMessage key={item.seq} streaming={item.streaming} text={item.text} />);
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
        return <ToolGroup ended={ended} group={slot} groups={groups} key={`tools-${slot.key}`} />;
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
  groups?: OpenKeys;
  onAllow?: (turn: string, seq: number) => Promise<void>;
  onTakenBack?: (text: string, images: ReadonlyArray<ChatImage>) => void;
  session: { id: string; turns: ReadonlyArray<string> };
}) {
  const agent = useAgent();
  const list = useRef<HTMLDivElement>(null);
  // The log announces nothing: the session's announcer says when a turn starts and ends, not each
  // word streamed. Astryx's `ChatMessageList` sets `aria-live` after the props it passes on.
  useEffect(() => {
    list.current?.setAttribute("aria-live", "off");
  }, []);
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
    <ChatMessageList align="top" aria-label="Conversation" density="compact" ref={list}>
      {session.turns.map((id, index) => (
        <Turn actions={actions} id={id} key={id} latest={index === session.turns.length - 1} />
      ))}
    </ChatMessageList>
  );
}
