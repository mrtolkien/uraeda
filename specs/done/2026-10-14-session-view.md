---
kind: feature
finished: 2026-10-15
pull-request: https://github.com/mrtolkien/uraeda/pull/15
---

# Record: Dedicated session view

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-14, finished on
> 2026-10-15, in [its pull request](https://github.com/mrtolkien/uraeda/pull/15). Its full files are
> in git: `git log -- specs/2026-10-14-session-view/`.

## What and why

Following what an agent does is one of the main things the web UI is for, and a feature's session
was a pane 40 % wide beside the feature page on a desktop, about 480 px of a 1440 px window: "it's
hard to really follow what is happening at the moment". The session became a page of its own at
every width, with a column beside the transcript for the feature's progress and the files changed on
its branch. The sidebar shows each feature by its slug and, during its implementation, its current
task, "7/11", taken from the plan's checkboxes, so it shows whoever runs the agent, the UI or a
terminal.

## Behaviour

- **The session's page**, `/f/<folder>/session`, at every width, as chats already were: crumbs
  "<title> › Session", a level-1 heading, the transcript, and the composer, with no feature page
  beside it. Hand-over (`?continue=`), Ask the agent (`?ask=`), and old run links (`/runs/<n>`,
  opening scrolled to that turn) keep working, and Back returns to the page it came from at its
  position. The feature page keeps its Agent section and "Open the session".
- **The column**, "Progress", 320 px (`--size-session-aside`), sticky at the window's edge on wide
  screens, with its sections:
  - its heading, the gate's title while the step waits on the human ("Review the plan", "Write the
    proposal"), and the step's name otherwise ("Implementation");
  - the plan: "Task 7 of 11" over a progress bar, and the tasks with their checks and the current
    one marked; a plan waiting for its review or a revision lists its tasks with no current one and
    no bar; "11 of 11 tasks done" with a full bar only once the core says the implementation is over
    (the final review onwards); "No plan yet." without a plan or a task heading;
  - "Sub-agents", the running ones;
  - "Changed on the branch": "2 files · +42 −19" (U+2212), then at most 50 paths sorted, each with
    its counts or "binary", a renamed file under its new path, then "and N more files"; the total
    counts them all. The feature's own folder, or once finished its record and its folder's
    deletions, is left out. "Nothing outside the feature's folder yet." with no such commit; no
    section without a branch, once merged, or with the default branch unknown; "The changes could
    not be read." when git fails, the rest of the page working. Only committed code counts; the
    paths are listed, not linked;
  - "Feature", with the feature page and its files.

  Each section's read fails alone. "Hide progress" and "Show progress" fold it for every session,
  kept in `localStorage` as `uraeda.sessionAside`, or for the document's life when storage is
  refused; folding never remounts the page, its focus, or an error under the composer. A chat has no
  column and no button.

- **Live updates**: a box checked in a worktree's `plan.md` moves the column, the sidebar, and the
  phone's line within 2 seconds, without a reload. A commit on the feature's branch, or on the
  default branch, which moves the merge base, refreshes its changes. Progress follows the plan as it
  is, so a revised plan can turn "7/11" into "5/12"; counts are positions among the plan's tasks,
  whatever their `## Task N` numbers, with titles as written, markup included.
- **The sidebar**: every feature row reads its slug, done ones and bugs included, its accessible
  name "<slug>, <title>, <status>"; search matches slugs and titles. While the core gives a
  feature's step a progress, a nested row comes first under it, before sub-agent rows: a ring filled
  to the progress and "7/11 · Session column", cut with an ellipsis, named "7/11 · Session column,
  Task 7 of 11". It opens the session's page, where it is the one selected row; folded, the sidebar
  hides it and selects the feature's row. An agent started outside the UI moves the progress, and
  its status dot keeps today's rules, "Idle".
- **The phone**: under the header, a disclosure line, "Implementation · 7/11 · Session column"
  beside a ring, or the step alone, opens the column's content in place, above the transcript, as a
  region labelled "Progress". Back keeps it open, from the history entry. Crossing 768 px keeps the
  line the human reads a third down the window in place, and the line comes back folded on the
  phone.
- **Following**: a working session follows the end while the human is there, within 24 px; only the
  human's scroll stops following, never the transcript growing, so a message sent from the end keeps
  the reply in view. Scrolled up, working or not, "Jump to the latest" floats above the composer;
  pressed, it scrolls to the end, follows again, and moves the focus to the composer.
- **Announcements**: a status region named "Agent updates" announces "The agent started:
  Implementation", "The agent finished", "The agent failed: <reason>", "The agent stopped", and
  "Task 8 of 11: <title>", for what changes after the page is drawn, never what it finds, keeping
  its last three. Every turn not yet ended is followed, so a queued turn hides no failure, and a
  message taken back or dropped before it ran says nothing. A new chat's first turn start is
  announced, Back and a reload announce nothing. The transcript no longer announces what streams,
  and the composer's "is replying" and "Reply complete" are gone.

## Design

The core owns every rule: the plan's progress, from the same parse the plan's review uses, whether
the implementation is over, and the branch's changes, by running git. The server publishes them
through fate, and the web UI only draws them, decides the layout, and keeps the column's folded
state.

**Core** ([`crates/core`](/crates/core/)):

- Progress: [`steps.rs`](/crates/core/src/steps.rs) gives the step `progress`, `TaskProgress`
  `{ position, total, title }`, set during the implementation only, and `implemented`, from the
  final review on; [`files/plan.rs`](/crates/core/src/files/plan.rs)'s `plan::tasks` is the one
  parser, over the parsed plan's items with titles taken from the heading's line; carried by
  [`view.rs`](/crates/core/src/view.rs).
- Changes: [`changes.rs`](/crates/core/src/changes.rs), `branch_changes`, runs
  `git diff --numstat -z -M --no-ext-diff <base>...<tip>` on the commits the default branch and the
  feature's branch resolve to, local or on `origin`.
- The watcher, [`watch.rs`](/crates/core/src/watch.rs): a feature's hash holds its branch's tip and
  the default branch's, so a commit on either publishes it.
- The binding: `branchChanges` in [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs).

**Server** ([`packages/server/src`](/packages/server/src/)): the `BranchChanges` view in
[`fate/views.ts`](/packages/server/src/fate/views.ts), keyed by the folder, and its source in
[`fate/sources.ts`](/packages/server/src/fate/sources.ts), answering a folder that is no feature's,
or a repository without `specs/`, as no changes, and other failures as `failed`, logged. It is
republished with the feature in [`live.ts`](/packages/server/src/live.ts). Absent fields are sent as
`null`, so the UI reads one shape.

**Web UI** ([`packages/web/src`](/packages/web/src/)):

- [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx), drawn alone by `SessionRoute` in
  [`App.tsx`](/packages/web/src/App.tsx), with the draft in
  [`useDraft.ts`](/packages/web/src/useDraft.ts).
- [`SessionAside.tsx`](/packages/web/src/SessionAside.tsx): the column, `WithAside`, which always
  draws Astryx's `Layout` and only adds or removes its `end` panel, and `AsideToggle`.
- [`ProgressLine.tsx`](/packages/web/src/ProgressLine.tsx), the phone's `Collapsible`, and
  [`useKeepPlace.ts`](/packages/web/src/useKeepPlace.ts), keeping the line read across widths.
- [`ProgressRing.tsx`](/packages/web/src/ProgressRing.tsx), an SVG in theme tokens, and the sidebar
  in [`SessionNav.tsx`](/packages/web/src/SessionNav.tsx).
- Following in [`following.ts`](/packages/web/src/following.ts) and
  [`JumpToLatest.tsx`](/packages/web/src/JumpToLatest.tsx); the transcript's tool groups in
  [`ToolGroups.tsx`](/packages/web/src/ToolGroups.tsx).
- [`SessionAnnouncer.tsx`](/packages/web/src/SessionAnnouncer.tsx), reading its records through the
  followed hooks at the end of [`data.ts`](/packages/web/src/data.ts); the transcript's log is set
  to `aria-live="off"` in an effect, as Astryx's `ChatMessageList` overrides the prop.

## Questions

### Round 01

#### Q1: Where does a feature's session open on a desktop?

**Answer:** A: a page of its own at `/f/<folder>/session`, at every width, with a column beside the
transcript for the feature's progress, changing the UI layout decision.

#### Q1.A: What sits beside the transcript?

**Answer:** B, the step, the plan's tasks, the sub-agents, and the feature's links, plus the files
changed on the branch: "Only add B if it's not too hard". The spec found it one more git call, and
left opening a file out.

#### Q2: How does the current task show in the sidebar?

**Answer:** A, a nested row opening the session: "Use icons to make it as short as possible, should
be small and visual more than textual", and for the feature's row, "use the slug". It became a ring
and "7/11 · <title>".

#### Q3: Should the UI show that an agent it did not start is working?

**Answer:** A: the progress only; the status stays as it is.

#### Q4: Should the progress move within a task?

**Answer:** A: boxes stay checked per task, and the progress reads "Task 7/11".

#### Q5: What else ships with the session's page?

**Answer:** A: "Jump to the latest" and announcements of turns and tasks; the agent's own checklist
stays plain tool rows.

## Decisions

- [UI layout](../decisions/ui-layout.md), changed: readability first, view by view; a view the human
  follows, like a session, is a page of its own, with a foldable column; the sidebar stays short,
  slugs and icons, with full words in accessible names.

## Changes after approval

- **C1** of the spec's review: the UI layout decision rests on concepts, "Goal #1 is always
  readability and clarity for the user. Some features will live well in a pane, others in a
  dedicated page", applied when the decision was rewritten at approval.
- **The spec's sections** were reordered for the new spec template merged meanwhile, its content
  unchanged (R7).

Rulings that change behaviour:

- **The sidebar's progress row** shows whenever the core sets a progress, and folded, the feature's
  row is selected on the session's page (R14).
- **The column's heading** is the core's step, a gate's title while it waits on the human, and each
  section's read fails alone (R16, R18).
- **The column's layout** wraps the whole page at every width, at the window's edge, so folding or
  crossing 768 px never remounts the page (R17).
- **The phone's line** is Astryx's `Collapsible`, and the page keeps the line read across widths
  (R19).
- **"Jump to the latest"** shows working or not, floats over the composer's area, and moves the
  focus to the composer; only a scroll stops following (R21, R22).
- **Announcements**: a region named "Agent updates", above the session, following every turn not
  ended, silent on a taken-back message, keeping three (R23, R24).
- **The progress row's accessible name** is "7/11 · Session column, Task 7 of 11", not the spec's
  "Task 7 of 11: Session column", for axe-core's label-in-name rule (R25).
- **The full bar** shows once the core says the implementation is over, not whenever every box is
  checked (R27).

From the final review, each fixed with tests: a commit on the default branch refreshes a feature's
changes, and the announcer reads only what is new.

## Follow-ups

- **A reload with the phone's line open** restores the scroll before the line's sections load, and
  can land a section's height off when `plan.md` or the changes load slowly (R28).
- **The announcer** may announce turn changes found in a stale cache when a page reopens.
- **The server recognises the core's "no specs/ folder" refusal** by its English wording, in
  `branchChanges` of [`fate/sources.ts`](/packages/server/src/fate/sources.ts).
- **Flaky tests from before this feature**: the Take-back tests of
  [`session.test.tsx`](/packages/web/src/__tests__/session.test.tsx), and the sheet test of
  [`overlay.test.tsx`](/packages/web/src/__tests__/overlay.test.tsx).
- **Left for later**: notifications, a diff view and opening a changed file, model-written activity
  summaries, and two sessions side by side.
