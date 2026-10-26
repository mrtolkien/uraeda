// Home's Usage pane: the account's 5 h window and its week, as the agent's runs last reported them.
// A report without the weekly window shows no week, never 0%; before any report, it says so.
import { HStack } from "@astryxdesign/core/HStack";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { Suspense } from "react";
import { useAgent } from "../data.ts";
import { HarnessMark } from "../HarnessMark.tsx";
import { Pane } from "../layout/Pane.tsx";
import { Empty } from "../layout/Empty.tsx";

const styles = stylex.create({
  body: {
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-2"],
  },
  name: { flexGrow: 1 },
});

type Limit = { percentUsed: number; resetsAt: string };

/** When a window resets: its time today, or its day and time for the week. */
function resets(resetsAt: string, hasDay: boolean) {
  return new Date(resetsAt).toLocaleString([], {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    ...(hasDay ? { weekday: "short" } : {}),
  });
}

/** One window: its name, how much is used, when it resets, and its bar. */
function Window({ hasDay, limit, name }: { hasDay: boolean; limit: Limit; name: string }) {
  const used = Math.min(100, Math.max(0, Math.round(limit.percentUsed)));
  return (
    <VStack gap={1}>
      <HStack align="center" gap={2}>
        <Text weight="semibold" xstyle={styles.name}>
          {name}
        </Text>
        <Text color="secondary" type="supporting">
          resets <time dateTime={limit.resetsAt}>{resets(limit.resetsAt, hasDay)}</time>
        </Text>
        <Text hasTabularNumbers>{`${used}% used`}</Text>
      </HStack>
      <ProgressBar
        isLabelHidden
        label={`${name} used`}
        value={used}
        variant={used >= 80 ? "error" : "accent"}
      />
    </VStack>
  );
}

/** The windows the agent's runs reported, with its harness's mark. */
function Windows() {
  const agent = useAgent();
  const fiveHour = agent?.fiveHourLimit;
  const week = agent?.weekLimit;
  if (!agent || (!fiveHour && !week)) {
    return <Empty isInset>No run reported usage yet.</Empty>;
  }
  return (
    <VStack gap={3} xstyle={styles.body}>
      <HStack align="center" gap={2}>
        <HarnessMark isDecorative kind={agent.kind} />
        <Text color="secondary" type="supporting">
          {agent.name}
        </Text>
      </HStack>
      {fiveHour && <Window hasDay={false} limit={fiveHour} name="5 h window" />}
      {week && <Window hasDay limit={week} name="Week" />}
    </VStack>
  );
}

export function Usage() {
  return (
    <Pane level={3} title="Usage">
      <Suspense fallback={<Empty isInset>Reading the usage…</Empty>}>
        <Windows />
      </Suspense>
    </Pane>
  );
}
