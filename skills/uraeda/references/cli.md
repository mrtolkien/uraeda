# The `ura` CLI

The `ura` command-line tool performs the mechanical parts of the steps. It is optional: each step
says what to do by hand, and names the command that does it.

Every command works without a terminal, with flags, and the read commands print JSON with `--json`.
A command that acts on a feature, a change, or a proposal file takes it as a path under `specs/`. It
can take a name matching one item instead: its folder name or slug. Without it, the command takes
the current branch's feature, or the only one waiting for that action.

| Command                                                                                   | What it does                                                                                                                           |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `ura init`                                                                                | [Sets a project up](projects.md#setting-up-a-project)                                                                                  |
| `ura install`, `--user`, `--repo`, `--agents`, `--claude`, `--update`, `--completions`    | [Installs the skill](projects.md#setting-up-a-project), and Tab completion                                                             |
| `ura status`                                                                              | Every feature and change, its step, and who it waits on, then the [missing setup files](projects.md#setting-up-a-project)              |
| `ura next [feature]`                                                                      | The target and its step, from [the table](../SKILL.md#finding-the-next-step)                                                           |
| `ura check [path]`, `--fix`                                                               | The rules of [Markdown](conventions.md#markdown), file by file, and [repairs moved links](implementation.md#where-a-moved-link-points) |
| `ura expand <text>`                                                                       | [Expands](projects.md#starting-postponing-and-dropping-a-feature) a proposal line into a file                                          |
| `ura note <text>`, `--category`, `--about`, `--agent`, `--no-commit`                      | [Adds a note](inbox.md#capture) to the inbox, or an agent's note file, and commits it                                                  |
| `ura inbox`, `--json`                                                                     | Prints [the inbox](inbox.md#the-format), agents' notes included, by category                                                           |
| `ura inbox clean`, `--dry-run`                                                            | Deletes [the orphan images](inbox.md#images-on-a-note) of proposal files and note files                                                |
| `ura start <proposal>`, `--switch`, `--change`, `--feature`                               | [Starts](projects.md#starting-postponing-and-dropping-a-feature) a feature, or a change                                                |
| `ura answer [feature] <Q2> <answer>`, `--submit`, `--resume`                              | Answers a round of questions, then submits it                                                                                          |
| `ura review [feature] --comment`, `--approve`, `--request-changes`                        | [Reviews](conventions.md#review-files) a spec or a plan                                                                                |
| `ura clean [feature]`, `--all`, `--dry-run`                                               | [Cleans](finish.md#after-the-merge) a merged feature: its worktree, branch, and line in the priorities                                 |
| `ura upgrade`                                                                             | Installs `ura`'s latest release, then updates the user's skill                                                                         |
| `ura lsp`                                                                                 | Serves workflow files to editors: diagnostics, completion, outline, actions                                                            |
| `ura add [folder]`                                                                        | Adds the repository holding a folder to the list of repositories the server serves                                                     |
| `ura extension add <folder, URL, or name>`, `--all`, `--here`; `update`, `remove`, `list` | Links or clones an extension into the config folder, pinned to a commit, and says where it is on, too                                  |
| `ura serve`, `--port`, `--data-dir`                                                       | Runs the server on this machine until it is stopped; a second start hands its folder to the first                                      |
| `ura pair`, `--data-dir`                                                                  | Prints a one-time code, with its QR code, that pairs another device with the running server                                            |

`ura next` and `ura status` read the open pull requests with `gh`. An open, ready pull request whose
branch is behind the default branch names the step `catch-up`, whose reference is
[the catch-up](implementation.md#catch-up-an-open-pull-request) for a feature, and
[Change](change.md) for a change. Otherwise, one that is not a draft, with no changes requested, and
lacks the branch's latest commit names the step `push`, whose reference is
[the push](implementation.md#push) for a feature, and [Change](change.md) for a change. It waits on
the human only once it holds it. A head the repository never fetched counts as holding it: it is
likely newer than the branch.

`ura check` prints each problem as `<file>:<line>: <message>`, then each warning as
`warning: <file>:<line>: <message>`. Warnings measure the limits of
[Writing for the human](writing.md): `block.count`, `block.items`, `writing.sentence`, and
`spec.length` on files waiting for the human, and `decision.intent`, `decision.rules`,
`decision.keywords`, `decision.order`, `decision.why`, `decision.alternatives`, and
`decision.consequences` on decisions. `decision.unapproved` warns on a decision edited on a branch
after its spec's approval. It exits with an error when it found a problem, and with success when it
found only warnings. `ura lsp` sends warnings to editors with the Warning severity.

`ura check` reads git's history at the first link to a missing file, and its `links.file` message
says where the file went: `no file <path>: it moved to /<new path>`,
`no file <path>: it became the record /specs/done/<folder>.md`, or
`no file <path>: deleted in <commit> (<subject>)`, with the commit's 7 characters. `<path>` is the
link's path as written. `ura check --fix` first rewrites every such link under the path, in the
`specs/` folders under it for a path above them such as `.`, as
[the catch-up](implementation.md#where-a-moved-link-points) says, and never commits: a file with
uncommitted changes is rewritten in place. It prints `fixed <file>: <n> link` or `<n> links` for
each file it changed, in path order, then the check's output, and exits as the check: with success
when no problem is left. With `--json`, it adds `fixed`, a list of `{"file", "links"}`, before
`problems`. Two runs from the same files write the same bytes.

`ura answer --submit --resume` adds `resumes: implementation` to the round, and is refused unless
the implementation is under way. `ura answer --submit` and `ura review` set the human's status,
record the block, and commit: a human runs them, or an agent the human asked, with `--no-commit`.
Every command writes on a branch through its worktree (see [Branches](conventions.md#branches));
`ura start --switch` switches the checkout instead. `ura start <change> --feature` takes a started
change and makes it a feature in place, as [Upgrading](change.md#upgrading) says.

`ura` refuses, before writing anything, what would break these rules by hand too:

- An answer or a note with a line starting with `#`, `**Answer:**`, or `**Notes:**`. A review
  comment with a line starting with `#`. They would read as a new heading or answer.
- The commit `ura start <change> --feature` makes on the branch while other files are staged there,
  since it would carry them. Every other commit holds its own files alone, as an answer's, a
  verdict's, a note's, or a start's: the other changes, uncommitted or staged, stay as they are. A
  start is refused instead during a merge or a cherry-pick on the default branch, where git refuses
  a commit of some files alone, and during a revert or a `git am`, which such a commit would end or
  leave half applied.
- With `--switch`, a branch switch over uncommitted changes.
- A start whose folder or branch name is taken: choose another slug with `--slug`. With `--feature`,
  rename or remove that branch or folder first.
- With `--feature`, a proposal file, a feature, or a done change: it takes a started change. A
  change with a pull request, as `gh` lists it then, since its branch would be renamed: close it
  first. Without `gh`, it is not checked. A change whose worktree has uncommitted changes, or an
  untracked file in the change's folder or `specs/decisions/`, or uncommitted changes in its folder
  on the default branch.
- A worktree whose folder is taken by something else.
- A review file that does not parse: it may hold the human's comments, and is never overwritten.
