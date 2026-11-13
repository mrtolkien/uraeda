# The app

The app shows every feature and file of a repository with its structure. It performs every human
step: answering, reviewing, writing proposals, and jotting down notes. It also holds your sessions
with the agent. It is one app in two forms: a desktop window on Linux, and the same screens in any
browser, a phone's too, both served by `ura serve`. [INSTALL.md](../INSTALL.md) says how to install
them.

## Starting it

In a repository, `ura serve` starts the server on http://127.0.0.1:4310 and opens the repository in
your browser. Run it in another repository and it opens in the server already running. On Linux,
`uraeda` opens the desktop app instead: it finds the server running, or starts one, and stops the
one it started when its window closes.

```sh
ura serve                       # the server, and the app in your browser
ura serve --no-open --port 4311 # without opening the browser, on another port
uraeda                          # the desktop app, on Linux
uraeda --server https://mac.tail1234.ts.net  # another machine's server
```

`ura serve --help` and `uraeda --help` list every option. [The CLI's page](cli.md) has `ura serve`,
`ura pair`, and `ura key` in full.

## Repositories

One server serves every repository in Uraeda's list, kept in your data folder. The menu at the top
left of the app switches between them, adds one by its folder, and removes one. `ura add` adds the
repository of the folder you are in. Each repository's pages are under `/r/<name>/`.

A repository that lacks the files the workflow needs opens Home on a Setup pane. "Set up with the
agent" opens a session with the setup message ready to send.

## The workflow's files

The app reads the workflow's files as the skill writes them, and draws them:

- A decision's `icon`, a [Lucide](https://lucide.dev/icons/) name, shows beside its title, and a
  default icon for a name it does not know. Its card on the decisions page shows its opening quote,
  the human's words, as a quote, or its context when it has none. A decision changed on a branch
  shows its change against the default branch, in place.
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
- The banner of the inbox's triage opens its round with "Answer it", in the questions view, where
  Submit commits it. Its Dismiss deletes it, in a commit of its own, so "Organize with AI" asks for
  a new one. A triage holding changes you have not committed, like answers not submitted, asks
  first, and one never committed stays: delete it by hand.
- A done feature's page repairs links its files lost to a later move with "Fix moved links", as
  `ura check --fix` does.

## Sign-in

Every browser and every device signs in. The first start of `ura serve` in a terminal shows an
access key, once: keep it in a password manager. The browser it opens is signed in already, and so
is the one a second start opens on the same machine. The desktop app on the server's own machine
needs no key.

Any other browser, like your phone's, pastes the key once. It stays signed in while it is used at
least every 30 days. A device, the desktop app on another machine or a phone, can pair instead:
`ura pair` on the server's machine prints a one-time code and its QR code, and the device then signs
in with a token of its own, which Settings revokes alone. "Sign out" and "Sign out everywhere…" are
in Settings, under Sign-in. A lost key is replaced with `ura key --replace` on the machine that runs
Uraeda, which signs every browser and device out. A server started with no terminal, as a service or
by the app, shows no key: `ura key` shows one then, once.

## Settings

Settings, at the bottom of the sidebar, shows and changes the server's settings. It also holds the
colours and the fonts, kept on each device, and signing out.

Its Appearance section picks the mode, System, Light, or Dark, then a dark theme and a light theme,
each from its own list: the shipped themes, then [yours](#colour-themes), marked "yours". System
follows the device, the light theme by day and the dark one by night; `Space u m` cycles the three
modes. Each device keeps its own picks, as it keeps its fonts: a phone opened for the first time
shows Catppuccin, whatever the laptop picked. A picked theme that leaves the lists, such as a file
of yours deleted, draws its mode's default, Catppuccin Mocha or Latte. In a browser, a reload draws
the picked theme from its first frame, the sign-in page included, from the colours the browser drew
last, and a private window that refuses storage keeps the picks until the page reloads.

`Space u t` tries the themes from the keyboard: a narrow list of every theme at the top of the page,
dark ones first, the two in use marked, and the app itself drawn in the theme under the cursor. Left
alone a second, the list fades so the whole page shows; a key or a pointer move brings it back.
Enter keeps the theme, and a theme of the other mode switches the mode to it, so you see it. Escape,
Back, or a tap outside the list put back the theme in use.

The section also lists your theme files, each with its mode, the theme it extends, how many colours
it has under the contrast floor and how many other problems, and the problems themselves, or says
where to put one. A role with a problem keeps its colour from the theme the file extends; a colour
under the floor applies as written.

Its Updates section shows this app's version, looks for a new release, and installs it. The desktop
app also looks once as it starts, and a toast offers the new version: Not now quiets it until the
next one. Installing downloads the release, checks its signature and its SHA-256, swaps it in, and
restarts the app on it, with the server the app started. An AppImage, or a folder only the system
can write, opens the release's page instead. In a browser the app is the one the server holds, and
updates with it.

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
start. The port comes from `--port`, else from `URAEDA_PORT`, else the file, else 4310. The host
names come from `URAEDA_ALLOWED_HOSTS` for one run, else the file. `--no-open` opens no browser,
whatever the file says. A variable is read from the server's environment, or from the `.env` of the
config folder.

Its `[runs]` table holds how the workflow's runs start and go on by themselves:

```toml
[runs]
continue_after_restart = true   # continue a run a server restart cut less than 6 hours before
continue_after_limit = true     # continue a run a session limit stopped, a minute after its reset
automatic_continues = 3         # automatic continues in a row, 1 to 10, before the run asks for you
catch_up_pull_requests = false  # catch up open pull requests behind the default branch
scheduled_jobs = true           # start your jobs at their times
default_agent = "codex"         # the agent a new session runs on; the first agent on when unset
review_depth = "waves"          # "waves": review each wave and the branch; "branch": the branch
```

Its other tables say how each workflow step runs, and with which sub-agents. The steps are
`discovery`, `spec`, `plan`, `build`, `review`, and `comments`, each with a table of its own, all
optional:

```toml
[runs.steps.spec]
agent = "claude"     # claude or codex; else the default agent
model = "opus"       # a model the agent lists; else the agent's default
effort = "high"      # an effort the model takes; else the model's default

[runs.steps.plan]
new_session = true   # start a clean session for this step; true for the plan when unset

[runs.implementers]  # the build's implementers; else the build's agent, on its defaults
agent = "codex"
model = "gpt-6.1-sol"
effort = "low"

[[runs.reviewers]]   # an agent reviewer, running its agent's own review
agent = "claude"
model = "opus"
effort = "high"
instructions = "Check the migrations first."  # added to the review's prompt

[[runs.reviewers]]   # a command reviewer, run in the feature's worktree
command = "coderabbit review --plain"
```

A missing table or key is the default: Discovery and Spec share a session, and Plan to Comments a
second one, every step on the default agent and its defaults. `new_session` is ignored on
`discovery`, which always starts a session, and is forced on a step whose agent or model differs
from the step before. Without `[[runs.reviewers]]`, one agent reviewer runs on the review step's
agent and its defaults. A reviewer holds `agent` or `command`, never both. The old
`build_in_fresh_session = false` still reads as the plan joined to the spec's session, until a
change to the run options replaces it with `[runs.steps.plan]` `new_session = false`.

They apply at once. Each continue's switch comes from its flag, `--no-continue-after-restart` or
`--no-continue-after-limit`, else from its environment variable, `URAEDA_CONTINUE_AFTER_RESTART` or
`URAEDA_CONTINUE_AFTER_LIMIT`, set to `true` or `false`, else the file, else its default. The
continues in a row come from `--automatic-continues <n>`, else `URAEDA_AUTOMATIC_CONTINUES`, else
the file, else 3. The catch-up of open pull requests comes from `--catch-up-pull-requests`, which
turns it on, else `URAEDA_CATCH_UP_PULL_REQUESTS`, set to `true` or `false`, else the file, else
off. The scheduled jobs come from `--no-scheduled-jobs`, which turns them off, else
`URAEDA_SCHEDULED_JOBS`, set to `true` or `false`, else the file, else on.

`default_agent` names the agent a new session runs on when nothing picks one, by the name of its
extension, like `claude` or `codex`: every picker starts on it, and a step without an `agent` runs
on it. Unset, it is the first agent on: Claude Code, then Codex, then yours. A name no agent has, or
an agent off in a repository, leaves that repository to the first agent on, and is no problem of the
file. No flag or variable gives it.

The page shows them under Runs. "Default agent" lists "The first one on" and every agent, and a pick
is saved at once, for the next session. "How each step runs" draws the run map: the six steps in a
row. Each tile shows its agent's mark, its model, and its effort as a 5-cell meter. Between two
tiles, a line means they share a session, and scissors mean a clean one starts. The scissors lock
where the steps run on different agents or models. Bands under the tiles name the sessions. Under
Build is the Implementers tile. Under Review are the reviewers, an agent or a command each, and
"Waves" or "Branch". ← → (or h l) move along the tiles and the joints, ↓ ↑ (or j k) go to the
implementers or the reviewers and back. Enter on a tile opens the agent and model picker, then the
effort; Enter or Space on a joint cuts or joins it; `r` puts the selection back to its default; `a`
adds a reviewer and `d` removes the one selected. Each is also a tap, and each change is saved at
once. When `CLAUDE_CODE_EFFORT_LEVEL` is set in the server's environment, every Claude Code effort
follows it, and the page says so under the map.

Then a switch for each kind of continue, the continues in a row, saved on Enter or when you leave
the field, a number outside 1 to 10 refused, and the switches "Catch up open pull requests" and "Run
scheduled jobs". Turning a continue's switch off cancels the waits it started, and those runs ask
for you. Turning "Run scheduled jobs" off starts no job at its times, and "Run now" still works.

A flag or a variable holds for one run, is never written into the file, and the page says which one
is in force. A file that cannot be read is never overwritten: the server says why and uses its
defaults until it is fixed.

A `[[jobs]]` table of the same file is a job, a prompt Uraeda runs at set times: see
[Scheduled jobs](#scheduled-jobs). The Jobs place writes them, keeping your comments, and you can
write them by hand:

```toml
[[jobs]]
name = "Dependencies"            # unique among the jobs
repositories = ["uraeda"]        # names in Uraeda's list, one at least
schedule = "daily 03:00"         # when it runs, in the server's local time
prompt = """
Upgrade the dependencies to their latest versions, and run the checks.
"""
on = true                        # false pauses it; true when unset
report_only = false              # true leaves the change its run offers to you; false when unset
agent = "claude"                 # the agent its runs start on; else a new chat's
model = "opus"                   # a model the agent lists; else the agent's default
effort = "high"                  # an effort the model takes; else the model's default
```

`name`, `repositories`, `schedule`, and `prompt` are required. A schedule is one of four forms, in
lower case, its time on 24 hours:

| Form             | Example          | Runs                                         |
| ---------------- | ---------------- | -------------------------------------------- |
| `hourly`         | `hourly`         | at minute 0 of every hour                    |
| `daily HH:MM`    | `daily 03:00`    | every day at that time                       |
| `weekdays HH:MM` | `weekdays 03:00` | Monday to Friday at that time                |
| `<day> HH:MM`    | `monday 04:00`   | that day of every week, `monday` to `sunday` |

The times are the server's local time, and the Jobs place and a job's page read them in that zone
too, whatever the browser's is. An `hourly` job runs in each real hour: the night the clock goes
back, it runs in the repeated hour too. A table that breaks a rule above is a job with a problem:
the Jobs place lists it with the problem, and it does not run. A job that names no repository of
Uraeda's list, whether it has no `repositories`, a value that is not a list of names, or a name that
is misspelt, runs nowhere, so the Jobs place of every repository lists it, to be found and fixed. Of
two jobs with one name, the second has the problem, and every write by that name (a change on the
page, `p`, `d`) is refused with "Two jobs are named “<name>”. Rename one in config.toml.", so the
healthy one is never changed by the other's card: rename one by hand. A `jobs` that is not a list of
tables is the jobs' own problem, and never makes the rest of the settings unreadable.

Its `[keyboard]` table holds the keys' settings, each applied at once:

```toml
[keyboard]
single_key_shortcuts = true                    # the letter keys of every page, and the Space leader
vim_mode = true                                # Vim's keys in every text field, off by default
vim_commands = ["imap jj <Esc>", "nmap Y y$"]  # run in order when Vim starts, empty by default
```

## Colour themes

Your own colour themes go in `~/.config/uraeda/themes/`, beside `config.toml`, one TOML file per
theme. They are read from that folder only, never from a repository. The file's name, without
`.toml`, is the theme's id: `ember.toml` is `ember`. Files whose name does not end in `.toml`, and
hidden files such as an editor's swap files, are not themes.

A theme names its mode, the theme it extends, its own palette, and the roles it changes:

```toml
#:schema https://raw.githubusercontent.com/mrtolkien/uraeda/main/schemas/theme.json
name = "Ember"
mode = "dark"
extends = "catppuccin-mocha"

[palette]
coal = "#1a1210"
ash = "#c9b8a8"
ember = "#ff7a45"

[roles]
page = "coal"
ink = "ash"
needs-you = "ember"
pane-title = "#e0a070"
```

- `name`: the name in the lists; the id when absent.
- `mode`: `"dark"` or `"light"`, the list the theme shows in; taken from `extends` when absent.
- `extends`: the id of a theme of the same mode, shipped or yours, in any case, which every role the
  file leaves out comes from. Without it, a theme extends its mode's default, Catppuccin Mocha or
  Catppuccin Latte.
- `[palette]`: your own colours, named freely, each `#rrggbb` or `#rrggbbaa`. It is merged over the
  palette of the theme it extends: redefining one of its names changes every role you left out that
  names it.
- `[roles]`: each role, a palette name or a colour. Every role is optional.

To start, copy a shipped theme from [`crates/core/themes/`](/crates/core/themes/) and give the file
another name: a theme of yours cannot take a shipped theme's name, in any case. Its first line names
the format's [JSON Schema](/schemas/theme.json), which an editor using Taplo, such as VS Code with
Even Better TOML, reads to complete and describe the keys and the roles.

The roles, each named for where it draws or what it means, with Catppuccin Mocha's colour:

| Role                                    | What it draws                                                         | Mocha                  |
| --------------------------------------- | --------------------------------------------------------------------- | ---------------------- |
| `page`                                  | the standard height's fill: a pane, the page's own content            | base                   |
| `raised`                                | the raised height's fill: a card, a selected row, a bar that stays    | base, one step lighter |
| `sunken`                                | a well below the page                                                 | crust                  |
| `chip`                                  | a neutral filled mark: a grey badge, a skeleton                       | surface0               |
| `cursor-row`                            | the row under the cursor, or picked                                   | mauve at 14% over base |
| `marked`                                | the block selected in a review, and its edge                          | yellow                 |
| `rule`                                  | panes' borders, dividers, fields                                      | overlay0, lightened    |
| `pane-title`                            | a pane's title in its border                                          | lavender               |
| `ink`                                   | body text                                                             | text                   |
| `ink-quiet`                             | what reads second: counts, help, labels                               | subtext0               |
| `ink-faint`                             | disabled and faint text                                               | overlay2, lightened    |
| `action`                                | what can be pressed: a button, focus, the active pane, the next step  | mauve                  |
| `on-action`                             | text on a filled action or status                                     | crust                  |
| `needs-you`                             | the Needs-you pane, Home's count, since-marks, key caps               | peach                  |
| `changed`                               | changed since you read it                                             | mauve                  |
| `added`                                 | new, added, done, success, the repository's mark                      | green                  |
| `removed`                               | wrong, removed, failed                                                | red                    |
| `caution`                               | warning, waiting                                                      | yellow                 |
| `context`                               | context notes                                                         | blue                   |
| `yours`                                 | your own messages in a session                                        | blue                   |
| `link`                                  | links                                                                 | blue                   |
| `working`                               | a running session's mark                                              | blue                   |
| `live`                                  | a live window's double border and title                               | sapphire               |
| `example`                               | an example pane                                                       | teal                   |
| `sub-agent`                             | a sub-agent's mark, and a sub-session under its parent                | teal                   |
| `heading-1`, `heading-2`, `heading-3`   | headings by level; deeper levels take `heading-3`                     | mauve, blue, green     |
| `code-inline`                           | inline code in markdown                                               | peach                  |
| `quote`                                 | a markdown quote                                                      | subtext0               |
| `mode-normal`, `-insert`, `-visual`     | the editing mode, on the status line's ends and the focused field     | mauve, green, blue     |
| `mode-replace`, `mode-command`          | the status line's Vim mode                                            | red, peach             |
| `code-ground`                           | code's background                                                     | mantle                 |
| `syntax-keyword`, `-string`, `-comment` | code's tokens                                                         | mauve, green, overlay2 |
| `syntax-number`, `-constant`            | code's tokens                                                         | peach, peach           |
| `syntax-function`, `-type`, `-operator` | code's tokens                                                         | blue, yellow, sky      |
| `syntax-property`, `-punctuation`       | code's tokens                                                         | lavender, overlay2     |
| `syntax-tag`, `-attribute`, `-variable` | code's tokens                                                         | red, yellow, text      |
| `backdrop`                              | what is under the panes, the darkest colour on screen                 | crust                  |
| `backdrop-wash-1`, `backdrop-wash-2`    | the two colours the backdrop is washed with                           | mauve, blue            |
| `well`                                  | the recessed height's fill: a field, a code block, the composer       | mantle                 |
| `rule-quiet`                            | a line that only separates rows inside a pane                         | between surface0 and 1 |
| `lip`, `shade`                          | the 1 px of light, or of shade, under a height's top edge, with alpha | white 9%, black 42%    |
| `glass-tint`, `glass-rim`               | what glass is tinted with, and its bright rim                         | mantle warmed, white   |
| `light-focus`, `light-focus-2`          | the two ends of the focused pane's light                              | mauve, blue            |
| `light-running`                         | a running pane's line                                                 | teal                   |

Everything else the page draws comes from these: tints over the page, hover and pressed overlays,
icons in their text's colour, diff lines, and text on filled marks. The last rows are the
[design language](/specs/ui/design-language.md)'s, which the Native Shell app draws: its heights,
its glass, and its light. A theme written before them takes each from its mode's default.

A theme of yours applies as written, as soon as it is saved. A problem never stops another theme or
setting from applying, and Settings' Appearance section lists your files, each with its problems and
their lines:

- A file that is not valid TOML, or cannot be read, such as a symlink to nothing, leaves the lists:
  "Could not read: line 4: …".
- A role naming a palette entry that does not exist, or giving something that is not a colour, keeps
  the colour of the theme it extends.
- An unknown `extends` extends the mode's default instead; without a `mode`, the file has no mode to
  take, and leaves the lists.
- A file extending a theme of yours that has problems leaving the lists extends its mode's default
  instead: `extends "a", which has problems of its own: see its row.`
- A loop of `extends`, a theme extending one of the other mode, a file with neither `mode` nor
  `extends`, a `mode` other than `"dark"` or `"light"`, and a file named like a shipped theme leave
  the lists.
- An unknown key or role is ignored, and named.
- A colour under the contrast floor is named, and applies as written: "ink-faint is 3.1:1 on page,
  under 4.5." Text roles are measured at 4.5:1 on `page`, on `raised`, and on `well`, the `syntax-`
  roles at 4.5:1 on `code-ground`, and `rule`, `sub-agent`, and `marked` at 3:1 on `page`, on
  `raised`, and on `well`. A colour with alpha is measured laid over its background.

## Extensions

Uraeda's parts are extensions: Claude Code, Codex, the fake agent of the tests and the sandbox, the
inbox, the priorities and proposals, the decisions, Git, the jobs, the previews, and the
notifications are built in, and yours are TypeScript folders in `~/.config/uraeda/extensions/`,
beside `config.toml`. [Extensions](extensions.md) says how to write one, and `ura extension`
installs one, as [the CLI's page](cli.md) says.

The settings' Extensions category lists "Your extensions", then the built-in ones, "Built in". A row
shows an extension's icon, title, and description, its version, where it came from, a git URL at its
commit or "reloads on save", and where it is on. Its switch turns it on in every repository or off
everywhere, and "Only in…" picks the repositories it is on in. Under the row, its settings, from its
manifest, are saved for every repository, or for the one picked above them, and a section its page
adds shows under them. Picked for one repository, the settings show its own values over the shared
ones: a value set there only reads "Set for uraeda only.", and "Use the shared value" takes it out,
so that the shared value applies there again. The page writes both into `config.toml`, keeping your
comments:

```toml
[extensions.inbox]
on = ["uraeda"]       # every repository by default, "all"; [] turns it off

[extensions.claude]
command = "claude"    # the command Claude Code's sessions run
accounts = []         # the folders of its accounts, see "Several Claude Code accounts"

[extensions.codex]
command = "codex"     # the command Codex's sessions run
```

A banner above the rows names each extension that needs you: one turned off by a problem, with its
file and line, like "Deploy is off: page.tsx, line 12: …"; one running with a problem, like a
setting on its default; one whose reload waits for a session's turn, "Deploy reloads when the turn
of “…” ends"; and a key another extension on in the same repository took first, "Deploy: `y` is
taken by Wiki", with the repositories it is taken in when not all of them, "in uraeda".

A turned-off part leaves at once: the inbox off removes its place, its keys, its Home pane, its
phone tab, and its New-page section, in the repositories it is off in. A link to its place opens
"Inbox is off here", with "Turn it on here". The files it read stay, and `ura check` still checks
them.

An extension's places show after Uraeda's, in the navigation column, the leader menu, and the
phone's tabs, and open at `/r/<repo>/e/<name>/<id>`. The phone's bar holds four places, Uraeda's
first: one of yours takes a tab there only where one of Uraeda's is off, and the rest go into the
`…`. Its panes, sections, keys, and status line's items show beside Uraeda's, in the repositories it
is on in. A saved change redraws them without reloading the page. One that throws shows its error in
its own place, and the rest of the page goes on.

## Panes, tabs, and the side stack

In the app, every page is panes in two stacks, as a tiling window manager arranges windows: the main
stack in the centre, which holds the page's subject, and the side stack at the right. A stack shows
its panes as tabs, or split, one under the other. On a phone both are one stack of tabs, and the bar
at the foot switches between them.

You arrange them with the keys of `Space w`, the leader menu's Panes group, or with the `…` at the
end of a pane's title, which a long press on a tab opens too. The menu shows only the moves that
make sense where the pane is, each with its key.

| Keys          | Does                                                                               |
| ------------- | ---------------------------------------------------------------------------------- |
| `Space w H`   | Send the pane to the main stack; `L` to the side stack                             |
| `Space w m`   | Make a side pane the main one: it takes the place of the pane the main stack shows |
| `Space w <`   | Move the tab left, `>` right; on a phone, along the one stack                      |
| `Space w s`   | Split the stack, or show it as tabs again; `=` gives split panes equal heights     |
| `Space w f`   | Fold the side stack, or unfold it (`]` does it too)                                |
| `Space w z`   | Zoom the pane to the whole window, and back                                        |
| `Space w o`   | One stack: the side stack's panes join the main one as tabs; again, two stacks     |
| `Space w q`   | Close the pane, when the page does not need it; `u` brings the last one back       |
| `Space w r`   | Reset this kind of page's arrangement; `R` every page's                            |
| `Shift+Enter` | On a row that names a session, a file, or a diff: open it beside, as a tab         |

A pointer can also drag a tab to the other stack: the stacks it may land in light up while it is
carried. A split stack's panes are resized by dragging the line between them, and the side stack by
its edge, or with `{` and `}`.

**Open beside**: `Shift+Enter` on a row, a long press on it, or "Open … beside" in its pane's menu,
opens what the row names in the other stack of the page you are on, instead of going to its page: a
file's diff beside a session's conversation, a spec beside the feature's overview, another session
beside this one. Such a pane belongs to this visit: close it with `Space w q`.

**What is kept**: each kind of page keeps its arrangement on the device, so every session page opens
as you left the last one, and a feature's pages as you left the last feature's. Back returns to a
page exactly as you left it. A pane keeps its scroll, its selection, and the text you typed when it
moves, zooms, or its tab is hidden. A preview's web page and an extension's page reload when their
pane moves to the other stack, but not when it is zoomed.

## Editing text

Every text field is the same editor, in the look of a terminal's text. Markdown is highlighted as
you type, its marks dimmed, and long lines wrap. A one-line field grows with its text, up to 9
lines, then scrolls; a pasted line break becomes a space. Enter saves a one-line field, and
Ctrl+Enter saves any field, as its button does. In a session, Enter sends the message and
Shift+Enter adds a line; on a touch screen, Enter adds a line and the Send button sends. Escape
leaves the field and keeps its text, so the page's keys work again. A changed row asks "Discard your
changes?" first.

### Vim mode

"Vim mode", in the settings' Keyboard section, gives every field Vim's keys, from CodeMirror's Vim
engine. A field opens in insert mode, so typing works as without Vim. Escape goes to normal mode,
and Escape in normal mode leaves the field. Shift+Escape leaves it from any mode. `:w` saves, as
Ctrl+Enter does, `:q` leaves the field, and `:wq` does both. As text wraps, `j`, `k`, `0`, `^`, and
`$` move along the lines shown, as `gj`, `gk`, `g0`, `g^`, and `g$` do; after an operator, as in
`dj`, they keep Vim's lines. A yank also copies to the system clipboard; a delete never replaces
what you copied.

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

In a browser, the keys the browser keeps never reach Vim: Ctrl+W closes the tab, even in insert
mode. The Leave guard asks first while text is not saved.

## Buffers

On a page showing one file, like the priorities, the inbox, a decision, or a feature's spec,
`Space b` opens the whole file as a buffer, frontmatter included. It fills the center column, under
a line naming the file, and the status line names its branch. A file of a feature's folder opens
from the feature's branch. Any other text file of the repository, like code a decision links, opens
from the main checkout, highlighted and only read: the page says why it is not edited there.

`:w` or Ctrl+Enter saves the file, without committing it. `:q`, or `b` outside the text, goes back,
asking first while the text is not saved; `:wq` saves, then goes back. With Vim mode on, a buffer
opens in normal mode at the file's start. On the phone, the bottom bar holds Back and Save.

A file changed on disk while you edit it, by an agent or a pull, is never overwritten silently: the
page says so at once, over your text, which it keeps, and offers "See what changed", the patch from
the file to your text, "Take the file's version", and "Save yours over it", each asking first. While
you have typed nothing, the buffer follows the file. A Markdown file's outline, beside it, moves the
caret to a heading. `/edit/<path>`, a workflow file's source opened from its page, is the same
editor, and returns to that page once saved. A feature's file is refused while its agent works: "An
agent is working on this feature. Stop it first, or wait for it." Its edit then waits too, on the
Git page.

## The Git page

Saving never commits. The inbox, the priorities, proposal and note files, and buffers only save
their files, and you commit them on the Git page. Actions that say they commit, like submitting a
round's answers or a review's verdict, still commit at once. Git, in the sidebar, `Space g`, or
`g G` opens it; `/commit`, the Commit page's old address, leads there. The sidebar's Git shows how
many files changed in the main checkout, and how many commits wait on `origin`, as "↓3". A feature's
worktree keeps its changes on its own branch: they wait on the Git page without counting.

The page works on the main checkout. Its title's line reads the branch against `origin`, as "main ·
3 to pull · 6 to push · fetched just now". It fetches as it opens, and again every 5 minutes while
it stays open. Fetch (`f`), Pull (`p`), and Push (`P`) run git as a terminal does, with your
configuration: a pull rebases or merges as `pull.rebase` says, and stashes your edits only with
`rebase.autoStash`. A push never forces: when `origin` has commits the branch lacks, it reads
"origin has commits main lacks: pull first." The server runs git without a terminal, so a remote
that asks for a password needs a credential helper or an ssh-agent.

Changes lists every changed file as a tree of folders, in the main checkout's group, then in one
group per feature's worktree a buffer saved into, set apart by a dashed blue border and marked
"worktree" after its name and count. `j` and `k`, or the arrows, move over the rows, Enter folds or
unfolds a folder, and Space ticks a row's box, staging its file, or every file under a folder. `a`
stages every file of the group, or unstages them all when all are staged. A staged file keeps its
row. Each group has its commit message, one line, filled with a default from what is staged:
`chore: add <the line>` for a single line added to a file, `chore: update <the file>` for any other
change to one file, and `chore: update <count> files` for several. `c` goes to the message, where
you can change it, and Enter, or the Commit under it, which names how many files it commits, commits
what is staged, through your hooks. A hook's refusal shows above Changes, and the files stay staged.
`d` asks before discarding a file's changes.

Picking a file shows its diff, from its first change, beside the sections, or as a page of its own
on the phone, with Back to the sections. Past 1,000 lines, it shows its counts and "Show the whole
diff". History lists the branch's commits, newest first: ↓ marks those to pull, ↑ those to push. A
commit opens its message and its files, each with its diff, and "Show more" reads older ones. The
picked row is in the address, so a reload or a shared link opens it again.

"Merge into main…", or `M`, merges a local branch, or one of `origin`'s, into the checked-out one.
When a pull or a merge stops on a conflict, a banner reads "The pull stopped: 1 file conflicts.",
and Conflicts lists each file. A text file opens in the editor, where a bar over each conflict takes
one side, named by its branch, or both, and the text stays yours to edit; save it, with Save or
Ctrl+Enter, once its markers are gone. A file's row can also take one side whole. Continue goes on
once every file is resolved, and Abort puts the branch back as it was. `m` opens Continue and Abort
as a menu. Until then, Pull, Push, and Merge wait, and the title's line reads "pull stopped".

Worktrees lists the main checkout and every worktree, each with its state. A merged feature's offers
Clean, which removes its worktree, its branch, and its priorities line, as `ura clean` does. One
without changes, or whose folder is gone, offers Remove, which keeps its branch; `d` on its row asks
the same. One with changes offers neither.

Clean is offered outside the Git page too, even once the worktree is gone: a merged feature's page
shows it as Next's button while its worktree or its branch is left, and `Enter` presses it; `c` on
its priorities line cleans it, from the line's bar.

While an agent works in the main checkout, the page reads "An agent works in this checkout.", and
its writes are disabled until the turn ends. Every write shows in the toast, and a refusal shows
next to what it concerns.

## Undo

Every edit you make to your lists and texts can be taken back, in the order you made it, with no
question first. So `d` deletes a row at once. Each tab keeps its last 50 actions, minutes or hours
old. A reload, or another tab, starts with none: what they held stays in the files and on the Git
page. The app keeps one stack for all its pages and repositories, until it closes.

These can be undone:

- the inbox's notes and categories, their moves, and their images;
- the priorities' lines and their moves;
- proposal files' lines and sections;
- a review's comments, and its Start over;
- the removal of a comment on a round's settled point.

Committing, starting a feature or a change, the Git page's actions, and settings cannot: their
buttons name what they do. Text saved from an editor, like a buffer, is not on the list either. The
editor's own history takes back your typing, and the Git page's Discard drops a saved file's
changes.

`u` or `Ctrl+Z` undoes the latest action, and `U` or `Ctrl+Shift+Z` redoes it, with Cmd for Ctrl on
a Mac. They work outside text fields: in a field, `Ctrl+Z` undoes your typing. With single-key
shortcuts off, `u` and `U` do nothing, and the chords still work.

Each action shows a toast for 5 seconds, such as "Deleted “Color themes”", with Undo. After an undo,
it reads "Undone: deleted “Color themes”", with Redo. The status line shows `U redo` while there is
something to redo, and a new action clears it. Moves show no toast: reordering, dragging, indenting,
and changing a row's section or category. Moves of one list, each less than a second after the last,
are one step, which one `u` takes back.

An undo takes you to where the action happened, with what came back selected; Back returns. It
writes the reverse as a change, which waits on the Git page: it never commits or rewrites git's
history. Two cases stop it:

- An undo of a change committed since asks "Undo a committed change?" first. Undo writes the reverse
  as a new change, and Keep it leaves the action on the stack.
- An undo is refused once the file changed since, from another tab, an agent, or a hand edit.
  Nothing is written, and "Could not undo: “Color themes” changed since in PRIORITIES.md." shows
  under the top bar; in the app, in the undo's toast, which stays until closed. The action leaves
  the stack.

Only what loses work for good asks first, like discarding a file's changes on the Git page. A
category that holds notes asks what to do with them, then its delete can be undone too.

On the phone, there is no key and no status line: the toast's Undo and Redo work for its 5 seconds.
A move there has no toast, so it can only be moved back.

## Reaching it from another device

The server listens on 127.0.0.1 only. To reach Uraeda from a public address, put a proxy that ends
TLS on the same machine, like Caddy or Tailscale Funnel. Add its host name in Settings, or give it
in `URAEDA_ALLOWED_HOSTS`. With Caddy, the whole configuration is:

```caddy
uraeda.example.com { reverse_proxy 127.0.0.1:4310 }
```

On a tailnet, `tailscale serve --bg 4310` reaches it from your phone, at your machine's full name,
like `https://mac.tail1234.ts.net/`, once that name is in `allowed_hosts`.

The iOS app asks for that address as it first opens, on "Connect to your server", then for a pairing
code. The link `ura pair` prints does both at once, pasted in the same field. The server it uses is
in Settings, under Sign-in, "This app's server", with "Use another server…". Your extensions' places
and panes work there as in a browser.

## Sessions with Claude Code and Codex

Sessions need `claude` or `codex` installed and signed in on the machine, with a paid plan: see
[Claude Code](../INSTALL.md#claude-code) and [Codex](../INSTALL.md#codex) in `INSTALL.md`. Without
either, the pages only commit.

Every conversation with the agent is a session. "＋ New" opens one in the main checkout, or starts a
change or a feature. Its three cards share one text, kept until it starts. A feature asks its slug
and its research effort, then opens its session. The feature's and the change's start dialogs show
the run map, the one the settings draw under "How each step runs", in a dialog as large as the map
needs, up to most of the window: what differs from your settings is in the accent. On a window under
1280 px wide the map stands as a column, as on the phone, in a narrower dialog. A change's map shows
what a change runs: its fix, and under it its reviewers and the one to add. Tab reaches the map, and
its keys are the settings': ← → (or h l) move along the steps and the joints, ↓ ↑ (or j k) go to the
implementers and the reviewers and back, Enter on a step, the implementers, or a reviewer opens the
picker, Enter or Space on a joint cuts or joins it, `r` puts the selection back to its default, `a`
adds a reviewer, and `d` removes the one selected. Enter starts the feature from the short name's
field alone. On the phone the dialog is a sheet as tall as the map, up to most of the screen, with
Reset and Remove as buttons under the map. What you change is the feature's own, and the rest
follows your settings. It starts with no proposal file: the text's first line is the title, and the
research effort goes in the proposal's `discovery` field. A change starts from a typed request, an
inbox note, or a priorities line. A line of **Now** it was filled from is replaced by the new link
in the start commit. "Drop the change…" and "Drop the feature…", in a session's actions, drop it.
"Postpone the change" and "Postpone the feature", in its page's actions, send its latest session, or
a new one, the message that makes it a proposal again, in **Later**, and open that session. A line's
Start, on the priorities, puts the line in that text, in place of what it held, which `u` brings
back. A change or a feature holds one or more sessions, in its worktree, where the workflow's runs
and your messages follow each other.

The buttons that hand a feature over, like "Commit and start the agent" and "Approve and start the
agent", commit. They then open the session of its next step with the workflow's message in the
composer, as the run map's joints say. Nothing goes until you send it. A message sent while the
agent works is steered into its turn. Stop ends the turn and keeps the session.

The sidebar shows every session with what needs you, what works, and each new reply. Its usage pane
shows one line per login of every agent that reported its five hours (one that reported only its
week has none, and with no line there is no pane), with Claude Code's accounts first, each by its
name, then Codex's, each with its mark; Home's Usage pane adds each login's week. The closed rail's
one bar shows the five hours of the account of the session or feature in view, named by its label
("b 5h: 58% left"), else, with none in view, of the one a new session would start on; a session
whose account is no longer listed shows no bar. A feature reads Working while any of its sessions
runs, whatever its step. A started feature of Now whose next step is an agent's, and that no run
follows, reads "Waits for your Continue", under Needs you, as no run starts by itself; it never
notifies. Home's In progress keeps what an agent works on, then the features a line of the
priorities holds elsewhere, saying where ("In Next"); a dropped one leaves it. A run that failed or
was stopped asks for you until you dismiss it, with Dismiss on its feature's or change's card, or on
its session's banner. A pull request reads "PR ready" only once it holds its branch's latest commit.
While its branch holds commits the pull request lacks, the feature reads "Push", in In progress, for
the agent to push. Once main moves past its branch, it reads "Catch up", for the agent to rebase,
validate, and push; main gaining only priorities, inbox, proposals, or notes does not count. "Catch
up open pull requests", under Runs in Settings, starts that run by itself, once per commit of main,
once no turn runs in the feature's latest session. It runs as part of Comments on the run map, on
its agent, model, and effort, in the session its joint gives. Its session opens with the line
"Catching up with main, which moved to “<subject of the commit>”." A catch-up that meets a conflict
with main, one needing your choice, asks on the pull request: the feature reads "Needs attention",
and its session's banner says "The catch-up stopped on a conflict." until you answer by requesting
changes, or dismiss it with Dismiss. A catch-up you stopped or dismissed is not started again until
main moves again.

Each workflow step is a run of its own: the run's message says where it stops, at the end of its
step. When a run ends its step before a gate of yours, Uraeda starts the next step's run itself, in
the same session where the run map joins the two steps, else in a new session on the next step's
agent, model, and effort, until the workflow waits for you. A run that ends at "Catch up" starts
nothing: only the switch above starts a catch-up by itself. A step at work keeps its pick: a change
made to it on the feature's page applies from its next run. The next step's run is no automatic
continue, and counts nothing toward the continues in a row. A run you stopped, one that failed, and
one that ended without finishing its step start nothing: the run asks for you.

A job's run is the one run Uraeda starts on a clock: [Scheduled jobs](#scheduled-jobs) says how.

A run Uraeda continues by itself says so in its session, with a line such as "Continued after the
server restarted." While a run waits for a usage limit's reset, it reads "Waiting until 8:41", the
time it goes on, and its session says so above the composer: a message you send goes at once, and
Stop ends the wait. A run whose agent set itself a wakeup, to check on CI later, reads "Waiting"
until it, and nothing asks it to go on before. Past the continues in a row set under Runs, without a
commit or a message from you, the run reads "The agent keeps stopping." and asks for you.

On Home, Needs you has "Continue all" in its border while a run there failed, was stopped, or ended
early, at a step where the agent works. It sends each such run its step's message, in the session of
its step, as continuing the step does, and leaves the features waiting for you at a gate alone. It
also catches up each feature reading "Catch up" whose catch-up has not run yet for main's current
commit. Under the pointer or focused, it tints the runs it continues and dims every other row; on a
touch screen, the first tap shows this and the second sends. A run it could not continue, as while
another session of its feature works, stays as it was, and a toast says why. A run waiting for a
usage limit's reset reads in In progress, with the time it goes on.

When you ask a session on the main checkout for a code change, the agent offers it as a change, in a
card holding its proposal: edit the proposal and its slug, then start it, and the session goes on in
the change's worktree. A change that needs more than a change's flow is offered as a feature the
same way. A run that starts a change it does not make, like applying an inbox triage, gives the
change's page, where its own session runs.

Sessions run Claude Code or Codex, the built-in `claude` and `codex` extensions, while they are on;
a runtime extension of yours runs another agent. Wherever a session starts, the composer of a new
chat or of a feature's new session, and a round's "Apply the answers", a button names the agent,
model, and effort it will run on, like "Codex · GPT-6.1-Sol · Medium". It, or `Space a`, opens the
picker in two steps: first the models of every agent on, each agent's "Default" first, naming the
model it stands for, then the picked model's efforts, "Default" first. A model that takes no effort
skips the second step, and on a phone the picker rises as a sheet. In a composer, on the New page, a
session's page, or a session in a review's column, `m` opens it too, once the field is left with
`Escape`. A new chat runs on the default agent, the settings' "Default agent" or else the first
agent on, at the agent's own default model and effort, until you pick others. A new session of a
feature or a change runs on the pick of its next step, from the run map, which the button shows
until you pick others.

A session keeps the agent and the model it started on, its automatic runs included; it is read-only
while its agent is off. Each step's run starts on that step's own pick, and a run joined to a
session runs on its step's effort. To change the model, start a new session. In a running session,
the composer's button names the effort alone, like "Effort · High", and it, `m`, or `Space a` opens
the effort step: the turn at work keeps its effort, and the next turns run on the new one. The
session's header names the agent, then the model and effort it reports running on, like "Codex ·
GPT-6.1-Sol · Medium".

A feature's page draws its run map, in place of a timeline. A Proposal cap opens the track and a
Merged cap ends it. Each tile carries what its stage had: its time, like "12:11 · 2 h 50 min" or
"since 15:08", its files as links, Discovery its rounds, and Build its tasks. A joint where the
workflow waits for you shows your gate, the answers, the approval, a plan review when it is on, or
the pull request's review, in the `needs-you` colour while the feature waits there. Steps done dim,
the current one is in the accent, and the steps not started stay editable, with the settings' keys:
what you change there is the feature's own. A finished feature shows its whole map, read only.

In a workflow run, the agent's own sub-agents are off: the build's implementers and the reviewers
are sub-sessions, sessions Uraeda starts for the run, each on the agent, model, and effort its role
is set to. The implementers work in their tasks' worktrees, beside their parent. The reviewers of a
review run at once, each with its agent's own review, Claude Code's `/code-review` at a level
matching its effort, Codex's review on its model, or as a command in the feature's worktree. Uraeda
commits their findings in the feature's folder as the next `findings-NN.md`, a section per reviewer,
before the run fixes them. A reviewer that fails says why in its section, like "Did not review:
Codex is not available on this machine.", and the others stand. With "Branch", a wave's review runs
nothing. Stop on a session stops its sub-sessions too.

A session's Sub-agents pane lists its sub-sessions, each with its role, its task or what it reviews,
its agent, model, and effort, its state, its time, and its usage. A click on one, or Enter, opens
its page: its transcript, without a composer, with Stop while it works and a link back to its
parent. On a feature's page, the sessions pane nests each sub-session under the session that started
it, in the `sub-agent` colour. A chat keeps its agent's own sub-agents, shown in the pane as before.

From the keyboard, on a session's page, `l` or `→` moves into the column on its right, unfolding it
first, and `h` or `←` comes back. In the column, `j` and `k` move from row to row, Enter opens the
row, and `k` past the first row reaches the tabs, where `h` and `l` open the previous and the next
one.

Claude Code runs in `auto` permission mode, with your own settings, and with the server's copy of
the skill as a plugin. Codex runs in its `workspace-write` sandbox, the network off, with approvals
on request, which its automatic reviewer decides, whatever your `~/.codex/config.toml` says: it
escalates each git write and network command, and the transcript shows the review's verdict, like
"Automatic review approved (risk: low): …". It gets the skill as one more skill folder. See the
[agents](../specs/decisions/agents.md) decision. A workflow session gets Uraeda's MCP server,
`uraeda`, with two tools: `run_agent`, which runs one task in a sub-session, and `review`, which
runs the reviewers and commits their findings. In the Activity, a `run_agent` call shows its
sub-session on one line: its state, its task as a link to its page, its model, and how long it ran.
Its token is in the process's environment, `URAEDA_MCP_TOKEN`, and holds only while that process
runs. Claude Code's `Agent`, `Task`, `Workflow`, and `TeamCreate` tools are disallowed there. Codex
runs on a copy of its model catalog with every model's sub-agents disabled. The copy is written to
`codex-catalog/` in the data folder as the session opens, and your Codex home stays untouched. When
it cannot be written, Codex runs on its own catalog, and the session says its own sub-agents may
run. Each extension of yours on in the repository adds its `skills/` folder the same way, as one
more plugin, `ext-<name>`, for Claude Code. The skill holds the workflow for any agent, and names
Uraeda's tools and the run's stop, never the app. The server adds the app's own instructions to
every session, in [`instructions.rs`](../crates/server/src/runtimes/built_in/instructions.rs): its
offers' cards, and what it shows of the agent's messages, and where your extensions folder and their
documentation are. A session may write in your extensions folder, Codex's after its reviewer
approves each write, so asking it for a change to Uraeda gives you an extension.

### Several Claude Code accounts

With one Claude Code account, its limit stops your work for hours. List one folder per account in
Settings, Extensions, under Claude Code, and each new session picks an account as its first turn
starts, and its header names it, like "Claude Code · b · Opus 5.5 · High". Nothing changes while the
list is empty.

For each extra account, once, save this script and run it from any shell, as
`bash claude-account.sh b`. It asks for the name when none is given, and is safe to run again:

```bash
#!/usr/bin/env bash
# Makes a Claude Code configuration folder for one more account, ~/.claude-<name>, linked to the
# settings, skills, plugins, hooks, memory, and conversations of ~/.claude, then signs it in.
# Usage: bash claude-account.sh [name]
set -euo pipefail

name="${1:-}"
if [ -z "$name" ]; then
  read -r -p "Account name (letters, digits, - or _): " name
fi
if ! [[ "$name" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "Not a name: '$name'. Use letters, digits, - or _." >&2
  exit 1
fi

source_dir="$HOME/.claude"
account_dir="$HOME/.claude-$name"
if [ ! -d "$source_dir" ]; then
  echo "No $source_dir: sign in to Claude Code once first." >&2
  exit 1
fi

mkdir -p "$account_dir"
for item in settings.json CLAUDE.md skills plugins commands agents hooks statusline.sh projects; do
  if [ ! -e "$source_dir/$item" ]; then
    continue
  fi
  if [ -e "$account_dir/$item" ] || [ -L "$account_dir/$item" ]; then
    echo "kept    $account_dir/$item"
  else
    ln -s "$source_dir/$item" "$account_dir/$item"
    echo "linked  $account_dir/$item"
  fi
done

echo
echo "Signing in $account_dir: pick the account for '$name' in the browser."
CLAUDE_CONFIG_DIR="$account_dir" claude auth login
echo
CLAUDE_CONFIG_DIR="$account_dir" claude auth status --text
echo
echo "Done. The folder to list in Uraeda's settings: ~/.claude-$name"
```

The links share your settings, skills, plugins, hooks, memory, and conversations with `~/.claude`.
MCP servers added for your user live in each folder's own `.claude.json`: add them again with
`CLAUDE_CONFIG_DIR` set. Then list the folders, in the order they should show, in Settings, or in
`config.toml`:

```toml
[extensions.claude]
accounts = ["~/.claude", "~/.claude-b", "~/.claude-c"]
```

The list holds for every repository. A session that starts picks, among the listed accounts that are
signed in and whose week is not used up:

1. the one with the most of its five hours left;
2. on a tie, the one whose five hours reset first;
3. then the first one listed.

When every signed-in account's week is used up, the first signed-in one listed is picked. A session
keeps its account until a usage limit refuses its run, of its five hours or of its week: it then
moves to the account with the most left among those with room, and the run goes on there at once,
with a line that names the account. The new account reads the conversation again, uncached. When no
other account has room, or none holds the session's conversation, a folder made without the script's
`projects` link, the session stays: its run waits for its account's five-hour reset, or asks for you
at a weekly limit. With "Continue after a usage limit" off, the session still moves, and your next
message runs on the new account.

An account's name is its folder's name without its dot and its `claude-`: `~/.claude-b` reads "b",
`~/.claude-work` reads "work", and `~/.claude` reads "default". A second folder that would read the
same as a listed one reads its full path instead. Home's Usage pane lists each account by its name
with its five hours and its week, and a used-up week reads 0% in red. An account signed out reads "b
· signed out" on Home and "b signed out" in the sidebar, with no usage; one whose folder is missing
reads "c · no folder" and "c no folder". A banner in Settings, Extensions, says which of the two,
and where.

Uraeda gives a session its account only as `CLAUDE_CONFIG_DIR`, and reads none of its credentials.
The default folder, `~/.claude`, runs without the variable, as Claude Code does on its own, so its
`~/.claude.json` still applies. Two things Claude Code decides, not Uraeda: an account with usage
credits on is never refused, so it pays past its limit, and you should turn them off; and an
`ANTHROPIC_API_KEY` in the server's environment outranks every account's login, so unset it.
Anthropic's terms forbid using someone else's account, and its advertised limits "assume ordinary,
individual usage": list only accounts that are yours, and read the terms yourself.

## Scheduled jobs

A job is a prompt you schedule: at each of its times, Uraeda starts a new session in the main
checkout of every repository it names, and sends it the prompt. Jobs are yours: they live in
`config.toml`, never in a repository, so no repository can add one.

Jobs, in the navigation column, `Space j`, `g j`, or the phone's `…`, at `/jobs`, lists the jobs
that name the repository, and those that name no repository of Uraeda's list, each as a card. Its
head holds the job's name, its schedule in words, and the switch that pauses it, and "Report only"
marks a job that does. Under it, "Next run" says when the job runs next, like "Tomorrow at 3:00", or
why it does not: "Paused", "Scheduled jobs are off", "Not running: the schedule “dayly 06:00” is not
understood", "Not running here: Claude Code is off in this repository.", "Not running here: Claude
Code is not available on this machine.", or "Two jobs are named “Dependencies”.". A problem of the
job itself comes first, then a pause: a paused job reads "Paused" whatever its agent. A problem that
does not stop the job here, like “notes” is not in Uraeda's list. for a job that runs in this
repository too, shows beneath the time. Of two jobs with one name, each has its card, and a write on
either, `p`, `d`, or a field of its page, and `r`, are refused with the words above until one is
renamed in `config.toml`. "Last run" says what the last run left for you, however many skipped times
follow it. The keys act on the selected card, each also on its bar and by tap: `j` and `k` move the
selection, Enter opens the job's page, `r` runs it now, `p` pauses or resumes it, `d` deletes it
after "Delete the job “<name>”? Its prompt leaves config.toml, and its sessions stay.", and `a` adds
a job. A refusal shows under its card until you dismiss it. Jobs is a built-in extension, turned off
like the others: its place is gone in the repositories it is off in, and no job starts there.

A job's page, `/jobs/<name>`, is its form (a name the address cannot carry, as `new`, `.`, `..`, or
one that starts with `~`, is written with a `~` before it): the name, the prompt, the schedule, the
repositories, the agent, model, and effort, and "Report only". Each field of an existing job is
saved as you leave it, and a choice as you make it. The control moves at once, changes made while a
save is under way wait their turn and apply on what the one before wrote, and a refusal puts the
control back and shows under the field: "A time is from 00:00 to 23:59.", "A job named “<name>”
exists already.", "A job runs in one repository at least.". A time is typed as `HH:MM`, and `3:00`
is sent as `03:00`. The Agent row shows what the file holds: an agent that is off in the repository
shows as itself, with why the job does not run, and "Default" clears the agent, the model, and the
effort. If you untick the repository the page is of while another stays ticked, the page says
“<name>” no longer runs in it, and "Run it here again" ticks it back. `a` opens a new job's page,
where "Add the job" writes its table once its name and prompt are filled. "Run now" sits by the
page's title, and on the phone it is the bottom bar's one action. The page ends with the job's
history, newest first: each run as its session, or its change once it started one, and "Its session
is gone." for a run whose session and change are, and each skipped time with its reason, and each
time whose run could not start with why. A job's table edited by hand shows on its page within a
second. A job renamed on its page keeps its history; renamed by hand, it starts a new one.

**A run.** A run is a session of the main checkout, one per repository, named after the job, on the
job's agent, model, and effort. It opens with a line saying why it started, "Started by the schedule
“<job>”." or, for "Run now", "Started by “Run now” of the job “<job>”.", then gets the prompt,
followed by a note from Uraeda: nobody follows the session live, and what to do with a change the
run needs. It ends as any session does, with a reply to read, or a failure that asks for you. A run
whose agent meets the session limit continues, as any run does. A job edited while its run works
leaves that run on the prompt it started with. When several runs are due together, they start a
minute apart, uraeda's at 3:00 and notes' at 3:01. The server looks for due times every 30 seconds,
and each time the settings file is read, so a run starts within a minute of its time, and a job you
save, resume, or switch on up to 30 seconds before its time still runs at it. Turning the Jobs
extension on in a repository is seen at the next look of the server, at most 30 seconds later.

**A time that passed.** A time that passes while Uraeda is not running, with the server off or the
machine asleep, is missed, and nothing makes it up: the job waits for its next time, and a restart
starts no job for a time already past. A time counts as missed once it is more than 5 minutes past
when the server sees it. A job added, edited, or turned on just after its time waits for the next
one too, and so do the times that pass while it is paused or "Run scheduled jobs" is off.

**A skipped time.** A time is skipped, and shows in the history, while the job's last run in that
repository still works, or waits for a wakeup its agent set, "Skipped: its last run still works.",
or while a change one of its runs started there is still open, "Skipped: the change “<title>” is
still open.", naming the open change by its own title. A skipped time is not made up either. Once
the change is merged or dropped, the next time runs. A time whose run could not start, a model the
agent no longer lists for instance, is recorded once and not tried again: the history says "Could
not start: <why>", and so does the card's "Last run" while that is the job's newest run, so you see
it without opening the page. The next time tries again. A start that the server's stop cuts records
nothing, and a "Run now" that cannot start is refused under the card and records nothing.

**The change a run starts.** When a run's last word is an offer of a change, Uraeda starts that
change as the offer's card does, with its proposal, its branch, and its worktree. The session moves
into it, says "The job “<job>” started the change “<title>”.", and goes on to a pull request that
waits for you: scheduling the job is your yes in advance. A run that offers nothing, because there
was nothing to do, makes no commit, branch, or worktree. An offer that is not the run's last word,
as one followed by more text, a feature, one indented or inside a list or a quote, or one in a
session you wrote in, starts nothing, and its card waits for you. A turn that ends on an offer while
a wakeup its agent set is pending is not the run's last word either: the turn the wakeup starts is
read as any turn's end is. An offer waits for you too when its job has a problem other than its
schedule by the time its run ends, and when the job no longer runs in that repository, because you
turned the Jobs extension off there, took the repository out of the job, or removed it from Uraeda's
list: each takes your yes back. A schedule mistyped meanwhile, or in a job you ran by hand, does
not. When the change cannot start, because its folder's name is taken for instance, the session asks
for you under the banner "The change could not start by itself.", with the reason, until you dismiss
it or start the change from the card. Every run is told to change no file, as it works in the main
checkout where your uncommitted edits are. A job that is "Report only" starts no change: the offer's
card waits in the session. A change merges only when you merge it, either way.

**Run now.** "Run now", or `r`, starts a run at once and opens its session. It tests the job as it
runs: it starts the change its run offers, unless the job is report only. It ignores the pause, "Run
scheduled jobs", and an open change, and a schedule that is not understood. It is refused while the
job's run works in that repository, "“<name>” still runs here.", for a job that has no prompt or
another problem apart from its schedule, and where the Jobs extension is off: "“<name>” does not run
in <repository>.", as for a repository the job does not name.

## The data folder

Sessions are kept in `sessions.sqlite`, in `URAEDA_DATA_DIR` or your system's data folder,
`~/.local/share/uraeda-next/` on Linux, and each feature's own run options in `run-options.json`
beside it: a store that cannot be read never takes the features' options with it. The list of
repositories, `repositories.json`, and the access key's hash with the paired devices,
`sign-in.json`, are there too. A running server keeps the files that only live while it runs, like
its host token and its previews' records, in `run/`, and Codex's catalogs without sub-agents, in
`codex-catalog/`. `ura add`, `ura pair`, `ura key`, and `ura extension` read the same folder: set
`URAEDA_DATA_DIR` for them too, or give `--data-dir`, when the server has one of its own.

The folder is named `uraeda-next` because the earlier web UI, `@uraeda/ui`, kept its files in
`uraeda`. The server never writes there, and refuses to start on a folder that holds that UI's
`runner.sqlite`: `ura import-sessions` copies its sessions, once, as
[INSTALL.md](../INSTALL.md#coming-from-the-web-ui-uraedaui) says.

The record of the jobs' runs is in `sessions.sqlite` too, the table `job_runs`: one row for each
time a job was due in a repository, or was run by hand: started, skipped, or failed to start, with
why, and with the session it started. It keeps the 50 latest rows of each job and repository, and
besides them the latest started run that has a session and every started run whose session belongs
to a change or a feature, for as long as that session is kept, which the schedule's open-change
check reads, and the latest start that failed, until a run starts after it. It is a cache: a
`sessions.sqlite` that cannot be read starts empty, and the history is lost, with no job's table in
`config.toml` touched.
