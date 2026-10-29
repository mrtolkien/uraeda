import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { ChatMessage, ChatMessageBubble, ChatSystemMessage } from "@astryxdesign/core/Chat";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useMemo, useState } from "react";
import { useFateClient } from "react-fate";
import type { ChatImage, Item } from "uraeda-server/fate";
import { agentStories, MessageStories } from "./AgentStories.tsx";
import { refusal } from "./errors.ts";
import { StatusText } from "./fields/StatusText.tsx";
import { ProseMarkdown } from "./Prose.tsx";
import { MessageBody } from "./MessageBody.tsx";
import { EarlierRecap, StretchRecap } from "./session/RecapLine.tsx";
import { slotsOf } from "./session/stretches.ts";
import { useOfferPlugins } from "./SessionOffers.tsx";
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
  /** Allows a blocked action. */
  onAllow?: (turn: string, seq: number) => Promise<void>;
  /** Called with a message's text and images once it is taken back. */
  onTakenBack?: (text: string, images: ReadonlyArray<ChatImage>) => void;
  session: string;
  /**
   * The address of the session's Activity at the stretch `key`, or at none without one: what a
   * recap line opens. Without it, a recap line is text.
   */
  stretchHref?: (key?: string) => string;
  /** The sub-agents the main agent runs now, which the live line counts. */
  subagents?: number;
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
            {error && <StatusText tone="error">{error}</StatusText>}
          </HStack>
        ) : undefined
      }
      sender="user"
    >
      <ChatMessageBubble
        data-words="human"
        variant={pending ? "ghost" : "filled"}
        xstyle={pending ? undefined : styles.user}
      >
        <MessageBody item={item} pending={pending} />
      </ChatMessageBubble>
    </ChatMessage>
  );
}

/**
 * An agent's message, as markdown, with the stories it links and its offer card once it ended:
 * flat text across the page, with no bubble of its own, so a story shows in the width the page
 * has. `at` is its place in the session, `<turn>:<seq>`.
 */
function AgentMessage({ at, streaming, text }: { at: string; streaming: boolean; text: string }) {
  const stories = useMemo<MessageStories>(() => ({ ended: !streaming }), [streaming]);
  const plugins = useOfferPlugins(at, streaming, text);
  return (
    <ChatMessage sender="assistant">
      <ChatMessageBubble variant="ghost" width={AGENT_WIDTH} xstyle={styles.agent}>
        <MessageStories value={stories}>
          {/* Drawn again once its offer shows: Astryx keeps a text's parse while the text stays. */}
          <ProseMarkdown
            components={agentStories}
            key={plugins ? "offer" : "text"}
            plugins={plugins}
          >
            {text}
          </ProseMarkdown>
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
 * A page of a turn's items in order: messages on the right, the agent's texts as markdown, each
 * stretch of the main agent's calls and thoughts one recap line after its last call, and the system
 * lines and blocked actions as notices. A sub-agent's calls and thoughts are not the chat's: the
 * Activity shows them.
 */
export function TranscriptItems({
  actions,
  after,
  endsOpen,
  firstMessage,
  items,
  queued,
  turn,
}: {
  actions: Actions;
  /**
   * The page before these items, drawn above them, whose open stretch their first one goes on, or
   * whose open stretch is drawn before them when they do not go on with it: undefined on the turn's
   * first page, when the items do not start their page, or when the page before is not drawn.
   */
  after: number | undefined;
  /**
   * Whether a stretch open at the items' end draws its line here: on the turn's last page, unless
   * the live line stands for it. On a page before, the page after draws it, whole.
   */
  endsOpen: boolean;
  /** The turn's own first message, which started it: taken back only while queued. */
  firstMessage: string | undefined;
  items: ReadonlyArray<TranscriptItem>;
  queued: boolean;
  turn: string;
}) {
  const slots = slotsOf(turn, items);
  // A stretch the page before ends with, which these items do not go on with, is drawn before them:
  // the page before left it to this one. A page of a sub-agent's items alone leaves it to the page
  // after, unless it ends the turn.
  const first = slots[0];
  const earlier =
    after !== undefined && first?.kind !== "stretch" && (slots.length > 0 || endsOpen) ? (
      <EarlierRecap actions={actions} after={after} key="recap-earlier" turn={turn} />
    ) : null;
  const drawn = slots.map((slot) => {
    if (slot.kind === "stretch") {
      const { stretch } = slot;
      return stretch.open && !endsOpen ? null : (
        <StretchRecap
          actions={actions}
          after={after}
          key={`recap-${stretch.key}`}
          stretch={stretch}
          turn={turn}
        />
      );
    }
    const { item } = slot;
    if (item.kind === "message") {
      const canTakeBack = actions.canTakeBack && (item.id !== firstMessage || queued);
      return <Message actions={actions} canTakeBack={canTakeBack} item={item} key={item.seq} />;
    }
    if (item.kind === "text") {
      return (
        <AgentMessage
          at={`${turn}:${item.seq}`}
          key={item.seq}
          streaming={item.streaming}
          text={item.text}
        />
      );
    }
    if (item.kind === "system") {
      return (
        <ChatSystemMessage key={item.seq} xstyle={styles.notice}>
          {item.text}
        </ChatSystemMessage>
      );
    }
    if (item.kind === "denial") {
      return <Denial actions={actions} item={item} key={item.seq} turn={turn} />;
    }
    // A call or a thought is a stretch's: `slotsOf` leaves none alone.
    return null;
  });
  return [earlier, ...drawn];
}
