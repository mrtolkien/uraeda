// The repository Uraeda's Storybook serves its stories from: a fresh copy of `fixtures/repo`, its
// commits dated 2026-10-16, a note given children, with the test feature of the story embeds and
// one checkout for each state `StoryEmbed.stories.tsx` shows. Its previews run the tests' fake Storybook,
// `fixtures/preview/serve.mjs`, as the browser tests' do.
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  addStoryFeature,
  commitOnBranch,
  fixture,
  fixtureRepo,
  git,
  previewDecision,
  temporaryFolder,
} from "uraeda-binding/test-utils";
import { FakeAdapter } from "uraeda-server/testing";
import type { Plugin } from "vite-plus";
import { uraedaServer } from "../vite.config.ts";
import { CHECKOUTS, ROUND_MOCKUPS } from "./checkouts.ts";
import { fateOverGet } from "./fateOverGet.ts";

/** The date of every commit the fixture is built with. */
const DATE = "2026-10-16T09:00:00Z";

/** A feature's proposal, for a branch the core reads as that feature. */
function proposal(title: string): string {
  return `# ${title}\n\n## What\n\nA checkout of Uraeda's Storybook, for the story embeds' states.\n`;
}

/**
 * Adds a feature on its own branch, from `main`, its preview decision running the fake Storybook in
 * `mode`, checked out in `.worktrees/<folder>` unless `worktree` is false.
 */
function addFeature(
  repo: string,
  folder: string,
  { mode, worktree }: { mode: "ok" | "fail" | "hang"; worktree: boolean },
) {
  git(repo, "branch", folder, "main");
  const log = join(temporaryFolder("uraeda-storybook-preview"), "starts.log");
  commitOnBranch(repo, folder, {
    [`specs/${folder}/proposal.md`]: proposal(folder),
    "specs/decisions/preview.md": previewDecision(log, "packages/web", mode, 0),
  });
  if (worktree) {
    git(repo, "worktree", "add", "--quiet", join(".worktrees", folder), folder);
  }
}

/** A file of the round page's mockup feature, from `fixtures/round-mockup/` (R5). */
function roundMockupFile(name: string): string {
  return readFileSync(fixture(`round-mockup/${name}`), "utf8");
}

/**
 * Adds a round page's mockup feature, its round in the clarifications redesign's format with its
 * Q1 answered `answer`, on its own branch, from `main`, without a worktree.
 */
function addRoundMockup(repo: string, folder: string, answer: string) {
  git(repo, "branch", folder, "main");
  // Q1's answer line is the round's first.
  const round = roundMockupFile("clarifications-01.md").replace(
    "**Answer:**\n",
    `**Answer:** ${answer}\n`,
  );
  commitOnBranch(repo, folder, {
    [`specs/${folder}/clarifications-01.md`]: round,
    [`specs/${folder}/proposal.md`]: roundMockupFile("proposal.md"),
  });
}

/** The children of the inbox's note the `Note` pane story shows, committed on `main`. */
function addNoteChildren(repo: string) {
  const inbox = join(repo, "specs/INBOX.md");
  const note = "- Icons are blurry on retina screens\n";
  const children =
    "  - On the sidebar's step icons\n  - Seen on a 2x display, in Firefox and Chrome\n";
  writeFileSync(inbox, readFileSync(inbox, "utf8").replace(note, `${note}${children}`));
  git(repo, "commit", "--quiet", "--no-verify", "--all", "--message", "chore: a note's children");
}

/**
 * Builds the fixture at `<temporary folder>/fixture`, which the server lists as `fixture`, and its
 * data and config folders, the config folder empty, all removed when Storybook exits.
 */
export function storybookFixture(): { configDir: string; dataDir: string; repo: string } {
  const dates = { GIT_AUTHOR_DATE: DATE, GIT_COMMITTER_DATE: DATE };
  Object.assign(process.env, dates);
  try {
    const repo = join(temporaryFolder("uraeda-storybook"), "fixture");
    renameSync(fixtureRepo(), repo);
    addNoteChildren(repo);
    // The test feature, `CHECKOUTS.ready`, its preview ready: the `Ready`, `Missing`, and
    // `Removed` states.
    addStoryFeature(repo);
    addFeature(repo, CHECKOUTS.starting, { mode: "hang", worktree: true });
    addFeature(repo, CHECKOUTS.failed, { mode: "fail", worktree: true });
    addFeature(repo, CHECKOUTS.noWorktree, { mode: "ok", worktree: false });
    // The round page's mockups, in the clarifications redesign's format.
    addRoundMockup(repo, ROUND_MOCKUPS.waiting, "B");
    addRoundMockup(
      repo,
      ROUND_MOCKUPS.commentOnly,
      "Neither: keep a single task, but keep the last 10 completions.",
    );
    return {
      configDir: temporaryFolder("uraeda-storybook-config"),
      dataDir: temporaryFolder("uraeda-storybook-data"),
      repo,
    };
  } finally {
    for (const name of Object.keys(dates)) {
      delete process.env[name];
    }
  }
}

/**
 * Uraeda's server in Storybook's own, over a fresh fixture: on the fake agent, dated 2026-10-16,
 * with no `.env` and an empty config folder, its list locked to the fixture (R47), behind the
 * middleware that turns the fixture's fate GETs back into POSTs (R4).
 */
export function fixtureServer(): Array<Plugin> {
  const { configDir, dataDir, repo } = storybookFixture();
  process.env.URA_TODAY = "2026-10-16";
  process.env.URAEDA_REPO = repo;
  process.env.URAEDA_DATA_DIR = dataDir;
  process.env.URAEDA_CONFIG_DIR = configDir;
  return [
    fateOverGet(),
    uraedaServer({ adapter: new FakeAdapter(), file: false, lockedList: true, signIn: false }),
  ];
}
