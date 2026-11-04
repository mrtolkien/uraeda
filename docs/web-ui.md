# The web UI

The web UI shows every feature and file of a repository with its structure. It performs every human
step: answering, reviewing, writing proposals, and jotting down notes. It also holds your sessions
with the agent, from a phone too. [INSTALL.md](../INSTALL.md#the-web-ui) says how to install it.

## Starting it

In a repository, `npx @uraeda/ui` starts the server on http://127.0.0.1:4310 and opens the
repository in your browser. Run it in another repository and it opens in the server already running.
After `npm i -g @uraeda/ui@latest`, the command is `uraeda`.

```sh
npx @uraeda/ui                          # the web UI, for the repository you are in
npx @uraeda/ui --no-open --port 4311    # without opening the browser, on another port
npx @uraeda/ui --allowed-hosts mac.tail1234.ts.net  # host names for this run, over the settings
npx @uraeda/ui --new-key                # a new access key, which signs every device out
```

`uraeda --help` lists every option.

## Repositories

One server serves every repository in Uraeda's list, kept in your data folder. The menu at the top
left of the web UI switches between them, adds one by its folder, and removes one. `ura add` adds
the repository of the folder you are in. Each repository's pages are under `/r/<name>/`.

A repository that lacks the files the workflow needs opens Home on a Setup pane. "Set up with the
agent" opens a session with the setup message ready to send.

## The workflow's files

The web UI reads the workflow's files as the skill writes them, and draws them:

- A decision's `icon`, a [Lucide](https://lucide.dev/icons/) name, shows beside its title, and a
  default icon for a name it does not know. A decision changed on a branch shows its change against
  the default branch, in place.
- A spec folds its stories' "More scenarios" and its niche edge cases, and shows `data-model.md`
  after the stories, as "Data".
- With a preview decision, a story link alone in its paragraph shows the story live, at a phone's
  width and a desktop's, in a file and in a session's message. A prototype's HTML page linked alone
  in its paragraph shows live too, and an image or an SVG shows in place.
- A comment on a point settled without you is written as a bullet of the round's notes, starting
  with the point's bold subject.
- On the inbox, the ＋ next to Inbox in the sidebar adds a note from any page, and from a feature's
  or a change's page with its slug. "Add" leaves it uncommitted, and "Add as a file" saves a note
  with images as a file of its own. A note's page adds images with "Add images", or by dropping
  them, and draws them under its text.
- The inbox page's "Answer it" and the decisions page's "Check decisions" open their round in the
  questions view, where Submit commits it.
- A done feature's page repairs links its files lost to a later move with "Fix moved links", as
  `ura check --fix` does.

## Sign-in

Every browser signs in. The first start shows an access key, once, in the terminal: keep it in a
password manager. The browser it opens is signed in already, and so is the one a second start opens
on the same machine.

Any other browser, like your phone's, pastes the key once. It stays signed in while it is used at
least every 30 days. "Sign out" and "Sign out everywhere…" are in Settings, under Sign-in. A lost
key is replaced with `uraeda --new-key` on the machine that runs Uraeda, which signs every device
out.

## Settings

Settings, at the bottom of the sidebar, shows and changes the server's settings. It also holds the
theme, kept on each browser, and signing out.

The server's settings are kept in `~/.config/uraeda/config.toml`, a file you can also edit by hand
and keep in your dotfiles. It is in `$XDG_CONFIG_HOME/uraeda/` when `XDG_CONFIG_HOME` is set, or in
`URAEDA_CONFIG_DIR` when that is. The page keeps the file's comments. Its `[server]` table holds:

```toml
[server]
allowed_hosts = ["mac.tail1234.ts.net"]  # host names accepted besides 127.0.0.1 and localhost
port = 4310                              # the server's port
open_browser = true                      # whether a start opens the browser
```

A host name added or removed applies to the next request; the port and the browser, at the next
start. Each value comes from its flag, `--allowed-hosts`, `--port`, or `--no-open`. Else it comes
from its environment variable, `URAEDA_ALLOWED_HOSTS` or `URAEDA_PORT`, else the file, else its
default.

Its `[runs]` table holds how the workflow's runs start and go on by themselves:

```toml
[runs]
build_in_fresh_session = true  # whether the build after a spec's approval starts in a new session
continue_after_restart = true  # continue a run a server restart cut less than 6 hours before
continue_after_limit = true    # continue a run a session limit stopped, a minute after its reset
continue_before_gate = true    # ask a run that ended before its next human gate to continue to it
automatic_continues = 3        # automatic continues in a row, 1 to 10, before the run asks for you
```

They apply at once. Each continue's switch comes from its flag, `--no-continue-after-restart`,
`--no-continue-after-limit`, or `--no-continue-before-gate`, else from its environment variable,
`URAEDA_CONTINUE_AFTER_RESTART`, `URAEDA_CONTINUE_AFTER_LIMIT`, or `URAEDA_CONTINUE_BEFORE_GATE`,
set to `true` or `false`, else the file, else its default. The continues in a row come from
`--automatic-continues <n>`, else `URAEDA_AUTOMATIC_CONTINUES`, else the file, else 3.

The page shows them under Runs: a switch for each kind of continue, and the continues in a row,
saved on Enter or when you leave the field, a number outside 1 to 10 refused. Turning a switch off
cancels the waits it started, and those runs ask for you.

A flag or a variable holds for one run, is never written into the file, and the page says which one
is in force. A file that cannot be read is never overwritten: the server says why and uses its
defaults until it is fixed.

Its `[keyboard]` table holds the keys' settings, each applied at once:

```toml
[keyboard]
single_key_shortcuts = true                    # the letter keys of every page, and the Space leader
vim_mode = true                                # Vim's keys in every text field, off by default
vim_commands = ["imap jj <Esc>", "nmap Y y$"]  # run in order when Vim starts, empty by default
```

## Editing text

Every text field is the same editor, in the look of a terminal's text. Markdown is highlighted as
you type, its marks dimmed, and long lines wrap. A one-line field grows with its text, up to 9
lines, then scrolls; a pasted line break becomes a space. Enter saves a one-line field, and
Ctrl+Enter saves any field, as its button does. Escape leaves the field and keeps its text, so the
page's keys work again. A changed row asks "Discard your changes?" first.

### Vim mode

"Vim mode", in the settings' Keyboard section, gives every field Vim's keys, from CodeMirror's Vim
engine. A field opens in insert mode, so typing works as without Vim. Escape goes to normal mode,
and Escape in normal mode leaves the field. Shift+Escape leaves it from any mode. `:w` saves, as
Ctrl+Enter does, `:q` leaves the field, and `:wq` does both. A yank also copies to the system
clipboard; a delete never replaces what you copied.

A picker's filter, like `Space Space`'s, takes Vim's keys too, as LazyVim's picker does: Escape goes
to normal mode with the picker open, where `j` and `k` move along the list and Enter opens the
highlighted item; Escape in normal mode closes the picker.

The status line at the bottom opens with the mode: NAV while keys act on the page, else the field's,
like NORMAL or INSERT.

Touch screens have no Vim: on a phone, or wherever the main pointer is a finger, fields type as
without it, and the engine is never loaded.

"Vim commands", under the switch, holds your own commands, one per line, like `imap jj <Esc>`. They
run in order when Vim starts. A line the engine refuses shows its error under the field, like
`Line 2: Not an editor command ":nmpa Q dd"`. A value of the wrong type in the file, like a string
instead of a list, shows as a problem of the file.

Keys the browser keeps never reach Vim: Ctrl+W closes the tab, even in insert mode. The Leave guard
asks first while text is not saved.

## Buffers

On a page showing one file, like the priorities, the inbox, a decision, or a feature's spec,
`Space b` opens the whole file as a buffer, frontmatter included. It fills the center column, under
a line naming the file, and the status line names its branch. A file of a feature's folder opens
from the feature's branch.

`:w` or Ctrl+Enter saves the file, without committing it. `:q`, or `b` outside the text, goes back,
asking first while the text is not saved; `:wq` saves, then goes back. With Vim mode on, a buffer
opens in normal mode at the file's start. On the phone, the bottom bar holds Back and Save.

A save is refused when the file changed since the buffer opened. A banner then offers "Copy my text"
and "Load the new version". A feature's file is refused while its agent works: "An agent is working
on this feature. Stop it first, or wait for it." Its edit then waits too, on the Commit page.

## Committing

Saving never commits. The inbox, the priorities, proposal and note files, and buffers only save
their files, and Commit, in the sidebar or the phone's tabs, opens the Commit page. Actions that say
they commit, like submitting a round's answers or a review's verdict, still commit at once.

The Commit page shows a pane per branch with changes: the default branch's first, then each
feature's whose files a buffer changed. Each pane lists what its commit holds, a buffer's file as
"Edit <path>". Its message is a field filled with the suggested message. Rewrite it, and it is
committed as typed; until then it is unsaved text, kept in this browser like any field's, and "Use
the suggested message" brings the suggestion back. Each pane has its own Commit and Discard, and
Discard asks first.

With several panes, `j` and `k` select one, and Enter and `d` commit or discard it. Ctrl+Enter in a
message commits its pane. On the phone, a single pane's Commit and Discard sit in the bottom bar.

## Reaching it from another device

The server listens on 127.0.0.1 only. To reach Uraeda from a public address, put a proxy that ends
TLS on the same machine, like Caddy or Tailscale Funnel. Add its host name in Settings, or give it
to `--allowed-hosts`. With Caddy, the whole configuration is:

```caddy
uraeda.example.com { reverse_proxy 127.0.0.1:4310 }
```

On a tailnet, `tailscale serve --bg 4310` reaches it from your phone, at your machine's full name,
like `https://mac.tail1234.ts.net/`, once that name is in `allowed_hosts`.

## Sessions with Claude Code

Sessions need `claude` installed and signed in on the machine, with a paid plan: see
[INSTALL.md](../INSTALL.md#claude-code). Without `claude`, the pages only commit.

Every conversation with the agent is a session. "＋ New" opens one in the main checkout, or starts a
change or a feature. Its three cards share one text, kept until it starts. A feature asks its slug
and its research effort, then opens its session. A line's Start, on the priorities, puts the line in
that text, in place of what it held, with an Undo. A change or a feature holds one or more sessions,
in its worktree, where the workflow's runs and your messages follow each other.

The buttons that hand a feature over, like "Commit and start the agent" and "Approve and start the
agent", commit. They then open its session with the workflow's message in the composer. Nothing goes
until you send it. A message sent while the agent works is steered into its turn. Stop ends the turn
and keeps the session.

The sidebar shows every session with what needs you, what works, and each new reply. A feature reads
Working while any of its sessions runs, whatever its step. A run that failed or was stopped asks for
you until you dismiss it, with Dismiss on its feature's or change's card, or on its session's
banner. A pull request reads "PR ready" only once it holds its branch's latest commit. While its
branch holds commits the pull request lacks, the feature reads "Push", in In progress, for the agent
to push.

A run Uraeda continues by itself says so in its session, with a line such as "Continued after the
server restarted." While a run waits for a usage limit's reset, it reads "Waiting until 8:41", the
time it goes on, and its session says so above the composer: a message you send goes at once, and
Stop ends the wait. A run whose agent set itself a wakeup, to check on CI later, reads "Waiting"
until it, and nothing asks it to go on before. Past the continues in a row set under Runs, without a
commit or a message from you, the run reads "The agent keeps stopping." and asks for you.

On Home, Needs you has "Continue all" in its border while a run there failed, was stopped, or ended
early, at a step where the agent works. It sends each such run its step's message, in its own
session, as continuing the step does, and leaves the features waiting for you at a gate alone. Under
the pointer or focused, it tints the runs it continues and dims every other row; on a touch screen,
the first tap shows this and the second sends. A run it could not continue, as while another session
of its feature works, stays as it was, and a toast says why. A run waiting for a usage limit's reset
reads in In progress, with the time it goes on.

"＋ New" starts a feature from a typed text, with no proposal file: its first line is the title, and
its research effort goes in the proposal's `discovery` field. It starts a change from a typed
request, an inbox note, or a priorities line. A line of **Now** it was filled from is replaced by
the new link in the start commit. "Drop the change…" and "Drop the feature…", in a session's
actions, drop it.

When you ask a session on the main checkout for a code change, the agent offers it as a change, in a
card holding its proposal: edit the proposal and its slug, then start it, and the session goes on in
the change's worktree. A change that needs more than a change's flow is offered as a feature the
same way. A run that starts a change it does not make, like applying an inbox triage, gives the
change's page, where its own session runs.

Claude Code runs in `auto` permission mode, with your own settings, and with the server's copy of
the skill as a plugin: see the [agents](../specs/decisions/agents.md) decision. The skill holds the
workflow for any agent, and never describes the web UI. The server adds the web UI's own
instructions to every session, in
[`instructions.ts`](../packages/server/src/runner/instructions.ts): its offers' cards, and what it
shows of the agent's messages.

## The data folder

Sessions are kept in `runner.sqlite`, in `URAEDA_DATA_DIR` or your system's data folder,
`~/.local/share/uraeda/` on Linux. There, a running server keeps the files that only live while it
runs, like its host token and its Storybooks' records, in `run/`.
