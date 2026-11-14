# By hand

The mechanical steps of the workflow that no step file spells out, for an agent without the `ura`
command-line tool or a session host that does them. Read a section only when a step sends you here:
nothing in this file changes what a step decides.

## Make a change a feature

The move behind [upgrading](change.md#upgrading), once the human said yes.

1. Check first, and stop if one fails, saying why. The change is not done: a merged change is
   finished, not moved. It has no pull request: close it first, since its branch is renamed. Its
   worktree has no uncommitted changes. No branch or folder named `YYYY-MM-DD-<slug>` exists: if one
   does, rename or remove it first.
2. In the worktree, move `specs/changes/YYYY-MM-DD-<slug>/` to `specs/YYYY-MM-DD-<slug>/`, its files
   unchanged. Every file of `specs/` linking into the old folder, the moved one included, points at
   the new one, as [where a moved link points](#where-a-moved-link-points) rewrites a moved link.
   The decisions the branch changed were approved for the change only: the feature's spec lists them
   again. Commit `chore(<slug>): upgrade to a feature`.
3. Rename the branch: `git branch -m change/YYYY-MM-DD-<slug> YYYY-MM-DD-<slug>`. The worktree stays
   where it is. A pushed branch is renamed locally only: the old remote branch stays until the human
   deletes it. Unset its upstream, `git branch --unset-upstream YYYY-MM-DD-<slug>`, so the next
   `git push -u` sets the feature's.

The code the change committed stays on the branch, and the feature's spec describes it as built. The
feature has answered rounds and no discovery file, so its first step is the
[spec](spec.md#is-the-scope-clear). It reads the change's rounds, which settled the change, not the
feature's scope. It starts a new round, with its discovery file, at the proposal's
[discovery effort](discovery.md#discovery-effort). Run it in the same session, unless the human's
settings cut it.

## Where a moved link points

By hand, `git log -M --name-status -- <path>` lists the commits that removed a missing file. Follow
its newest removal, then the new path's removals after it, to the end:

- **A rename**, as git detects it, moved the file.
- **A change made a feature** moved `specs/changes/<folder>/<file>` to `specs/<folder>/<file>`.
- **A finish**: a commit adding `specs/done/<folder>.md` turned every file it removed from
  `specs/<folder>/` or `specs/changes/<folder>/` into that record.
- **Otherwise** the commit deleted the file.
- **A folder** went where its files went, when the newest commit removing any of them sent all the
  files it removed to one folder, one record, or one deletion.

Then rewrite the link:

- **Moved**: point it at the new path, in its own form. A rooted link, `/specs/...`, stays rooted,
  and a relative one is written from its file's folder; Its anchor, title, and `<…>` stay, and a
  link to a folder keeps its trailing `/`.
- **Became a record**: point it at the record. A question's anchor in a `clarifications-NN.md`,
  `#q<number>...`, stays; any other anchor is dropped. A file of the folder that is not markdown,
  like an image, counts as deleted: the finish deleted it.
- **Deleted**: a link becomes its words, and an image its alt text. A reference definition,
  `[label]: path`, stays.

A path no commit ever removed, or one back at the tip, is left as it is. So are wikilinks, links in
code, and links outside `specs/`, in `README.md`, `docs/`, or code comments. `ura check` reports the
ones in `specs/`, with where each file went when git shows it.

## Whether a pull request is behind, or lacks commits

Read the pull request's head with `gh pr view <branch> --json headRefOid`. The branch lacks nothing
when `git merge-base --is-ancestor <branch> <head>` succeeds, or when the head is not in the
repository: the branch is then most likely behind it.

A branch is **behind** when neither it nor `origin/<branch>` holds the tip of `origin/<default>`, or
of the local default branch without a remote. With `ura`, `ura next` names the step. By hand, after
`git fetch`, the branch lacks the tip when `git merge-base --is-ancestor origin/<default> <branch>`
fails, and fails for `origin/<branch>` too. A branch the default branch already holds,
`git merge-base --is-ancestor <branch> origin/<default>` succeeding, is merged, not behind. When one
of `<branch>` and `origin/<branch>` holds the other, only the newer one counts. Without a remote,
use `<default>` for `origin/<default>`.

## Read a pull request's comments

- **Review threads** come from `gh api graphql`, on the pull request's `reviewThreads`: each
  thread's `isResolved` and `isOutdated`, and each comment's `author`, `path`, `line`, `body`, and
  `createdAt`.
- **Reviews and comments** come from `gh pr view <number> --json reviews,comments`, and count when
  posted after the last push. Fetch first, then take the remote branch's last commit date as the
  last push's: `git log -1 --format=%cI origin/<branch>`. A commit pushed later than it was made
  only counts more comments, never fewer.

```bash
gh api graphql -f owner=<owner> -f repo=<repo> -F number=<number> -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100) {
          nodes {
            isResolved
            isOutdated
            comments(first: 100) { nodes { author { login } path line body createdAt } }
          }
        }
      }
    }
  }'
```

A pull request with more than 100 threads, or a thread with more than 100 comments, is read page by
page, with `pageInfo { hasNextPage endCursor }` and `after:`.

## Clean up after a merge

Only when the human asks, from the main checkout, never forced:

1. `git worktree remove <path>`: git refuses a worktree with uncommitted or untracked files, and
   they stay until the human deals with them. `git worktree prune` drops the record of a worktree
   folder already deleted.
2. `git branch -D <branch>`, only when every commit of the branch is on the default branch:
   `git log --cherry-pick --right-only --format=%H <default>...<branch>` lists the commits it lacks.
   When the merge is only on the forge yet, run it with `origin/<default>` too: a commit counts as
   merged when either list leaves it out. `-D`, because `-d` refuses a rebased branch.

Remote branches are the forge's: GitHub's "Automatically delete head branches" setting removes them.

## A forge without draft pull requests

Write the record first, then open the pull request, and add its link to the record in a second
commit, `finish(<slug>): link the pull request`. When no pull request can be opened, leave
`pull-request` out of the record, and push the branch.
