// The host token: how the host's own `uraeda` proves itself to the server on its port, by reading a
// file only its user can read, in the data folder they share.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomToken } from "./tokens.ts";

/** The host token file of the server on `port`: `server-<port>.token` in the data folder. */
const tokenPath = (dataDir: string, port: number) => join(dataDir, `server-${port}.token`);

/**
 * Makes the host token of the server on `port`, 32 random bytes in base64url, writes it readable
 * by its owner only, replacing one a killed server left, and returns it. Throws
 * `cannot write <path>: <reason>` when the data folder cannot take it.
 */
export function writeHostToken(dataDir: string, port: number): string {
  const path = tokenPath(dataDir, port);
  const token = randomToken(32);
  try {
    mkdirSync(dataDir, { mode: 0o700, recursive: true });
    // Removed first: a file left behind keeps its mode, which writing it again would not change.
    rmSync(path, { force: true });
    writeFileSync(path, token, { flag: "wx", mode: 0o600 });
  } catch (error) {
    throw new Error(`cannot write ${path}: ${(error as Error).message}`, { cause: error });
  }
  return token;
}

/** The host token of the server on `port`, or undefined when this data folder has none. */
export function readHostToken(dataDir: string, port: number): string | undefined {
  try {
    return readFileSync(tokenPath(dataDir, port), "utf8").trim();
  } catch {
    return undefined;
  }
}

/** Removes the host token of the server on `port`, as it stops. */
export function removeHostToken(dataDir: string, port: number): void {
  rmSync(tokenPath(dataDir, port), { force: true });
}
