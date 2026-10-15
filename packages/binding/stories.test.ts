import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { preview, storyLink } from "./index.js";
import { fixtureRepo } from "./test-utils.ts";

const ACTIVE_PREVIEW = `---
status: active
approved-by: me
preview-folder: .
preview-command: node serve.mjs --port {port}
---

# Preview
`;

test("a story link is read through the binding", () => {
  expect(storyLink("/packages/web/src/SidebarHandle.stories.tsx#Dragging")).toEqual({
    export: "Dragging",
    path: "packages/web/src/SidebarHandle.stories.tsx",
  });
  expect(storyLink("https://example.com/a.stories.tsx#A")).toBeNull();
});

test("a checkout's preview comes from its decision", async () => {
  const repo = fixtureRepo();
  mkdirSync(join(repo, "specs/decisions"), { recursive: true });
  writeFileSync(join(repo, "specs/decisions/preview.md"), ACTIVE_PREVIEW);
  expect(await preview(repo)).toEqual({ command: "node serve.mjs --port {port}", folder: "." });
});
