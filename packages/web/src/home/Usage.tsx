// Home's Usage pane: the account's 5 h window and its week, as the agent's runs last reported them.
// A report without the weekly window shows no week, never 0%; before any report, it says so.
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { Suspense } from "react";
import { useAgent } from "../data.ts";
import { UsageWindow } from "../UsageWindow.tsx";
import { Pane } from "../layout/Pane.tsx";
import { Empty } from "../layout/Empty.tsx";

const styles = stylex.create({
  body: {
    paddingBlockEnd: spacingVars["--spacing-2"],
    paddingBlockStart: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
  },
});

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
      {fiveHour && <UsageWindow kind={agent.kind} limit={fiveHour} name="5h" />}
      {week && <UsageWindow hasDay kind={agent.kind} limit={week} name="Week" />}
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
