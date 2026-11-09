// The five sample projects of the sandbox, each a repository in a folder of its own: "sample", a
// feature at every step, the spec, plan, and questions pages' features, and a change at each of its
// states; "empty", a project just set up; "broken", whose features carry the problems
// `ura check` reports; "realistic", a full day's load (`realistic.ts`); and "bare", a repository
// not set up, without `specs/`.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  addStoryFeature,
  commitPreview,
  fixture,
  fixtureRepo,
  git,
  initRepository,
  previewDecision,
  STORY_FEATURE,
  temporaryFolder,
} from "uraeda-binding/test-utils";
import { CHANGE_FOLDERS, addChanges } from "./changes.ts";
import {
  addFeaturePages,
  addQuestionsPages,
  addRoundMockup,
  addSpecPages,
  dated,
  proposal,
} from "./features.ts";
import { FEATURE_PAGES, ROUND_MOCKUPS } from "./folders.ts";
import { addRealistic } from "./realistic.ts";
import { addStepFeatures, FEATURE_FOLDERS, FEATURE_STEPS } from "./steps.ts";

export { CHANGE_FOLDERS, FEATURE_FOLDERS, FEATURE_STEPS };

/** The folder of each step's feature, and of each state's change: what the sandbox opens. */
export const SAMPLE_FOLDERS = { changes: CHANGE_FOLDERS, features: FEATURE_FOLDERS };

/** The templates a project set up has in its `specs/`. */
const SETUP_TEMPLATES = ["README.md", "CONSTITUTION.md", "PRIORITIES.md", "INBOX.md"];

/** The folders setup creates, each with an empty `.gitkeep`. */
const SETUP_FOLDERS = ["proposals", "decisions", "changes"];

/** Commits what `git status` shows in `repo`. */
function commitAll(repo: string, message: string) {
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", message);
}

/** Writes `specs/` as setting up a project does (`projects.md`), and commits it. */
function setUp(repo: string) {
  const specs = join(repo, "specs");
  const templates = fixture("../skills/uraeda/assets/templates/specs");
  mkdirSync(specs, { recursive: true });
  for (const name of SETUP_TEMPLATES) {
    copyFileSync(join(templates, name), join(specs, name));
  }
  for (const name of SETUP_FOLDERS) {
    mkdirSync(join(specs, name), { recursive: true });
    writeFileSync(join(specs, name, ".gitkeep"), "");
  }
  commitAll(repo, "chore: set up specs");
}

/** The sample project: the fixture repository, and a feature at every step, a change at each state. */
function buildSample(repo: string) {
  fixtureRepo("repo", repo);
  // The stories feature first, as Storybook's fixture does: the preview decision reaches only the
  // branches that exist. Its fake Storybook logs nowhere: a log in this process's temporary folder
  // would be gone when the sandbox, which keeps the projects, starts it later.
  addStoryFeature(repo, { preview: false, worktree: false });
  commitPreview(repo, previewDecision(null, "packages/web", "ok", 0));
  git(repo, "worktree", "add", "--quiet", join(".worktrees", STORY_FEATURE), STORY_FEATURE);
  addFeaturePages(repo);
  addStepFeatures(repo);
  addChanges(repo);
  // The spec page's and the plan page's features, as Storybook's fixture and the screenshots have
  // them: a spec revised since its review, approved, and a plan, auto-approved and waiting.
  addSpecPages(repo);
  // The questions page's features, from the spec's rounds, as Storybook's fixture has them, and the
  // round page's, whose options show SVG prototypes.
  addQuestionsPages(repo);
  addRoundMockup(repo, ROUND_MOCKUPS.waiting, "B");
  // Uraeda's own code-quality and testing decisions, on `main`: the project is set up, and its Home
  // shows no Setup pane.
  git(repo, "switch", "--quiet", "main");
  for (const name of ["code-quality.md", "testing.md"]) {
    copyFileSync(fixture(`realistic/decisions/${name}`), join(repo, "specs/decisions", name));
  }
  commitAll(repo, "docs: code-quality and testing decisions");
  // The pull requests waiting on review hold main's tip; those at `catch-up` lack the decisions.
  updateBranch(repo, FEATURE_PAGES.pullRequest);
  updateBranch(repo, `change/${CHANGE_FOLDERS["pull-request"]}`);
  addOrigin(repo);
}

/**
 * Merges `main` into `branch`, as GitHub's "Update branch" does: its pull request then holds
 * main's tip, and waits on review rather than a catch-up.
 */
function updateBranch(repo: string, branch: string) {
  const worktree = join(temporaryFolder("uraeda-branch"), "worktree");
  git(repo, "worktree", "add", "--quiet", worktree, branch);
  try {
    git(worktree, "merge", "--quiet", "--no-verify", "--no-edit", "main");
  } finally {
    git(repo, "worktree", "remove", "--force", worktree);
  }
}

/** The line of `specs/PRIORITIES.md` the sample's own commit and its `origin`'s both change. */
const PRIORITY_LINE = "- Claude Code runner (triggered manually)";

/** Replaces `PRIORITY_LINE` in `repo`'s `specs/PRIORITIES.md` with `line`, and commits it. */
function changePriority(repo: string, line: string, message: string) {
  const file = join(repo, "specs/PRIORITIES.md");
  const text = readFileSync(file, "utf8");
  if (!text.includes(PRIORITY_LINE)) {
    throw new Error(`specs/PRIORITIES.md has no line "${PRIORITY_LINE}"`);
  }
  writeFileSync(file, text.replace(PRIORITY_LINE, line));
  commitAll(repo, message);
}

/**
 * The sample's `origin`: a bare repository beside it, `sample-origin.git`, with its `main` pushed
 * and tracked. Then a commit on `origin`, made in a second clone and fetched, and a local chore,
 * each changing the same line of `specs/PRIORITIES.md`: the Git page shows one to pull and one to
 * push, and a pull stops on a conflict. The seed points `origin` at the bare repository's final
 * folder.
 */
function addOrigin(repo: string) {
  const origin = join(dirname(repo), "sample-origin.git");
  const upstream = join(dirname(repo), ".sample-upstream");
  git(dirname(repo), "init", "--quiet", "--bare", "--initial-branch", "main", origin);
  git(repo, "remote", "add", "origin", origin);
  git(repo, "push", "--quiet", "--no-verify", "--set-upstream", "origin", "main");
  git(dirname(repo), "clone", "--quiet", origin, upstream);
  git(upstream, "config", "user.name", git(repo, "config", "user.name").trim());
  git(upstream, "config", "user.email", git(repo, "config", "user.email").trim());
  git(upstream, "config", "commit.gpgsign", "false");
  changePriority(
    upstream,
    "- Claude Code runner (triggered from the web UI)",
    "docs: the runner is triggered from the web UI",
  );
  git(upstream, "push", "--quiet", "--no-verify", "origin", "main");
  rmSync(upstream, { force: true, recursive: true });
  git(repo, "fetch", "--quiet", "origin");
  changePriority(
    repo,
    "- Claude Code runner (triggered by a git hook)",
    "chore: the runner is triggered by a git hook",
  );
}

/**
 * The broken project: set up, then one feature per file of `fixtures/broken/`, its proposal and
 * that file, each with the problem `ura check` reports in it. Each is on a branch of its own, as a
 * feature at work is: one merged on `main` would be done, which shows without its problems.
 */
function buildBroken(repo: string) {
  initRepository(repo);
  setUp(repo);
  const source = fixture("broken");
  for (const name of readdirSync(source)) {
    const file = name.replace(/\.md$/, "");
    const folder = `2026-10-19-broken-${file}`;
    // Copied byte for byte, in the project's own checkout: one fixture is not UTF-8.
    git(repo, "switch", "--quiet", "--create", folder, "main");
    mkdirSync(join(repo, "specs", folder));
    writeFileSync(join(repo, "specs", folder, "proposal.md"), proposal(`Broken ${file}`));
    copyFileSync(join(source, name), join(repo, "specs", folder, name));
    commitAll(repo, `docs(${folder}): proposal`);
  }
  git(repo, "switch", "--quiet", "main");
}

/** The realistic project: set up, then a full day's features and priorities (`realistic.ts`). */
function realistic(repo: string) {
  initRepository(repo);
  setUp(repo);
  addRealistic(repo);
}

/**
 * Builds the realistic project alone in `repo`, every commit dated as `buildProjects` dates them:
 * what the README's screenshots show.
 */
export function buildRealistic(repo: string) {
  dated(() => realistic(repo));
}

/** The bare project: a repository with a README, and no `specs/`, as one is before its setup. */
function buildBare(repo: string) {
  initRepository(repo);
  writeFileSync(join(repo, "README.md"), "# Bare\n\nA project not set up for Uraeda yet.\n");
  commitAll(repo, "docs: readme");
}

/**
 * Builds the five sample projects in `dir`, each in the folder the server lists it by, with
 * every commit dated: returns their paths.
 */
export function buildProjects(dir: string): {
  bare: string;
  broken: string;
  empty: string;
  realistic: string;
  sample: string;
} {
  const paths = {
    bare: join(dir, "bare"),
    broken: join(dir, "broken"),
    empty: join(dir, "empty"),
    realistic: join(dir, "realistic"),
    sample: join(dir, "sample"),
  };
  dated(() => {
    buildSample(paths.sample);
    initRepository(paths.empty);
    setUp(paths.empty);
    buildBroken(paths.broken);
    realistic(paths.realistic);
    buildBare(paths.bare);
  });
  return paths;
}
