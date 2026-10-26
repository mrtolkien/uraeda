/** The repository the screenshots open: the fixture, with the features the views need. */
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fixtureRepo, git } from "uraeda-binding/test-utils";
import {
  addFeaturePages,
  addQuestionsPages,
  addRoundMockup,
  addSpecPages,
  ROUND_MOCKUPS,
} from "../samples/index.ts";

/** The fixture, with the fixture HTML mockup committed on the recurring tasks' branch. */
export function repository(root: string) {
  const repo = fixtureRepo();
  const branch = "2026-10-06-recurring-tasks";
  git(repo, "switch", "--quiet", branch);
  mkdirSync(join(repo, "specs", branch, "mockups"), { recursive: true });
  copyFileSync(
    join(root, "fixtures/mockups/repeat.html"),
    join(repo, "specs", branch, "mockups/repeat.html"),
  );
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "docs: mockup repeat.html");
  git(repo, "switch", "--quiet", "main");
  // The round page's mockup feature, whose round holds a diagram, a follow-up, and every group.
  addRoundMockup(repo, ROUND_MOCKUPS.waiting, "B");
  // The questions page's features, from its spec's rounds.
  addQuestionsPages(repo);
  // The spec page's features, waiting for review and approved, and their decisions' changes.
  addSpecPages(repo);
  // The feature page's features, one per state.
  addFeaturePages(repo);
  return repo;
}
