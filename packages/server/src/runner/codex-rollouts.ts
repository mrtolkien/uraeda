/** Codex's thread files, its rollouts, which it keeps by day. */
import { readdirSync } from "node:fs";
import { join } from "node:path";

/** The names in `folder`, none when it cannot be read. */
function entries(folder: string): Array<string> {
  try {
    return readdirSync(folder, { encoding: "utf8" });
  } catch {
    return [];
  }
}

/** The date folders in `folder`, as rollouts' `YYYY`, `MM`, and `DD`, the newest first. */
function newestFirst(folder: string): Array<string> {
  return entries(folder)
    .filter((name) => /^\d+$/.test(name))
    .sort((a, b) => Number(b) - Number(a))
    .map((name) => join(folder, name));
}

/**
 * Whether the thread `nativeId` has its file, `<codexHome>/sessions/YYYY/MM/DD/rollout-*-<id>.jsonl`,
 * unread: day after day, the newest first, until found.
 */
export function hasRollout(codexHome: string, nativeId: string): boolean {
  const end = `-${nativeId}.jsonl`;
  const found = (day: string) =>
    entries(day).some((name) => name.startsWith("rollout-") && name.endsWith(end));
  return newestFirst(join(codexHome, "sessions")).some((year) =>
    newestFirst(year).some((month) => newestFirst(month).some(found)),
  );
}
