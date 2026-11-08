// Home's Usage pane: the windows each runtime on here reported, Claude Code's 5 h window and its
// week, in the runtimes' order and then the windows'. A window not reported shows nothing, never
// 0%; before any runtime on reports one, it says so.
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Suspense } from "react";
import { UsageWindows, useReportedRuntimes } from "../UsageWindow.tsx";
import { Pane } from "../layout/Pane.tsx";
import { Empty } from "../layout/Empty.tsx";

const styles = stylex.create({
  body: {
    paddingBlockEnd: spacingVars["--spacing-2"],
    paddingBlockStart: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
  },
});

/** The windows the runs of each runtime on reported, each with its harness's mark. */
function Windows() {
  const reported = useReportedRuntimes();
  if (reported.length === 0) {
    return <Empty isInset>No run reported usage yet.</Empty>;
  }
  return <UsageWindows runtimes={reported} xstyle={styles.body} />;
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
