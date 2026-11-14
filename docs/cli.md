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
ura add                                    # this repository, to the app's list
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
ura serve                                  # pages to answer and review on, from your phone too
ura serve-app                              # the server, and the app in your browser
ura pair                                   # a one-time code, and its QR code, to pair a device with it
ura import-sessions                        # the earlier web UI's sessions, copied once
```

`ura next` and `ura status` read your pull requests with `gh`. An open pull request, not a draft and
with no changes requested, waits on you only once it holds its branch's latest commit. Until then,
the step is `push`, for an agent. Once the default branch gains changes beyond its priorities,
inbox, proposals, and notes, a branch lacking them reads `catch-up` instead, for an agent to rebase,
validate, and push it. Settings › Runs in the app can start that run by itself.

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
`fixed` list of files and link counts. In the app, a done feature's page has "Fix moved links" for
the same repair.

`ura serve` serves small pages to answer a round and review a spec or a plan on, from your phone
too. It prints their address, which holds a token: keep it to yourself, as anyone with it can answer
for you.

- **What waits on you**: every round, spec, and plan waiting for you, across the repositories it
  serves and their worktrees.
- **A round**: one card per question, the recommended option marked. An answer is saved as soon as
  you pick it or type it. "Send answers" records the round answered.
- **A review**: the spec or plan, what changed since your last review, and a comment on any passage
  you tap, or on words you select. Then approve, or request changes.
- **Mockups**: "See it" draws a mockup of the feature in place. "Pick an element" starts a comment
  on the element you tap.
- **Settings**: how each step of the workflow runs, its agent, model, and effort, chosen among T3
  Code's providers and their models, and which steps share a session; the build's implementers; the
  reviewers, and whether they review each wave or the branch only. Each change is saved at once in
  the `[runs]` of the settings file, the rest of the file kept as it was.

The pages write the workflow's files and never commit: the next agent step commits your work. It
listens on 127.0.0.1, port 4320 or `--port`: to reach it from your phone, put it on your own
network, as `tailscale serve 4320` does. `--data-dir` names the folder it keeps its token in. Its
settings are the `[serve]` section of the settings file, `~/.config/uraeda/config.toml`:

```toml
[serve]
port = 4320
repositories = ["~/code/todo", "~/code/uraeda"] # without it, the repository it starts in
wake = "t3" # tell the feature's T3 Code session to continue when you send answers or a verdict
```

Without `wake`, a page ends with "Tell your session to continue". With `wake = "t3"`, it finds the
open T3 Code thread working in the feature's worktree, with the `t3` command, and sends it a message
to continue.

`ura serve-app` runs Uraeda's server, which serves [the app](app.md) to your browser and to the
desktop app.

- It listens on http://127.0.0.1:4310, or on `--port`, else on the port `URAEDA_PORT` gives, else on
  the settings file's `port`; `--port 0` takes a free port. A terminal's start opens the app in your
  browser, unless `--no-open` or the settings say otherwise.
- It keeps its files in `~/.local/share/uraeda-next/`, your system's data folder, or in
  `URAEDA_DATA_DIR`, or in `--data-dir`. It never starts on the earlier web UI's folder, which holds
  a `runner.sqlite`: see `ura import-sessions` below.
- It reads secrets from the `.env` of your config folder only, never from a project or the folder it
  runs in, and gives them to the agents it runs.
- Run in a repository, it adds that repository to its list. A second `ura serve-app` on the same
  data folder starts nothing, whatever its port: it hands its folder to the first, prints its
  address, and exits. When the first does not answer, it says which server holds the data folder,
  and exits with an error.
- Ctrl-C, or closing its terminal, stops it, and everything it runs.
- Its first start in a terminal prints an access key, once: keep it in a password manager. A browser
  signs in with it. A start whose output goes to a file or another program, as a service's or the
  desktop app's, prints none, so no key rests in a log: `ura key` shows one then.

`ura pair` pairs another device with the running server, a phone or another computer. It prints a
code, good for one device, for 10 minutes, the address the device reaches the server at, and a QR
code holding both. The device scans it, or you enter the code there. It then signs in with a token
of its own, which you can revoke alone. `--data-dir` names the server's data folder when
`ura serve-app` was given one.

`ura key` shows an access key of the running server, once, for a browser to sign in with: the first,
when no start showed one. Uraeda keeps only a key's hash, so it never shows a key again:
`ura key --replace` makes a new one in place of a lost one, and signs every browser and device out.
`--data-dir` names the server's data folder, as for `ura pair`.

`ura sandbox` is for working on Uraeda itself, from a checkout of it: the server over sample
projects and a fake agent, without sign-in, on http://127.0.0.1:4420. It keeps the projects and
their data in `.sandbox/` of the checkout until `--reset` builds them again, and never reads your
projects, your data, or your config. [CONTRIBUTING.md](../CONTRIBUTING.md) says how to run it.

`ura import-sessions` copies the sessions of the earlier web UI, `@uraeda/ui`, with their
transcripts and the images in their messages, into the store of `ura serve-app`. It reads
`~/.local/share/uraeda/`, that UI's data folder, or `--from`, and never changes it. A store that
already holds sessions is refused, unless `--replace` removes them first. It is a one-time tool,
which goes away once it has run: [INSTALL.md](../INSTALL.md#coming-from-the-web-ui-uraedaui) has the
steps.

- It reads `runner.sqlite` in that UI's data folder, `~/.local/share/uraeda/`, or in `--from`, and
  never writes it. It writes `sessions.sqlite` in the data folder of `ura serve-app`, or in
  `--data-dir`.
- Sessions, turns, and messages keep their IDs. Everything lands at once, or nothing does.
- Nothing imported runs by itself, since the earlier server may still run it: a turn that ran or
  waited there, or that its server's stop cut, is stopped here, and a run that waited to continue by
  itself waits for you. A message continues it.
- A second run imports nothing: a store that already holds sessions is refused. With `--replace`,
  its sessions are removed, those made since included, and the earlier ones are imported in their
  place.
- Run it while `ura serve-app` is stopped: a running server shows the imported sessions only once
  its app reads them again.

`ura extension` manages the extensions in your config folder's `extensions/`. It never runs their
code: the server does. [Extensions](extensions.md) says how to write one. `add` takes a folder, a
git URL, or an installed extension's name:

- A folder is linked as `extensions/<name>`, the name its `extension.toml` gives, and reloads on
  each save. A folder already in `extensions/`, or its name, is only turned on: in the repositories
  given, besides the ones it is on in already, or everywhere with `--all`.
- A URL is cloned, then checked out at its default branch's commit, detached, with `.ura-source`
  naming the URL, the commit, and the branch. A host without a scheme, like
  `github.com/gary/uraeda-deploy`, is cloned over `https://`.

`add` refuses a built-in extension's name, `uraeda` and `sessions`, which Uraeda keeps, one
installed already from another folder or URL, and a manifest with a fatal problem. It then asks
whether the extension is on in every repository or in this one, the one its `scope` suggests first.
Without a terminal, pass `--all`, `--here`, or `--repo <name>`, repeated for more. `update <name>`
moves a cloned extension only after you confirm, or with `--yes`: without a terminal, it prints the
diff and moves nothing. `remove <name>` deletes the folder, or only the link to a linked one, and
keeps its settings in `config.toml`. `list --json` prints every extension, the built-in ones first,
but `fake`, the scripted agent of the tests and the sandbox.

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
