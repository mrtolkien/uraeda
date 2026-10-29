// The account's latest reported five-hour allowance, in the "Usage" pane at the column's foot, and
// until a run reports it, nothing. In the closed rail the pane is hidden and a small bar stands in
// for it, on the icons' axis: what is left of the window, red once it is nearly gone.
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { columnVars } from "../shell/column.stylex.ts";
import { Suspense } from "react";
import { useAgent } from "../data.ts";
import { UsageWindow } from "../UsageWindow.tsx";
import { useClosedRail } from "../layout/closedRail.ts";
import { Pane } from "../layout/Pane.tsx";

/** What is left, in percent, at which the allowance reads as nearly gone: `UsageWindow`'s too. */
const LOW = 20;

const styles = stylex.create({
  // Room under the pane, which Settings, the row below it, would otherwise sit too close to.
  apart: {
    marginBlockEnd: spacingVars["--spacing-2"],
  },
  // What is left of the window, `width` of the track, in `color`.
  fill: (width: string, color: string) => ({
    backgroundColor: color,
    height: "100%",
    width,
  }),
  // The usage pane, gone in the closed rail, where the bar stands in for it.
  gone: { display: "none" },
  // The rail's bar: hidden but in the closed rail (`railShown`), centred in the 38 px box the
  // rail's rows have (`shell/column.stylex.ts`).
  rail: {
    alignItems: "center",
    display: "none",
    justifyContent: "center",
    marginInlineStart: columnVars["--rail-allowance-nudge"],
    paddingBlock: spacingVars["--spacing-2"],
    width: columnVars["--rail-row-box"],
  },
  railShown: { display: "flex" },
  // The bar's track, in the border's colour.
  track: {
    backgroundColor: colorVars["--color-border"],
    height: columnVars["--rail-allowance-height"],
    overflow: "hidden",
    width: columnVars["--rail-allowance-width"],
  },
  usage: {
    paddingBlockEnd: spacingVars["--spacing-2"],
    paddingBlockStart: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
  },
});

function Bar() {
  const agent = useAgent();
  const limit = agent?.fiveHourLimit;
  const isRail = useClosedRail();
  if (!agent || !limit) {
    return null;
  }
  const remaining = Math.min(100, Math.max(0, 100 - limit.percentUsed));
  return (
    <>
      <Pane isGroup title="Usage" xstyle={[styles.apart, isRail && styles.gone]}>
        <VStack gap={1} xstyle={styles.usage}>
          <UsageWindow kind={agent.kind} limit={limit} name="5h" />
        </VStack>
      </Pane>
      <div data-rail-only {...stylex.props(styles.rail, isRail && styles.railShown)}>
        <div
          aria-label="5h allowance remaining"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(remaining)}
          role="progressbar"
          title={`5h: ${Math.round(remaining)}% left`}
          {...stylex.props(styles.track)}
        >
          <div
            {...stylex.props(
              styles.fill(
                `${remaining}%`,
                remaining <= LOW ? colorVars["--color-text-red"] : colorVars["--color-accent"],
              ),
            )}
          />
        </div>
      </div>
    </>
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
