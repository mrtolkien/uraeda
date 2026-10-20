// The three sample projects of the sandbox, each a repository in a folder of its own: "sample", a
// feature at every step and a change at each of its states; "empty", a project just set up; and
// "broken", whose features carry the problems `ura check` reports.
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  addStoryFeature,
  fixture,
  fixtureRepo,
  git,
  initRepository,
} from "uraeda-binding/test-utils";
import { CHANGE_FOLDERS, addChanges } from "./changes.ts";
import { addFeaturePages, dated, proposal } from "./features.ts";
import { addStepFeatures, FEATURE_FOLDERS, FEATURE_STEPS } from "./steps.ts";

export { CHANGE_FOLDERS, FEATURE_FOLDERS, FEATURE_STEPS };

/** The folder of each step's feature, and of each state's change: what the sandbox opens. */
export const SAMPLE_FOLDERS = { changes: CHANGE_FOLDERS, features: FEATURE_FOLDERS };

/** The templates a project set up has in its `specs/`. */
const SETUP_TEMPLATES = ["README.md", "CONSTITUTION.md", "PRIORITIES.md", "INBOX.md"];

/** The folders setup creates, each with an empty `.gitkeep`. */
const SETUP_FOLDERS = ["drafts", "backlog", "decisions", "changes"];

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
  // branches that exist.
  addStoryFeature(repo);
  addFeaturePages(repo);
  addStepFeatures(repo);
  addChanges(repo);
}

/**
 * The broken project: set up, then one feature per file of `fixtures/broken/`, its proposal and
 * that file, each with the problem `ura check` reports in it.
 */
function buildBroken(repo: string) {
  initRepository(repo);
  setUp(repo);
  const source = fixture("broken");
  for (const name of readdirSync(source)) {
    const folder = join(repo, "specs", `2026-10-19-broken-${name.replace(/\.md$/, "")}`);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "proposal.md"), proposal("Broken"));
    copyFileSync(join(source, name), join(folder, name));
  }
  commitAll(repo, "chore: broken features");
}

/**
 * Builds the three sample projects in `dir`, each in the folder the server lists it by, with
 * every commit dated: returns their paths.
 */
export function buildProjects(dir: string): { broken: string; empty: string; sample: string } {
  const paths = {
    broken: join(dir, "broken"),
    empty: join(dir, "empty"),
    sample: join(dir, "sample"),
  };
  dated(() => {
    buildSample(paths.sample);
    initRepository(paths.empty);
    setUp(paths.empty);
    buildBroken(paths.broken);
  });
  return paths;
}
