// The repository Uraeda's Storybook serves its stories from: a fresh copy of `fixtures/repo`, its
// commits dated 2026-10-16, a note given children, with the test feature of the story embeds and
// one checkout for each state `StoryEmbed.stories.tsx` shows, the round page's, the questions
// page's, the spec page's, and the feature page's features, with their past runs, and the inbox's
// triage. Its previews run the tests' fake Storybook, `fixtures/preview/serve.mjs`, as the browser
// tests' do. Its repository is built once per change of its sources, in a cache each start copies.
import { createHash } from "node:crypto";
import {
  constants,
  copyFileSync,
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
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
import {
  addFeaturePages,
  addQuestionsPages,
  addRoundMockup,
  addSpecPages,
  DATE,
  dated,
  listPullRequest,
  recordFeatureRuns,
  recordSubSessionRuns,
  ROUND_MOCKUPS,
} from "../samples/index.ts";
import { CHECKOUTS } from "./checkouts.ts";
import { fateOverGet } from "./fateOverGet.ts";

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

/** The children of the inbox's note the `Note` pane story shows, committed on `main`. */
function addNoteChildren(repo: string) {
  const inbox = join(repo, "specs/INBOX.md");
  const note = "- Icons are blurry on retina screens\n";
  const children =
    "  - On the sidebar's step icons\n  - Seen on a 2x display, in Firefox and Chrome\n";
  writeFileSync(inbox, readFileSync(inbox, "utf8").replace(note, `${note}${children}`));
  git(repo, "commit", "--quiet", "--no-verify", "--all", "--message", "chore: a note's children");
}

/** The inbox's triage, `fixtures/INBOX-TRIAGE.md`, committed on `main`, waiting for answers. */
function addTriage(repo: string) {
  copyFileSync(fixture("INBOX-TRIAGE.md"), join(repo, "specs/INBOX-TRIAGE.md"));
  git(repo, "add", "specs/INBOX-TRIAGE.md");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "chore: propose an inbox triage");
}

/** The fixture's repository, built from `fixtures/repo` in `repo`, as `storybookFixture` lists it. */
function buildRepository(repo: string) {
  renameSync(fixtureRepo(), repo);
  addNoteChildren(repo);
  // The test feature, `CHECKOUTS.ready`, its preview ready: the `Ready`, `Missing`, and
  // `Removed` states.
  addStoryFeature(repo);
  addFeature(repo, CHECKOUTS.starting, { mode: "hang", worktree: true });
  addFeature(repo, CHECKOUTS.failed, { mode: "fail", worktree: true });
  addFeature(repo, CHECKOUTS.noWorktree, { mode: "ok", worktree: false });
  // The spec page's features: its spec revised since its review, approved, and its plan,
  // auto-approved and waiting.
  addSpecPages(repo);
  // The round page's mockups, in the clarifications redesign's format.
  addRoundMockup(repo, ROUND_MOCKUPS.waiting, "B");
  addRoundMockup(
    repo,
    ROUND_MOCKUPS.commentOnly,
    "Neither: keep a single task, but keep the last 10 completions.",
  );
  // The questions page's features, from the spec's rounds, and the inbox's triage.
  addQuestionsPages(repo);
  addTriage(repo);
  // The feature page's features, one per state, and their runs' tokens.
  addFeaturePages(repo);
}

/** The checkout's top level. */
const ROOT = join(import.meta.dirname, "../../..");

/** The cache of built repositories, one folder per key, in the web package's `node_modules`. */
const CACHE = join(import.meta.dirname, "../node_modules/.cache/uraeda-storybook-fixture");

/**
 * What the repository's build reads, from the checkout's top level: files, and every file under
 * folders.
 */
const SOURCES = [
  "fixtures",
  "packages/web/samples",
  "packages/binding/test-repos.ts",
  "packages/binding/test-utils.ts",
  "packages/web/.storybook/checkouts.ts",
  "packages/web/.storybook/fixture.ts",
];

/**
 * The cache's key for this checkout: a hash of its path, which the preview decisions' commands
 * hold, of git's version, and of every file the build reads, by path and content.
 */
function cacheKey(): string {
  const hash = createHash("sha256").update(ROOT).update("\0").update(git(ROOT, "--version"));
  for (const source of SOURCES) {
    const path = join(ROOT, source);
    const files = statSync(path).isDirectory()
      ? readdirSync(path, { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => join(entry.parentPath, entry.name))
      : [path];
    for (const file of files.sort()) {
      hash.update(relative(ROOT, file)).update("\0").update(readFileSync(file)).update("\0");
    }
  }
  return hash.digest("hex").slice(0, 16);
}

/**
 * Copies a folder, a copy-on-write clone where the file system has one, an ordinary copy
 * elsewhere.
 */
function copyFolder(from: string, to: string) {
  cpSync(from, to, { mode: constants.COPYFILE_FICLONE, recursive: true, verbatimSymlinks: true });
}

/**
 * Copies the cached repository at `cached` to `repo`, then repairs its worktrees, each in
 * `.worktrees/`, whose links still name the repository it was built in. Returns whether `repo`
 * holds it, every worktree linked: on a failure, `repo` is removed.
 */
function copyCached(cached: string, repo: string): boolean {
  if (!existsSync(cached)) {
    return false;
  }
  try {
    copyFolder(cached, repo);
    const worktrees = readdirSync(join(repo, ".worktrees")).map((name) =>
      join(repo, ".worktrees", name),
    );
    git(repo, "worktree", "repair", ...worktrees);
    const listed = git(repo, "worktree", "list", "--porcelain");
    if (listed.includes("\nprunable") || worktrees.some((path) => !listed.includes(path))) {
      throw new Error("a worktree of the cached fixture is not linked");
    }
    return true;
  } catch {
    rmSync(repo, { force: true, recursive: true });
    return false;
  }
}

/**
 * Saves the repository built at `repo` as the cache's `cached`, then removes every other key's:
 * written aside, then renamed, so a start never copies half of one, nor one being removed. A
 * failure leaves no cache of this key.
 */
function saveCache(repo: string, cached: string) {
  const aside = `${cached}.${process.pid}`;
  try {
    rmSync(cached, { force: true, recursive: true });
    copyFolder(repo, aside);
    renameSync(aside, cached);
    for (const other of readdirSync(CACHE)) {
      if (join(CACHE, other) !== cached && !other.includes(".")) {
        rmSync(join(CACHE, other), { force: true, recursive: true });
      }
    }
  } catch {
    rmSync(aside, { force: true, recursive: true });
  }
}

/**
 * Builds the fixture at `<temporary folder>/fixture`, which the server lists as `fixture`, and its
 * data and config folders, the config folder empty, all removed when Storybook exits. The
 * repository is the cache's copy when it has one for its sources, and is built, then cached,
 * otherwise; the data folder is built at each start, its runs keyed by the repository's path.
 */
export function storybookFixture(): { configDir: string; dataDir: string; repo: string } {
  return dated(() => {
    const repo = join(temporaryFolder("uraeda-storybook"), "fixture");
    const cached = join(CACHE, cacheKey());
    if (!copyCached(cached, repo)) {
      buildRepository(repo);
      saveCache(repo, cached);
    }
    const dataDir = temporaryFolder("uraeda-storybook-data");
    recordFeatureRuns(dataDir, repo);
    recordSubSessionRuns(dataDir, repo);
    return { configDir: temporaryFolder("uraeda-storybook-config"), dataDir, repo };
  });
}

/**
 * Uraeda's server in Storybook's own, over a fresh fixture: on the fake agent, dated 2026-10-16,
 * with no `.env` and an empty config folder, its list locked to the fixture (R47), behind the
 * middleware that turns the fixture's fate GETs back into POSTs (R4). Its `gh` lists the feature
 * page's open pull request (R100).
 */
export function fixtureServer(): Array<Plugin> {
  const { configDir, dataDir, repo } = storybookFixture();
  listPullRequest();
  // "Today" is the day of the fixture's commits.
  process.env.URA_TODAY = DATE.slice(0, 10);
  process.env.URAEDA_REPO = repo;
  process.env.URAEDA_DATA_DIR = dataDir;
  process.env.URAEDA_CONFIG_DIR = configDir;
  return [
    fateOverGet(),
    uraedaServer({
      agents: { fake: new FakeAdapter() },
      file: false,
      lockedList: true,
      signIn: false,
    }),
  ];
}
