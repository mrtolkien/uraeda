import type { Changes } from "uraeda-binding";
import type { Binding } from "./fate/context.ts";
import { changedRecords, takeWatched, type Watched } from "./fate/preview.ts";
import { pages } from "./fate/sessions.ts";
import { SETTINGS_ID } from "./fate/settings.ts";
import {
  AGENT_ID,
  INBOX_ID,
  PRIORITIES_ID,
  SESSION_LIST_ID,
  DEFAULT_ROUND_IDS,
  WORKSPACE_ID,
} from "./fate/views.ts";
import { type LiveBus, live as globalLive } from "./fate.ts";
import { NEEDS_YOU_ID } from "./fate/needs-you.ts";
import { LEDGER_ID } from "./fate/views-ledger.ts";
import { Previews } from "./preview/runner.ts";
import type { Host, Hosts } from "./repositories.ts";
import type { Adapter } from "./runner/adapter.ts";
import type { SessionCache } from "./runner/cache.ts";
import { type SessionChange, Sessions } from "./runner/sessions.ts";
import type { ServerSettings } from "./settings.ts";

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
 * reports. A feature's change may change its step, which its session's status reads, its
 * branch's changes, and its history, and a feature that goes leaves the sidebar: the list and the features'
 * sessions go too. A change of the inbox sends its triage and the decisions check too, and one of the constitution or a
 * decision, the ledger; a decision a branch changed sends its page, and its spec's file.
 */
export function publish(changes: Changes, host: Pick<Host, "path" | "live">, sessions?: Sessions) {
  const { live } = host;
  live.update("Workspace", WORKSPACE_ID, { eventId: eventId("workspace") });
  // What needs the human spans every repository: its view is on the global bus.
  globalLive.update("NeedsYouList", NEEDS_YOU_ID, { eventId: eventId("needs-you") });
  for (const folder of changes.features) {
    live.update("Feature", folder, { eventId: eventId(`feature:${folder}`) });
    live.update("BranchChanges", folder, { eventId: eventId(`changes:${folder}`) });
    live.update("History", folder, { eventId: eventId(`history:${folder}`) });
    live.update("RecommendedMessage", folder, { eventId: eventId(`recommended:${folder}`) });
  }
  for (const file of changes.files) {
    live.update("WorkflowFile", file, { eventId: eventId(`file:${file}`) });
  }
  for (const id of changes.branchDecisions) {
    live.update("BranchDecision", id, { eventId: eventId(`branch-decision:${id}`) });
  }
  // The inbox and the priorities share the commit bar's count, so a change of either sends both.
  if (changes.priorities || changes.inbox) {
    live.update("Priorities", PRIORITIES_ID, { eventId: eventId("priorities") });
    live.update("Inbox", INBOX_ID, { eventId: eventId("inbox") });
  }
  // The ledger carries the decisions check's status, which a change of the inbox's rounds moves.
  if (changes.decisions || changes.inbox) {
    live.update("Ledger", LEDGER_ID, { eventId: eventId("ledger") });
  }
  if (changes.inbox) {
    for (const id of DEFAULT_ROUND_IDS) {
      live.update("WorkflowFile", id, { eventId: eventId(`file:${id}`) });
    }
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

/** Sends the live updates of the records read for a base: its `Preview`, and its `Story`s. */
function sendWatched({ folder, live, stories }: Watched) {
  const update = sender(live);
  update("Preview", folder);
  for (const id of stories) {
    update("Story", id);
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
        sendWatched(changed);
      }
    },
  });
  return previews;
}

/**
 * Renews the Storybooks as the frame secret is replaced: the records read for every base are
 * taken, every Storybook, starting or running, is stopped, and their records are sent, so the pages
 * that read them read them again under the new base, which starts their Storybooks again. A
 * Storybook no page reads stays stopped.
 */
export function renewPreviews(previews: Previews): void {
  const records = takeWatched(previews);
  previews.stopEach();
  records.forEach(sendWatched);
}

type Timer = ReturnType<typeof setTimeout>;

/**
 * Sends the agent's live update on every bus, the global one too, as the agent is every
 * repository's, and each repository's features' recommended messages, which read whether it is
 * available.
 */
function publishAgent(binding: Pick<Binding, "readWorkspace">, hosts: HostsOf) {
  for (const bus of [globalLive, ...(hosts()?.all() ?? []).map((host) => host.live)]) {
    sender(bus)("Agent", AGENT_ID);
  }
  for (const host of hosts()?.all() ?? []) {
    void binding.readWorkspace(host.path).then(
      ({ features }) => {
        const update = sender(host.live);
        features.forEach(({ folder }) => update("RecommendedMessage", folder));
      },
      // A repository the core cannot read has no feature to update.
      () => undefined,
    );
  }
}

/**
 * Sends the live updates of the session manager's changes. A session's record, its changed turns,
 * and their last two item pages, where a tool call may finish, go out at most every 250 ms while
 * items change, with the sidebar's list when a sub-agent starts or ends. A turn's state change,
 * and any other change of the session, go out at once, with the list, the session's feature, and
 * the workspace's working folders. A change of the agent's availability goes with every feature's
 * recommended message, which reads it; a commit's goes with the feature's, through `publish`.
 */
export function sessionPublisher(
  cache: SessionCache,
  binding: Pick<Binding, "readWorkspace">,
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
      publishAgent(binding, hosts);
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

/** What each session manager calls as a feature's turn ends done: see `onTurnDone`. */
const turnDone = new WeakMap<Sessions, Set<(repo: string, folder: string) => void>>();

/**
 * Calls `listener` with the repository and the folder of each feature's or change's turn of
 * `sessions` that ends done, as the agent comes back to the human. Gives what stops the calls.
 */
export function onTurnDone(
  sessions: Sessions,
  listener: (repo: string, folder: string) => void,
): () => void {
  const listeners = turnDone.get(sessions) ?? new Set();
  turnDone.set(sessions, listeners);
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * A session manager whose changes are sent as live updates, to the hosts of their repositories, and
 * whose features' turns that end done reach `onTurnDone`'s listeners.
 */
export function createSessions(options: {
  adapter: Adapter;
  binding: Binding;
  cache: SessionCache;
  hosts: HostsOf;
}): Sessions {
  const publish = sessionPublisher(options.cache, options.binding, options.hosts);
  const sessions: Sessions = new Sessions({
    ...options,
    onChange: (change) => {
      publish(change);
      // A session's status changes with its turn's state, which what needs the human reads.
      if (!("agent" in change) && (change.turn === undefined || change.state !== undefined)) {
        globalLive.update("NeedsYouList", NEEDS_YOU_ID, { eventId: eventId("needs-you") });
      }
      if ("agent" in change || change.state !== "done" || change.folder === null) {
        return;
      }
      const { folder, repo } = change;
      turnDone.get(sessions)?.forEach((listener) => listener(repo, folder));
    },
  });
  return sessions;
}

/**
 * Sends the `Settings` record's live update on the global bus and every host's, each time the
 * settings in force or their problem change, once per change: returns its removal, which
 * `settings.close()`, as the server stops, makes too.
 */
export function announceSettings(settings: ServerSettings, hosts: Pick<Hosts, "all">): () => void {
  return settings.onChange(() => {
    for (const bus of new Set([globalLive, ...hosts.all().map((host) => host.live)])) {
      sender(bus)("Settings", SETTINGS_ID);
    }
  });
}
