import { expect, test, vi } from "vite-plus/test";
import { commitOnBranch } from "uraeda-binding/test-utils";
import { createApp } from "../app.ts";
import { live as globalLive } from "../fate.ts";
import { needsYouReason, NEEDS_YOU_ID } from "../fate/needs-you.ts";
import { publish } from "../live.ts";
import { appSettings, byIdAt, fixtureRepo, port, testHosts, testPreviews } from "./helpers.ts";

const binding = await import("uraeda-binding");

/** Waits on the human, at its questions, in the fixture repository. */
const HUMAN = "2026-10-11-web-ui";

/** Two fixture repositories served by one app, read from its global endpoint. */
async function twoRepositories() {
  const repos = [fixtureRepo(), fixtureRepo()];
  const opened = await testHosts(repos, { installed: false });
  const app = createApp({
    allowOrigins: [],
    binding,
    dataDir: opened.dataDir,
    hosts: opened.hosts,
    port,
    previews: testPreviews(),
    sessions: opened.sessions,
    settings: (await appSettings()).settings,
  });
  const rows = async () =>
    (await byIdAt(app, null, "NeedsYouList", [NEEDS_YOU_ID], ["rows"]))[0]!.rows as Array<
      Record<string, string>
    >;
  return { ...opened, app, repos, rows };
}

/** US6.5 */
test("what needs the human is listed across repositories, with its message and address", async () => {
  const { names, rows } = await twoRepositories();

  const listed = (await rows()).filter((row) => row.folder === HUMAN);

  expect(listed).toHaveLength(2);
  expect(listed.map((row) => row.repository).sort()).toEqual([...names].sort());
  expect(listed[0]).toMatchObject({
    label: "web-ui",
    message: "Questions to answer",
    reason: "step",
  });
  const row = listed.find((each) => each.repository === names[0])!;
  expect(row.href).toBe(`/r/${names[0]}/f/${HUMAN}/clarifications-01.md`);
  expect((await rows()).some((each) => each.folder === "2026-10-12-cli-tuis")).toBe(false);
});

test("answering the questions removes the row", async () => {
  const { repos, rows } = await twoRepositories();
  const before = (await rows()).filter((row) => row.folder === HUMAN).length;

  commitOnBranch(repos[0]!, HUMAN, {
    [`specs/${HUMAN}/clarifications-01.md`]: null,
  });

  expect((await rows()).filter((row) => row.folder === HUMAN)).toHaveLength(before - 1);
});

test.each<[string, Parameters<typeof needsYouReason>[0], string | undefined]>([
  [
    "a refused action first",
    { status: "needs-you", statusReason: "blocked", step: "spec" },
    "blocked",
  ],
  ["a failed run", { status: "attention", statusReason: "failed", step: "plan" }, "attention"],
  ["a halted run", { status: "attention", statusReason: "halted", step: "plan" }, "attention"],
  ["a step waiting", { status: "needs-you", statusReason: "step", step: "human-gate" }, "step"],
  [
    "a ready pull request",
    { status: "needs-you", statusReason: "step", step: "pull-request" },
    "pull-request",
  ],
  ["a working run", { status: "working", statusReason: null, step: "spec" }, undefined],
  ["an idle feature", { status: "idle", statusReason: null, step: "plan" }, undefined],
])("the reason: %s", (_, input, reason) => {
  expect(needsYouReason(input)).toBe(reason);
});

test("a repository's change is heard on the global bus", () => {
  const update = vi.spyOn(globalLive, "update");
  const bus = { update: vi.fn() } as unknown as Parameters<typeof publish>[1]["live"];

  publish(
    { features: [HUMAN], files: [], inbox: false, priorities: false, workspace: false },
    { live: bus, path: "/repo" },
  );

  expect(update).toHaveBeenCalledWith("NeedsYouList", NEEDS_YOU_ID, expect.anything());
  update.mockRestore();
});
