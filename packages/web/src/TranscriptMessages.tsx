import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { ChatMessage, ChatMessageBubble, ChatSystemMessage } from "@astryxdesign/core/Chat";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Markdown } from "@astryxdesign/core/Markdown";
import { Text } from "@astryxdesign/core/Text";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useMemo, useState } from "react";
import { useFateClient } from "react-fate";
import type { ChatImage, Item } from "uraeda-server/fate";
import { agentStories, MessageStories } from "./AgentStories.tsx";
import { refusal } from "./errors.ts";
import { statusStyles } from "./Question.tsx";
import { MessageBody } from "./MessageBody.tsx";
import { ToolGroup, type ToolGroupSlot } from "./ToolGroups.tsx";
import type { OpenKeys } from "./useOpenKeys.ts";
import { SessionView } from "./views.ts";

/** The page's width: the list's 12 px at the sides, less the page's inset, given back. */
const AGENT_WIDTH = `calc(100% + 2 * (${spacingVars["--spacing-3"]} - ${spacingVars["--spacing-2"]}))`;

const styles = stylex.create({
  agent: {
    // The agent's text takes the page's width: no padding of its own, and the list's 12 px at the
    // sides given back down to the page's inset.
    marginInline: `calc(${spacingVars["--spacing-2"]} - ${spacingVars["--spacing-3"]})`,
    maxWidth: "none",
    paddingInline: 0,
  },
  notice: {
    // Astryx centres a system line, as a chat's date separators are; the UI layout decision keeps
    // text left-aligned.
    justifyContent: "flex-start",
    textAlign: "start",
  },
  user: {
    backgroundColor: colorVars["--color-background-blue"],
    // On the page's inset, as the agent's text: the list's 12 px at the side is given back.
    marginInlineEnd: `calc(${spacingVars["--spacing-2"]} - ${spacingVars["--spacing-3"]})`,
  },
});

/** A line of a turn, as the server keeps it. */
export type TranscriptItem = Item & { seq: number };
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
      <ChatMessageBubble
        variant={pending ? "ghost" : "filled"}
        xstyle={pending ? undefined : styles.user}
      >
        <MessageBody item={item} pending={pending} />
      </ChatMessageBubble>
    </ChatMessage>
  );
}

/**
 * An agent's message, as markdown, with the stories it links once it ended: flat text across the
 * page, with no bubble of its own, so a story shows in the width the page has.
 */
function AgentMessage({ streaming, text }: { streaming: boolean; text: string }) {
  const stories = useMemo<MessageStories>(() => ({ ended: !streaming }), [streaming]);
  return (
    <ChatMessage sender="assistant">
      <ChatMessageBubble variant="ghost" width={AGENT_WIDTH} xstyle={styles.agent}>
        <MessageStories value={stories}>
          <Markdown
            autolink="gfm"
            components={agentStories}
            density="compact"
            headingLevelStart={4}
          >
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
export function TranscriptItems({
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
