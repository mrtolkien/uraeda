// Home's Usage pane: the windows each runtime on here reported, in the runtimes' order and then the
// windows'; a runtime with accounts shows each account's name, then its five hours and its week.
// A window not reported shows nothing, never 0%; before any runtime on reports one, it says so.
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Suspense } from "react";
import { UsageWindows, useReportedRuntimes } from "../UsageWindow.tsx";
import type { Runtime } from "../runtimes.ts";
import { Pane } from "../layout/Pane.tsx";
import { Empty } from "../layout/Empty.tsx";

const styles = stylex.create({
  body: {
    paddingBlockEnd: spacingVars["--spacing-2"],
    paddingBlockStart: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
  },
});

/** The pane's windows, `runtimes`' each with its harness's mark: the stories draw them too. */
export function UsageBody({ runtimes }: { runtimes: ReadonlyArray<Runtime> }) {
  if (runtimes.length === 0) {
    return <Empty isInset>No run reported usage yet.</Empty>;
  }
  return <UsageWindows runtimes={runtimes} xstyle={styles.body} />;
}

/** The windows the runs of each runtime on reported, and the accounts' usage. */
function Windows() {
  return <UsageBody runtimes={useReportedRuntimes()} />;
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
