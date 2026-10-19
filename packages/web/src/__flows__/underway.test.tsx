// Flow: a round the agent asked while it was building the plan. Its answers offer to continue the
// implementation as the primary action, written into the round as `resumes: implementation`, and
// still go back to the spec on request; a round asked before the implementation offers no such
// action.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor } from "@testing-library/react";
import { fixture } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { click, fixtureRepo, git, startApp } from "./harness.tsx";

const SOURCE = "2026-10-11-web-ui";
const CONTINUE = "2026-10-15-continue";
const REVISE = "2026-10-15-revise";
const BEFORE = "2026-10-15-before";

/** A feature whose round `second` is answered in its worktree and not committed. */
function feature(repo: string, folder: string, second: boolean) {
  const source = fixture(`repo/branches/${SOURCE}/specs/${SOURCE}`);
  const round = readFileSync(join(source, "clarifications-01.md"), "utf8");
  const answers = round.replaceAll(/^\*\*Answer:\*\*$/gm, "**Answer:** A");
  git(repo, "switch", "--quiet", "--create", folder, "main");
  const dir = join(repo, "specs", folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "proposal.md"), readFileSync(join(source, "proposal.md")));
  if (second) {
    // Round 01 is answered, the spec and the plan approved: the agent is building.
    writeFileSync(
      join(dir, "clarifications-01.md"),
      answers.replace("status: awaiting-human", "status: answered"),
    );
    writeFileSync(
      join(dir, "spec.md"),
      "---\nstatus: approved\nrevision: 1\nclarifications: 1\nrisk-tier: low\n---\n\n# Spec: Web UI\n\nA feature.\n\n## Decisions\n\nRelied on:\n\n- None.\n",
    );
    writeFileSync(
      join(dir, "plan.md"),
      "---\nstatus: approved\nspec-revision: 1\n---\n\n# Plan: Web UI\n\n## Task 1: One\n\n- [ ] **Step 1: Do**\n",
    );
    writeFileSync(join(dir, "clarifications-02.md"), round);
  } else {
    writeFileSync(join(dir, "clarifications-01.md"), round);
  }
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "work on the round");
  git(repo, "switch", "--quiet", "main");
  const worktree = join(repo, ".worktrees", folder);
  git(repo, "worktree", "add", "--quiet", worktree, folder);
  const target = join(
    worktree,
    "specs",
    folder,
    second ? "clarifications-02.md" : "clarifications-01.md",
  );
  writeFileSync(target, answers);
}

const app = startApp({
  agent: true,
  repo: () => {
    const repo = fixtureRepo();
    feature(repo, CONTINUE, true);
    feature(repo, REVISE, true);
    feature(repo, BEFORE, false);
    return repo;
  },
});

/** The branch's last commit's file. */
const committed = (folder: string, file: string) =>
  git(app.repo, "show", `${folder}:specs/${folder}/${file}`);

test("a round asked during the implementation continues it, as the primary action", async () => {
  await app.open(`/f/${CONTINUE}/clarifications-02.md`);

  await click(await screen.findByRole("button", { name: "Answer and continue implementing" }));

  await waitFor(() => expect(window.location.pathname).toBe(app.path(`/f/${CONTINUE}/session`)));
  expect(committed(CONTINUE, "clarifications-02.md")).toContain("resumes: implementation");
  expect(window.location.search).toContain("continue=answers");
  expect(app.agent.sent).toHaveLength(0);
});

test("the same round still goes back to the spec on request", async () => {
  await app.open(`/f/${REVISE}/clarifications-02.md`);

  await click(await screen.findByRole("button", { name: "Answer and revise the spec" }));

  await waitFor(() => expect(window.location.pathname).toBe(app.path(`/f/${REVISE}/session`)));
  expect(committed(REVISE, "clarifications-02.md")).not.toContain("resumes");
});

test("a round asked before the implementation has no action that continues it", async () => {
  await app.open(`/f/${BEFORE}/clarifications-01.md`);

  await screen.findByRole("button", { name: /start the agent/i });
  expect(screen.queryByRole("button", { name: "Answer and continue implementing" })).toBeNull();
});
