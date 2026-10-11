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

/**
 * The watch of each repository. The core stops watching once its handle is collected, so the
 * server keeps them for as long as it runs.
 */
const watches = new Map<string, WatchHandle>();

/** Watches the repository, once, and publishes its changes until the handle is closed. */
export function startLive(binding: Binding, repo: string): WatchHandle {
  let handle = watches.get(repo);
  if (!handle) {
    handle = binding.watch(repo, publish);
    watches.set(repo, handle);
  }
  return handle;
}
