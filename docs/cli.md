# The `ura` CLI

`ura` performs the mechanical parts of the workflow, for you and for agents. It is optional: the
skill says how to do each step by hand, and names the command that does it. The skill's
[CLI reference](../skills/uraeda/references/cli.md) says which step uses which command.
[INSTALL.md](../INSTALL.md#ura) says how to install it.

## Commands

```sh
ura init                                   # specs/, and the skill offered for your user
ura install --user --agents --claude       # the skill, for your agents and Claude Code
ura status                                 # every feature and change, and who it waits on
ura next                                   # the next step for an agent, from the skill's table
ura check                                  # every workflow file against the skill's rules
ura check --fix                            # first repair the links to moved files
ura add                                    # this repository, to the web UI's list
ura extension add ~/code/uraeda-wiki       # link a folder as an extension; a git URL is cloned
ura extension update deploy                # fetch, print the diff, and move once you confirm
ura extension list                         # every extension, where it is on, where it came from
ura expand "listener"                      # a line of PRIORITIES.md becomes a proposal file
ura start git-listener-process             # a proposal file becomes a feature; --change, a change
ura note "Blurry icons" --category UI      # a note in the inbox, committed on the default branch
ura answer cli-core Q3 "B, simpler"        # one answer; --submit sends the round
ura review cli-core --comment 50-52 "Why?" # a comment; --approve or --request-changes
ura inbox                                  # every note, agents' notes included; --json for tools
ura clean --all                            # merged features' worktrees, branches, and priorities lines
ura upgrade                                # the latest release, then your skill
```

`ura next` and `ura status` read your pull requests with `gh`. An open pull request, not a draft and
with no changes requested, waits on you only once it holds its branch's latest commit. Until then,
the step is `push`, for an agent.

`ura check` says where a missing file went, from git's history: it moved, it became a finished
feature's record, or a commit deleted it. `ura check --fix` repairs those links, without committing,
in every `specs/` folder under the path it is given, and prints each file it changed before the
check's output:

```text
fixed specs/done/2026-10-30-inbox-again.md: 1 link
specs/: no problems
```

A link to a moved file points at its new path, in the same form. A link to a finished feature's file
points at its record, keeping a question's anchor. A link to a deleted file becomes its words.
`--fix` exits as the check after it, with success when no problem is left, and its JSON adds a
`fixed` list of files and link counts. In the web UI, a done feature's page has "Fix moved links"
for the same repair.

`ura extension` manages the extensions in your config folder's `extensions/`. It never runs their
code: the server does. [Extensions](extensions.md) says how to write one. `add` takes a folder or a
git URL:

- A folder is linked as `extensions/<name>`, the name its `extension.toml` gives, and reloads on
  each save. A folder already in `extensions/` is only turned on.
- A URL is cloned, then checked out at its default branch's commit, detached, with `.ura-source`
  naming the URL, the commit, and the branch. A host without a scheme, like
  `github.com/gary/uraeda-deploy`, is cloned over `https://`.

`add` refuses a built-in extension's name, `uraeda` and `sessions`, which Uraeda keeps, one
installed already, and a manifest with a fatal problem. It then asks whether the extension is on in
every repository or in this one, the one its `scope` suggests first. Without a terminal, pass
`--all`, `--here`, or `--repo <name>`, repeated for more. `update <name>` moves a cloned extension
only after you confirm, or with `--yes`: without a terminal, it prints the diff and moves nothing.
`remove <name>` deletes the folder, or only the link to a linked one, and keeps its settings in
`config.toml`. `list --json` prints every extension, the built-in ones first.

Every command works without a terminal, and the read commands print JSON with `--json`.
`ura <command> --help` lists a command's options.

After `ura init`, `ura status` ends with the setup's files the project still lacks, until they are
written:

```text
Setup: 3 files missing
  Constitution: still the template
  Code-quality decision: missing
  Testing decision: missing
```

## Editors

`ura lsp` is a language server for workflow files. It offers diagnostics as you type, completion of
frontmatter values, and the human's actions, from commenting on a spec to approving it.
