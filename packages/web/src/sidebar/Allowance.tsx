// The usage windows the runtime in view reported, Claude Code's five hours and its week, in the
// "Usage" pane at the column's foot, and until a run reports one, nothing: the runtime of the
// session shown, or of the feature shown, its latest session's, else the one new sessions run on.
// In the closed rail the pane is hidden and a small bar stands in for it, on the icons' axis: what
// is left of the first window alone, the shortest, red once it is nearly gone.
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { columnVars } from "../shell/column.stylex.ts";
import { Suspense } from "react";
import { useAgent } from "../data.ts";
import { type Runtime, useFeatureRuntime, useSessionRuntime } from "../runtimes.ts";
import { useRoute } from "../routes.tsx";
import type { Route } from "../routeTable.ts";
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

function Bar({ agent }: { agent: Runtime | undefined }) {
  const window = agent?.usage[0];
  const isRail = useClosedRail();
  if (!agent || !window) {
    return null;
  }
  const remaining = Math.min(100, Math.max(0, 100 - window.used * 100));
  return (
    <>
      <Pane isGroup title="Usage" xstyle={[styles.apart, isRail && styles.gone]}>
        <VStack gap={3} xstyle={styles.usage}>
          {agent.usage.map((each) => (
            <UsageWindow key={each.id} kind={agent.kind} window={each} />
          ))}
        </VStack>
      </Pane>
      {/* The rail has room for one bar: the first window's, the one that runs out first. */}
      <div data-rail-only {...stylex.props(styles.rail, isRail && styles.railShown)}>
        <div
          aria-label={`${window.label} allowance remaining`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(remaining)}
          role="progressbar"
          title={`${window.label}: ${Math.round(remaining)}% left`}
          {...stylex.props(styles.track)}
        >
          <div
            {...stylex.props(
              styles.fill(
                `${remaining}%`,
                remaining <= LOW ? colorVars["--color-error"] : colorVars["--color-accent"],
              ),
            )}
          />
        </div>
      </div>
    </>
  );
}

function SessionBar({ id }: { id: string }) {
  return <Bar agent={useSessionRuntime(id).runtime} />;
}

function FeatureBar({ folder }: { folder: string }) {
  return <Bar agent={useFeatureRuntime(folder).runtime} />;
}

function DefaultBar() {
  return <Bar agent={useAgent()} />;
}

/** The pages of a feature whose runs go to its latest session. */
const FEATURE_PAGES = new Set<Route["page"]>(["feature", "file", "run", "session"]);

/** The bar of the runtime in view, by the page shown. */
function InView({ route }: { route: Route }) {
  if (route.page === "session-id") {
    return <SessionBar id={route.id} />;
  }
  if ("folder" in route && FEATURE_PAGES.has(route.page)) {
    return <FeatureBar folder={route.folder} />;
  }
  return <DefaultBar />;
}

/** Usage loads on its own, keeping the navigation visible while its request settles. */
export function Allowance() {
  const { route } = useRoute();
  return (
    <Suspense fallback={null}>
      <InView route={route} />
    </Suspense>
  );
}
