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

A flag or a variable holds for one run, is never written into the file, and the page says which one
is in force. A file that cannot be read is never overwritten: the server says why and uses its
defaults until it is fixed.

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

Claude Code runs in `auto` permission mode, with your own settings, and with the server's copy of
the skill as a plugin: see the [agents](../specs/decisions/agents.md) decision.

## The data folder

Sessions are kept in `runner.sqlite`, in `URAEDA_DATA_DIR` or your system's data folder,
`~/.local/share/uraeda/` on Linux. There, a running server keeps the files that only live while it
runs, like its host token and its Storybooks' records, in `run/`.
