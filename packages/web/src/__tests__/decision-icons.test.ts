// Every decision of this repository, and of the skill's example project, names an icon the
// decisions page draws, so none falls back to the default one (C8 of the redesign of the
// priorities, R20). A project's own names may fall back.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { decisionIcon, uraedaIcons } from "../theme/icons.ts";

const root = join(import.meta.dirname, "../../../..");

/** The decisions of a folder whose icon the page would not draw. */
function undrawn(folder: string) {
  const decisions = join(root, folder);
  return readdirSync(decisions)
    .filter((file) => file.endsWith(".md"))
    .filter((file) => {
      const icon = /^icon: (.+)$/m.exec(readFileSync(join(decisions, file), "utf8"))?.[1];
      return icon === undefined || decisionIcon(icon) !== `uraeda:decision-${icon}`;
    });
}

test("each decision of this repository has a drawn icon", () => {
  expect(undrawn("specs/decisions")).toEqual([]);
});

test("each decision of the skill's example has a drawn icon", () => {
  expect(undrawn("skills/uraeda/assets/example/specs/decisions")).toEqual([]);
});

/** C8: a row draws its decision's icon, or the default one for a name the UI does not register. */
test("a decision's icon is its own when registered, else the default one", () => {
  expect(decisionIcon("git-branch")).toBe("uraeda:decision-git-branch");
  expect(Object.hasOwn(uraedaIcons, "uraeda:decision-git-branch")).toBe(true);
  for (const name of ["calendar-x", "", null, undefined]) {
    expect(decisionIcon(name)).toBe("uraeda:decision-file-text");
  }
  expect(Object.hasOwn(uraedaIcons, "uraeda:decision-file-text")).toBe(true);
});
