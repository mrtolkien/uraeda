import { ChatMessageList } from "@astryxdesign/core/Chat";
import * as stylex from "@stylexjs/stylex";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatImage } from "uraeda-server/fate";
import { useAgent } from "./data.ts";
import { openAtEnd } from "./following.ts";
import { currentEntry } from "./routes.tsx";
import { Tail } from "./tail.tsx";
import type { Actions } from "./TranscriptMessages.tsx";
import type { OpenKeys } from "./useOpenKeys.ts";

export { elapsed } from "./TurnLines.tsx";
export { type Actions, sentAt } from "./TranscriptMessages.tsx";

const styles = stylex.create({
  list: {
    // The list reaches the screen's edges, as the page's inset is taken back: its own 12 px padding
    // is left to the human's messages, and the agent's text takes it back (see `AgentMessage`).
    marginInline: "var(--page-bleed)",
  },
});

/** For a transcript whose page does not tell the human's scroll: it opens at its end. */
const neverAway = () => false;

/**
 * The latest messages of a session's turns in order, named "Conversation", kept up to date while
 * it goes on. The address's `#turn-<id>` scrolls to its turn once drawn. `onAllow` allows a blocked action, while
 * `canAllow`.
 */
export function Transcript({
  away = neverAway,
  canAllow = true,
  groups,
  onAllow,
  onTakenBack,
  session,
}: {
  /** Whether the human scrolled away from the end before the tail first drew. */
  away?: () => boolean;
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
  // Where Back or a reload left the page, read as it opens: the page saves its own position into
  // the entry as the human scrolls, and a tail that first draws late must not take the human back to
  // where they were half a second ago, as after "Jump to the latest" (R112).
  const [opened] = useState(() => ({ scroll: currentEntry().scroll }));
  // The tail drew: scrolls to the turn the address names, else to where Back left the page, else to
  // the end, unless the human scrolled away from it meanwhile (R110).
  const settled = useCallback(() => {
    const scrolledAway = away();
    const { hash } = window.location;
    const { scroll } = opened;
    if (hash.startsWith("#turn-")) {
      document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: "start" });
    } else if (typeof scroll === "number") {
      window.scrollTo(0, scroll);
    } else if (list.current && !scrolledAway) {
      openAtEnd(list.current, opened);
    }
  }, [away, opened]);
  const actions: Actions = {
    canAllow,
    canTakeBack: Boolean(agent?.capabilities.takeBack),
    groups,
    onAllow,
    onTakenBack,
    session: session.id,
  };
  return (
    <ChatMessageList
      align="top"
      aria-label="Conversation"
      density="compact"
      ref={list}
      xstyle={styles.list}
    >
      <Tail actions={actions} key={session.id} onSettled={settled} turns={session.turns} />
    </ChatMessageList>
  );
}
