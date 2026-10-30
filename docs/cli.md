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
ura add                                    # this repository, to the web UI's list
ura expand "listener"                      # a line of PRIORITIES.md becomes a proposal file
ura start git-listener-process             # a proposal file becomes a feature; --change, a change
ura note "Blurry icons" --category UI      # a note in the inbox, committed on the default branch
ura answer cli-core Q3 "B, simpler"        # one answer; --submit sends the round
ura review cli-core --comment 50-52 "Why?" # a comment; --approve or --request-changes
ura clean --all                            # the worktrees and branches of merged features
ura upgrade                                # the latest release, then your skill
```

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
