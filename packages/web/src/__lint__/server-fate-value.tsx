// A value of the server's fate module in the browser: refused by `no-restricted-imports`, which
// allows its types alone.
import { AGENT_ID } from "uraeda-server/fate";
import type { Workspace } from "uraeda-server/fate";

export const agent: [string, Workspace | undefined] = [AGENT_ID, undefined];
