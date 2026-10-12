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
  Root as Views,
  workspaceDataView,
} from "./fate/views.ts";

export { draftDataView, featureDataView, fileDataView, prioritiesDataView, workspaceDataView };
export { PRIORITIES_ID, WORKSPACE_ID } from "./fate/views.ts";

/** The types fate's generated client and the UI's views use, named after each view's type. */
export type Workspace = Entity<typeof workspaceDataView, "Workspace">;
export type Feature = Entity<typeof featureDataView, "Feature">;
export type WorkflowFile = Entity<typeof fileDataView, "WorkflowFile">;
export type Priorities = Entity<typeof prioritiesDataView, "Priorities">;
export type Draft = Entity<typeof draftDataView, "Draft">;

export type FateVariables = { fate: Context };

export const Root = Views;

/** Live updates: the core's watcher marks what changed, and fate sends it to the views. */
export const live = createLiveEventBus();

/** One fate server for every app: each request brings its app's context, set by `createApp`. */
export const fateServer = createFateServer({
  context: ({ adapterContext }: { adapterContext?: HonoContext<{ Variables: FateVariables }> }) =>
    adapterContext!.get("fate"),
  live,
  mutations,
  roots: Root,
  sources,
});
