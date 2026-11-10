// The usage windows every runtime on reported, Claude Code's five hours and its week, then Codex's,
// in the "Usage" pane at the column's foot, as Home's pane lists them, and until a run reports one,
// nothing. In the closed rail the pane is hidden and a small bar stands in for it, on the icons'
// axis: what is left of the five hours alone, the shortest, of the runtime in view, red once it
// is nearly gone: the runtime of the session shown, or of the feature shown, its latest session's,
// else the one new sessions run on. With accounts, the bar is the first window of the account of
// the session in view, of the feature's latest session likewise, else, with no session in view, of the one a
// new session would start on; a session whose account is not listed, or has none, shows no bar.
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { columnVars } from "../shell/column.stylex.ts";
import { Suspense } from "react";
import { useAgent, useFeature } from "../data.ts";
import { type Runtime, useSessionAgent } from "../runtimes.ts";
import { useRoute } from "../routes.tsx";
import type { Route } from "../routeTable.ts";
import { fiveHours, UsageWindows, useReportedRuntimes } from "../UsageWindow.tsx";
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

/**
 * The window the rail's bar shows: with accounts, the first of the account `account` names, none
 * when the session's account is not listed or it has none; `undefined` is no session in view, which
 * shows the account a new session would start on, and the window is labelled by the account's name.
 * Without accounts, the runtime's five hours, none when it did not report them.
 */
function barWindow(agent: Runtime | undefined, account: string | null | undefined) {
  if (agent === undefined || agent.accounts.length === 0) {
    return agent && fiveHours(agent.usage);
  }
  const shown =
    account === undefined
      ? agent.accounts.find((each) => each.isNext)
      : agent.accounts.find((each) => each.name === account);
  const [first] = shown?.state === "ready" ? shown.windows : [];
  return first && { ...first, label: `${shown?.name} ${first.label}` };
}

/** The sidebar's Usage pane: one line per login, its five hours alone; the stories draw it too. */
export function AllowancePane({
  isRail = false,
  runtimes,
}: {
  isRail?: boolean;
  runtimes: ReadonlyArray<Runtime>;
}) {
  return (
    <Pane isGroup title="Usage" xstyle={[styles.apart, isRail && styles.gone]}>
      <UsageWindows isCompact runtimes={runtimes} xstyle={styles.usage} />
    </Pane>
  );
}

function Bar({ account, agent }: { account?: string | null; agent: Runtime | undefined }) {
  const window = barWindow(agent, account);
  const reported = useReportedRuntimes();
  const isRail = useClosedRail();
  if (reported.length === 0) {
    return null;
  }
  return (
    <>
      <AllowancePane isRail={isRail} runtimes={reported} />
      {window && <RailBar isRail={isRail} window={window} />}
    </>
  );
}

/**
 * The rail's one bar: the five hours' of the runtime in view, the one that runs out first.
 */
function RailBar({ isRail, window }: { isRail: boolean; window: { label: string; used: number } }) {
  const remaining = Math.min(100, Math.max(0, 100 - window.used * 100));
  return (
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
  );
}

function SessionBar({ id }: { id: string }) {
  const { account, runtime } = useSessionAgent(id);
  return <Bar account={account} agent={runtime.runtime} />;
}

/** A feature's latest session's bar, else the one of a new session. */
function FeatureBar({ folder }: { folder: string }) {
  const session = useFeature(folder)?.session;
  return session ? <SessionBar id={session} /> : <DefaultBar />;
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
