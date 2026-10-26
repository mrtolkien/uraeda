// The account's latest reported five-hour allowance, in the "Usage" pane at the column's foot:
// hidden while folded, and until a run reports it.
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Suspense } from "react";
import { useAgent } from "../data.ts";
import { UsageWindow } from "../UsageWindow.tsx";
import { Pane } from "../layout/Pane.tsx";
import { useColumnFold } from "../shell/fold.ts";

const styles = stylex.create({
  usage: {
    paddingBlockEnd: spacingVars["--spacing-2"],
    paddingBlockStart: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
  },
});

function Bar() {
  const agent = useAgent();
  const { isFolded } = useColumnFold();
  const limit = agent?.fiveHourLimit;
  if (!agent || !limit || isFolded) {
    return null;
  }
  return (
    <Pane isGroup title="Usage">
      <VStack gap={1} xstyle={styles.usage}>
        <UsageWindow kind={agent.kind} limit={limit} name="5h" />
      </VStack>
    </Pane>
  );
}

/** Usage loads on its own, keeping the navigation visible while its request settles. */
export function Allowance() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
