// The feature page's features, one per state its stories, browser tests, and screenshots show, each
// with typed commits dated in UTC, so its stages are timed: built on the fixture repository's
// `main`, from the recurring tasks' files of `fixtures/repo/`.
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  commitsAt,
  type DatedCommit,
  ELEVEN,
  fixture,
  git,
  planText,
  temporaryFolder,
} from "uraeda-binding/test-utils";
import { recordRun } from "uraeda-server/testing";
import { FEATURE_PAGES } from "./checkouts.ts";

/** The pull request `gh` lists for `FEATURE_PAGES.pullRequest`. */
const PULL_REQUEST = {
  headRefName: FEATURE_PAGES.pullRequest,
  isDraft: false,
  number: 31,
  reviewDecision: "",
  url: "https://github.com/mrtolkien/uraeda/pull/31",
};

/**
 * The past runs of the feature page's features, as the runner's cache keeps them: each feature's
 * one run, its times, and its own token counts.
 */
const RUNS = [
  {
    at: "2026-10-17T15:08:00Z",
    ended: "2026-10-17T15:20:00Z",
    folder: FEATURE_PAGES.working,
    step: "implementation",
    tokens: { cacheRead: 98_120_400, cacheWrite: 3_904_211, input: 1840, output: 81_022 },
  },
  {
    at: "2026-10-17T12:01:00Z",
    ended: "2026-10-17T12:11:00Z",
    folder: FEATURE_PAGES.waiting,
    step: "spec",
    tokens: { cacheRead: 30_512_008, cacheWrite: 1_098_340, input: 920, output: 41_230 },
  },
  {
    at: "2026-10-18T09:10:00Z",
    ended: "2026-10-18T16:05:00Z",
    folder: FEATURE_PAGES.done,
    step: "implementation",
    tokens: { cacheRead: 146_726_052, cacheWrite: 5_174_704, input: 2712, output: 113_407 },
  },
] as const;

/** A file of the recurring tasks' feature in `fixtures/repo/`. */
function recurring(name: string): string {
  const folder = "2026-10-06-recurring-tasks";
  return readFileSync(fixture(`repo/branches/${folder}/specs/${folder}/${name}`), "utf8");
}

/** The slug of a folder: its name without its date. */
const slugOf = (folder: string) => folder.slice(11);

/** `count` numbered lines of code. */
function lines(count: number, prefix: string): string {
  return Array.from({ length: count }, (_, index) => `${prefix} ${index}\n`).join("");
}

/** A proposal titled `title`. */
const proposal = (title: string) =>
  `# ${title}\n\n## What\n\nRounds of questions read as a flat list.\n\n## Why\n\nThey take too long to answer.\n`;

/** The spec of the recurring tasks, its status `status`. */
const spec = (status: string) => recurring("spec.md").replace(/^status: .*$/m, `status: ${status}`);

/** A UTC time of Oct 17 or Oct 18, 2026, "17 10:52" giving Oct 17 at 10:52. */
const at = (time: string) => `2026-10-${time.replace(" ", "T")}:00Z`;

/**
 * The commits of a feature's first stages, from its proposal at 10:52 on Oct 17 to its plan at
 * 15:05: proposal, its round of questions, its spec, approved, and its decisions.
 */
function firstStages(folder: string, title: string): Array<DatedCommit> {
  const path = `specs/${folder}`;
  const slug = slugOf(folder);
  return [
    {
      at: at("17 10:52"),
      files: { [`${path}/proposal.md`]: proposal(title) },
      message: `proposal(${slug}): ${title}`,
    },
    {
      at: at("17 11:18"),
      files: { [`${path}/clarifications-01.md`]: recurring("clarifications-01.md") },
      message: `discovery(${slug}): round 01`,
    },
    {
      at: at("17 12:11"),
      files: { [`${path}/spec.md`]: spec("approved") },
      message: `spec(${slug}): the spec`,
    },
    {
      at: at("17 15:01"),
      files: { [`specs/decisions/${slug}.md`]: decision(title) },
      message: `decision(${slug}): ${title}`,
    },
    {
      at: at("17 15:05"),
      files: { [`${path}/plan.md`]: planText(ELEVEN) },
      message: `plan(${slug}): the plan`,
    },
  ];
}

/** A new decision, named after the feature that made it. */
function decision(title: string): string {
  return `---\nstatus: active\napproved-by: mrtolkien\nicon: book-open\n---\n\n# ${title}\n\nFlows and states are Mermaid code blocks, drawn by the UI.\n\n## Rules\n\n- Flows MUST be drawn as Mermaid code blocks. Checked by review.\n- A diagram MUST draw in a frame without scripts. Checked by the UI tests.\n\n## Why\n\nOne way to draw a flow, readable as text.\n`;
}

/** A record of a feature or a change, with `questions` questions in one round. */
function record(kind: "change" | "feature", title: string, questions: number, finished: string) {
  const asked = Array.from(
    { length: questions },
    (_, index) =>
      `#### Q${index + 1}: How should question ${index + 1} read?\n\n**Answer:** A, one card per question.\n`,
  ).join("\n");
  const round = questions > 0 ? `\n## Questions\n\n### Round 01\n\n${asked}` : "";
  const decisions = kind === "feature" ? `\n## Decisions\n\n- New: ${title}.\n` : "";
  return `---\nkind: ${kind}\nfinished: ${finished}\npull-request: https://github.com/mrtolkien/uraeda/pull/30\n---\n\n# Record: ${title}\n\n## What and why\n\nRounds of questions had grown long and read as a flat list. You asked for a round that is quick to read once, top to bottom, with a verdict first.\n\n## Behaviour\n\n- A round opens with the counts and the time, then a verdict.\n- Each question is a card, with a muted "Why it matters" box after its context.\n${round}${decisions}\n## Follow-ups\n\n- Keyboard navigation between question cards, left for later.\n`;
}

/** The code a feature's build writes: 1,204 lines over 22 files, and `old` removed when given. */
function code(prefix: string, old?: string): Record<string, string | null> {
  return {
    ...Object.fromEntries(
      Array.from({ length: 22 }, (_, index) => [
        `src/${prefix}/part-${index}.ts`,
        lines(index === 0 ? 70 : 54, "line"),
      ]),
    ),
    ...(old ? { [old]: null } : {}),
  };
}

/** The finish: the feature's folder removed, its record added. */
function finish(
  folder: string,
  record: string,
  files: Array<string>,
  times: Pick<DatedCommit, "at" | "committed">,
): DatedCommit {
  return {
    ...times,
    files: {
      ...Object.fromEntries(files.map((file) => [`specs/${folder}/${file}`, null])),
      [`specs/done/${folder}.md`]: record,
    },
    message: `finish(${slugOf(folder)}): the record`,
  };
}

/** The feature being built since 15:08: task 7 of 11. */
function addWorking(repo: string) {
  const folder = FEATURE_PAGES.working;
  git(repo, "branch", folder, "main");
  commitsAt(repo, folder, [
    ...firstStages(folder, "Redesign clarifications"),
    {
      at: at("17 15:08"),
      files: code("clarifications"),
      message: "feat(redesign-clarifications): question cards",
    },
  ]);
  // Checked out, as a feature being built is: its files are checked, and their format notes found.
  git(repo, "worktree", "add", "--quiet", join(".worktrees", folder), folder);
}

/** A feature whose spec is `status`: waiting for review, or unreadable. */
function addGated(repo: string, folder: string, title: string, status: string) {
  const path = `specs/${folder}`;
  const slug = slugOf(folder);
  git(repo, "branch", folder, "main");
  commitsAt(repo, folder, [
    {
      at: at("17 10:52"),
      files: { [`${path}/proposal.md`]: proposal(title) },
      message: `proposal(${slug}): ${title}`,
    },
    {
      at: at("17 11:18"),
      files: { [`${path}/clarifications-01.md`]: recurring("clarifications-01.md") },
      message: `discovery(${slug}): round 01`,
    },
    {
      at: at("17 12:11"),
      files: { [`${path}/spec.md`]: spec(status) },
      message: `spec(${slug}): the spec`,
    },
  ]);
}

/** The feature finished on its branch, waiting for its pull request's review since Oct 18. */
function addPullRequest(repo: string) {
  const folder = FEATURE_PAGES.pullRequest;
  const title = "Keyboard shortcuts";
  git(repo, "branch", folder, "main");
  commitsAt(repo, folder, [
    ...firstStages(folder, title),
    { at: at("17 15:20"), files: code("shortcuts"), message: "feat(keyboard-shortcuts): the keys" },
    finish(
      folder,
      record("feature", title, 7, "2026-10-18"),
      ["proposal.md", "clarifications-01.md", "spec.md", "plan.md"],
      {
        at: at("18 09:10"),
      },
    ),
  ]);
}

/**
 * The done feature, merged by rebase onto `main`: planned on Oct 17, built from 09:10 on Oct 18,
 * finished at 16:05, and committed to `main` at 16:11.
 */
function addDone(repo: string) {
  const folder = FEATURE_PAGES.done;
  const title = "Redesign rounds";
  commitsAt(repo, "main", [
    {
      at: at("16 12:00"),
      files: { "src/rounds/old.ts": lines(310, "old") },
      message: "chore: old rounds",
    },
    ...firstStages(folder, title),
    {
      at: at("18 09:10"),
      files: code("rounds", "src/rounds/old.ts"),
      message: "feat(redesign-rounds): question cards",
    },
    {
      at: at("18 14:30"),
      files: { "src/rounds/part-0.ts": lines(70, "card") },
      message: "fix(redesign-rounds): the card's edge",
    },
    finish(
      folder,
      record("feature", title, 10, "2026-10-18"),
      ["proposal.md", "clarifications-01.md", "spec.md", "plan.md"],
      {
        at: at("18 16:05"),
        committed: at("18 16:11"),
      },
    ),
  ]);
}

/** The done change, merged by rebase onto `main` on Oct 17, from 15:40 to 16:13. */
function addDoneChange(repo: string) {
  const folder = FEATURE_PAGES.doneChange;
  const path = `specs/changes/${folder}`;
  const slug = slugOf(folder);
  commitsAt(repo, "main", [
    {
      at: at("17 15:40"),
      files: { [`${path}/proposal.md`]: proposal("Symlinks") },
      message: `proposal(${slug}): symlinks`,
    },
    {
      at: at("17 15:44"),
      files: { "src/worktree/links.ts": lines(487, "link") },
      message: `fix(${slug}): link the ignored folders`,
    },
    {
      at: at("17 16:06"),
      committed: at("17 16:13"),
      files: {
        [`${path}/proposal.md`]: null,
        [`specs/done/${folder}.md`]: record("change", "Symlinks", 0, "2026-10-17"),
      },
      message: `finish(${slug}): the record`,
    },
  ]);
}

/**
 * Adds the feature page's features to `repo`, the fixture repository: each of `FEATURE_PAGES`, the
 * live ones on their branches from `main`, the done ones committed on `main`.
 */
export function addFeaturePages(repo: string) {
  addWorking(repo);
  addGated(repo, FEATURE_PAGES.waiting, "Recurring reminders", "awaiting-human");
  addGated(repo, FEATURE_PAGES.blocked, "Due dates", "aproved");
  addPullRequest(repo);
  addDone(repo);
  addDoneChange(repo);
}

/** Records the features' past runs, with their tokens, in the runner's cache of `dataDir`. */
export function recordFeatureRuns(dataDir: string, repo: string) {
  for (const { folder, ...run } of RUNS) {
    recordRun(dataDir, repo, folder, run);
  }
}

/**
 * Puts first on this process's PATH a `gh` that lists `FEATURE_PAGES.pullRequest`'s pull request,
 * #31, open, as `feature-page.test.tsx` fakes it (R24): the server and the core read it as they
 * read GitHub's, and answer as they do.
 */
export function listPullRequest() {
  const bin = temporaryFolder("uraeda-gh");
  const gh = join(bin, "gh");
  writeFileSync(gh, `#!/bin/sh\necho '${JSON.stringify([PULL_REQUEST])}'\n`);
  chmodSync(gh, 0o755);
  process.env.PATH = `${bin}:${process.env.PATH ?? ""}`;
}
