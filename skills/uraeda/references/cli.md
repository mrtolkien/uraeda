# The `ura` CLI

The `ura` command-line tool performs the mechanical parts of the steps. It is optional: each step
says what to do by hand, and names the command that does it.

Every command works without a terminal, with flags, and the read commands print JSON with `--json`.
A command that acts on a feature, a bug, or a draft takes it as a path under `specs/` or a name
matching one item, its folder name or slug; without it, the current branch's feature, or the only
one waiting for that action.

| Command                                                               | What it does                                                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `ura init`                                                            | [Sets a project up](projects.md#setting-up-a-project)                        |
| `ura install`, `--user`, `--repo`, `--agents`, `--claude`, `--update` | [Installs the skill](projects.md#setting-up-a-project)                       |
| `ura status`                                                          | Every feature and bug, its step, and who it waits on                         |
| `ura next [feature]`                                                  | The target and its step, from [the table](../SKILL.md#finding-the-next-step) |
| `ura check [path]`                                                    | The rules of [Markdown](conventions.md#markdown), file by file               |
| `ura draft <text>`                                                    | [Drafts](projects.md#starting-postponing-and-dropping-a-feature) a line      |
| `ura start <draft>`, `--switch`                                       | [Starts](projects.md#starting-postponing-and-dropping-a-feature) a feature   |
| `ura answer [feature] <Q2> <answer>`, `--submit`                      | Answers a round of questions, then submits it                                |
| `ura review [feature] --comment`, `--approve`, `--request-changes`    | [Reviews](conventions.md#review-files) a spec, plan, or assessment           |
| `ura clean [feature]`, `--all`, `--dry-run`                           | [Cleans](finish.md#after-the-merge) a merged feature                         |
| `ura upgrade`                                                         | Installs `ura`'s latest release, then updates the user's skill               |
| `ura lsp`                                                             | Serves workflow files to editors: diagnostics, completion, outline, actions  |
| `ura add [folder]`                                                    | Adds the repository holding a folder to the web UI's list                    |

`ura answer --submit` and `ura review` set the human's status, record the block, and commit: a human
runs them, or an agent the human asked, with `--no-commit`. Every command writes on a branch through
its worktree (see [Branches](conventions.md#branches)); `ura start --switch` switches the checkout
instead.

`ura` refuses, before writing anything, what would break these rules by hand too:

- An answer or a note with a line starting with `#`, `**Answer:**`, or `**Notes:**`, and a review
  comment with a line starting with `#`: they would read as a new heading or answer.
- A commit while other files are staged, since it would carry them; with `--switch`, a branch switch
  over uncommitted changes; a worktree whose folder is taken by something else.
- A review file that does not parse: it may hold the human's comments, and is never overwritten.
- `ura start` on a bug: the bug flow starts by hand, until it has its spec.
