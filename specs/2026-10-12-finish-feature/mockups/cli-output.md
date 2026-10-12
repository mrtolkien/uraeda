# Mockup: command output

The text `ura status`, `ura next`, and `ura clean` print for finished features, without a terminal's
colours. The [spec](../spec.md) stays the reference for behaviour.

## `ura status`

A feature finished on its branch, waiting for its pull request, and two merged features, one with
its worktree and branch still there:

```text
$ ura status
Remote branches fetched 5 minutes ago.

Now
  2026-10-12-finish-feature                 agent  finish: open the pull request

Done
  2026-10-11-web-ui                         -      merged: worktree and branch left, run ura clean
  2026-10-10-cli-core                       -      merged
```

Once the pull request is open:

```text
Now
  2026-10-12-finish-feature                 you    pull-request
```

## `ura status --json`

A merged feature's entry gains two fields, so the `version` stays 1:

```json
{
  "kind": "feature",
  "folder": "2026-10-11-web-ui",
  "slug": "web-ui",
  "branch": null,
  "source": "default-branch",
  "files": [{ "name": "2026-10-11-web-ui.md", "kind": "record", "round": null, "status": null }],
  "step": { "name": "done", "waits-on": "nobody" },
  "left-worktree": ".worktrees/2026-10-11-web-ui",
  "left-branch": "2026-10-11-web-ui"
}
```

## `ura next`

When a merged feature has a worktree or a branch left, after the usual output, on stderr:

```text
$ ura next
2026-10-12-finish-feature: final-review
  branch     2026-10-12-finish-feature
  follow     skills/uraeda/references/implementation.md
ura: 2026-10-11-web-ui is merged, with its worktree and branch left: run ura clean
```

## `ura clean`

Without a target, with one merged feature to clean:

```text
$ ura clean
2026-10-11-web-ui
  removed the worktree .worktrees/2026-10-11-web-ui
  deleted the branch 2026-10-11-web-ui
```

Without a target, with several:

```text
$ ura clean
ura: 2 merged features have a worktree or a branch left: name one, or pass --all
  2026-10-10-cli-core
  2026-10-11-web-ui
```

`--dry-run`, with `--all`:

```text
$ ura clean --all --dry-run
2026-10-10-cli-core
  would delete the branch 2026-10-10-cli-core
2026-10-11-web-ui
  would remove the worktree .worktrees/2026-10-11-web-ui
  would delete the branch 2026-10-11-web-ui
```

A worktree with uncommitted work, exit 1:

```text
$ ura clean web-ui
2026-10-11-web-ui
  left the worktree .worktrees/2026-10-11-web-ui: it has uncommitted or untracked files. Commit or
  remove them, then run ura clean again
  left the branch 2026-10-11-web-ui: its worktree is still there
```

A branch with commits the default branch does not have, exit 1:

```text
$ ura clean web-ui
2026-10-11-web-ui
  removed the worktree .worktrees/2026-10-11-web-ui
  left the branch 2026-10-11-web-ui: 2 commits are on neither main nor origin/main. Delete it with
  git branch -D 2026-10-11-web-ui if they are not needed
```

The main checkout on the merged branch, exit 1:

```text
$ ura clean web-ui
2026-10-11-web-ui
  left the branch 2026-10-11-web-ui: your checkout is on it. Switch it to main, then run ura clean
  again
```

A worktree outside `.worktrees/`, or a locked one, exit 1:

```text
$ ura clean web-ui
2026-10-11-web-ui
  left the worktree ../web-ui-checkout: checked out in ../web-ui-checkout, remove that worktree
  yourself
  left the branch 2026-10-11-web-ui: its worktree is still there
```

```text
$ ura clean web-ui
2026-10-11-web-ui
  left the worktree .worktrees/2026-10-11-web-ui: the worktree is locked. Unlock it with git
  worktree unlock, then run ura clean again
  left the branch 2026-10-11-web-ui: its worktree is still there
```

Run from inside the worktree it would remove, exit 1:

```text
$ ura clean web-ui
2026-10-11-web-ui
  left the worktree .worktrees/2026-10-11-web-ui: you are in it. Run ura clean from the main
  checkout
  left the branch 2026-10-11-web-ui: its worktree is still there
```

A worktree folder already deleted by hand:

```text
$ ura clean web-ui
2026-10-11-web-ui
  pruned the record of the missing worktree .worktrees/2026-10-11-web-ui
  deleted the branch 2026-10-11-web-ui
```

A merged bug:

```text
$ ura clean completed-tasks-reappear
fix/2026-10-14-completed-tasks-reappear
  removed the worktree .worktrees/fix/2026-10-14-completed-tasks-reappear
  deleted the branch fix/2026-10-14-completed-tasks-reappear
```

Nothing to clean:

```text
$ ura clean
Nothing to clean: no merged feature has a worktree or a branch left.
```
