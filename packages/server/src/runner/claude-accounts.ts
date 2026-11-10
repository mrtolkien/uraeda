/**
 * Claude Code's accounts: each one a configuration folder, `CLAUDE_CONFIG_DIR`, with a name, whether
 * it is signed in, and its usage, which Claude Code's `get_usage` control request answers. Nothing
 * of a folder is opened here: Claude Code reads its own.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, join, normalize } from "node:path";
import type { Account, AccountState, Accounts, AccountWindow } from "./adapter.ts";
import { endShortProcess, lines, MODELS_TIMEOUT_MS, spawnGrouped } from "./child.ts";
import { Controls } from "./claude-control.ts";

/** `claude auth status` gives up after this long. */
const AUTH_TIMEOUT_MS = 10_000;

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
 * The folders of the `accounts` setting's lines: a leading `~/` is `home`; a line that is then no
 * absolute path is left out, with its problem, and a folder already listed. A second folder of a
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
    const expanded = listed.startsWith("~/") ? join(home, listed.slice(2)) : listed;
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

/** Whether `claude auth status` says the folder is signed out: rejected when it says nothing. */
function signedOut(command: string, folder: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      ["auth", "status", "--json"],
      {
        encoding: "utf8",
        env: { ...process.env, CLAUDE_CONFIG_DIR: folder },
        timeout: AUTH_TIMEOUT_MS,
      },
      (error, stdout) => {
        // A signed-out folder exits 1, with its answer on stdout.
        let status: unknown;
        try {
          status = JSON.parse(stdout);
        } catch {
          reject(error ?? new Error("Claude Code gave no authentication status"));
          return;
        }
        resolve(isJson(status) && status.loggedIn === false);
      },
    );
  });
}

/**
 * The ask of a folder: `missing` when it does not exist, `signed-out` when `claude auth status`
 * says so, else `ready`, with the windows of a `get_usage` request when it answers. Run from the
 * home folder, as `models()` is, with `CLAUDE_CONFIG_DIR` the folder.
 */
export function claudeAsk(command: string): ClaudeAsk {
  return async (folder) => {
    if (!existsSync(folder)) {
      return { state: "missing" };
    }
    if (await signedOut(command, folder)) {
      return { state: "signed-out" };
    }
    try {
      const [answer] = await askShort(
        command,
        homedir(),
        { CLAUDE_CONFIG_DIR: folder },
        [{ subtype: "get_usage" }],
        { did: "give its usage", exited: "giving its usage" },
      );
      const windows = claudeUsageWindows(answer);
      return windows === undefined ? { state: "ready" } : { state: "ready", windows };
    } catch {
      return { state: "ready" };
    }
  };
}

/** What `ClaudeAccounts` keeps of a folder. */
type Entry = { account: Account; folder: ClaudeFolder; inflight?: Promise<void>; tried?: number };

/**
 * Claude Code's accounts, the folders of the `accounts` setting's lines, each as last asked. An
 * account never asked is `ready`, its usage unknown.
 */
export class ClaudeAccounts implements Accounts {
  readonly folders: ReadonlyArray<ClaudeFolder>;
  readonly #entries: Array<Entry>;
  readonly #ask: ClaudeAsk;
  readonly #now: () => number;
  readonly #problems: ReadonlyArray<string>;

  constructor(options: {
    ask: ClaudeAsk;
    home?: string;
    lines: ReadonlyArray<string>;
    now?: () => number;
  }) {
    const read = claudeFolders(options.lines, options.home ?? homedir());
    this.folders = read.folders;
    this.#problems = read.problems;
    this.#ask = options.ask;
    this.#now = options.now ?? Date.now;
    this.#entries = read.folders.map((folder) => ({
      account: { askedAt: null, id: folder.id, name: folder.name, state: "ready", windows: [] },
      folder,
    }));
  }

  list(): ReadonlyArray<Account> {
    return this.#entries.map(({ account }) => account);
  }

  nameOf(id: string): string {
    return this.folders.find((folder) => folder.id === id)?.name ?? nameByRule(id);
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
    await Promise.all(this.#entries.map((entry) => this.#refreshOne(entry, maxAgeMs)));
  }

  /** The ask under way, shared; else a new one when the last, answered or not, is old enough. */
  #refreshOne(entry: Entry, maxAgeMs: number): Promise<void> | undefined {
    if (entry.inflight !== undefined) {
      return entry.inflight;
    }
    const now = this.#now();
    if (entry.tried !== undefined && now - entry.tried < maxAgeMs) {
      return undefined;
    }
    entry.tried = now;
    entry.inflight = this.#ask(entry.folder.id)
      .then(
        ({ state, windows }) => {
          // A usage that was not read keeps the windows last read, and is unknown again.
          entry.account =
            windows === undefined
              ? { ...entry.account, askedAt: null, state }
              : { ...entry.account, askedAt: this.#now(), state, windows };
        },
        // A rejected ask keeps the windows, and is unknown too.
        () => {
          entry.account = { ...entry.account, askedAt: null };
        },
      )
      .finally(() => {
        entry.inflight = undefined;
      });
    return entry.inflight;
  }
}
