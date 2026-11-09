// Codex's model catalog without its sub-agents: the one switch Codex 0.163.0 honours for a model
// its catalog puts on multi-agent v2, where `features.multi_agent` leaves `spawn_agent` on (R18).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
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
 * Writes the catalog of `command`'s Codex, its sub-agents off, to `<folder>/models.json`, read
 * afresh at each call, as Codex's own catalog changes with its version: its path. Written whole
 * through a temporary file, and only when it changed, as processes opening together read it. On a
 * failure, none: the server prints why, and the process runs on Codex's own catalog.
 */
export function catalogWithoutSubAgents(command: string, folder: string): string | undefined {
  const path = join(folder, "models.json");
  try {
    const raw = execFileSync(command, ["debug", "models"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: CATALOG_TIMEOUT_MS,
    });
    const text = `${JSON.stringify(withoutSubAgents(JSON.parse(raw)))}\n`;
    mkdirSync(folder, { recursive: true });
    let old: string | undefined;
    try {
      old = readFileSync(path, "utf8");
    } catch {
      old = undefined;
    }
    if (old !== text) {
      const next = `${path}.${process.pid}.${Date.now()}`;
      writeFileSync(next, text);
      renameSync(next, path);
    }
    return path;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `Codex's sub-agents stay on in this session: its model catalog could not be written (${reason})\n`,
    );
    return undefined;
  }
}
