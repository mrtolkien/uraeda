import type { Changes } from "uraeda-binding";
import type { Binding } from "./fate/context.ts";
import { changedRecords } from "./fate/preview.ts";
import { pages } from "./fate/sessions.ts";
import {
  AGENT_ID,
  INBOX_ID,
  PRIORITIES_ID,
  SESSION_LIST_ID,
  TRIAGE_ID,
  WORKSPACE_ID,
} from "./fate/views.ts";
import { type LiveBus, live } from "./fate.ts";
import { Previews } from "./preview/runner.ts";
import type { Host, Hosts } from "./repositories.ts";
import type { Adapter } from "./runner/adapter.ts";
import type { SessionCache } from "./runner/cache.ts";
import { type SessionChange, Sessions } from "./runner/sessions.ts";

/** A session's live updates are sent at most this often while its items change. */
export const SESSION_UPDATE_MS = 250;

let sent = 0;
/** A live update's event ID, unique in this process. */
const eventId = (topic: string) => `${topic}:${Date.now()}:${sent++}`;

/** Sends a record's live update on a bus. */
const sender = (bus: LiveBus) => (type: string, id: string) =>
  bus.update(type, id, { eventId: eventId(`${type}:${id}`) });

/**
 * The hosts the session manager's changes go to, once they are open: the session manager starts
 * first, as the hosts' watches publish its sessions.
 */
export type HostsOf = () => Pick<Hosts, "byPath" | "all"> | undefined;

/**
 * Sends a repository's live updates, on its host's bus, for each change the core's watcher
 * reports. A feature's change may change its step, which its session's status reads, and its
 * branch's changes, and a feature that goes leaves the sidebar: the list and the features'
 * sessions go too. A change of the inbox sends its triage too.
 */
export function publish(changes: Changes, host: Pick<Host, "path" | "live">, sessions?: Sessions) {
  const { live } = host;
  live.update("Workspace", WORKSPACE_ID, { eventId: eventId("workspace") });
  for (const folder of changes.features) {
    live.update("Feature", folder, { eventId: eventId(`feature:${folder}`) });
    live.update("BranchChanges", folder, { eventId: eventId(`changes:${folder}`) });
  }
  for (const file of changes.files) {
    live.update("WorkflowFile", file, { eventId: eventId(`file:${file}`) });
  }
  // The inbox and the priorities share the commit bar's count, so a change of either sends both.
  if (changes.priorities || changes.inbox) {
    live.update("Priorities", PRIORITIES_ID, { eventId: eventId("priorities") });
    live.update("Inbox", INBOX_ID, { eventId: eventId("inbox") });
  }
  if (changes.inbox) {
    live.update("WorkflowFile", TRIAGE_ID, { eventId: eventId(`file:${TRIAGE_ID}`) });
  }
  if (sessions && (changes.features.length > 0 || changes.workspace)) {
    live.update("SessionList", SESSION_LIST_ID, { eventId: eventId("sessions") });
    // The host's path is the main checkout, which keys its sessions.
    for (const folder of changes.features) {
      const session = sessions.cache.featureSession(host.path, folder);
      if (session) {
        live.update("Session", session.id, { eventId: eventId(`Session:${session.id}`) });
      }
    }
  }
}

/**
 * A Storybook runner whose changes are sent live: when a checkout's state changes, its `Preview`
 * record and every `Story` record read for it, on the bus of the repository that read them.
 */
export function livePreviews(
  options: Omit<ConstructorParameters<typeof Previews>[0] & {}, "onChange"> = {},
): Previews {
  const previews: Previews = new Previews({
    ...options,
    onChange: (base) => {
      const changed = changedRecords(previews, base);
      if (changed !== undefined) {
        const update = sender(changed.live);
        update("Preview", changed.folder);
        for (const id of changed.stories) {
          update("Story", id);
        }
      }
    },
  });
  return previews;
}

type Timer = ReturnType<typeof setTimeout>;

/**
 * Sends the live updates of the session manager's changes. A session's record, its changed turns,
 * and their last two item pages, where a tool call may finish, go out at most every 250 ms while
 * items change, with the sidebar's list when a sub-agent starts or ends. A turn's state change,
 * and any other change of the session, go out at once, with the list, the session's feature, and
 * the workspace's working folders.
 */
export function sessionPublisher(
  cache: SessionCache,
  hosts: HostsOf,
): (change: SessionChange) => void {
  /** The sessions whose items change: when each was last sent, and its pending update. */
  const sessions = new Map<
    string,
    { last: number; repo: string; subagents: string; timer?: Timer; turns: Set<number> }
  >();
  const turn = (update: ReturnType<typeof sender>, id: number) => {
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
  /**
   * The bus of the session's repository, read when its updates go: none once its repository left
   * the list, and its updates are dropped.
   */
  const busOf = (repo: string) => hosts()?.byPath(repo)?.live;
  const send = (
    session: string,
    entry: { last: number; repo: string; subagents: string; turns: Set<number> },
  ) => {
    entry.last = Date.now();
    const bus = busOf(entry.repo);
    if (!bus) {
      entry.turns.clear();
      return;
    }
    const update = sender(bus);
    update("Session", session);
    const turns = [...entry.turns];
    entry.turns.clear();
    turns.forEach((id) => turn(update, id));
    const running = subagents(turns);
    if (running !== entry.subagents) {
      entry.subagents = running;
      update("SessionList", SESSION_LIST_ID);
    }
  };
  return (change) => {
    if ("agent" in change) {
      // The agent is every repository's: every bus is sent it, the global one too.
      for (const bus of [live, ...(hosts()?.all() ?? []).map((host) => host.live)]) {
        sender(bus)("Agent", AGENT_ID);
      }
      return;
    }
    const { session } = change;
    if (change.turn === undefined || change.state !== undefined) {
      const entry = sessions.get(session);
      clearTimeout(entry?.timer);
      sessions.delete(session);
      const bus = busOf(change.repo);
      if (!bus) {
        return;
      }
      const update = sender(bus);
      update("Session", session);
      if (change.turn !== undefined) {
        turn(update, change.turn);
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
      entry = { last: -Infinity, repo: change.repo, subagents: "", turns: new Set() };
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

/** A session manager whose changes are sent as live updates, to the hosts of their repositories. */
export function createSessions(options: {
  adapter: Adapter;
  binding: Binding;
  cache: SessionCache;
  hosts: HostsOf;
}): Sessions {
  return new Sessions({ ...options, onChange: sessionPublisher(options.cache, options.hosts) });
}
