import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import type {
  Adapter,
  AgentProcess,
  Capabilities,
  ModelList,
  OpenOptions,
  ReviewAsk,
  ReviewMessage,
} from "./adapter.ts";
import { type Child, EventQueue, lines, spawnGrouped } from "./child.ts";
import { askShort, claudeAsk, ClaudeAccounts } from "./claude-accounts.ts";
import { claudeModels, claudeRunsOn, Controls } from "./claude-control.ts";
import { allowRule, type Blocks, parseLine } from "./claude-events.ts";
import type { Denial } from "./events.ts";
import { type ExtensionPaths, webUiInstructions } from "./instructions.ts";
import {
  TOKEN_VARIABLE,
  TOOL_NAMES,
  TOOL_TIMEOUT_MS,
  TOOLS_SERVER,
  toolsEnv,
} from "./uraeda-tools.ts";

/** `claude --version` gives up after this long. */
const VERSION_TIMEOUT_MS = 5000;
/** Where sessions write extensions, read their documentation, and get their skills. */
export type ClaudeExtensions = ExtensionPaths & {
  /** The folder of the extensions' plugins, `<data folder>/extension-plugins`. */
  plugins: string;
};

/**
 * The plugin folder of the extension whose `skills/` folder is `skills`, `ext-<name>`: apart from
 * Uraeda's own plugin, `uraeda`, whatever the extension's name.
 */
function pluginOf(skills: string, plugins: string): string {
  return join(plugins, `ext-${basename(dirname(skills))}`);
}

/** Writes `path` unless it holds `text` already: sessions opening together write the same. */
function writeIfChanged(path: string, text: string) {
  let old: string | undefined;
  try {
    old = readFileSync(path, "utf8");
  } catch {
    old = undefined;
  }
  if (old !== text) {
    writeFileSync(path, text);
  }
}

/**
 * Makes the plugin folder of each extension's skills, `<plugins>/ext-<name>/`: its
 * `.claude-plugin/plugin.json`, and `skills`, a link to the extension's `skills/` folder, replaced
 * whole when it points elsewhere or is no link. Each of `skills` is
 * `<extensions folder>/<name>/skills`. Gives the folders, in the order of `skills`.
 */
export function extensionPlugins(skills: ReadonlyArray<string>, plugins: string): Array<string> {
  return skills.map((folder) => {
    const plugin = pluginOf(folder, plugins);
    mkdirSync(join(plugin, ".claude-plugin"), { recursive: true });
    const name = basename(plugin);
    writeIfChanged(join(plugin, ".claude-plugin", "plugin.json"), `${JSON.stringify({ name })}\n`);
    const link = join(plugin, "skills");
    let target: string | undefined;
    try {
      target = readlinkSync(link);
    } catch (error) {
      // Not a link, as a folder or file left there: a link cannot be renamed over it.
      if ((error as NodeJS.ErrnoException).code === "EINVAL") {
        rmSync(link, { force: true, recursive: true });
      }
      target = undefined;
    }
    if (target !== folder) {
      // A new link renamed over the old one: another session never sees it missing.
      const next = `${link}.${randomUUID()}`;
      symlinkSync(folder, next);
      renameSync(next, link);
    }
    return plugin;
  });
}

/**
 * Removes the plugin folders, `<plugins>/ext-<name>`, of the extensions no longer in `extensions`,
 * the extensions folder. Only those: another session may run with the plugin of an extension
 * installed but off here, or turned off since it opened.
 */
export function prunePlugins(plugins: string, extensions: string): void {
  let names: Array<string>;
  try {
    names = readdirSync(plugins);
  } catch {
    return;
  }
  for (const name of names) {
    if (name.startsWith("ext-") && !existsSync(join(extensions, name.slice("ext-".length)))) {
      rmSync(join(plugins, name), { force: true, recursive: true });
    }
  }
}

/** Claude Code's tools that start its own sub-agents: `Task` is `Agent`'s older name. */
const SUB_AGENT_TOOLS = ["Agent", "Task", "Workflow", "TeamCreate"];

/**
 * The arguments that give a process Uraeda's tools and take its own sub-agents away: Uraeda's MCP
 * server over HTTP, its token read from the environment, as the arguments are readable by every
 * user, and its calls given up only after `TOOL_TIMEOUT_MS`, as progress does not extend a call.
 * The user's own servers stay. With `"none"`, only the sub-agents are taken away; a chat keeps
 * them. Both options take several values, so they come before an option that takes one.
 */
function toolsArgs(tools: OpenOptions["tools"]): Array<string> {
  if (tools === undefined) {
    return [];
  }
  const disallowed = ["--disallowedTools", ...SUB_AGENT_TOOLS];
  if (tools === "none") {
    return disallowed;
  }
  const server = {
    headers: { Authorization: `Bearer \${${TOKEN_VARIABLE}}` },
    timeout: TOOL_TIMEOUT_MS,
    type: "http",
    url: tools.url,
  };
  return [
    "--mcp-config",
    JSON.stringify({ mcpServers: { [TOOLS_SERVER]: server } }),
    ...disallowed,
  ];
}

/**
 * The arguments of a session's process: print mode, stream-json both ways, `auto` mode, the skill,
 * the web UI's instructions, appended to the system prompt on every start, and the chat images'
 * folder, which the agent reads even when the user blocks reads outside the working directory.
 * Only that folder is added, never the whole data folder: `auto` mode lets the agent write to added
 * folders. With `extensions`, the extensions folder is added too, so the agent writes extensions
 * there, the instructions say so, and each extension of `options.skills` gives one more plugin
 * folder, after Uraeda's own (`extensionPlugins` makes them). With `options.tools`, Uraeda's tools
 * are given and allowed, and the agent's own sub-agents taken away (`toolsArgs`).
 */
export function claudeArgs(
  options: OpenOptions,
  pluginDir: string,
  imagesDir: string,
  extensions?: ClaudeExtensions,
): Array<string> {
  const plugins =
    extensions === undefined
      ? []
      : options.skills.map((skills) => pluginOf(skills, extensions.plugins));
  const tools = typeof options.tools === "object";
  const allowed = [
    ...(options.allowed ?? []),
    ...(tools ? TOOL_NAMES.map((name) => `mcp__${TOOLS_SERVER}__${name}`) : []),
  ];
  return [
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--permission-mode",
    "auto",
    ...(options.model === undefined ? [] : ["--model", options.model]),
    ...(options.effort === undefined ? [] : ["--effort", options.effort]),
    "--plugin-dir",
    pluginDir,
    ...plugins.flatMap((plugin) => ["--plugin-dir", plugin]),
    "--add-dir",
    imagesDir,
    ...(extensions === undefined ? [] : ["--add-dir", extensions.folder]),
    ...toolsArgs(options.tools),
    "--append-system-prompt",
    webUiInstructions(extensions && { docs: extensions.docs, folder: extensions.folder }),
    options.resume ? "--resume" : "--session-id",
    options.nativeId,
    ...(allowed.length === 0 ? [] : ["--allowedTools", ...allowed]),
  ];
}

/**
 * The environment a process adds to the server's: its token when it gets Uraeda's tools, and its
 * account as the configuration folder Claude Code reads. Undefined when it adds nothing.
 */
export function claudeEnv(options: OpenOptions): Record<string, string> | undefined {
  const tools = toolsEnv(options.tools);
  if (options.account === undefined) {
    return tools;
  }
  return { ...tools, CLAUDE_CONFIG_DIR: options.account };
}

export type ClaudeAdapterOptions = {
  /**
   * The `accounts` setting's lines, the configuration folders new sessions pick between: no line
   * gives the adapter no accounts. Lines of which none is a folder give accounts with no account,
   * for their problems to show, and sessions stay on the server's login.
   */
  accounts?: ReadonlyArray<string>;
  /** The command to run, `claude` from the `PATH` by default. */
  command?: string;
  /** Claude Code's configuration folder, where it keeps its transcripts. */
  configDir?: string;
  /**
   * Where sessions write extensions and get their skills: the server always gives it; scripts
   * running Claude Code outside the server, without extensions, do not.
   */
  extensions?: ClaudeExtensions;
  /** The chat images' folder, `<data folder>/images`, created as a process opens. */
  imagesDir: string;
  /** The plugin folder that holds the Uraeda skill, `layout().plugin` in the server. */
  pluginDir: string;
};

/**
 * A message as Claude Code reads it: its text, then a blank line and one `[Image: <path>]` line per
 * image, which the agent opens with its Read tool.
 */
export function messageContent(text: string, images: Array<{ path: string }>): string {
  const lines = images.map(({ path }) => `[Image: ${path}]`).join("\n");
  if (lines === "") {
    return text;
  }
  return text === "" ? lines : `${text}\n\n${lines}`;
}

/** The levels `/code-review` takes, the names of Claude Code's efforts. */
const REVIEW_LEVELS = new Set(["low", "medium", "high", "xhigh", "max"]);

/**
 * Claude Code's own review of the commits `<base>..<head>`: `/code-review` at the level of the
 * reviewer's effort, `medium` for an effort it does not name, never left out, which would reuse the
 * level the human last typed. `/code-review` reads all the text after its level as its target: the
 * instructions follow the range there, and the review reads them.
 */
export function claudeReview({ base, effort, head, instructions }: ReviewAsk): ReviewMessage {
  const level = effort !== undefined && REVIEW_LEVELS.has(effort) ? effort : "medium";
  const command = `/code-review ${level} ${base}..${head}`;
  return { text: instructions ? `${command}\n\n${instructions}` : command };
}

/**
 * Claude Code, run through its installed `claude` command, in print mode, its stdin kept open for
 * the session's messages.
 */
export class ClaudeAdapter implements Adapter {
  readonly icon = "uraeda:harness-claude";
  readonly kind = "claude";
  readonly name = "Claude Code";
  /** The listed folders, when the setting has a line, valid or not. */
  readonly accounts: ClaudeAccounts | undefined;
  /** Taking back is `cancel_async_message`, which `validate-claude.ts` checks (R5). */
  readonly capabilities: Capabilities = {
    approvals: false,
    images: true,
    queue: true,
    steer: true,
    subagents: true,
    takeBack: true,
  };
  #command: string;
  #configDir: string;
  #pluginDir: string;
  #imagesDir: string;
  #extensions: ClaudeExtensions | undefined;

  constructor({
    accounts,
    command = "claude",
    configDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"),
    extensions,
    imagesDir,
    pluginDir,
  }: ClaudeAdapterOptions) {
    this.#extensions = extensions;
    this.#command = command;
    this.accounts = accounts?.some((line) => line.trim() !== "")
      ? new ClaudeAccounts({ ask: claudeAsk(command), lines: accounts })
      : undefined;
    this.#configDir = configDir;
    this.#pluginDir = pluginDir;
    this.#imagesDir = imagesDir;
  }

  version(): Promise<string | undefined> {
    return new Promise((resolve) => {
      execFile(
        this.#command,
        ["--version"],
        { encoding: "utf8", timeout: VERSION_TIMEOUT_MS },
        (error, stdout) => {
          const first = stdout.split("\n")[0]?.trim();
          resolve(error || !first ? undefined : first);
        },
      );
    });
  }

  /**
   * Looks for `<account>/projects/*\/<id>.jsonl`, the adapter's own folder without an account,
   * without reading any file.
   */
  hasSession(nativeId: string, account?: string): boolean {
    const projects = join(account ?? this.#configDir, "projects");
    let folders: Array<string>;
    try {
      folders = readdirSync(projects);
    } catch {
      return false;
    }
    return folders.some((folder) => existsSync(join(projects, folder, `${nativeId}.jsonl`)));
  }

  allowRule(denial: Denial): string | undefined {
    return allowRule(denial);
  }

  /**
   * Starts the process, its images' and extensions' folders made first, as `--add-dir` refuses a
   * missing folder, and its extensions' plugin folders, those of extensions removed taken away.
   */
  #spawn(options: OpenOptions): Child {
    mkdirSync(this.#imagesDir, { recursive: true });
    const extensions = this.#extensions;
    if (extensions) {
      mkdirSync(extensions.folder, { recursive: true });
      prunePlugins(extensions.plugins, extensions.folder);
      extensionPlugins(options.skills, extensions.plugins);
    }
    const args = claudeArgs(options, this.#pluginDir, this.#imagesDir, extensions);
    return spawnGrouped(this.#command, args, options.cwd, claudeEnv(options));
  }

  /**
   * The models listed for the account, through a short process, closed once it answered
   * `list_models` and `get_settings`, which spend no usage: rejected when it fails to answer within
   * 10 seconds. Its group is sent SIGTERM as it is done with, and SIGKILL if it outlives that. With
   * accounts, it runs in the first listed account's folder.
   */
  async models(): Promise<ModelList> {
    const folder = this.accounts?.list()[0]?.id;
    const [list, settings] = await askShort(
      this.#command,
      homedir(),
      folder === undefined ? undefined : { CLAUDE_CONFIG_DIR: folder },
      [{ subtype: "list_models" }, { subtype: "get_settings" }],
      { did: "list its models", exited: "listing its models" },
    );
    return claudeModels(list, settings);
  }

  reviewMessage(ask: ReviewAsk): ReviewMessage {
    return claudeReview(ask);
  }

  open(options: OpenOptions): AgentProcess {
    const { child, exited, signal, write } = this.#spawn(options);

    // Stdout is read as it comes, whether or not the events are: Claude Code loses its last lines
    // when they are read slowly.
    const events = new EventQueue();
    const tasks = new Map<string, string>();
    const blocks: Blocks = new Map();
    const controls = new Controls(write);
    void (async () => {
      try {
        for await (const line of lines(child.stdout)) {
          if (controls.answer(line)) {
            continue;
          }
          for (const event of parseLine(line, options.cwd, tasks, blocks)) {
            events.push(event);
          }
        }
      } catch {
        // A process that failed to start has no output.
      }
      controls.end("Claude Code exited");
      events.push(await exited);
      events.end();
    })();

    // What it runs on, by names from its own list, asked once: at open, and after each change.
    let listed: unknown;
    const report = () =>
      controls.ask({ subtype: "get_settings" }).then(
        (settings) => {
          const event = claudeRunsOn(listed, settings);
          if (event !== undefined) {
            events.push(event);
          }
        },
        () => {},
      );
    void controls
      .ask({ subtype: "list_models" })
      .then(
        (list) => (listed = list),
        () => {},
      )
      .then(report);

    return {
      close: () => {
        child.stdin.end();
      },
      events,
      interrupt: () => controls.send({ subtype: "interrupt" }),
      kill: signal,
      send: ({ id, images, text, when }) => {
        write({
          message: { content: messageContent(text, images), role: "user" },
          priority: when === "steer" ? "next" : "later",
          type: "user",
          uuid: id,
        });
      },
      // From its next turn on: the runner calls it between turns only (R3).
      setEffort: (effort) => {
        controls
          .ask({ settings: { effortLevel: effort ?? null }, subtype: "apply_flag_settings" })
          .catch(() => {});
        void report();
      },
      takeBack: (id) => controls.send({ message_uuid: id, subtype: "cancel_async_message" }),
    };
  }
}
