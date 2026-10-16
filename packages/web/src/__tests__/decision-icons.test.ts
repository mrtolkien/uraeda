// Every decision of this repository names an icon the decisions page draws, so none falls back to
// the default one (C8 of the redesign of the priorities, R20). A project's own names may fall back.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { decisionIcon } from "../theme/icons.ts";

const decisions = join(import.meta.dirname, "../../../../specs/decisions");

test("each decision of this repository has a drawn icon", () => {
  const missing = readdirSync(decisions)
    .filter((file) => file.endsWith(".md"))
    .filter((file) => {
      const icon = /^icon: (.+)$/m.exec(readFileSync(join(decisions, file), "utf8"))?.[1];
      return icon === undefined || decisionIcon(icon) !== `uraeda:decision-${icon}`;
    });

  expect(missing).toEqual([]);
});
