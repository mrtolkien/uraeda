// The sample project's changes, one at each state a change's step reads: at work, a round waiting,
// its pull request open, and merged.
import { readFileSync } from "node:fs";
import { addChange, fixture, STORY_FEATURE } from "uraeda-binding/test-utils";
import { FEATURE_PAGES, proposal } from "./features.ts";

/** The folder of each state's sample change. */
export const CHANGE_FOLDERS = {
  /** At its `change` step: the agent investigates and fixes. */
  change: "2026-10-19-sort-order",
  /** Done: merged by rebase, the feature page's. */
  done: FEATURE_PAGES.doneChange,
  /** A round of questions waiting for the human. */
  "human-gate": "2026-10-19-date-format",
  /** Its pull request, #35, open. */
  "pull-request": "2026-10-18-empty-state",
} as const;

/** Adds the changes `addFeaturePages` leaves out, each on its branch `change/<folder>`. */
export function addChanges(repo: string) {
  addChange(repo, CHANGE_FOLDERS.change, { "proposal.md": proposal("Sort order") });
  // The round is the stories feature's, a real round waiting for its answers.
  addChange(repo, CHANGE_FOLDERS["human-gate"], {
    "clarifications-01.md": readFileSync(
      fixture(`preview/feature/specs/${STORY_FEATURE}/clarifications-01.md`),
      "utf8",
    ),
    "proposal.md": proposal("Date format"),
  });
  addChange(repo, CHANGE_FOLDERS["pull-request"], { "proposal.md": proposal("Empty state") });
}
