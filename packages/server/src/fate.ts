// The fate server module: fate's Vite plugin reads its exports to type the UI's client.
import { createFateServer, createLiveEventBus, type Entity } from "@nkzw/fate/server";
import type { Context as HonoContext } from "hono";
import type { Context } from "./fate/context.ts";
import { mutations } from "./fate/mutations.ts";
import { sources } from "./fate/sources.ts";
import {
  draftDataView,
  featureDataView,
  fileDataView,
  prioritiesDataView,
  proposalHintsDataView,
  Root as Views,
  runDataView,
  runLogDataView,
  runnerDataView,
  workspaceDataView,
} from "./fate/views.ts";

export {
  draftDataView,
  featureDataView,
  fileDataView,
  prioritiesDataView,
  runDataView,
  runLogDataView,
  runnerDataView,
  proposalHintsDataView,
  workspaceDataView,
};
export { PRIORITIES_ID, PROPOSAL_HINTS_ID, RUNNER_ID, WORKSPACE_ID } from "./fate/views.ts";

/** The types fate's generated client and the UI's views use, named after each view's type. */
export type Workspace = Entity<typeof workspaceDataView, "Workspace">;
export type Feature = Entity<typeof featureDataView, "Feature">;
export type WorkflowFile = Entity<typeof fileDataView, "WorkflowFile">;
export type Priorities = Entity<typeof prioritiesDataView, "Priorities">;
export type Draft = Entity<typeof draftDataView, "Draft">;
export type ProposalHints = Entity<typeof proposalHintsDataView, "ProposalHints">;
export type Runner = Entity<typeof runnerDataView, "Runner">;
export type Run = Entity<typeof runDataView, "Run">;
export type RunLog = Entity<typeof runLogDataView, "RunLog">;
/** What started a run, for `run.start`. */
export type { Trigger } from "./runner/events.ts";

export type FateVariables = { fate: Context };

export const Root = Views;

const bus = createLiveEventBus();

/**
 * Live updates: the core's watcher marks what changed, and fate sends it to the views. A view reads
 * its data, then subscribes: each subscription is sent the current data once, so a change made
 * between the two is not missed until the next one.
 */
export const live: typeof bus = {
  ...bus,
  listen(type, id, handler, options) {
    const stop = bus.listen!(type, id, handler, options);
    setTimeout(() => {
      if (!options?.signal?.aborted) {
        handler({ id, type: "update" });
      }
    });
    return stop;
  },
};

/** One fate server for every app: each request brings its app's context, set by `createApp`. */
export const fateServer = createFateServer({
  context: ({ adapterContext }: { adapterContext?: HonoContext<{ Variables: FateVariables }> }) =>
    adapterContext!.get("fate"),
  live,
  mutations,
  roots: Root,
  sources,
});
