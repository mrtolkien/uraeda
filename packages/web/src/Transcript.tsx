import { ChatMessageList } from "@astryxdesign/core/Chat";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useCallback, useEffect, useRef } from "react";
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
    // The compact list pads its messages by 12 px at the sides: taken back, the page's inset is the
    // only one, so the agent's text takes the width the phone has.
    marginInline: `calc(-1 * ${spacingVars["--spacing-3"]})`,
  },
});

/**
 * The latest messages of a session's turns in order, named "Conversation", kept up to date while
 * it goes on. The address's `#turn-<id>` scrolls to its turn once drawn. `onAllow` allows a blocked action, while
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
  // The tail drew: scrolls to the turn the address names, else to where Back left the page, else to
  // the end.
  const settled = useCallback(() => {
    const { hash } = window.location;
    const { scroll } = currentEntry();
    if (hash.startsWith("#turn-")) {
      document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: "start" });
    } else if (typeof scroll === "number") {
      window.scrollTo(0, scroll);
    } else if (list.current) {
      openAtEnd(list.current);
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
