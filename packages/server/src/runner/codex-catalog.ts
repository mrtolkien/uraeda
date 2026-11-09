// Codex's model catalog without its sub-agents: the one switch Codex 0.163.0 honours for a model
// its catalog puts on multi-agent v2, where `features.multi_agent` leaves `spawn_agent` on (R20).
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** `codex debug models` gives up after this long. */
const CATALOG_TIMEOUT_MS = 5000;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * `catalog`, Codex's raw model catalog, `{ models: [...] }`, with every model's
 * `multi_agent_version` set to `"disabled"`: every model and every other field kept, so no model
 * is hidden. Throws on anything else, as Codex would then run on a catalog it cannot read.
 */
export function withoutSubAgents(catalog: unknown): { models: Array<unknown> } {
  if (!isObject(catalog) || !Array.isArray(catalog.models)) {
    throw new Error("codex debug models gave no models");
  }
  return {
    ...catalog,
    models: catalog.models.map((model) =>
      isObject(model) ? { ...model, multi_agent_version: "disabled" } : model,
    ),
  };
}

/**
 * The catalog's file for sessions in `cwd`, in `folder`: one per working directory, named by a
 * hash of it, as a project's own Codex configuration may change the catalog.
 */
export function catalogPath(folder: string, cwd: string): string {
  const hash = createHash("sha256").update(cwd).digest("hex").slice(0, 16);
  return join(folder, `models-${hash}.json`);
}

/** The catalog a session runs on, its file's path, or why it could not be written. */
export type Catalog = { path: string } | { problem: string };

/** Codex's model catalog in `cwd`, as `command debug models` prints it there. */
function debugModels(command: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      ["debug", "models"],
      { cwd, encoding: "utf8", timeout: CATALOG_TIMEOUT_MS },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
  });
}

/** Writes `text` to `path` whole, through a temporary file removed when it cannot be put in place. */
async function writeWhole(path: string, text: string) {
  const next = `${path}.${process.pid}.${Date.now()}`;
  try {
    await writeFile(next, text);
    await rename(next, path);
  } catch (error) {
    await rm(next, { force: true });
    throw error;
  }
}

/**
 * The catalogs without sub-agents of one Codex command, written to `folder`: read afresh at each
 * open, as Codex's own catalog changes with its version, without holding the server, and once for
 * the sessions of a working directory opening together.
 */
export class CodexCatalogs {
  #command: string;
  #folder: string;
  #running = new Map<string, Promise<Catalog>>();

  constructor(command: string, folder: string) {
    this.#command = command;
    this.#folder = folder;
  }

  /**
   * The catalog of the sessions in `cwd`, written only when it changed, as processes opening
   * together read it. On a failure, why: the server prints it, and the process runs on Codex's
   * own catalog.
   */
  write(cwd: string): Promise<Catalog> {
    const running = this.#running.get(cwd);
    if (running !== undefined) {
      return running;
    }
    const catalog = this.#write(cwd).finally(() => this.#running.delete(cwd));
    this.#running.set(cwd, catalog);
    return catalog;
  }

  async #write(cwd: string): Promise<Catalog> {
    const path = catalogPath(this.#folder, cwd);
    try {
      const raw = await debugModels(this.#command, cwd);
      const text = `${JSON.stringify(withoutSubAgents(JSON.parse(raw)))}\n`;
      await mkdir(this.#folder, { recursive: true });
      const old = await readFile(path, "utf8").catch(() => undefined);
      if (old !== text) {
        await writeWhole(path, text);
      }
      return { path };
    } catch (error) {
      const problem = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `Codex's sub-agents stay on in this session: its model catalog could not be written (${problem})\n`,
      );
      return { problem };
    }
  }
}
