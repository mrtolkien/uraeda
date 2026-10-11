# Mockup: command output

The text each command prints, without a terminal's colours. With a terminal, `you` is bold, `agent`
is dim, section names are bold, and errors start with a red `ura:`. The [spec](../spec.md) stays the
reference for behaviour.

## `ura status`

```text
$ ura status
Remote branches fetched 2 hours ago.

Now
  2026-10-10-cli-core          you    clarifications-01.md: 16 questions, about 50 minutes.
  web-ui                       -      not started (drafts/web-ui.md)

Next
  2026-10-12-git-listener      agent  plan (behind origin by 2)
  Claude Code runner           -      not started

Blocked
  benchmarks                   -      not started (backlog/benchmarks/proposal.md)

Not in priorities
  fix/2026-10-14-reappear      you    assessment.md: Fix to approve, about 5 minutes.
```

With uncommitted edits on the current branch:

```text
  2026-10-10-cli-core          you    clarifications-01.md: 16 questions, about 50 minutes. (uncommitted changes)
```

With an invalid file:

```text
  2026-10-10-cli-core          -      invalid files: run ura check
```

## `ura status --json`

```json
{
  "version": 1,
  "root": "/home/me/uraeda",
  "default-branch": "main",
  "fetched-at": "2026-10-11T08:12:00Z",
  "priorities": [
    {
      "section": "now",
      "position": 1,
      "text": "CLI for basic setup and upkeep",
      "link": "specs/2026-10-10-cli-core/proposal.md",
      "feature": "2026-10-10-cli-core"
    }
  ],
  "features": [
    {
      "kind": "feature",
      "folder": "2026-10-10-cli-core",
      "slug": "cli-core",
      "branch": "2026-10-10-cli-core",
      "source": "local",
      "uncommitted": false,
      "behind": 0,
      "files": [
        {
          "name": "proposal.md",
          "kind": "proposal",
          "round": null,
          "status": null,
          "waiting-line": null
        },
        {
          "name": "clarifications-01.md",
          "kind": "clarifications",
          "round": 1,
          "status": "awaiting-human",
          "waiting-line": "16 questions, about 50 minutes."
        }
      ],
      "step": {
        "name": "human-gate",
        "waits-on": "human",
        "reference": null,
        "file": "clarifications-01.md",
        "task": null,
        "pull-request": null
      },
      "problems": []
    }
  ],
  "problems": []
}
```

## `ura next`

```text
$ ura next
2026-10-12-git-listener: plan
  branch     2026-10-12-git-listener
  follow     skills/uraeda/references/plan.md
```

```text
$ ura next recurring-tasks
2026-10-06-recurring-tasks: implementation, Task 3: Repeat menu
  branch     2026-10-06-recurring-tasks
  follow     skills/uraeda/references/implementation.md
```

```text
$ ura next
Nothing for an agent: every feature in Now waits on you. Run ura status.
```

## `ura check`

```text
$ ura check
specs/: no problems
```

```text
$ ura check cli-core --json
{ "version": 1, "problems": [] }
```

```text
$ ura check
specs/2026-10-10-x/clarifications-02.md:2: status "done" is not one of awaiting-human, answered
specs/2026-10-10-x/clarifications-01.md:88: Q3 has no answer
specs/2026-10-10-x/clarifications-01.md:104: Q4.B has no answer (may not apply: answer "-" if so)
specs/2026-10-10-x/spec.md: missing section "## Constitution check"
specs/2026-10-10-x/spec.md:41: no heading "git-backend" in discovery-01.md
5 problems
```

## `ura answer`

```text
$ ura answer cli-core Q3 "B, we'll do it later"
Q3 answered in specs/2026-10-10-cli-core/clarifications-01.md. 14 of 16 questions answered.
```

```text
$ ura answer cli-core --submit
switched to 2026-10-10-cli-core
Round 01 answered, committed as "discovery(cli-core): answer round 01".
```

```text
$ ura answer cli-core --submit
ura: Q7 and Q9 have no answer
```

```text
$ ura answer cli-core --submit
ura: cannot switch to 2026-10-10-cli-core: uncommitted changes in README.md
```

## `ura review`

```text
$ ura review cli-core --comment 50-52 "Name the field"
C1 added to specs/2026-10-10-cli-core/spec-review.md, on lines 50–52, under "US2: Edit a repeat (P1)".
```

```text
$ ura review cli-core --request-changes --summary "Name the field"
Changes requested on spec.md, committed as "spec(cli-core): request changes".
```

```text
$ ura review cli-core --approve
spec.md approved, committed as "spec(cli-core): approve". The agent applies its decisions next.
```

```text
$ ura review cli-core --request-changes
ura: a request for changes needs at least one comment: ura review cli-core --comment <lines> <text>
```

## `ura init`

```text
$ ura init
created specs/README.md
created specs/CONSTITUTION.md
created specs/PRIORITIES.md
created specs/drafts/.gitkeep
created specs/backlog/.gitkeep
created specs/decisions/.gitkeep
created specs/bugs/.gitkeep
created .agents/skills/uraeda/ (38 files)
linked  .claude/skills/uraeda -> ../../.agents/skills/uraeda
Next: ask your agent to write specs/CONSTITUTION.md with you, then commit.
```

```text
$ ura init
kept    specs/README.md
kept    specs/CONSTITUTION.md
kept    specs/PRIORITIES.md
updated .agents/skills/uraeda/ (36 files)
kept    .agents/skills/uraeda/SKILL.md: edited since installed
```

## `ura draft`

```text
$ ura draft listener
created specs/drafts/git-listener-process.md
linked  "Git listener process" in specs/PRIORITIES.md
```

```text
$ ura draft "web ui"
ura: 2 lines match "web ui":
  Now   Basic web UI for viewing the workflow files
  Next  WebUI for editing files related to the workflow
```

## `ura start`

```text
$ ura start specs/drafts/git-listener-process.md
on main: committed "chore(git-listener-process): start Git listener process"
created branch 2026-10-11-git-listener-process
moved   specs/drafts/git-listener-process.md -> specs/2026-10-11-git-listener-process/proposal.md
committed "chore(git-listener-process): proposal"
Next: discovery. Ask an agent, or run ura next.
```

```text
$ ura start git-listener-process
ura: 2026-10-11-git-listener-process exists: choose another slug with --slug
```

```text
$ ura start specs/2026-10-10-cli-core/proposal.md
ura: not a draft: ura start takes a file or folder in specs/drafts/ or specs/backlog/
```

```text
$ ura start specs/drafts/git-listener-process.md
ura: specs/drafts/git-listener-process.md still holds the template's placeholders: write it first
```

```text
$ ura start specs/drafts/git-listener-process.md
on main: committed "chore(git-listener-process): start Git listener process"
created branch 2026-10-11-git-listener-process
ura: git commit failed: <the hook's first line of error>
Done: the start commit on main, the branch.
Left: move the draft to specs/2026-10-11-git-listener-process/proposal.md, then commit
"chore(git-listener-process): proposal".
```

```text
$ ura start specs/bugs/2026-10-14-completed-tasks-reappear/report.md
thread 'main' panicked at crates/core/src/actions/start.rs:
not implemented: starting a bug, until the bug flow has its spec
```
