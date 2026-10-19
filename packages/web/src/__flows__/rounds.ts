// What the round, settled-points, and notes flows share: features of the fixture repository, each
// with the web UI's round, so every test answers a round of its own.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commitOnBranch, fixture, git } from "uraeda-binding/test-utils";

const SOURCE = "2026-10-11-web-ui";

/** The round file's name in a feature. */
export const ROUND_FILE = "clarifications-01.md";

/** The round's path from the top of a checkout. */
export function roundPath(folder: string, name = ROUND_FILE) {
  return `specs/${folder}/${name}`;
}

/** The fixture's round text: Q1 (with its follow-up Q1.B), Q2, Q3, settled points, and notes. */
export function roundText() {
  return readFileSync(fixture(`repo/branches/${SOURCE}/specs/${SOURCE}/${ROUND_FILE}`), "utf8");
}

/** Writes answers into a round's text: `answers` maps a question's id to its `**Answer:**` text. */
export function withAnswers(round: string, answers: Record<string, string>) {
  const lines = round.split("\n");
  for (const [id, answer] of Object.entries(answers)) {
    const heading = lines.findIndex((line) =>
      new RegExp(`^#{2,3} ${id.replace(".", String.raw`\.`)}:`).test(line),
    );
    const at = lines.findIndex((line, index) => index > heading && line.startsWith("**Answer:**"));
    lines[at] = answer ? `**Answer:** ${answer}` : "**Answer:**";
  }
  return lines.join("\n");
}

/** Adds a feature `folder` on its own branch, its round answered as `answers` says. */
export function addRound(
  repo: string,
  folder: string,
  answers: Record<string, string> = {},
  edit: (round: string) => string = (round) => round,
) {
  git(repo, "branch", folder, "main");
  commitOnBranch(repo, folder, {
    [`specs/${folder}/proposal.md`]: "# A feature\n\n## What\n\nA thing.\n\n## Why\n\nSo.\n",
    [roundPath(folder)]: edit(withAnswers(roundText(), answers)),
  });
}

/** The round's text now: in the feature's worktree once the UI wrote it, else on the branch. */
export function roundNow(repo: string, folder: string, name = ROUND_FILE) {
  const path = join(repo, ".worktrees", folder, roundPath(folder, name));
  return existsSync(path)
    ? readFileSync(path, "utf8")
    : git(repo, "show", `${folder}:${roundPath(folder, name)}`);
}

/** Replaces the round in the feature's worktree, as an edit made elsewhere. */
export function editElsewhere(repo: string, folder: string, edit: (round: string) => string) {
  const path = join(repo, ".worktrees", folder, roundPath(folder));
  writeFileSync(path, edit(readFileSync(path, "utf8")));
}

/** The `**Answer:**` line of a question. */
export function answerLine(repo: string, folder: string, id: string) {
  const lines = roundNow(repo, folder).split("\n");
  const heading = lines.findIndex((line) =>
    new RegExp(`^#{2,3} ${id.replace(".", String.raw`\.`)}:`).test(line),
  );
  return lines.slice(heading).find((line) => line.startsWith("**Answer:**"));
}

/** The subject of the feature branch's last commit. */
export function lastSubject(repo: string, folder: string) {
  return git(repo, "log", "-1", "--format=%s", folder).trim();
}

/**
 * Makes the worktree of a feature, where its round is written, before the page opens it: an edit
 * made elsewhere needs the file there.
 */
export function checkOut(repo: string, folder: string) {
  git(repo, "worktree", "add", "--quiet", join(".worktrees", folder), folder);
}
