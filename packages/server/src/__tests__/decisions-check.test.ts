import { cpSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { APPLY_DECISIONS_CHECK, RUN_DECISIONS_CHECK } from "uraeda-server/round-messages";
import { byId, fixture, fixtureRepo, git, mutate, testApp, testHosts } from "./helpers.ts";

const FILE = ["id", "name", "path", "kind", "status", "current", "missing", "candidates"];
const CHECK = "decisions-check";

/** A repository whose main checkout holds the fixture's check and its candidate, committed. */
function checkRepo() {
  const repo = fixtureRepo();
  copyFileSync(fixture("DECISIONS-CHECK.md"), join(repo, "specs/DECISIONS-CHECK.md"));
  cpSync(fixture("decisions-check"), join(repo, "specs/decisions-check"), { recursive: true });
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "chore: propose a decisions check");
  return repo;
}

test("both messages name the reference and a waiting stop", () => {
  expect(RUN_DECISIONS_CHECK).toContain("references/decisions-check.md");
  expect(RUN_DECISIONS_CHECK).toContain("Stop when the check waits");
  expect(APPLY_DECISIONS_CHECK).toContain("references/decisions-check.md");
  expect(APPLY_DECISIONS_CHECK).toContain("specs/DECISIONS-CHECK.md");
});

test("the check is missing until an agent writes it", async () => {
  const [file] = await byId((await testApp()).app, "WorkflowFile", [CHECK], FILE);

  expect(file.missing).toBe(true);
  expect(file.name).toBe("DECISIONS-CHECK.md");
  expect(file.candidates).toEqual([]);
});

test("the check's file is read as a round with its candidates", async () => {
  const [file] = await byId((await testApp(checkRepo())).app, "WorkflowFile", [CHECK], FILE);

  expect(file).toMatchObject({ id: CHECK, name: "DECISIONS-CHECK.md", status: "awaiting-human" });
  expect(file.candidates).toHaveLength(1);
  expect(file.candidates[0]).toMatchObject({ option: "a", question: "q1" });
  expect(file.candidates[0].change.name).toBe("ui-components");
});

test("the decisions page's data says whether a check waits", async () => {
  const none = await byId((await testApp()).app, "Ledger", ["ledger"], ["decisionsCheck"]);
  const waits = await byId(
    (await testApp(checkRepo())).app,
    "Ledger",
    ["ledger"],
    ["decisionsCheck"],
  );

  expect(none[0].decisionsCheck).toBeNull();
  expect(waits[0].decisionsCheck).toBe("awaiting-human");
});

test("an answer to the check is written to its file and not to the triage", async () => {
  const repo = checkRepo();
  copyFileSync(fixture("INBOX-TRIAGE.md"), join(repo, "specs/INBOX-TRIAGE.md"));
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "chore: propose an inbox triage");
  const triage = readFileSync(join(repo, "specs/INBOX-TRIAGE.md"), "utf8");
  const { app } = await testApp(repo);
  const [opened] = await byId(app, "WorkflowFile", [CHECK], FILE);

  const answered = await mutate(
    app,
    "defaultRound.answer",
    {
      base: opened.current.document.hash,
      comment: "",
      id: CHECK,
      letters: ["A"],
      previous: "",
      question: "Q1",
    },
    FILE,
  );

  expect(answered.ok).toBe(true);
  expect(readFileSync(join(repo, "specs/DECISIONS-CHECK.md"), "utf8")).toContain("**Answer:** A\n");
  expect(readFileSync(join(repo, "specs/INBOX-TRIAGE.md"), "utf8")).toBe(triage);
});

test("a change of the check's file is announced for its id", async () => {
  const repo = fixtureRepo();
  const { hosts, names } = await testHosts([repo], { installed: false });
  const host = hosts.get(names[0])!;
  const update = vi.spyOn(host.live, "update");

  writeFileSync(join(host.path, "specs/DECISIONS-CHECK.md"), "---\nstatus: awaiting-human\n---\n");

  await vi.waitFor(
    () => {
      const sent = update.mock.calls.map(([type, id]) => `${type} ${String(id)}`);
      expect(sent).toEqual(
        expect.arrayContaining(["WorkflowFile decisions-check", "Ledger ledger"]),
      );
    },
    { timeout: 5000 },
  );
});
