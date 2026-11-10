/**
 * Claude Code's accounts: each one a configuration folder, `CLAUDE_CONFIG_DIR`, with a name, whether
 * it is signed in, and its usage, which Claude Code's `get_usage` control request answers. Nothing
 * of a folder is opened here: Claude Code reads its own.
 */
import { statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, join, normalize } from "node:path";
import type { Account, AccountState, Accounts, AccountWindow } from "./adapter.ts";
import { endShortProcess, lines, MODELS_TIMEOUT_MS, spawnGrouped } from "./child.ts";
import { Controls } from "./claude-control.ts";

/**
 * The arguments of a short process: print mode and stream-json, as a session's, in `auto` mode,
 * which the models list says each model keeps or drops, and no transcript written, as no message
 * is sent.
 */
const SHORT_ARGS = [
  "-p",
  "--input-format",
  "stream-json",
  "--output-format",
  "stream-json",
  "--verbose",
  "--permission-mode",
  "auto",
  "--no-session-persistence",
];

/**
 * What a short process is asked for: `did` completes "Claude Code did not ... within 10 seconds",
 * and `exited` completes "Claude Code exited before ...".
 */
export type ShortWords = { did: string; exited: string };

/**
 * Starts `claude` as a short process in `cwd`, with `env` added, writes each of `requests` as a
 * control request, and gives their answers' payloads, in order: rejected on the agent's error, on
 * its exit, or when it has not answered within 10 seconds. The process is ended as it is done with.
 */
export async function askShort(
  command: string,
  cwd: string,
  env: Record<string, string> | undefined,
  requests: ReadonlyArray<Record<string, unknown>>,
  words: ShortWords,
): Promise<Array<unknown>> {
  const short = spawnGrouped(command, SHORT_ARGS, cwd, env);
  const controls = new Controls(short.write);
  void (async () => {
    try {
      for await (const line of lines(short.child.stdout)) {
        controls.answer(line);
      }
    } catch {
      // A process that failed to start has no output.
    }
    const { missing, stderr } = await short.exited;
    controls.end(
      missing
        ? `Claude Code is not available: ${stderr}`
        : `Claude Code exited before ${words.exited}${stderr === "" ? "" : `: ${stderr}`}`,
    );
  })();
  const timer = setTimeout(() => {
    controls.end(`Claude Code did not ${words.did} within ${MODELS_TIMEOUT_MS / 1000} seconds`);
  }, MODELS_TIMEOUT_MS);
  try {
    const answers: Array<unknown> = [];
    for (const request of requests) {
      answers.push(await controls.ask(request));
    }
    return answers;
  } finally {
    clearTimeout(timer);
    endShortProcess(short);
  }
}

/** One listed folder: its id, absolute; the line as listed; its name. */
export type ClaudeFolder = { id: string; listed: string; name: string };

/** A folder's name by the rule: its last segment, without its dot and its `claude-`. */
function nameByRule(id: string): string {
  const segment = basename(id).replace(/^\./, "");
  if (segment === "claude") {
    return "default";
  }
  const name = segment.replace(/^claude-/, "");
  return name === "" ? id : name;
}

/**
 * The folders of the `accounts` setting's lines: a leading `~/`, or `~` alone, is `home`; a line
 * that is then no absolute path is left out, with its problem, and a folder already listed. A second folder of a
 * name already taken reads its path.
 */
export function claudeFolders(
  lines: ReadonlyArray<string>,
  home: string,
): { folders: Array<ClaudeFolder>; problems: Array<string> } {
  const folders: Array<ClaudeFolder> = [];
  const problems: Array<string> = [];
  for (const raw of lines) {
    const listed = raw.trim();
    if (listed === "") {
      continue;
    }
    const expanded =
      listed === "~" ? home : listed.startsWith("~/") ? join(home, listed.slice(2)) : listed;
    if (!isAbsolute(expanded)) {
      problems.push(`account folder ${listed} is not an absolute path`);
      continue;
    }
    const id = normalize(expanded).replace(/(.)\/+$/, "$1");
    if (folders.some((folder) => folder.id === id)) {
      continue;
    }
    const name = nameByRule(id);
    folders.push({ id, listed, name: folders.some((folder) => folder.name === name) ? id : name });
  }
  return { folders, problems };
}

type Json = Record<string, unknown>;
const isJson = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The windows Claude Code names, shortest first, as the accounts' windows are. */
const WINDOWS = [
  { id: "five_hour", label: "5h" },
  { id: "seven_day", label: "Week" },
];

/**
 * The windows of a `get_usage` answer, the share used as a fraction of one: undefined when it gives
 * no five-hour window, as a signed-out folder's does, so the first window is always the five hours
 * and a week never stands first. A window not open has no reset.
 */
export function claudeUsageWindows(answer: unknown): Array<AccountWindow> | undefined {
  const limits = isJson(answer) ? answer.rate_limits : undefined;
  if (!isJson(limits)) {
    return undefined;
  }
  const windows: Array<AccountWindow> = [];
  for (const { id, label } of WINDOWS) {
    const window = limits[id];
    if (!isJson(window) || typeof window.utilization !== "number") {
      continue;
    }
    const reset =
      typeof window.resets_at === "string" ? new Date(window.resets_at).getTime() : Number.NaN;
    windows.push({
      id,
      label,
      resetsAt: Number.isNaN(reset) ? null : new Date(reset).toISOString(),
      used: window.utilization / 100,
    });
  }
  return windows[0]?.id === WINDOWS[0]?.id ? windows : undefined;
}

/** What one ask of a folder gives: its state, and its windows when its usage was read. */
export type ClaudeAsk = (
  folder: string,
) => Promise<{ state: AccountState; windows?: Array<AccountWindow> }>;

/**
 * Whether `claude auth status` says the folder is signed out: rejected when it says nothing. A
 * short process, as the others: from the home folder, ended with `endShortProcess`, given up after
 * `MODELS_TIMEOUT_MS`.
 */
async function signedOut(command: string, folder: string): Promise<boolean> {
  const short = spawnGrouped(command, ["auth", "status", "--json"], homedir(), {
    CLAUDE_CONFIG_DIR: folder,
  });
  let stdout = "";
  short.child.stdout.setEncoding("utf8");
  short.child.stdout.on("data", (data: string) => {
    stdout += data;
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `Claude Code did not give its authentication status within ${MODELS_TIMEOUT_MS / 1000} seconds`,
          ),
        ),
      MODELS_TIMEOUT_MS,
    );
  });
  try {
    // A signed-out folder exits 1, with its answer on stdout, which is whole once the process closed.
    const { stderr } = await Promise.race([short.exited, late]);
    let status: unknown;
    try {
      status = JSON.parse(stdout);
    } catch {
      throw new Error(stderr || "Claude Code gave no authentication status");
    }
    return isJson(status) && status.loggedIn === false;
  } finally {
    clearTimeout(timer);
    endShortProcess(short);
  }
}

/** The windows `get_usage` gives, or undefined when it gives none or does not answer. */
async function usageOf(command: string, folder: string): Promise<Array<AccountWindow> | undefined> {
  try {
    const [answer] = await askShort(
      command,
      homedir(),
      { CLAUDE_CONFIG_DIR: folder },
      [{ subtype: "get_usage" }],
      { did: "give its usage", exited: "giving its usage" },
    );
    return claudeUsageWindows(answer);
  } catch {
    return undefined;
  }
}

/**
 * The ask of a folder, which is a directory: its `claude auth status` and its `get_usage` request
 * run at once, from the home folder, as `models()` is, with `CLAUDE_CONFIG_DIR` the folder. Signed
 * out wins; else `ready`, with the windows when the usage was read. A status that says nothing and
 * a usage that gives no windows reject: the account stays as it was.
 */
export function claudeAsk(command: string): ClaudeAsk {
  return async (folder) => {
    const [signed, windows] = await Promise.allSettled([
      signedOut(command, folder),
      usageOf(command, folder),
    ]);
    if (signed.status === "fulfilled" && signed.value) {
      return { state: "signed-out" };
    }
    const read = windows.status === "fulfilled" ? windows.value : undefined;
    if (read !== undefined) {
      // A usage with a five-hour window is a signed-in account's, whatever the status said.
      return { state: "ready", windows: read };
    }
    if (signed.status === "rejected") {
      throw signed.reason;
    }
    return { state: "ready" };
  };
}

/** What `ClaudeAccounts` keeps of a folder. */
type Entry = { account: Account; folder: ClaudeFolder; inflight?: Promise<void>; tried?: number };

/** Whether `path` is a directory: a stat of the folder itself, which opens no file of it. */
function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Claude Code's accounts, the folders of the `accounts` setting's lines, each as last asked. An
 * account never asked is `ready`, its usage unknown, unless its folder is no directory: it is
 * `missing`, checked as the accounts are built and at each refresh, before any ask.
 */
export class ClaudeAccounts implements Accounts {
  readonly #entries: Array<Entry>;
  readonly #ask: ClaudeAsk;
  readonly #isFolder: (path: string) => boolean;
  readonly #now: () => number;
  readonly #problems: ReadonlyArray<string>;

  constructor(options: {
    ask: ClaudeAsk;
    home?: string;
    /** Whether a path is a directory: a test's own. */
    isFolder?: (path: string) => boolean;
    lines: ReadonlyArray<string>;
    now?: () => number;
  }) {
    const read = claudeFolders(options.lines, options.home ?? homedir());
    this.#problems = read.problems;
    this.#ask = options.ask;
    this.#isFolder = options.isFolder ?? isDirectory;
    this.#now = options.now ?? Date.now;
    this.#entries = read.folders.map((folder) => ({
      account: {
        askedAt: null,
        id: folder.id,
        known: false,
        name: folder.name,
        state: "ready",
        windows: [],
      },
      folder,
    }));
    this.#entries.forEach((entry) => this.#check(entry));
  }

  list(): ReadonlyArray<Account> {
    return this.#entries.map(({ account }) => account);
  }

  nameOf(id: string): string {
    return this.#entries.find(({ folder }) => folder.id === id)?.folder.name ?? nameByRule(id);
  }

  problems(): ReadonlyArray<string> {
    return [
      ...this.#problems,
      ...this.#entries.flatMap(({ account, folder }) =>
        account.state === "signed-out"
          ? [`account ${account.name} is signed out, in ${folder.listed}`]
          : [],
      ),
      ...this.#entries.flatMap(({ account, folder }) =>
        account.state === "missing"
          ? [`account ${account.name} has no folder at ${folder.listed}`]
          : [],
      ),
    ];
  }

  async refresh(maxAgeMs: number): Promise<void> {
    // The folders first, so a pick that stops waiting knows which are gone.
    this.#entries.forEach((entry) => this.#check(entry));
    await Promise.all(this.#entries.map((entry) => this.#refreshOne(entry, maxAgeMs)));
  }

  /** Marks the account `missing` when its folder is no directory, and `ready` again once it is. */
  #check(entry: Entry) {
    const missing = !this.#isFolder(entry.folder.id);
    if (missing && entry.account.state !== "missing") {
      entry.account = { ...entry.account, known: false, state: "missing" };
    } else if (!missing && entry.account.state === "missing") {
      entry.account = { ...entry.account, state: "ready" };
    }
  }

  /**
   * The ask under way, shared; else a new one when the folder is a directory and the last ask,
   * answered or not, is old enough.
   */
  #refreshOne(entry: Entry, maxAgeMs: number): Promise<void> | undefined {
    if (entry.inflight !== undefined) {
      return entry.inflight;
    }
    const now = this.#now();
    if (
      entry.account.state === "missing" ||
      (entry.tried !== undefined && now - entry.tried < maxAgeMs)
    ) {
      return undefined;
    }
    entry.tried = now;
    entry.inflight = this.#ask(entry.folder.id)
      .then(
        ({ state, windows }) => {
          // A usage that was not read keeps the windows last read and the time they were, and is
          // unknown again.
          entry.account =
            windows === undefined
              ? { ...entry.account, known: false, state }
              : { ...entry.account, askedAt: this.#now(), known: true, state, windows };
          // A folder that went while it was asked is missing still.
          this.#check(entry);
        },
        // A rejected ask keeps the windows, and is unknown too.
        () => {
          entry.account = { ...entry.account, known: false };
        },
      )
      .finally(() => {
        entry.inflight = undefined;
      });
    return entry.inflight;
  }
}
