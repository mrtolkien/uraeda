// The line at the end of a turn that went wrong, and how long an activity lasted, in words. What
// the agent does now is the live recap line's, `session/RecapLine.tsx`.
import { ChatSystemMessage } from "@astryxdesign/core/Chat";
import { Text } from "@astryxdesign/core/Text";
import * as stylex from "@stylexjs/stylex";

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

/** How a turn that did not end well ended. */
export function ending(state: string, reason: string | null): string | undefined {
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
