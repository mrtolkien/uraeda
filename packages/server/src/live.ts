import type { Changes, RunOptions } from "uraeda-binding";
import type { Binding } from "./fate/context.ts";
import { changedRecords, takeWatched, type Watched } from "./fate/preview.ts";
import { pages } from "./fate/sessions.ts";
import { SETTINGS_ID } from "./fate/settings.ts";
import { THEMES_ID } from "./fate/themes.ts";
import { AGENT_ID, INBOX_ID, PRIORITIES_ID, SESSION_LIST_ID, WORKSPACE_ID } from "./fate/views.ts";
import { DEFAULT_ROUND_IDS } from "./runner/round-messages.ts";
import { type LiveBus, live as globalLive } from "./fate.ts";
import { NEEDS_YOU_ID } from "./fate/needs-you.ts";
import { LEDGER_ID } from "./fate/views-ledger.ts";
import { ALL_BRANCH_CHANGES_ID } from "./fate/views-branch.ts";
import { GIT_ID } from "./fate/views-git.ts";
import { readMessages } from "./fate/workflow-step.ts";
import { Previews } from "./preview/runner.ts";
import type { Host, Hosts } from "./repositories.ts";
import type { ServerAddress } from "./mcp/endpoint.ts";
import type { McpTokens } from "./mcp/tokens.ts";
import type { SessionCache } from "./runner/cache.ts";
import type { Runtimes } from "./runner/runtimes.ts";
import { type ContinueSettings, type SessionChange, Sessions } from "./runner/sessions.ts";
import type { ServerSettings } from "./settings.ts";
import type { ServerThemes } from "./themes.ts";

/** A session's live updates are sent at most this often while its items change. */
export const SESSION_UPDATE_MS = 250;

let sent = 0;
/** A live update's event ID, unique in this process. */
const eventId = (topic: string) => `${topic}:${Date.now()}:${sent++}`;

/** Sends a record's live update on a bus. */
export const sender = (bus: LiveBus) => (type: string, id: string) =>
  bus.update(type, id, { eventId: eventId(`${type}:${id}`) });

/**
 * The hosts the session manager's changes go to, once they are open: the session manager starts
 * first, as the hosts' watches publish its sessions.
 */
export type HostsOf = () => Pick<Hosts, "byPath" | "all"> | undefined;

/**
 * Sends the Git page's live updates on a repository's bus: the page, and the sidebar's count. They
 * go after each of the page's writes, each change of a checkout's git state, and each turn's start
 * and end, which refuses or lets the page's writes.
 */
export function publishGit(bus: LiveBus) {
  const update = sender(bus);
  update("GitPage", GIT_ID);
  update("GitSummary", GIT_ID);
}

/** What each session manager's repositories call as their features or branches change. */
const workspaceListeners = new WeakMap<
  Sessions,
  Set<(host: Pick<Host, "path" | "live">, changes: Changes) => void>
>();

/**
 * Calls `listener` each time `publish`, for a repository of `sessions`, reports a feature or a branch
 * that changed: a change merged or dropped, or a pull request's refresh. It gets the repository's
 * host and what changed. Gives what stops the calls.
 */
export function onWorkspaceChange(
  sessions: Sessions,
  listener: (host: Pick<Host, "path" | "live">, changes: Changes) => void,
): () => void {
  const listeners = workspaceListeners.get(sessions) ?? new Set();
  workspaceListeners.set(sessions, listeners);
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Sends a repository's live updates, on its host's bus, for each change the core's watcher
 * reports. A feature's change may change its step, which its sessions' statuses read, its
 * branch's changes and the cards' record of every feature's, its history, and its workflow
 * messages read, whose step its queued commits move as they land, and a feature that
 * goes leaves the sidebar: the list and the features' sessions go too. A change of the inbox sends its triage and the decisions check too, and
 * one of the constitution or a decision, the ledger; a decision a branch changed sends its page, and its spec's file.
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
    for (const id of readMessages(host.path, folder)) {
      live.update("WorkflowMessage", id, { eventId: eventId(`workflow:${id}`) });
    }
  }
  // The cards' one record of every feature's changes goes with each feature's own.
  if (changes.features.length > 0) {
    live.update("AllBranchChanges", ALL_BRANCH_CHANGES_ID, { eventId: eventId("all-changes") });
  }
  for (const file of changes.files) {
    live.update("WorkflowFile", file, { eventId: eventId(`file:${file}`) });
  }
  for (const id of changes.branchDecisions) {
    live.update("BranchDecision", id, { eventId: eventId(`branch-decision:${id}`) });
  }
  // The inbox and the priorities share the count of changes waiting for a commit, every branch's,
  // so a change of either, or of a feature, whose checkout a buffer may have edited, sends both,
  // and the Git page, whose changes they are too.
  const edited = changes.priorities || changes.inbox || changes.features.length > 0;
  if (edited) {
    live.update("Priorities", PRIORITIES_ID, { eventId: eventId("priorities") });
    live.update("Inbox", INBOX_ID, { eventId: eventId("inbox") });
  }
  if (edited || changes.git) {
    publishGit(live);
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
    // What reads the workspace's open changes, as the jobs' next runs do, hears it too.
    workspaceListeners.get(sessions)?.forEach((listener) => listener(host, changes));
    live.update("SessionList", SESSION_LIST_ID, { eventId: eventId("sessions") });
    // The host's path is the main checkout, which keys its sessions. Each reads the step, its
    // sub-sessions too.
    const { cache } = sessions;
    for (const folder of changes.features) {
      for (const parent of cache.folderSessions(host.path, folder)) {
        for (const session of [parent, ...cache.subSessionsOf(parent.id)]) {
          live.update("Session", session.id, { eventId: eventId(`Session:${session.id}`) });
        }
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
  sendEachFeature(binding, hosts()?.all() ?? [], "RecommendedMessage");
}

/** Sends the record of `type` of each feature of each host, on its bus. */
function sendEachFeature(
  binding: Pick<Binding, "readWorkspace">,
  hosts: ReadonlyArray<Pick<Host, "live" | "path">>,
  type: string,
) {
  for (const host of hosts) {
    void binding.readWorkspace(host.path).then(
      ({ features }) => {
        const update = sender(host.live);
        features.forEach(({ folder }) => update(type, folder));
      },
      // A repository the core cannot read has no feature to update.
      () => undefined,
    );
  }
}

/**
 * Sends the session's record, and, for a sub-session, its parent's, which lists it with its state
 * and its usage: the parent's list follows a sub-session's usage as its state changes. Gives
 * whether it is a sub-session, which the sidebar's list leaves out.
 */
function sendSession(
  cache: SessionCache,
  update: ReturnType<typeof sender>,
  session: string,
): boolean {
  update("Session", session);
  const parent = cache.session(session)?.parent;
  if (parent) {
    update("Session", parent);
  }
  return Boolean(parent);
}

/** Sends a turn's record and its last two item pages, where a tool call may finish. */
function sendTurn(cache: SessionCache, update: ReturnType<typeof sender>, id: number) {
  update("Turn", String(id));
  const count = pages(cache, id);
  for (const page of [count - 2, count - 1].filter((page) => page >= 0)) {
    update("TurnLog", `${id}:${page}`);
  }
}

/**
 * Sends a session's change at once on `bus`: its record, a sub-session's parent's, its turn, the
 * list but for a sub-session, its feature, the workspace, and, as a turn starts or ends, the Git
 * page, whose writes it refuses or lets.
 */
function publishAtOnce(
  cache: SessionCache,
  bus: LiveBus,
  change: Exclude<SessionChange, { agent: true }>,
) {
  const update = sender(bus);
  const sub = sendSession(cache, update, change.session);
  if (change.turn !== undefined) {
    sendTurn(cache, update, change.turn);
  }
  if (!sub) {
    update("SessionList", SESSION_LIST_ID);
  }
  if (change.folder !== null) {
    update("Feature", change.folder);
  }
  update("Workspace", WORKSPACE_ID);
  if (change.state !== undefined) {
    publishGit(bus);
  }
}

/**
 * Sends the live updates of the session manager's changes. A session's record, its changed turns,
 * and their last two item pages, where a tool call may finish, go out at most every 250 ms while
 * items change, with the sidebar's list when a sub-agent starts or ends. A turn's state change,
 * and any other change of the session, go out at once, with the list, the session's feature, the
 * workspace's working folders, and a sub-session's parent, whose record lists its usage: the
 * parent's list updates a sub-session's usage as its state changes, not with each of its items.
 * The list, which leaves sub-sessions out, is not sent for theirs. A change of the agent's
 * availability goes with every feature's recommended message, which reads it; a commit's goes with
 * the feature's, through `publish`.
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
  const turn = (update: ReturnType<typeof sender>, id: number) => sendTurn(cache, update, id);
  /** The sub-agents running in the turns, which the sidebar lists: the cache's `subagentsOf`. */
  const subagents = (turns: Iterable<number>) =>
    [...turns].flatMap((id) => cache.subagentsOf(id).map((subagent) => subagent.id)).join(" ");
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
      // The list, which leaves sub-sessions out, lists none of theirs.
      if (!cache.session(session)?.parent) {
        update("SessionList", SESSION_LIST_ID);
      }
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
      publishAtOnce(cache, bus, change);
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

/** What each session manager calls with each of its changes: see `onSessionChange`. */
const changeListeners = new WeakMap<Sessions, Set<(change: SessionChange) => void>>();

/**
 * Calls `listener` with each change of `sessions`, after its live updates: a listener that throws
 * is printed, and the others are still called. Gives what stops the calls.
 */
export function onSessionChange(
  sessions: Sessions,
  listener: (change: SessionChange) => void,
): () => void {
  const listeners = changeListeners.get(sessions) ?? new Set();
  changeListeners.set(sessions, listeners);
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * A session manager whose changes are sent as live updates, to the hosts of their repositories, and
 * whose features' turns that end done reach `onTurnDone`'s listeners. `runs` gives the continues'
 * settings in force, and `runOptions` a feature's run options as its next run starts on them.
 */
export function createSessions(options: {
  binding: Binding;
  cache: SessionCache;
  hosts: HostsOf;
  mcp?: { address: ServerAddress; tokens: McpTokens };
  runOptions?: (repo: string, folder: string) => RunOptions;
  runs?: () => ContinueSettings;
  runtimes: Runtimes;
}): Sessions {
  const publish = sessionPublisher(options.cache, options.binding, options.hosts);
  const sessions: Sessions = new Sessions({
    ...options,
    hosted: (root) => options.hosts()?.byPath(root) !== undefined,
    onChange: (change) => {
      publish(change);
      // A session's status changes with its turn's state, which what needs the human reads.
      if (!("agent" in change) && (change.turn === undefined || change.state !== undefined)) {
        globalLive.update("NeedsYouList", NEEDS_YOU_ID, { eventId: eventId("needs-you") });
      }
      for (const listener of changeListeners.get(sessions) ?? []) {
        try {
          listener(change);
        } catch (error) {
          process.stderr.write(`uraeda: ${(error as Error).message}\n`);
        }
      }
      if (
        "agent" in change ||
        change.state !== "done" ||
        change.dismissed ||
        change.folder === null
      ) {
        return;
      }
      const { folder, repo } = change;
      turnDone.get(sessions)?.forEach((listener) => listener(repo, folder));
    },
    queue: (root) => options.hosts()?.byPath(root)?.queue,
  });
  return sessions;
}

/** The continues' settings in force, from the `[runs]` settings, read at each call. */
export function continueSettings(settings: ServerSettings): () => ContinueSettings {
  return () => {
    const runs = settings.runs();
    return {
      afterLimit: runs.continueAfterLimit.inForce,
      afterRestart: runs.continueAfterRestart.inForce,
      cap: runs.automaticContinues.inForce,
    };
  };
}

/**
 * Sends the `Settings` record's live update on the global bus and every host's, each time the
 * settings in force or their problem change, once per change, with every host's `Feature` records
 * when the run options change, as each holds its options merged over them: returns its removal,
 * which `settings.close()`, as the server stops, makes too.
 */
export function announceSettings(
  settings: ServerSettings,
  hosts: Pick<Hosts, "all">,
  binding: Pick<Binding, "readWorkspace">,
): () => void {
  let options = JSON.stringify(settings.runs().options);
  return settings.onChange(() => {
    for (const bus of new Set([globalLive, ...hosts.all().map((host) => host.live)])) {
      sender(bus)("Settings", SETTINGS_ID);
    }
    const now = JSON.stringify(settings.runs().options);
    if (now !== options) {
      options = now;
      sendEachFeature(binding, hosts.all(), "Feature");
    }
  });
}

/**
 * Sends a record's live update on the global bus and every host's: the `Extensions` record, which
 * every endpoint serves.
 */
export function announceEverywhere(hosts: Pick<Hosts, "all">, type: string, id: string): void {
  for (const bus of new Set([globalLive, ...hosts.all().map((host) => host.live)])) {
    sender(bus)(type, id);
  }
}

/**
 * Sends the `Themes` record's live update on the global bus and every host's, each time a read of
 * the themes changes them: returns its removal, which `themes.close()`, as the server stops, makes
 * too.
 */
export function announceThemes(themes: ServerThemes, hosts: Pick<Hosts, "all">): () => void {
  return themes.onChange(() => {
    for (const bus of new Set([globalLive, ...hosts.all().map((host) => host.live)])) {
      sender(bus)("Themes", THEMES_ID);
    }
  });
}
