// Uraeda's tools as an agent process gets them: the MCP server's name, its tools, and its token.
import type { OpenOptions } from "./adapter.ts";

/** The name of Uraeda's MCP server, as the agents name its tools: `mcp__uraeda__run_agent`. */
export const TOOLS_SERVER = "uraeda";

/** The tools of Uraeda's MCP server. */
export const TOOL_NAMES = ["run_agent", "review"] as const;

/** The longest a call of Uraeda's tools may take before the agent gives it up: two hours. */
export const TOOL_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/**
 * The environment variable that holds the process's token: in the environment, unlike the
 * arguments, no other user on the machine reads it.
 */
export const TOKEN_VARIABLE = "URAEDA_MCP_TOKEN";

/** The environment a process adds to the server's: its token, when it gets Uraeda's tools. */
export function toolsEnv(tools: OpenOptions["tools"]): Record<string, string> | undefined {
  return tools === undefined || tools === "none" ? undefined : { [TOKEN_VARIABLE]: tools.token };
}
