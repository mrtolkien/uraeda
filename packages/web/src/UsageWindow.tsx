// One usage window a runtime reported, in a line and its bar: the harness's mark, the window's
// label, what is left, and when it resets. Home's Usage pane and the sidebar's allowance share it.
import { HStack } from "@astryxdesign/core/HStack";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { HarnessMark } from "./HarnessMark.tsx";

/** A runtime's usage window: its label, the share used from 0 to 1, and its reset time. */
export type Window = { label: string; resetsAt: string; used: number };

/** When a window resets: its time today, or its day and time on another day. */
function resets(resetsAt: string) {
  const at = new Date(resetsAt);
  const hasDay = at.toDateString() !== new Date().toDateString();
  return at.toLocaleString([], {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    ...(hasDay ? { weekday: "short" } : {}),
  });
}

export function UsageWindow({ kind, window }: { kind: string; window: Window }) {
  const remaining = Math.min(100, Math.max(0, 100 - window.used * 100));
  const name = window.label;
  return (
    <VStack gap={1}>
      <ProgressBar
        isLabelHidden
        label={`${name} allowance remaining`}
        value={remaining}
        variant={remaining <= 20 ? "error" : "accent"}
      />
      <HStack align="center" gap={2}>
        <HarnessMark isDecorative kind={kind} />
        <Text color="secondary" hasTabularNumbers type="supporting">
          {name} {Math.round(remaining)}% left - reset{" "}
          <time dateTime={window.resetsAt}>{resets(window.resetsAt)}</time>
        </Text>
      </HStack>
    </VStack>
  );
}
