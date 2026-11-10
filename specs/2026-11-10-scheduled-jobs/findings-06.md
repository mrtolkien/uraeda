---
reviewed: wave 6
commits: 855b217fa4f465a68e17ccf9599ca1ad3247d5d1..4a259711617300ce7e8879f347101d00a12b6e07
---

# Findings: Scheduled jobs, wave 6

## Claude Code · Fable 5.2

10 findings, most severe first:

1. `packages/web/src/jobs/useJobForm.ts:172`: Every field save sends the whole job built from the
   file's values as last rendered, so a second save started while another is in flight writes the
   first field's old value back.

   Failure scenario: Type a new prompt, then click the "Report only" switch. The blur sends save A
   with the new prompt; the click sends save B built from `values`, which still holds the old
   prompt. The server applies A then B, so config.toml ends with the old prompt, and A's success has
   already cleared the draft: the typed text is lost with no refusal. The same happens after a
   rename: B calls `update(oldName, ...)` and is refused with "There is no job named ...".

2. `packages/web/src/jobs/JobPage.tsx:178`: `renderCard` returns a `<RunCard>` element, which is
   never null, so `card ?? ...` in JobHistory.tsx:67 never falls back to the "its session is gone"
   line.

   Failure scenario: A started run whose session was deleted, or is not in the sidebar's
   `sessionList`: `RunCard` renders null inside, but the element is truthy. The history row shows
   only its time over an empty space, and for a manual run "Started by “Run now”." under nothing.
   The tests miss it because they pass `renderCard={() => null}` or a span.

3. `packages/web/src/jobs/useJobForm.ts:168`: A change to a row whose save is still in flight is
   silently dropped, and a draft typed after Enter is wiped when the first save resolves.

   Failure scenario: Pick Weekly, then at once pick Wednesday: the second `change("schedule")`
   returns false while the first is saving, and the file keeps "monday 03:00" with no message. The
   same happens when ticking two repositories quickly, or toggling "Report only" on then off. For a
   line: Enter, type more, blur: the blur's save is dropped, then the first save's success runs
   `setDrafts` at line 212 and discards the newer text. The controls also only move when the server
   answers, against the optimistic-writes rule of specs/ui/space-and-motion.md.

4. `packages/web/src/jobs/JobForm.tsx:48`: ScheduleNotes appends "." to every sentence, but the
   problem texts that are sentences already end with one.

   Failure scenario: A job whose agent is off here: `next.why` is "agent-off" and `job.problem` is
   "Not running here: Claude Code is off in this repository.", so the page reads "...in this
   repository..". Likewise "Two jobs are named “Dependencies”.." and "Not running here: no agent is
   on in this repository..". These are exact texts in the plan; only the schedule fragment has no
   period of its own.

5. `packages/web/src/jobs/JobForm.tsx:45`: The next run's words are lowercased at their first
   letter, which is a day's name for any run more than a day ahead.

   Failure scenario: A weekly job, "monday 04:00", viewed on a Wednesday: `whenWords` gives "Monday
   16 November at 4:00", and the schedule's note reads "Every Monday at 4:00. Next run monday 16
   November at 4:00.". Only "Today" and "Tomorrow" should be lowered.

6. `packages/web/src/jobs/useJobForm.ts:130`: A time typed without two-digit hours is refused by the
   core as a bare fragment, which `rowOf` does not recognise, so on a new job it shows over the
   button instead of under the schedule.

   Failure scenario: On /jobs/new, type "3:00" or "9:30" and press "Add the job". The core's
   `time_of` wants two digits, so `schedule()` answers
   `the schedule “daily 3:00” is not understood`. `rowOf` matches only "A time is", so the lowercase
   fragment with no period appears over the button, away from the time field. On an existing job the
   same fragment shows under the schedule. The form could pad the hour, or map "the schedule"
   refusals to the schedule row.

7. `packages/web/src/jobs/JobForm.tsx:161`: The agent row gets only the runtimes on here, and
   SessionPicker falls back to `runtimes[0]` when the job's agent is not among them, so it shows an
   agent the file does not hold.

   Failure scenario: A job with `agent = "claude"` opened in a repository where Claude Code is off
   and Codex is on: the picker's button reads Codex with its default model, next to "Default", while
   config.toml says claude. With no runtime on, the picker renders nothing and only "Default" shows.
   A hand-written `model` or `effort` without `agent` is not shown either, and cannot be cleared
   since "Default" is hidden.

8. `docs/web-ui.md:217`: The docs say a table that breaks a rule is listed in the Jobs place with
   its problem, but the record only lists jobs whose `repositories` include the current repository.

   Failure scenario: A hand-written `[[jobs]]` with no `repositories` key,
   `repositories = "uraeda"`, or a misspelt name such as "ureada": `jobsRecord` filters with
   `job.repositories.includes(name)`, so the job appears in no repository's Jobs place. The human
   who follows the docs to find the problem sees nothing and the job never runs. Also inexact at
   line 776: the prune keeps every started run whose session has a folder, not only those whose
   change is still open; and line 721 says "Run now" sits by the title, without the phone's bottom
   bar.

9. `packages/web/src/jobs/JobHistory.tsx:27`: A skipped time names the latest older run that has a
   folder, not the change that is actually open, and it uses the session's title.

   Failure scenario: The scheduled run 1 started change A, still open. "Run now", which ignores an
   open change, started change B, since merged. The next time is skipped for A, but the line reads
   "Skipped: the change “B” is still open.". The record has no open flag per run, so the page cannot
   tell them apart.

10. `packages/web/src/jobs/JobPage.tsx:168`: Unticking the page's own repository, while another
    stays ticked, saves and turns the page into the missing page at once.

    Failure scenario: A job in uraeda and notes, opened in uraeda: untick uraeda. The update
    succeeds, the record of uraeda no longer lists the job, and `record.jobs.find` gives undefined:
    the form is replaced by "No job “Dependencies” here." with no word on what happened and no undo.
    Only the rename case navigates after a save.

## Codex · GPT-6.1-Sol

The form can silently lose edits, and the live history misidentifies changes or renders empty run
entries. Targeted tests could not run because Nix's fetcher-lock cache is read-only in this sandbox.

Full review comments:

- [P1] Queue field saves against the latest job state —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/web/src/jobs/useJobForm.ts:168-172
  On a slow connection, leaving an edited prompt and immediately changing Report only sends two
  complete job inputs based on the same old `values`. The second update restores the old prompt,
  silently losing the successful first edit. Conversely, another change to the same row is simply
  discarded by `saving.current.has(row)`. Queue pending patches and apply them against the latest
  accepted state rather than sending stale replacements or dropping edits.

- [P2] Preserve text entered while an earlier save is pending —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/web/src/jobs/useJobForm.ts:211-212
  If the human presses Enter in the time field and continues typing before that save completes, its
  successful response unconditionally removes the current draft, including text entered after the
  request. The field then reverts to the earlier saved value. Clear the draft only if it still
  matches the submitted text, leaving newer edits available for their own save.

- [P2] Name the actual blocking change in skipped history rows —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/web/src/jobs/JobHistory.tsx:27-30
  `JobRunView.title` is the cached session title: `startRun` sets it to the job's name, and
  attaching the session to a change does not rename it. Consequently, a run that opens “Upgrade
  three dependencies” normally produces “Skipped: the change “Dependencies” is still open.” Also,
  the latest earlier run with a folder need not be the still-open change, since Run now can create
  additional changes. Carry the blocking change's identity and title into the skipped row instead of
  inferring them from session titles.

- [P2] Render the missing-session fallback inside the live card —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/web/src/jobs/JobPage.tsx:178-178
  When a run's change has been dropped or finished into its record, it can disappear from both the
  workspace and the navigation's session list. `RunCard` then returns null, but this callback has
  already returned a non-null React element, so `JobHistory` never takes its `card ?? ...` fallback.
  The history displays only a timestamp instead of a card or the intended missing-session
  explanation. Resolve the fallback inside `RunCard`, or determine card availability before
  returning the element.

- [P2] Display model and effort overrides without an explicit agent —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/web/src/jobs/JobForm.tsx:143-149
  A valid hand-written job can omit `agent` while specifying `model` or `effort`; the server passes
  those overrides to the default runtime. Here, an undefined agent makes the picker value undefined,
  discarding both overrides from its display, while the Default button is also hidden. The page
  therefore shows different settings from those the job actually runs with. Resolve the default
  runtime while preserving these overrides, and offer Default whenever any of the three keys is set.
