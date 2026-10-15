// The repository Uraeda's Storybook serves its stories from: a fresh copy of `fixtures/repo`, its
// commits dated 2026-10-16, with the test feature of the story embeds and one checkout for each state
// `StoryEmbed.stories.tsx` shows. Its previews run the tests' fake Storybook,
// `fixtures/preview/serve.mjs`, as the browser tests' do.
import { renameSync } from "node:fs";
import { join } from "node:path";
import {
  addStoryFeature,
  commitOnBranch,
  fixtureRepo,
  git,
  previewDecision,
  temporaryFolder,
} from "uraeda-binding/test-utils";
import { CHECKOUTS } from "./checkouts.ts";

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

/**
 * Builds the fixture at `<temporary folder>/fixture`, which the server lists as `fixture`, and its
 * data folder, both removed when Storybook exits.
 */
export function storybookFixture(): { dataDir: string; repo: string } {
  const dates = { GIT_AUTHOR_DATE: DATE, GIT_COMMITTER_DATE: DATE };
  Object.assign(process.env, dates);
  try {
    const repo = join(temporaryFolder("uraeda-storybook"), "fixture");
    renameSync(fixtureRepo(), repo);
    // The test feature, `CHECKOUTS.ready`, its preview ready: the `Ready`, `Missing`, and
    // `Removed` states.
    addStoryFeature(repo);
    addFeature(repo, CHECKOUTS.starting, { mode: "hang", worktree: true });
    addFeature(repo, CHECKOUTS.failed, { mode: "fail", worktree: true });
    addFeature(repo, CHECKOUTS.noWorktree, { mode: "ok", worktree: false });
    return { dataDir: temporaryFolder("uraeda-storybook-data"), repo };
  } finally {
    for (const name of Object.keys(dates)) {
      delete process.env[name];
    }
  }
}
