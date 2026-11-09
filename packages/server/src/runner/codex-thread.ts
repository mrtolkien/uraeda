// The parameters of a Codex thread and its turns: its instructions, its permissions, and its
// configuration, apart from the adapter that sends them.
import type { OpenOptions, Outgoing } from "./adapter.ts";
import { type ExtensionPaths, webUiInstructions } from "./instructions.ts";
import { TOKEN_VARIABLE, TOOL_TIMEOUT_MS, TOOLS_SERVER } from "./uraeda-tools.ts";

/**
 * The sandbox's section of the instructions: what Codex cannot do without escalating, so it asks
 * its reviewer instead of failing, or working around the sandbox. The extensions folder is not
 * writable: Uraeda runs what it holds, so each write there is reviewed first (R22).
 */
function sandboxSection(extensions: string | undefined): string {
  const folder =
    extensions === undefined
      ? ""
      : ` Writing in \`${extensions}\`, your extensions folder, needs escalated permissions too, from its first try.`;
  return `
# Sandbox

Your commands run in a sandbox: you write in the working directory only, git's own folder is read-only, and the network is off. So run every git command that writes, as \`git add\`, \`git commit\`, \`git mv\`, and \`git worktree add\`, and every command that uses the network, as \`git push\` and \`gh\`, with escalated permissions from its first try (\`sandbox_permissions: "require_escalated"\`, with a one-line justification): a reviewer approves each before it runs, and you are allowed to ask.${folder} Never work around the sandbox, and never stop at a git command the sandbox refused: run it again with escalated permissions.
`;
}

/** The developer instructions of every thread: the web UI's, then the sandbox's. */
export function codexInstructions(extensions?: ExtensionPaths): string {
  return `${webUiInstructions(extensions)}${sandboxSection(extensions?.folder)}`;
}

/**
 * The arguments of a session's `codex app-server`: with `tools`, either Uraeda's or `"none"`, and
 * `catalog`, Codex's model catalog with every model's sub-agents off, that catalog. The one switch
 * Codex 0.163.0 honours: `features.multi_agent` and `multi_agent_v2` off, for the thread or the
 * process, leave `spawn_agent` to a model its catalog puts on multi-agent v2 (R18). A chat keeps
 * Codex's own catalog, and its sub-agents.
 */
export function codexServerArgs(tools: OpenOptions["tools"], catalog?: string): Array<string> {
  return [
    "app-server",
    ...(tools === undefined || catalog === undefined
      ? []
      : ["-c", `model_catalog_json=${JSON.stringify(catalog)}`]),
  ];
}

/**
 * The configuration that gives a workflow thread Uraeda's tools: its MCP server, its token read
 * from the process's environment, its tools approved, so Codex never asks for them, run in
 * parallel, and given up only after `TOOL_TIMEOUT_MS`.
 */
function toolsConfig(tools: OpenOptions["tools"]) {
  if (tools === undefined || tools === "none") {
    return {};
  }
  const server = {
    bearer_token_env_var: TOKEN_VARIABLE,
    default_tools_approval_mode: "approve",
    supports_parallel_tool_calls: true,
    tool_timeout_sec: TOOL_TIMEOUT_MS / 1000,
    url: tools.url,
  };
  return { mcp_servers: { [TOOLS_SERVER]: server } };
}

/**
 * The parameters of a session's `thread/start`, or `thread/resume` when resuming: the model when
 * picked, the session's directory, and Codex's permissions, its `workspace-write` sandbox, its
 * approvals on request, reviewed by its automatic reviewer. The configuration overrides only the
 * trust of the session's directory, when known, the level Codex would apply itself: without it,
 * Codex writes it to the user's settings (R24); and, for a workflow session, Uraeda's tools.
 * Never another, which could widen the permissions.
 */
export function codexThreadParams(options: OpenOptions, instructions: string, trust?: string) {
  const config = {
    ...toolsConfig(options.tools),
    ...(trust === undefined ? {} : { projects: { [options.cwd]: { trust_level: trust } } }),
  };
  return {
    approvalPolicy: "on-request",
    approvalsReviewer: "auto_review",
    ...(Object.keys(config).length === 0 ? {} : { config }),
    cwd: options.cwd,
    developerInstructions: instructions,
    sandbox: "workspace-write",
    ...(options.model === undefined ? {} : { model: options.model }),
    // A resumed thread's turns stay unread: the transcript has them.
    ...(options.resume ? { excludeTurns: true, threadId: options.nativeId } : {}),
  };
}

/** A message's input items: its text, then its images by their paths. */
export function codexInput({ images, text }: Pick<Outgoing, "images" | "text">) {
  return [
    ...(text === "" ? [] : [{ text, text_elements: [], type: "text" }]),
    ...images.map(({ path }) => ({ path, type: "localImage" })),
  ];
}

/** A turn to start: its thread, its message, and the effort when set. */
export type CodexTurn = Pick<Outgoing, "images" | "text"> & { effort?: string; threadId: string };

/**
 * The parameters of a `turn/start`: the message, the effort when set, and the sandbox's policy,
 * which writes only the session's directory, the network off: no other writable root (R22).
 */
export function codexTurnParams({ effort, threadId, ...message }: CodexTurn) {
  return {
    input: codexInput(message),
    sandboxPolicy: {
      excludeSlashTmp: false,
      excludeTmpdirEnvVar: false,
      networkAccess: false,
      type: "workspaceWrite",
      writableRoots: [],
    },
    threadId,
    ...(effort === undefined ? {} : { effort }),
  };
}
