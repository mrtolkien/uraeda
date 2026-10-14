import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import {
  attachImage,
  encodeImage,
  mainRoot,
  nextStep,
  readFile,
  readImage,
  readWorkspace,
  saveAnswer,
  version,
  watch,
  workDir,
  type Changes,
} from "./index.js";
import { fixture, fixtureRepo } from "./test-utils.ts";

const ROUND = "specs/2026-10-11-web-ui/clarifications-01.md";

test("reads the workspace of a repository", async () => {
  const workspace = await readWorkspace(fixtureRepo());

  const steps = Object.fromEntries(workspace.features.map((f) => [f.folder, f.step.name]));
  expect(steps).toEqual({
    "2026-10-06-recurring-tasks": "human-gate",
    "2026-10-10-cli-core": "done",
    "2026-10-10-stack-decision": "done",
    "2026-10-11-web-ui": "human-gate",
    "2026-10-12-cli-tuis": "plan",
    "2026-10-13-plan-review": "human-gate",
  });
  expect(workspace.priorities.find((p) => p.id === "next-2")?.draft).toBe(
    "specs/drafts/git-listener.md",
  );
});

test("reads a round's questions and options", async () => {
  const file = await readFile(fixtureRepo(), "2026-10-11-web-ui", "clarifications-01.md");

  const questions = file.current.items.clarifications!.questions;
  expect(questions.map((q) => q.id)).toEqual(["Q1", "Q1.B", "Q2", "Q3"]);
  expect(questions[2].options.map((o) => o.letter)).toEqual(["A", "B", "C"]);
  expect(file.current.document.blocks.length).toBeGreaterThan(20);
});

test("saves an answer in the feature's worktree", async () => {
  const repo = fixtureRepo();

  const file = await saveAnswer(repo, "2026-10-11-web-ui", "Q2", ["A"], "", "");

  expect(file.current.items.clarifications!.questions[2].answer).toBe("A");
  const written = readFileSync(join(repo, ".worktrees/2026-10-11-web-ui", ROUND), "utf8");
  expect(written).toContain("**Answer:** A\n");
});

test("rejects a stale answer with its code", async () => {
  const repo = fixtureRepo();
  await saveAnswer(repo, "2026-10-11-web-ui", "Q2", ["A"], "", "");

  await expect(saveAnswer(repo, "2026-10-11-web-ui", "Q2", ["B"], "", "")).rejects.toThrow(
    "conflict: clarifications-01.md changed on disk since you opened it. Your text was not saved.",
  );
});

/**
 * How many reports a write makes is the core's debounce, tested there: a machine that stalls the
 * watcher's thread may split one write's events in two, so this waits for the file's report.
 */
test("watches the repository until closed", async () => {
  const repo = fixtureRepo();
  await saveAnswer(repo, "2026-10-11-web-ui", "Q3", ["A"], "", "");
  const seen: Array<Changes> = [];
  const handle = watch(repo, (changes) => seen.push(changes));

  const path = join(repo, ".worktrees/2026-10-11-web-ui", ROUND);
  writeFileSync(path, readFileSync(path, "utf8").replace("**Answer:** A", "**Answer:** B"));
  await expect
    .poll(() => seen.flatMap((changes) => changes.files), { timeout: 10_000 })
    .toContain("2026-10-11-web-ui/clarifications-01.md");
  handle.close();

  expect(new Set(seen.flatMap((changes) => changes.files))).toEqual(
    new Set(["2026-10-11-web-ui/clarifications-01.md"]),
  );
}, 20_000);

test("nextStep and workDir give where and what an agent runs", async () => {
  const repo = fixtureRepo();

  const next = await nextStep(repo, "2026-10-12-cli-tuis");

  expect(next).toMatchObject({ folder: "2026-10-12-cli-tuis", mainRoot: repo });
  expect(next.step).toMatchObject({
    name: "plan",
    reference: "skills/uraeda/references/plan.md",
    waitsOn: "agent",
  });
  expect(await workDir(repo, "2026-10-12-cli-tuis")).toBe(
    join(repo, ".worktrees", "2026-10-12-cli-tuis"),
  );
});

test("mainRoot gives the main checkout from a worktree", async () => {
  const repo = fixtureRepo();
  const worktree = await workDir(repo, "2026-10-12-cli-tuis");

  expect(await mainRoot(worktree)).toBe(repo);
});

test("attaches an image to a proposal and reads it back", async () => {
  const repo = fixtureRepo();
  const bytes = readFileSync(fixture("images/desktop.png"));

  const attached = await attachImage(
    repo,
    "specs/2026-10-12-cli-tuis/proposal.md",
    bytes,
    "desktop.png",
  );

  expect(attached.link).toMatch(/^!\[desktop\]\(images\/desktop/);
  expect(attached.moved ?? null).toBeNull();
  const image = await readImage(repo, attached.path);
  expect(image.type).toBe("image/webp");
  expect(Buffer.isBuffer(image.bytes)).toBe(true);
  expect(image.bytes.subarray(8, 12).toString("latin1")).toBe("WEBP");
});

test("encodes a chat image without writing it", async () => {
  const encoded = await encodeImage(readFileSync(fixture("images/desktop.png")), "desktop.png");

  expect(encoded).toMatchObject({ extension: "webp", height: 900, width: 1440 });
  expect(encoded.bytes.subarray(8, 12).toString("latin1")).toBe("WEBP");
});

test("refuses an SVG with the spec's text", async () => {
  const bytes = readFileSync(fixture("images/drawing.svg"));

  await expect(
    attachImage(fixtureRepo(), "specs/2026-10-12-cli-tuis/proposal.md", bytes, "drawing.svg"),
  ).rejects.toThrow(
    "refused: Only PNG, JPEG, GIF, and WebP images can be added: drawing.svg is not one.",
  );
  await expect(encodeImage(bytes, "drawing.svg")).rejects.toThrow(
    "refused: Only PNG, JPEG, GIF, and WebP images can be added: drawing.svg is not one.",
  );
});

test("does not read a markdown file as an image", async () => {
  await expect(readImage(fixtureRepo(), "specs/README.md")).rejects.toThrow(
    "refused: specs/README.md: no such file",
  );
});

test("the binding's version is the Cargo workspace's", () => {
  const cargo = readFileSync(new URL("../../Cargo.toml", import.meta.url), "utf8");
  const workspace = /\[workspace\.package\][^[]*?\nversion = "([^"]+)"/.exec(cargo)![1];

  expect(version()).toBe(workspace);
});
