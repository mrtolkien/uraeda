import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FakeAdapter } from "uraeda-server/runner/fake";
import { expect, test } from "vite-plus/test";
import { makeHuman } from "../human.ts";
import { isInvalidRun } from "../session.ts";
import { repository, result, sh, write } from "./harness.ts";

const GUIDELINES = readFileSync(
  join(import.meta.dirname, "../../../../benchmarks/human.md"),
  "utf8",
);
const PROPOSAL = "# Add a helper\n\n## Requirements\n\n- It MUST accept a list of fields.\n";
const FOLDER = "specs/2026-10-19-case";

/** A repository holding the feature's folder and some code, committed. */
function checkout() {
  const repo = repository("feature");
  write(join(repo, FOLDER, "spec.md"), "spec\n");
  write(join(repo, "src/app.py"), "print(1)\n");
  sh(repo, "add", "-A");
  sh(repo, "commit", "-q", "-m", "base");
  return repo;
}

/** What `ura` would do in the checkout: change a file and commit it with a subject. */
const commit = (file: string, subject: string) => (cwd: string) => {
  write(join(cwd, file), `${subject}\n`);
  sh(cwd, "add", "-A");
  sh(cwd, "commit", "-q", "-m", subject);
};

/** The simulated human, and a turn at the spec's gate in which its session does `steps`. */
function human() {
  const adapter = new FakeAdapter();
  const run = makeHuman({ adapter, guidelines: GUIDELINES, proposal: PROPOSAL });
  return {
    adapter,
    turn: (repo: string, ...steps: Array<(cwd: string) => void>) => {
      adapter.script([...steps, result()]);
      return run({ branch: "feature", file: "spec.md", folder: FOLDER, repo, step: "human-gate" });
    },
  };
}

test("the human opens the checkout with its guidelines, the proposal, and the waiting file only", async () => {
  const repo = checkout();
  const { adapter, turn } = human();

  await turn(repo, commit(`${FOLDER}/spec.md`, "spec(case): approve"));

  expect(adapter.opens.map((open) => open.cwd)).toEqual([repo]);
  const message = adapter.sent[0]?.text ?? "";
  expect(message).toContain(GUIDELINES.trim());
  expect(message).toContain("It MUST accept a list of fields.");
  expect(message).toContain(`${FOLDER}/spec.md`);
});

test("what the human committed at the gate reads as its outcome", async () => {
  const { turn } = human();

  const approved = await turn(checkout(), commit(`${FOLDER}/spec.md`, "spec(case): approve"));
  const nothing = await turn(checkout());

  expect(approved.gate).toBe("approved");
  expect(approved.commit).toMatch(/^[0-9a-f]{40}$/);
  expect(nothing).toMatchObject({ gate: "no action" });
  expect(nothing.commit).toBeUndefined();
});

test("a commit of the human outside the feature's folder makes the run invalid", async () => {
  const { turn } = human();

  await expect(turn(checkout(), commit("src/app.py", "spec(case): approve"))).rejects.toSatisfy(
    isInvalidRun,
  );
});

test("the human may request changes twice and no more", async () => {
  const repo = checkout();
  const { turn } = human();
  const request = (n: number) => turn(repo, commit(`${FOLDER}/spec.md`, `request changes ${n}`));

  await request(1);
  await request(2);

  await expect(request(3)).rejects.toSatisfy(isInvalidRun);
});
