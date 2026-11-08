// Home's Usage pane: the windows the runtime of new sessions here reported, Claude Code's 5 h window
// and its week, in their order. A window not reported shows nothing, never 0%; before any report,
// it says so.
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

/** The windows the runtime's runs reported, with its harness's mark. */
function Windows() {
  const agent = useAgent();
  if (!agent || agent.usage.length === 0) {
    return <Empty isInset>No run reported usage yet.</Empty>;
  }
  return (
    <VStack gap={3} xstyle={styles.body}>
      {agent.usage.map((window) => (
        <UsageWindow key={window.id} kind={agent.kind} window={window} />
      ))}
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
