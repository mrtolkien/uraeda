// The lines at the end of a turn: what the agent does now, and how a turn that went wrong ended.
import { ChatSystemMessage } from "@astryxdesign/core/Chat";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useState } from "react";
import { StatusMark } from "./StatusMark.tsx";

const styles = stylex.create({
  notice: {
    // Astryx centres a system line, as a chat's date separators are; the UI layout decision keeps
    // text left-aligned.
    justifyContent: "flex-start",
    textAlign: "start",
  },
});

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
export function Activity({ label, since }: { label: string; since: string }) {
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
