import { ChatMessageList, ChatSystemMessage } from "@astryxdesign/core/Chat";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState } from "react";
import type { ChatImage } from "uraeda-server/fate";
import { useAgent } from "./data.ts";
import { useTurn, useTurnLog } from "./sessionData.ts";
import { stepLabel } from "./labels.ts";
import { StatusMark } from "./StatusMark.tsx";
import { type Actions, TranscriptItems } from "./TranscriptMessages.tsx";
import type { OpenKeys } from "./useOpenKeys.ts";

export { type Actions, sentAt } from "./TranscriptMessages.tsx";

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

/** One page of a turn's items. */
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
