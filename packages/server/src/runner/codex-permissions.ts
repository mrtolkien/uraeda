/**
 * What Uraeda checks of a Codex thread's permissions: those Codex applied, from its `thread/start`
 * or `thread/resume` answer (R21).
 */

type Json = Record<string, unknown>;
const isJson = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Codex's sandbox types, by the names its settings and documentation give them. */
const SANDBOX_NAMES: Record<string, string> = {
  dangerFullAccess: "danger-full-access",
  externalSandbox: "an external sandbox",
  readOnly: "read-only",
  workspaceWrite: "workspace-write",
};

const applied = (what: string, wanted: string) =>
  `Codex applied ${what} instead of ${wanted}: Uraeda does not run it`;
const shown = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value));

/**
 * Why Uraeda does not run a thread whose answer says Codex applied other permissions than the
 * ones it asked for: the `workspace-write` sandbox with the network off, approvals on request,
 * reviewed by the automatic reviewer. Undefined when it applied those.
 */
export function appliedProblem(answer: unknown): string | undefined {
  const { approvalPolicy, approvalsReviewer, sandbox } = isJson(answer) ? answer : {};
  const type = isJson(sandbox) ? sandbox.type : undefined;
  if (type !== "workspaceWrite") {
    const name = typeof type === "string" ? (SANDBOX_NAMES[type] ?? type) : "no sandbox";
    return applied(name, "workspace-write");
  }
  if (isJson(sandbox) && sandbox.networkAccess !== false) {
    return applied("a sandbox with the network on", "the network off");
  }
  if (approvalPolicy !== "on-request") {
    return applied(`the approval policy ${shown(approvalPolicy)}`, "on-request");
  }
  if (approvalsReviewer !== "auto_review") {
    return applied(`the reviewer ${shown(approvalsReviewer)}`, "auto_review");
  }
  return undefined;
}
