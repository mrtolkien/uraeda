import { fileURLToPath } from "node:url";

/** A path inside the repository's shared `fixtures/` folder. */
export function fixture(path: string): string {
  return fileURLToPath(new URL(`../../fixtures/${path}`, import.meta.url));
}
