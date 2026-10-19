import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FakeAdapter } from "uraeda-server/runner/fake";
import { expect, test } from "vite-plus/test";
import { git } from "../git.ts";
import { humanMessage, makeHuman } from "../human.ts";
import { isInvalidRun } from "../session.ts";
import { result } from "./loop-helpers.ts";
import { temporary, write } from "./samples.ts";

const GUIDELINES = readFileSync(
  join(import.meta.dirname, "../../../../benchmarks/human.md"),
  "utf8",
);
const PROPOSAL =
  "# Add a multipart helper\n\n## Requirements\n\n- It MUST accept a list of fields.\n";
const FOLDER = "specs/2026-10-19-case";
const FILE = `${FOLDER}/spec.md`;

/** A repository holding the feature's folder, committed. */
async function repository() {
  const repo = temporary("benchmarks-human-");
  await git(repo, ["init", "-q", "-b", "feature"]);
  await git(repo, ["config", "user.email", "t@example.com"]);
  await git(repo, ["config", "user.name", "t"]);
  write(join(repo, FILE), "spec\n");
  write(join(repo, "src/app.py"), "print(1)\n");
  await git(repo, ["add", "-A"]);
  await git(repo, ["commit", "-q", "-m", "base"]);
  return repo;
}

/** What `ura review` would do in the repository: change a file and commit it with a subject. */
const commit = (file: string, subject: string) => (cwd: string) => {
  write(join(cwd, file), `${subject}\n`);
  execFileSync("git", ["add", "-A"], { cwd });
  execFileSync("git", ["commit", "-q", "-m", subject], { cwd });
};

/** A human turn at the spec's gate, whose session does `steps`. */
async function turn(repo: string, steps: Array<(cwd: string) => void>, human = makeHumanFor()) {
  const adapter = human.adapter;
  adapter.script([...steps, result()]);
  return {
    adapter,
    result: await human.run({
      branch: "feature",
      file: "spec.md",
      folder: FOLDER,
      repo,
      step: "human-gate",
    }),
  };
}

function makeHumanFor() {
  const adapter = new FakeAdapter();
  return { adapter, run: makeHuman({ adapter, guidelines: GUIDELINES, proposal: PROPOSAL }) };
}

test("the prompt holds the guidelines, the proposal, and the file, and nothing else", () => {
  const message = humanMessage({ file: FILE, guidelines: GUIDELINES, proposal: PROPOSAL });

  expect(message).toContain("It MUST accept a list of fields.");
  expect(message).toContain('"your call"');
  expect(message).toContain(`The file waiting for you is ${FILE}.`);
  expect(message).not.toMatch(/hidden|reference solution|test suite/i);
});

test("the guidelines cap the requests for changes at two, and approve with the risk tier", () => {
  expect(GUIDELINES).toContain("at most twice");
  expect(GUIDELINES).toContain("confirm the risk tier");
});

test("approves with the spec's risk tier: the gate reads approved", async () => {
  const repo = await repository();

  const { result: done } = await turn(repo, [commit(FILE, "spec(case): approve")]);

  expect(done.gate).toBe("approved");
  expect(done.commit).toMatch(/^[0-9a-f]{40}$/);
});

test("a turn that commits nothing says so", async () => {
  const { result: done } = await turn(await repository(), []);

  expect(done).toMatchObject({ gate: "no action" });
  expect(done.commit).toBeUndefined();
});

test("marks the run invalid when the human's commit leaves the feature's folder", async () => {
  const run = turn(await repository(), [commit("src/app.py", "spec(case): approve")]);

  await expect(run).rejects.toSatisfy(isInvalidRun);
});

test("a third request for changes makes the run invalid", async () => {
  const repo = await repository();
  const human = makeHumanFor();
  for (const n of [1, 2]) {
    await turn(repo, [commit(FILE, `spec(case): request changes ${n}`)], human);
  }

  await expect(
    turn(repo, [commit(FILE, "spec(case): request changes 3")], human),
  ).rejects.toSatisfy(isInvalidRun);
});

test("SC-004: the human's session runs in the repository, which holds no tests or reference patch", async () => {
  const repo = await repository();

  const { adapter } = await turn(repo, [commit(FILE, "spec(case): approve")]);

  expect(adapter.opens.map((open) => open.cwd)).toEqual([repo]);
  const files = (await git(repo, ["ls-files"])).split("\n");
  expect(files.filter((file) => /(^|\/)(tests?|hidden)\/|reference\.patch/.test(file))).toEqual([]);
});
