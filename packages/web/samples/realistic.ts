// The sandbox's "realistic" project: a project as it is lived in, to judge the sidebar and home on a
// full day's load rather than on one feature at each step. A feature waits for the human, two have
// an agent working (one writes the spec, one builds the plan, which the sandbox starts as it starts:
// `sandbox/agent.ts`), three are done, and Now, Next, and Later hold five lines each, not counting
// the three live features', which show apart as Ongoing (a feature waiting on the human is one),
// some of them long, and an inbox of nine notes, three of them long.
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
- Bulk edit for tasks: select several with the keyboard or a drag, then change their due date, labels, or project at once, with a single undo for the whole batch
- Drag to reorder subtasks
- Quick add from the keyboard
- Undo for deleted tasks, kept for thirty days in a trash that can be searched, and restored with their subtasks and comments
  - the trash empties itself, and says when it will, so that nothing is lost without a warning on a phone that was offline the whole month
- Subtasks that repeat with their task

## Next

> [!NOTE]
>
> What comes once Now is done

- Task templates
- Natural-language due dates, so that "every other Friday until the end of the quarter" becomes a repeating task with an end date, and the parsing is shown before the task is saved
- Offline mode
  - with a queue of the changes made meanwhile, which a conflict with another device's can neither lose nor silently overwrite
- Attachments on tasks
- A weekly review page

## Later

> [!NOTE]
>
> Ideas for one day, and what waits on another line

- Calendar sync with Google and Apple, both ways, so that a task dragged on the calendar moves its due date and an event moved in the calendar moves the task
- Team workspaces
  - after sharing lists, with roles for who may edit, who may only comment, and who is only told when a task is done
- Time tracking
- A public API
- Import from other task apps, keeping the labels, the due dates, the repeats, and the comments each one has, and listing what could not be kept before anything is written
`;

/** The inbox: notes before the first category, and two categories, with a few long ones. */
const INBOX = `# Inbox

- The reminder email arrives an hour late when the due time is set in another time zone than the phone's
- Searching for a task by its label should also find the tasks of the lists that are archived, with a way to tell which ones they are, and without making the results of the lists in use any harder to find
- Dark mode flashes white for a moment when the app opens

## UI

- [run-ui] The count on the Today tab is not centered in its badge
- A task with a very long title pushes its due date out of the row on a phone, where it should wrap to a second line and keep the date visible beside the first one, as the desktop does
- The empty state of a new list has no way to add a first task from the keyboard

## Sync

- Two devices that complete the same repeating task at the same time create the next one twice
- [agent] After a long time offline the app replays every change at once, which freezes it for several seconds, where it should replay them in small batches and show a progress line that the human can leave
- The calendar sync should not touch tasks that have no due date
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
    {
      at: at("17 09:00"),
      files: { "specs/INBOX.md": INBOX, "specs/PRIORITIES.md": PRIORITIES },
      message: "docs: priorities and inbox",
    },
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
