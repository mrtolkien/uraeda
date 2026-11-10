---
reviewed: wave 1
commits: 1cb49a249aceb53b4c3e912017afc13645996332..2ab9ce3abeda94fc1b0a6ead64a46ef0890679c1
---

# Findings: Scheduled jobs, wave 1

## Claude Code · Fable 5.2

10 findings, most severe first:

1. `crates/core/src/jobs/write.rs:100`: `remove` drops a comment that is not the job's own (the file
   header, or a section comment set apart by a blank line) whenever no table follows the removed
   one, breaking "a write MUST keep a human's comments".

   Failure scenario: Reproduced: on a fresh folder, `add("A")` then `remove("A")` leaves an empty
   config.toml, with the "# Uraeda's settings…" header gone. Likewise `# my header\n\n[[jobs]]…`
   loses the header, and `[server]\nport = 1\n\n# section: jobs\n\n# mine\n[[jobs]]…` loses
   `# section: jobs`. `next_position` returns None, so the kept comment is discarded instead of
   going to the document's trailing text or the previous table.

2. `crates/core/src/jobs.rs:160`: Non-text entries in `repositories` are silently dropped by
   `filter_map`, so a malformed list reads as a valid job with no problem.

   Failure scenario: Reproduced: `repositories = ["a", 3]` reads as `["a"]` with `problem: None`, so
   the job runs although the table fails the data model's "list of names" rule. `repositories = [3]`
   reports "A job runs in one repository at least." instead of the type problem. A later `update`
   rewrites the list and deletes the human's entry without saying so.

3. `crates/core/src/jobs/write.rs:92`: Removing from, or adding to, an inline `jobs = [...]` list on
   several lines misplaces comments and layout.

   Failure scenario: Reproduced on a multi-line inline list with `# first` / `# a` / `# second` /
   `# b` comments: `remove("A")` leaves A's end-of-line `# a` on the `jobs = [ # a` line. `add("C")`
   then puts the new inline table on the same line as B, between B and B's own `# b`, so `# b` now
   annotates C. The reviewers' `kept_layout` handling in settings.rs is not applied to this list.

4. `crates/core/src/jobs/write.rs:24`: The trailing-comment fix in `add` only covers a file whose
   top level is all plain values; with any table or dotted key, the first `[[jobs]]` lands above the
   file's trailing comments.

   Failure scenario: Reproduced: `server.port = 1\n# tail\n` plus `add` gives `# tail` after the
   job's `prompt` line, reading as part of the job. `[server]\nport = 1\n\n# [runs]\n# x = 1\n` plus
   `add` puts `[[jobs]]` between `[server]` and the commented-out `[runs]` block, so uncommenting it
   later yields keys under the wrong place. `first` is false in both cases, so the order is not
   kept.

5. `crates/core/src/jobs.rs:208`: Names are checked for emptiness trimmed but stored and compared
   untrimmed, so names differing only by surrounding spaces coexist.

   Failure scenario: Reproduced: `add(" A ")` then `add("A")` both succeed; the reader flags no
   duplicate. The UI shows two jobs that look identical, and the texts
   `Started by the schedule “ A ”` and the run history keyed by name are ambiguous.
   `update`/`remove` by the displayed name hit the wrong job or answer "There is no job named…".

6. `crates/core/src/jobs/write.rs:195`: `apply` writes `agent`, `model`, `effort` as empty strings
   when the form sends `Some("")`, and writes the schedule text untrimmed.

   Failure scenario: Reproduced: an input with `agent: Some("")` and `schedule: "  daily   03:00 "`
   writes `agent = ""` and `schedule = "  daily   03:00 "`. The job then reads back with
   `agent: Some("")`, which is not "unset, a new chat's", so a later task starting the run looks up
   a runtime named "" and reports the agent off or unknown. Neither `check_input` nor the reader
   normalises or refuses it.

7. `crates/core/src/jobs/write.rs:87`: Removing the first table of the file leaves a leading blank
   line, because the next table keeps its `\n` prefix.

   Failure scenario: Reproduced: two `[[jobs]]` tables separated by a blank line, `remove` the
   first, and config.toml now starts with an empty line. The same happens when the first job has no
   detached comment and `[server]` follows. The write changes bytes outside its job's table.

8. `crates/core/src/jobs.rs:77`: `read` loads and parses config.toml twice without a lock
   (`settings::read`, then `load_text` and `Document::parse`), and swallows a failure of the second
   load as "no jobs, no problem".

   Failure scenario: The file is rewritten or becomes unreadable between the two loads (an editor
   save, or a concurrent settings write that does hold `folder_lock`).
   `let Ok(Some(..)) = load_text(..) else` then returns an empty list with `problem: None`, so the
   Jobs record briefly shows no jobs, and the scheduler treats them as gone, with no message. It is
   also double I/O and parsing on a path later tasks read on every endpoint; one load, then
   `file::parse` on that text, does both.

9. `crates/core/src/jobs/schedule.rs:37`: The schedule problem is a lower-case fragment without a
   period, unlike every other job problem, yet it is returned verbatim as a write refusal and as
   `Job.problem`.

   Failure scenario: `add`/`update` with `dayly 06:00` refuses with the bare message
   `the schedule “dayly 06:00” is not understood`, while siblings read `A job has no name.`. The
   card's `Not running: …` prefix belongs to the view, so each consumer must special-case this one
   problem (prefix it or not, add the period or not) instead of the core giving whole sentences and
   the card composing its line.

10. `crates/core/src/settings.rs:367`: settings.rs is at 499 of the 500 lines the structure test
    allows, and `change_document` takes a `path` argument that only matters for a file the write
    creates.

    Failure scenario: Any later task adding one more line here (another `ContinueKey`, a doc line)
    fails `crates/cli/tests/structure.rs`, and the plan forbids adding a marker.
    `change_document(dir, &[], …)` from jobs passes an empty path only to get the header-only seed;
    moving the seed text into `change_path` and giving `change_document` no `path` would be simpler
    and free lines. Behaviour of the existing writers is unchanged: the seed text is byte-identical.

## Codex · GPT-6.1-Sol

Binding-level reproductions confirmed comment loss on deletion and silent acceptance of invalid
repository entries. The requested Rust tests could not run because the sandbox prevented Nix from
writing its cache lock.

Full review comments:

- [P2] Preserve detached comments when no following table exists —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/crates/core/src/jobs/write.rs:100-104
  Deleting the only job from a file starting with `# mine\n\n[[jobs]]` produces an empty file,
  losing the human's file-level comment. `own_comment` correctly extracts it, but this branch
  discards it when `next_position` returns `None`. Preserve it in the document's trailing text when
  there is no following table. This violates the comment-preservation requirement in
  [the settings decision](specs/decisions/settings.md#L22).

- [P2] Flag non-string repository entries instead of discarding them —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/crates/core/src/jobs.rs:158-161
  With `repositories = ["uraeda", 3]`, the reader silently drops `3` and returns a job with no
  problem. This treats an invalid stored job as runnable instead of listing its validation problem,
  contrary to the data model's list-of-names requirement. Validate every array element and record a
  problem if any entry is not text, while keeping other jobs readable.
