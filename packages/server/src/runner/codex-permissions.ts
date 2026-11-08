/**
 * What Uraeda checks of a Codex thread's permissions: those Codex applied, from its `thread/start`
 * or `thread/resume` answer (R23), and the trust of the session's project, given in memory so that
 * Codex does not write it to the user's settings (R24).
 */
import { readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";

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

/**
 * The main checkout of the git repository whose working tree is `cwd`, as Codex keys a project's
 * trust: `cwd` itself for a main checkout, the folder holding the common git folder for a linked
 * worktree. Undefined outside a repository, or for a bare one.
 */
export function gitMainRoot(cwd: string): string | undefined {
  const dotGit = resolve(cwd, ".git");
  try {
    if (statSync(dotGit).isDirectory()) {
      return cwd;
    }
    const pointer = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, "utf8"))?.[1]?.trim();
    if (pointer === undefined) {
      return undefined;
    }
    const gitDir = isAbsolute(pointer) ? pointer : resolve(cwd, pointer);
    const common = resolve(gitDir, readFileSync(resolve(gitDir, "commondir"), "utf8").trim());
    return basename(common) === ".git" ? dirname(common) : undefined;
  } catch {
    return undefined;
  }
}

/** `path`, then each folder holding it, up to the root. */
function upwards(path: string): Array<string> {
  const folders = [path];
  for (let at = path; dirname(at) !== at; at = dirname(at)) {
    folders.push(dirname(at));
  }
  return folders;
}

/**
 * The trust level Codex gives the project of `cwd`, from the user's `projects` setting as
 * `config/read` gives it: the entry of `cwd`, else of its main checkout `root`, else of the
 * closest folder holding either; `trusted` without one, the level Codex then writes to the user's
 * settings and applies (R24).
 */
export function codexTrust(cwd: string, root: string | undefined, projects: unknown): string {
  const entries = isJson(projects) ? projects : {};
  const levelOf = (path: string) => {
    const entry = entries[path];
    return isJson(entry) && typeof entry.trust_level === "string" ? entry.trust_level : undefined;
  };
  const folders = [cwd, ...(root === undefined ? [] : upwards(root)), ...upwards(cwd).slice(1)];
  for (const folder of folders) {
    const level = levelOf(folder);
    if (level !== undefined) {
      return level;
    }
  }
  return "trusted";
}
