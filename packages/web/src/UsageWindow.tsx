// One usage window of the agent's account, in a line and its bar: the harness's mark, the window's
// name, what is left, and when it resets. Home's Usage pane and the sidebar's allowance share it.
import { HStack } from "@astryxdesign/core/HStack";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { HarnessMark } from "./HarnessMark.tsx";

export type Limit = { percentUsed: number; resetsAt: string };

/** When a window resets: its time today, or its day and time for the week. */
function resets(resetsAt: string, hasDay: boolean) {
  return new Date(resetsAt).toLocaleString([], {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    ...(hasDay ? { weekday: "short" } : {}),
  });
}

export function UsageWindow({
  hasDay = false,
  kind,
  limit,
  name,
}: {
  hasDay?: boolean;
  kind: string;
  limit: Limit;
  name: string;
}) {
  const remaining = Math.min(100, Math.max(0, 100 - limit.percentUsed));
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
          <time dateTime={limit.resetsAt}>{resets(limit.resetsAt, hasDay)}</time>
        </Text>
      </HStack>
    </VStack>
  );
}
