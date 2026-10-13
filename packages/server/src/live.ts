import { join } from "node:path";
import type { Changes, WatchHandle } from "uraeda-binding";
import type { Binding } from "./fate/context.ts";
import { pages } from "./fate/sessions.ts";
import { AGENT_ID, PRIORITIES_ID, SESSION_LIST_ID, WORKSPACE_ID } from "./fate/views.ts";
import { live } from "./fate.ts";
import type { Adapter } from "./runner/adapter.ts";
import { SessionCache } from "./runner/cache.ts";
import { type SessionChange, Sessions } from "./runner/sessions.ts";

/** A session's live updates are sent at most this often while its items change. */
export const SESSION_UPDATE_MS = 250;
/** How often the server checks that the agent still works. */
export const CHECK_EVERY_MS = 60_000;

let sent = 0;
/** A live update's event ID, unique in this process. */
const eventId = (topic: string) => `${topic}:${Date.now()}:${sent++}`;

/**
 * Sends live updates for each change the core's watcher reports. A feature's change may change its
 * step, which its session's status reads, and a feature that goes leaves the sidebar: the list and
 * the features' sessions go too.
 */
export function publish(changes: Changes, owner?: { sessions: Sessions; repo: string }) {
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
  if (owner && (changes.features.length > 0 || changes.workspace)) {
    live.update("SessionList", SESSION_LIST_ID, { eventId: `sessions:${eventId}` });
    void publishSessions(owner, changes.features);
  }
}

/** Sends the sessions of the features: none in a repository without a main checkout. */
async function publishSessions(
  { sessions, repo }: { sessions: Sessions; repo: string },
  folders: Array<string>,
) {
  const root = await sessions.mainRoot(repo).catch(() => undefined);
  if (root === undefined) {
    return;
  }
  for (const folder of folders) {
    const session = sessions.cache.featureSession(root, folder);
    if (session) {
      live.update("Session", session.id, { eventId: eventId(`Session:${session.id}`) });
    }
  }
}

/**
 * The watch of each repository. The core stops watching once its handle is collected, so the
 * server keeps them for as long as it runs.
 */
const watches = new Map<string, WatchHandle>();

/** Stops watching a repository, as the browser tests do once done with a copy of the fixture. */
export function stopLive(repo: string): void {
  watches.get(repo)?.close();
  watches.delete(repo);
}

/**
 * Watches the repository, once, and publishes its changes until the handle is closed, with its
 * features' sessions from `sessions`.
 */
export function startLive(binding: Binding, repo: string, sessions?: Sessions): WatchHandle {
  let handle = watches.get(repo);
  if (!handle) {
    handle = binding.watch(repo, (changes) =>
      publish(changes, sessions === undefined ? undefined : { sessions, repo }),
    );
    watches.set(repo, handle);
  }
  return handle;
}

type Timer = ReturnType<typeof setTimeout>;

/**
 * Sends the live updates of the session manager's changes. A session's record, its changed turns,
 * and their last two item pages, where a tool call may finish, go out at most every 250 ms while
 * items change, with the sidebar's list when a sub-agent starts or ends. A turn's state change,
 * and any other change of the session, go out at once, with the list, the session's feature, and
 * the workspace's working folders.
 */
export function sessionPublisher(cache: SessionCache): (change: SessionChange) => void {
  /** The sessions whose items change: when each was last sent, and its pending update. */
  const sessions = new Map<
    string,
    { last: number; timer?: Timer; turns: Set<number>; subagents: string }
  >();
  const update = (type: string, id: string) =>
    live.update(type, id, { eventId: eventId(`${type}:${id}`) });
  const turn = (id: number) => {
    update("Turn", String(id));
    const count = pages(cache, id);
    for (const page of [count - 2, count - 1].filter((page) => page >= 0)) {
      update("TurnLog", `${id}:${page}`);
    }
  };
  /** The sub-agents running in the turns, which the sidebar lists. */
  const subagents = (turns: Iterable<number>) =>
    [...turns]
      .flatMap((id) => cache.itemsOf(id, "tool"))
      .filter((tool) => tool.subagent !== undefined && tool.status === "in_progress")
      .map((tool) => tool.id)
      .join(" ");
  const send = (
    session: string,
    entry: { last: number; turns: Set<number>; subagents: string },
  ) => {
    entry.last = Date.now();
    update("Session", session);
    const turns = [...entry.turns];
    entry.turns.clear();
    turns.forEach(turn);
    const running = subagents(turns);
    if (running !== entry.subagents) {
      entry.subagents = running;
      update("SessionList", SESSION_LIST_ID);
    }
  };
  return (change) => {
    if ("agent" in change) {
      update("Agent", AGENT_ID);
      return;
    }
    const { session } = change;
    if (change.turn === undefined || change.state !== undefined) {
      const entry = sessions.get(session);
      clearTimeout(entry?.timer);
      sessions.delete(session);
      update("Session", session);
      if (change.turn !== undefined) {
        turn(change.turn);
      }
      update("SessionList", SESSION_LIST_ID);
      if (change.folder !== null) {
        update("Feature", change.folder);
      }
      update("Workspace", WORKSPACE_ID);
      return;
    }
    let entry = sessions.get(session);
    if (!entry) {
      entry = { last: -Infinity, turns: new Set(), subagents: "" };
      sessions.set(session, entry);
    }
    entry.turns.add(change.turn);
    if (entry.timer) {
      return;
    }
    const wait = entry.last + SESSION_UPDATE_MS - Date.now();
    if (wait <= 0) {
      send(session, entry);
      return;
    }
    const pending = entry;
    pending.timer = setTimeout(() => {
      pending.timer = undefined;
      send(session, pending);
    }, wait);
  };
}

/** A session manager whose changes are sent as live updates. */
export function createSessions(options: {
  adapter: Adapter;
  cache: SessionCache;
  binding: Binding;
}): Sessions {
  return new Sessions({ ...options, onChange: sessionPublisher(options.cache) });
}

/**
 * The server's session manager: its cache opened in the data folder, the turns a stopped server
 * left marked stopped, and the agent checked now and every 60 seconds. `stop` stops its turns and
 * closes its processes.
 */
export async function startSessions(options: {
  adapter: Adapter;
  binding: Binding;
  dataDir: string;
}): Promise<{ sessions: Sessions; stop: () => Promise<void> }> {
  const cache = SessionCache.open(join(options.dataDir, "runner.sqlite"));
  cache.interrupted("Stopped: the server stopped while it ran.");
  const sessions = createSessions({ ...options, cache });
  await sessions.check();
  const timer = setInterval(() => void sessions.check(), CHECK_EVERY_MS);
  timer.unref();
  return {
    sessions,
    stop: async () => {
      clearInterval(timer);
      await sessions.closeAll();
      sessions.close();
    },
  };
}
