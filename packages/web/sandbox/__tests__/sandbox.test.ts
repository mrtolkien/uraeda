// @vitest-environment node
// The sandbox's server, as `vp run sandbox` serves it: the real app over the three sample projects,
// in a locked list, without sign-in, its page with the picker, and its state kept across restarts.
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { fakeGh, SAMPLE_FOLDERS, samplePullRequests } from "../../samples/index.ts";
import { type Sandbox, sandboxEnv, seed } from "../seed.ts";
import {
  fateAt,
  first,
  type RepositoryRows,
  type Served,
  serveSandbox,
  setEnv,
  waitAtWork,
} from "./helpers.ts";

const LOCKED = { code: "BAD_REQUEST", message: "refused: this server's list is locked" };

/** The skill's pick script, which the sandbox's page loads as it is. */
const PICK_SCRIPT = fileURLToPath(
  new URL("../../../../skills/uraeda/assets/storybook/uraeda-pick.js", import.meta.url),
);

const ROUND = SAMPLE_FOLDERS.features["round-waiting"];

let checkout: string;
let sandbox: Sandbox;
let restore: () => void;
beforeAll(async () => {
  fakeGh(samplePullRequests());
  checkout = temporaryFolder("sandbox-checkout");
  sandbox = await seed(checkout, { reset: false });
  restore = setEnv(sandboxEnv(sandbox));
}, 120_000);
afterAll(() => restore());

test("the sandbox serves Home with sample, empty, and broken, locked, without sign-in", async () => {
  const served = await serveSandbox(checkout);
  try {
    expect(served.lines).toContain(`Sandbox: http://127.0.0.1:${served.port}/`);

    const page = await (await fetch(served.url)).text();
    const pick = page.match(/<script src="([^"]+)"><\/script>/)?.[1];
    expect(pick).toBeDefined();
    expect(page).toMatch(/<script (?=[^>]*type="module")[^>]*src="\/src\/sandbox\/main\.tsx"/);
    expect(await (await fetch(new URL(pick!, served.url))).text()).toBe(
      readFileSync(PICK_SCRIPT, "utf8"),
    );

    const list = await fateAt(served.url, null, [
      { ids: ["repositories"], kind: "byId", select: ["rows.name"], type: "Repositories" },
      {
        input: { folder: sandbox.projects.sample },
        kind: "mutation",
        name: "repositories.add",
        select: ["rows.name"],
      },
      { input: { name: "empty" }, kind: "mutation", name: "repositories.remove", select: ["id"] },
    ]);
    expect(list.status).toBe(200);
    const [rows, added, removed] = list.results;
    expect(
      first<RepositoryRows>(rows)
        .rows.map((row) => row.name)
        .sort(),
    ).toEqual(["broken", "empty", "sample"]);
    expect([added?.error, removed?.error]).toEqual([LOCKED, LOCKED]);

    const home = await fateAt(served.url, "sample", [
      { ids: ["workspace"], kind: "byId", select: ["id", "features"], type: "Workspace" },
    ]);
    expect(home.status).toBe(200);
    const { features } = first<{ features: Array<{ folder: string }> }>(home.results[0]);
    const folders = features.map((row) => row.folder);
    expect(folders).toEqual(expect.arrayContaining(Object.values(SAMPLE_FOLDERS.features)));

    await waitAtWork(served);
  } finally {
    await served.close();
  }
}, 150_000);

test("a restart keeps an answered round", async () => {
  const before = await serveSandbox(checkout);
  try {
    const saved = await fateAt(before.url, "sample", [
      {
        input: { comment: "", folder: ROUND, letters: ["A"], previous: "", question: "Q2" },
        kind: "mutation",
        name: "answer.save",
        select: ["id"],
      },
    ]);
    expect(saved.results[0]?.ok).toBe(true);
    await waitAtWork(before);
  } finally {
    await before.close();
  }

  // A restart: the command seeds again, and Vite serves anew.
  expect((await seed(checkout, { reset: false })).stale).toBe(false);
  const after = await serveSandbox(checkout);
  try {
    const { results } = await fateAt(after.url, "sample", [
      {
        ids: [`${ROUND}/clarifications-01.md`],
        kind: "byId",
        select: ["current"],
        type: "WorkflowFile",
      },
    ]);
    const file = first<{
      current: { items: { clarifications: { questions: Array<{ answer?: string; id: string }> } } };
    }>(results[0]);
    const questions = file.current.items.clarifications.questions;
    expect(questions.find((question) => question.id === "Q2")?.answer).toBe("A");
    // The turn at work, stopped by the restart, plays again from its start.
    await waitAtWork(after);
  } finally {
    await after.close();
  }
}, 150_000);

test("a port taken, the sandbox serves on the next free one, and prints it", async () => {
  const blocker = createServer();
  await new Promise<void>((resolve) => blocker.listen(0, "127.0.0.1", resolve));
  const address = blocker.address();
  const taken = typeof address === "object" && address !== null ? address.port : 0;
  try {
    const served = await serveSandbox(checkout, taken);
    try {
      expect(served.port).toBeGreaterThan(taken);
      expect(served.lines).toContain(`Sandbox: http://127.0.0.1:${served.port}/`);
      expect((await fetch(served.url)).status).toBe(200);
      await waitAtWork(served);
    } finally {
      await served.close();
    }
  } finally {
    await new Promise((resolve) => blocker.close(resolve));
  }
}, 150_000);

/** A round's questions, as fate reads its file. */
type RoundFile = {
  current: { items: { clarifications: { questions: Array<{ answer?: string; id: string }> } } };
};

/** The step of the feature in `folder` of "sample", as Home reads it. */
async function stepOf(served: Served, folder: string): Promise<string | undefined> {
  const home = await fateAt(served.url, "sample", [
    { ids: ["workspace"], kind: "byId", select: ["id", "features"], type: "Workspace" },
  ]);
  const { features } = first<{ features: Array<{ folder: string; step: { name: string } }> }>(
    home.results[0],
  );
  return features.find((feature) => feature.folder === folder)?.step.name;
}

test("the round waiting, answered and submitted, moves its feature to the spec step", async () => {
  const served = await serveSandbox(checkout);
  try {
    const read = await fateAt(served.url, "sample", [
      {
        ids: [`${ROUND}/clarifications-01.md`],
        kind: "byId",
        select: ["current"],
        type: "WorkflowFile",
      },
    ]);
    const { questions } = first<RoundFile>(read.results[0]).current.items.clarifications;
    const answers = questions
      .filter((question) => !question.answer)
      .map((question) => ({
        input: { comment: "", folder: ROUND, letters: ["A"], previous: "", question: question.id },
        kind: "mutation",
        name: "answer.save",
        select: ["id"],
      }));
    const saved = await fateAt(served.url, "sample", answers);
    expect(saved.results.map((result) => result.ok)).not.toContain(false);

    expect(await stepOf(served, ROUND)).toBe("human-gate");
    const submitted = await fateAt(served.url, "sample", [
      {
        input: { file: "clarifications-01.md", folder: ROUND },
        kind: "mutation",
        name: "answers.submit",
        select: ["id"],
      },
    ]);
    expect(submitted.results[0]?.ok).toBe(true);

    expect(await stepOf(served, ROUND)).toBe("spec");
    await waitAtWork(served);
  } finally {
    await served.close();
  }
}, 150_000);
