---
kind: change
finished: 2026-11-01
pull-request: https://github.com/mrtolkien/uraeda/pull/84
supersedes: [2026-10-25-session-new]
---

# Record: When a session touched files, there's nothing in the "changed files" sidebar...

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-11-01, finished on
> 2026-11-01, in [its pull request](https://github.com/mrtolkien/uraeda/pull/84). Its full files are
> in git: `git log -- specs/changes/2026-11-01-files-changed/`.

## What and why

A session on the main checkout changed and committed five files, yet its Changes panel read "No file
changed yet.". The human asked whether the panel could look at the file-write tool calls, or whether
that was too complex.

## Behaviour

- **"This session" still lists only the files of completed Edit, MultiEdit, NotebookEdit, and Write
  calls**, never the files a shell command wrote.
- **The empty panel says why it may be empty**: "No file edited by a tool. Files written by shell
  commands are not listed.". The same text shows before the session's first message, in the wide
  column and in the phone's Changes sheet.

## Design

The panel already read the file-write tool calls. The session behind the report made 35 tool calls,
all of them Bash, and wrote its files with `python3` heredocs and `sed -i`. The agent's events name
a tool edit's file, but only a shell command's text, so no file reached the cache's
[`editedFiles`](/packages/server/src/runner/cache-work.ts). Catching shell writes would need git
comparisons of the checkout, which the human declined. The change is the `NOTHING` text of
[`ChangesPanel`](/packages/web/src/session/ChangesPanel.tsx), and its comments. No test covers the
text: the [testing](/specs/decisions/testing.md) decision keeps UI tests for behaviour that using
the UI would not show.

## Questions

### Round 01

#### Q1: How should Uraeda find the files a shell command wrote?

**Answer:** C: keep tool calls only, and make the empty panel say that files written by shell
commands are not listed. A, comparing the checkout with git before and after each turn, would have
listed the human's own saves in the main checkout as the session's. B, the same around each shell
command with Claude Code hooks, worked for Claude Code only.

## Changes after approval

- **The round's settled points were not built**: they described option A's comparison of the
  checkout, which the answer left out.
- **The empty text also shows before the first message**, in place of "No file changed yet.", so the
  panel has one text for nothing.
