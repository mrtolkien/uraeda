import type { Changes, WatchHandle } from "uraeda-binding";
import type { Binding } from "./fate/context.ts";
import { PRIORITIES_ID, WORKSPACE_ID } from "./fate/views.ts";
import { live } from "./fate.ts";

/** Sends live updates for each change the core's watcher reports. */
export function publish(changes: Changes) {
  const eventId = `${Date.now()}`;
  live.update("Workspace", WORKSPACE_ID, { eventId: `workspace:${eventId}` });
  for (const folder of changes.features) {
    live.update("Feature", folder, { eventId: `feature:${folder}:${eventId}` });
  }
  for (const file of changes.files) {
    live.update("WorkflowFile", file, { eventId: `file:${file}:${eventId}` });
  }
  if (changes.priorities) {
    live.update("Priorities", PRIORITIES_ID, { eventId: `priorities:${eventId}` });
  }
}

/** Watches the repository, and publishes its changes, until the handle is closed. */
export function startLive(binding: Binding, repo: string): WatchHandle {
  return binding.watch(repo, publish);
}
