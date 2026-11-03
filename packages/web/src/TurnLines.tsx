// The line at the end of a turn that went wrong, and how long an activity lasted, in words. What
// the agent does now is the live recap line's, `session/RecapLine.tsx`.
import { ChatSystemMessage } from "@astryxdesign/core/Chat";
import { Text } from "@astryxdesign/core/Text";
import * as stylex from "@stylexjs/stylex";
import { Suspense } from "react";
import { useSessionFollowed } from "./data.ts";

const styles = stylex.create({
  notice: {
    // Astryx centres a system line, as a chat's date separators are; the UI layout decision keeps
    // text left-aligned.
    justifyContent: "flex-start",
    textAlign: "start",
  },
});

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
 * How a turn that did not end well ended; its reason alone, such as a usage limit's text, while
 * its run is `waiting` to continue by itself.
 */
export function ending(state: string, reason: string | null, waiting = false): string | undefined {
  if (waiting && reason) {
    return reason;
  }
  if (state === "stopped") {
    return reason ? (reason.startsWith("Stopped") ? reason : `Stopped: ${reason}`) : "Stopped";
  }
  if (state === "failed") {
    return reason ? `Failed: ${reason}` : "Failed";
  }
  return undefined;
}

/** The line that says how a turn that did not end well ended. */
export function Ending({ state, text }: { state: string; text: string }) {
  return (
    <ChatSystemMessage xstyle={styles.notice}>
      <Text color={state === "failed" ? "error" : "secondary"}>{text}</Text>
    </ChatSystemMessage>
  );
}

/** A turn of a session, as its ending reads it. */
type EndedTurn = { id: string; reason: string | null; session: string; state: string };

/**
 * The ending of a session's latest turn: a failed one reads its reason alone, not as a failure,
 * while its run waits to continue by itself.
 */
export function LatestEnding({ text, turn }: { text: string; turn: EndedTurn }) {
  const plain = <Ending state={turn.state} text={text} />;
  return turn.state === "failed" ? (
    <Suspense fallback={plain}>
      <FailedEnding turn={turn} />
    </Suspense>
  ) : (
    plain
  );
}

/** A latest turn's failure, or its reason alone while its run waits, as its session says. */
function FailedEnding({ turn }: { turn: EndedTurn }) {
  const session = useSessionFollowed(turn.session);
  const waiting = session?.wait != null && session.statusTurn === turn.id;
  const text = ending(turn.state, turn.reason, waiting) ?? "Failed";
  return <Ending state={waiting ? "waiting" : turn.state} text={text} />;
}
