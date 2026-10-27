// The sandbox's "realistic" project: a project as it is lived in, to judge the sidebar and home on a
// full day's load rather than on one feature at each step. A feature waits for the human, two have
// an agent working (one writes the spec, one builds the plan, which the sandbox starts as it starts:
// `sandbox/agent.ts`), three are done, and Now, Next, and Later hold five lines each, not counting
// the three live features', which show apart as Ongoing (a feature waiting on the human is one).
import { join } from "node:path";
import { commitsAt, ELEVEN, git, planText } from "uraeda-binding/test-utils";
import { at, code, finish, firstStages, record } from "./features.ts";

/** The folders of the live features, by what they wait for. */
export const REALISTIC_FOLDERS = {
  /** An agent builds it: task 7 of 11. */
  building: "2026-10-18-due-reminders",
  /** An agent writes its spec, from the answered round. */
  specifying: "2026-10-21-calendar-view",
  /** Its plan waits for the human's review. */
  waiting: "2026-10-20-share-lists",
} as const;

/** The priorities file: five lines in each section, and the live features besides in Now. */
const PRIORITIES = `# Priorities

## Now

> [!NOTE]
>
> The features worked on today

- [Due date reminders](/specs/${REALISTIC_FOLDERS.building}/proposal.md)
- [Calendar view](/specs/${REALISTIC_FOLDERS.specifying}/proposal.md)
- [Share lists](/specs/${REALISTIC_FOLDERS.waiting}/proposal.md)
- Bulk edit for tasks
- Drag to reorder subtasks
- Quick add from the keyboard
- Undo for deleted tasks
- Subtasks that repeat with their task

## Next

> [!NOTE]
>
> What comes once Now is done

- Task templates
- Natural-language due dates, "every other Friday"
- Offline mode
  - with a queue of the changes made meanwhile
- Attachments on tasks
- A weekly review page

## Later

> [!NOTE]
>
> Ideas for one day, and what waits on another line

- Calendar sync with Google and Apple
- Team workspaces
  - after sharing lists
- Time tracking
- A public API
- Import from other task apps
`;

/** The features finished and merged, each with the time it was finished at. */
const DONE = [
  { finished: "17 18:30", folder: "2026-10-12-task-search", questions: 6, title: "Task search" },
  { finished: "18 11:15", folder: "2026-10-13-csv-import", questions: 4, title: "Import from CSV" },
  { finished: "18 16:05", folder: "2026-10-14-keyboard-nav", questions: 8, title: "Keyboard navigation" },
];

/** A done feature, merged by rebase onto `main`: its stages, its code, and its record. */
function addDone(repo: string, { finished, folder, questions, title }: (typeof DONE)[number]) {
  commitsAt(repo, "main", [
    ...firstStages(folder, title),
    {
      at: at("17 16:00"),
      files: code(folder.slice(11)),
      message: `feat(${folder.slice(11)}): the code`,
    },
    finish(
      folder,
      record("feature", title, questions, `2026-10-${finished.slice(0, 2)}`),
      ["proposal.md", "clarifications-01.md", "spec.md", "plan.md"],
      { at: at(finished), committed: at(finished) },
    ),
  ]);
}

/** A plan with no task started, so a feature waiting for its review has nothing built yet. */
const unstarted = (status: string) =>
  planText(
    ELEVEN.map(([title, , total]) => [title, 0, total]),
    status,
  );

/**
 * Adds the realistic project's content to `repo`, a project set up: the done features and the
 * priorities on `main`, then the three live features on their branches.
 */
export function addRealistic(repo: string) {
  for (const done of DONE) {
    addDone(repo, done);
  }
  commitsAt(repo, "main", [
    { at: at("17 09:00"), files: { "specs/PRIORITIES.md": PRIORITIES }, message: "docs: priorities" },
  ]);

  // Waiting for the human: the spec approved, its plan to review.
  const { waiting, specifying, building } = REALISTIC_FOLDERS;
  git(repo, "branch", waiting, "main");
  commitsAt(repo, waiting, [
    ...firstStages(waiting, "Share lists").slice(0, 4),
    {
      at: at("17 15:05"),
      files: { [`specs/${waiting}/plan.md`]: unstarted("awaiting-human") },
      message: "plan(share-lists): the plan",
    },
  ]);

  // An agent writes the spec: the proposal and its answered round are all there is.
  git(repo, "branch", specifying, "main");
  commitsAt(repo, specifying, firstStages(specifying, "Calendar view").slice(0, 2));

  // An agent builds the plan, checked out in its worktree as a feature being built is.
  git(repo, "branch", building, "main");
  commitsAt(repo, building, [
    ...firstStages(building, "Due date reminders"),
    {
      at: at("17 15:08"),
      files: code("reminders"),
      message: "feat(due-reminders): the reminder rules",
    },
  ]);
  git(repo, "worktree", "add", "--quiet", join(".worktrees", building), building);
}
