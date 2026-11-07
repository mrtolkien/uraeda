/**
 * Prints, for each shipped theme, the `-floor` entries its palette needs (R4): for every palette
 * entry a role names whose pairs fail the contrast floor, and for every `-floor` entry already
 * there, the first step of lightness from the published colour at which they all pass, as TOML
 * lines to paste into the theme's `[palette]`. The roles that fail then name the `-floor` entry.
 * Run by hand, after adding or changing a shipped theme:
 *
 *     nix develop -c node packages/web/scripts/theme-floor.ts
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readThemes, type Theme } from "uraeda-binding";
import { entryPasses, floorStep, GROUNDS } from "../src/theme/floor.ts";
import { failures } from "../src/theme/pairs.ts";
import { tokensOf } from "../src/theme/roles.ts";

/** The TOML lines of a theme's floor entries, each with the roles that should name it. */
function floorLines(theme: Theme): Array<string> {
  const away = theme.mode === "dark" ? "lighter" : "darker";
  const named = new Map<string, Array<string>>();
  for (const [role, entry] of Object.entries(theme.sources)) {
    named.set(entry, [...(named.get(entry) ?? []), role]);
  }
  return [...named]
    .filter(([, roles]) => roles.some((role) => !GROUNDS.has(role)))
    .flatMap(([entry, roles]) => {
      const floored = entry.endsWith("-floor");
      const passes = (colour: string) => entryPasses(theme, entry, colour);
      if (!floored && passes(theme.palette[entry]!)) {
        return [];
      }
      const published = floored ? entry.slice(0, -"-floor".length) : entry;
      const step = floorStep(theme.palette[published]!, passes, away);
      return [`${published}-floor = "${step}" # ${roles.join(", ")}`];
    });
}

const folder = mkdtempSync(join(tmpdir(), "uraeda-theme-floor-"));
try {
  const { themes } = await readThemes(folder);
  for (const theme of themes.filter((each) => each.isShipped)) {
    const left = failures(tokensOf(theme.roles, theme.mode as "dark" | "light"));
    process.stdout.write(`# ${theme.id}: ${left.length} pairs under the floor\n`);
    for (const { back, floor, front, ratio } of left) {
      process.stdout.write(`#   ${front} on ${back}: ${ratio.toFixed(2)}:1, under ${floor}\n`);
    }
    for (const line of floorLines(theme)) {
      process.stdout.write(`${line}\n`);
    }
  }
} finally {
  rmSync(folder, { force: true, recursive: true });
}
