---
kind: feature
finished: 2026-11-14
pull-request: https://github.com/mrtolkien/uraeda/pull/125
supersedes:
  - 2026-10-11-web-ui
  - 2026-10-12-claude-code-runner-triggered-manually-https-code
  - 2026-10-12-ui-improvements
  - 2026-10-13-chat-in-the-web-ui
  - 2026-10-13-image-attachments
  - 2026-10-14-run-ui
  - 2026-10-14-session-view
  - 2026-10-14-text-inputs
  - 2026-10-15-add-scratchpad
  - 2026-10-15-claude-usage
  - 2026-10-16-redesign-interface
  - 2026-10-16-redesign-priorities
  - 2026-10-16-storybook-warmup
  - 2026-10-17-access-storybook
  - 2026-10-17-storybook-restart
  - 2026-10-18-priorities-decisions-fixes
  - 2026-10-18-redesign-feature
  - 2026-10-18-start-draft-folder
  - 2026-10-18-storybook-fixes
  - 2026-10-19-redesign-session
  - 2026-10-19-right-bar
  - 2026-10-20-ctrl-enter
  - 2026-10-20-inbox-images
  - 2026-10-20-layout-look
  - 2026-10-20-merge-chats
  - 2026-10-20-session-transcript
  - 2026-10-25-feature-page
  - 2026-10-25-inbox-priorities
  - 2026-10-25-session-new
  - 2026-10-26-leader-key
  - 2026-10-29-amend-latest
  - 2026-10-29-help-keybindings
  - 2026-10-29-performance-pass
  - 2026-10-30-commits-shouldn
  - 2026-10-30-feature-state
  - 2026-10-30-panes-size
  - 2026-10-30-phone-bottom
  - 2026-10-30-proposal-start
  - 2026-10-30-release-binding
  - 2026-11-01-files-changed
  - 2026-11-01-nothing-bar
  - 2026-11-01-stable-buttons
  - 2026-11-01-text-focus
  - 2026-11-03-vim-text
  - 2026-11-03-worker-lifecycle
  - 2026-11-04-basic-git
  - 2026-11-04-reading-long
  - 2026-11-04-vim-mode
  - 2026-11-05-code-editor
  - 2026-11-07-color-themes
  - 2026-11-07-drag-handles
  - 2026-11-07-git-changes
  - 2026-11-07-global-undo
  - 2026-11-07-keyboard-nav
  - 2026-11-07-storybook-previews
  - 2026-11-08-codex-runtime
  - 2026-11-08-extensions-system
  - 2026-11-08-postpone-proposal
  - 2026-11-08-pressing-enter
  - 2026-11-08-triage
  - 2026-11-09-all-pages
  - 2026-11-09-postpone-feature
  - 2026-11-09-when-there
  - 2026-11-10-multi-accounts
  - 2026-11-10-nsh-migration
  - 2026-11-10-scheduled-jobs
---

# Record: Uraeda light, step 3: remove what `ura` no longer does

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-11-14, finished on
> 2026-11-14, in [its pull request](https://github.com/mrtolkien/uraeda/pull/125). Its full files
> are in git: `git log -- specs/2026-11-14-uraeda-light-removal/`.
>
> The four "Uraeda light" steps share one branch and one pull request. The other three records are
> [the workflow](2026-11-14-uraeda-light-workflow.md),
> [the pages of `ura serve`](2026-11-14-uraeda-light-serve.md), and
> [the vault](2026-11-14-uraeda-light-vault.md). The feature's folder holds only its proposal: the
> human worked in a chat session, with no clarifications, spec, or plan file, so the rounds below
> come from that session.

## What and why

Steps 0 to 2 of Uraeda light moved the workflow into the skill, the pages into `ura serve`, and the
human's notes into a vault. Step 3 removes everything those steps made useless: the server that ran
and showed agent sessions, the Linux, web, and iOS apps, the protocol, extensions, the Vim layer,
text editing, the language server, and what only they used. What stays is a small `ura`: it parses,
checks, says the next step, records answers and reviews, reads git, serves the pages, and syncs the
vault. The owner is the only user and the project is very early, so nothing was kept for
compatibility, and "I want a clean codebase" settled each doubt toward removal.

## Behaviour

- **`ura` has one set of commands.** `init`, `install`, `upgrade`, `check` with `--fix`, `next`,
  `status`, `answer`, `review`, `serve`, `vault`, and `usage`, plus a hidden `sandbox`. The commands
  of the old server and workflow, `start`, `clean`, `note`, `inbox`, `expand`, `add`, `extension`,
  `lsp`, `pair`, `key`, `import-sessions`, `serve-app`, and `fake-storybook`, do not exist.
- **`ura` never commits, switches a checkout, or makes a worktree.** `ura answer` and `ura review`
  write in the worktree that holds the feature's branch, and refuse, before writing, when none does.
  `--no-commit` went with every commit and switch of the core. The next agent step commits what
  `ura` wrote.
- **One rule says what is in progress, in the core and in the vault.** A feature or a change is in
  progress where a worktree on a branch of its own holds its dated folder, or its record when its
  own finish wrote one. The branch's name does not matter. A branch with no worktree is postponed
  and holds nothing in progress. A folder the default branch holds too is merged.
- **`ura next` knows the final workflow's table.** It takes the first feature waiting on an agent.
  It prints the step's pick and whether the step joins the previous session or starts a new one,
  from the settings. It says to commit the human's uncommitted answers or review first, then names
  the step after.
- **`ura status` lists the work in progress, then merged features with a worktree or branch left.**
  It also lists each proposal note in the vault still `started` whose feature is merged, with the
  `ura vault write` command that sets it `done`.
- **`ura check` reports what the workflow no longer keeps in git.** `PRIORITIES.md`, `INBOX.md`,
  `INBOX-TRIAGE.md`, `specs/proposals/`, `specs/notes/`, and a review's `findings-NN.md` are each an
  error, `layout.removed`, that says where the content lives now. A record's link to a file deleted
  since is history and never reported.
- **`ura vault rm` moves a note to the vault's `.trash/`**, as Obsidian does. The skill and the code
  agree.
- **`ura serve` is on port 4310 again, and its data folder is `uraeda`.** Both were `4320` and
  `uraeda-next` only while the old server held `4310` and `uraeda`.
- **The settings file holds three tables.** `[runs]`, the picks of each step, read by the core.
  `[serve]` and `[vault]`, read by their crates. `[usage]` is read by `ura usage`. A key `ura` does
  not read is ignored, and a save from the settings page keeps it as it was.
- **`ura usage` prints the usage windows as JSON, for the owner's own use.** The skill and its
  `cli.md` do not name it, by the owner's decision. `ura --help` and
  [`docs/cli.md`](../../docs/cli.md) do.
- **The last full release is `v2.1.0`**, "Last of the full Uraeda". The code of everything removed
  is read with `git show v2.1.0:<path>`, or in a checkout of that tag.

Rules a later feature must keep:

- **`ura` writes files, and an agent commits them.** Nothing in Uraeda's own code commits, branches,
  makes a worktree, switches a checkout, fetches, or pushes. The [git decision](../decisions/git.md)
  says it, and the core has no function left for it.
- **What is in progress has one definition**,
  [`in_progress`](../../crates/core/src/workspace/in_progress.rs). A crate that needs to know asks
  it, and never reads a branch's name.
- **The settings file is read and written by the code of one place.** The core's
  [`settings`](../../crates/core/src/settings.rs) writes `[runs]` and keeps comments, order, and
  unknown keys. The [settings decision](../decisions/settings.md) says it.
- **The skill names every command of `ura`, except `usage`.** The test that checks it,
  [`skill.rs`](../../crates/cli/tests/skill.rs), exempts `usage` with a comment saying so.
- **A test or a run never reads the person's folders.** Every test recipe goes through
  [`isolated.sh`](../../scripts/isolated.sh), and the CLI's tests point `ura` at a config folder of
  their own.

## Design

The removal ran as 27 commits on the branch of Uraeda light, each leaving the workspace building,
except one pair named in the gotchas. The dependency map came first: what each thing that stays
uses. It showed that `uraeda-text` stays, and that the server, the app, the protocol, the compile
crate, and the Vim crate reference each other too much to leave one at a time. They went in one
commit, with the CLI commands and the tooling that used them.

|                            | `v2.1.0` | HEAD                            |
| -------------------------- | -------- | ------------------------------- |
| Tracked files              | 3,291    | 1,109                           |
| Rust lines                 | 192,000  | 45,000                          |
| TS and TSX lines           | 74,000   | 0                               |
| Crates                     | 10       | 6 (`serve` and `vault` are new) |
| `Cargo.lock` packages      | 958      | 417                             |
| Core lines, tests included | 79,600   | 25,200                          |

A clean release build took 7 min 50 s and gave a 57.6 MB `ura` before the first cut. After the main
cuts it took 3 min 39 s and gave 18.8 MB. Later cuts shrank both further, unmeasured.

The crates now are:

- [`core`](../../crates/core/src/lib.rs): parsing, checks, steps, the next step, answers, reviews,
  the settings, and a read of git with gix.
- [`text`](../../crates/text/src/lib.rs): a Markdown text's document tree, links, and the patch
  between two texts.
- [`serve`](../../crates/serve/src/lib.rs): the pages, the sync's desktop side, and `ura usage`.
- [`vault`](../../crates/vault/src/lib.rs): the notes, their links to the specs, and the sync's
  plan.
- [`cli`](../../crates/cli/src/main.rs): the `ura` binary.
- [`xtask`](../../crates/xtask/src/main.rs): the start of a release, and the toolchain's tests.

The cuts, in order:

1. The tests red since step 0 were fixed first, so every later commit started green.
2. `ura sandbox` moved out of the server into [the CLI](../../crates/cli/src/sandbox.rs). It builds
   sample projects from [`fixtures/`](../../fixtures), puts each sample branch in a worktree, and
   runs `ura serve` over them on port 4420, with a `gh` that lists the sample's pull requests.
3. The server, `app/`, the protocol, compile, app, Vim, and language server crates, the commands of
   the old server and workflow, the fixtures only they read, and the tooling that built them: the
   `justfile`'s app and web recipes, the scripts, the flake's Native Shell, GTK, WebKit, GStreamer,
   and Chromium parts, and the CI and release jobs for the app.
4. The core's modules nothing kept used, in two commits: the inbox, the priorities, the triage,
   deferred commits, the read cache, the app's views, then what the compiler's dead-code warnings
   named, and every public function without a caller in another crate.
5. `ura` brought to the final workflow: the one in-progress rule, `ura answer` and `ura review`
   without a commit, the table's new rows in `next`, `status`, and `check`, and `cli.md`.
6. The human's notes left git, then every page was rewritten: the README, `INSTALL.md`,
   `CONTRIBUTING.md`, [`docs/`](../../docs/cli.md), the guides, [`AGENTS.md`](../../AGENTS.md), and
   the decisions.
7. After the owner read it: the port, the settings keys, the data folder, and `ura usage`.

`ura usage` lives in [`crates/serve/src/usage.rs`](../../crates/serve/src/usage.rs), beside the code
that starts `claude` and `codex` as short processes to list their models, which it reuses.
[`crates/cli/src/usage.rs`](../../crates/cli/src/usage.rs) is the command.

- **Claude Code**: each folder of `[usage] claude` is an account. A short `claude -p` in
  `stream-json` mode, with `--no-session-persistence`, answers the `get_usage` control request with
  `rate_limits.five_hour` and `rate_limits.seven_day`. It spends no usage.
- **Codex**: a short `codex app-server`, after `initialize` and `initialized`, answers
  `account/rateLimits/read` with `primary` and `secondary` windows.
- Every account and Codex are asked at once, with 15 seconds of patience each.
- The JSON has `claude`, a list in the settings' order, and `codex`. Each has `five_hour` and
  `week`, with `used` in percent and `resets_at` in RFC 3339, or null while the window is not open.
  An account that cannot be read has a `problem` in place of its windows, and never fails the
  others. An account's `name` is its folder's name without its dot and `claude-`: `work` for
  `~/.claude-work`, `default` for `~/.claude`.

```toml
[usage]
claude = ["~/.claude", "~/.claude-work"]
```

## Replaced behaviour

What went, with its guards. The tests went with it, in groups:

- **The server that ran agent sessions and chats.** Sessions, turns, resuming, permissions, the
  account picker, scheduled jobs, the Codex runtime, and the worker that kept runs alive across a
  restart. The server's tests went whole: its sessions, features, and browser groups, and its
  support code.
- **The apps and their protocol.** The Linux app, the web build, the iOS app, the one WebSocket
  protocol, device pairing and sign-in by key, and the extension pages signed by the server. The
  app's tests and the protocol's went with their crates.
- **Everything an app page did that `ura serve` does not.** The sidebar and the feature page, the
  inbox and priorities pages, the git page, the changes panel, the session page and its composer,
  themes, undo, the leader key and every keyboard shortcut, and the Storybook that the app ran and
  warmed up. Their tests went with the app.
- **Extensions.** The QuickJS runtime, the signing, the pages built into NSH packages, and
  `ura extension`. Its core and CLI tests went.
- **The Vim layer, text editing, and the language server.** `ura lsp` and the Vim crate's tests
  went.
- **The commands of the old workflow.** `ura start`, `clean`, `note`, `inbox`, `expand`, and `add`.
  One CLI test file went for each, with the one of `ura serve-app`.
- **The inbox, the priorities, the triage, and the deferred commits.** `PRIORITIES.md`, `INBOX.md`,
  `INBOX-TRIAGE.md`, their parsers, checks, and moves, `specs/proposals/` and `specs/notes/` as
  workflow places, and the commits and amends that kept their noise out of `git log`. The core tests
  of priorities, inbox, triage, deferred, jobs, and drop went.
- **The git page's reads and writes.** Checkout, staging, conflict resolution, the log, commit
  messages, and later fetch, pull, and push, with the streaming of a process's output that only they
  used. The core's `git_*` tests went.
- **Settings the new `ura` does not read.** `[server]`, `[keyboard]`, the old agent runner's
  `[runs]` keys, the `build_in_fresh_session` migration, and the per-feature merge of run options.
  Their tests went, and the others use neutral key names for "other keys a write keeps".
- **The core's image encoder and short-slug helper.** Neither had a caller left once the app went.
  `gif`, `image`, and `libwebp-sys` left `Cargo.lock`, and axum lost its `multipart` and `ws`
  features. The memory test for a crafted PNG went with the encoder.
- **Documents.** `docs/app.md`, `docs/extensions.md`, the app's decisions and guides, and the
  README's pictures. The README's new pictures show a round and a review on `ura serve`.

About 10,000 lines of the core's tests rested on fixtures that went. They were removed with the
fixtures, not moved, because each guarded a behaviour that no longer exists.

## Gotchas

- **The core's commit `a07829d9` does not build alone.** It holds only the deletions of the inbox,
  priorities, and triage, and `04c950c2` holds the edits that make the rest compile. Read them as
  one when bisecting, or when reverting one of them. History was not rewritten.
- **`skills/uraeda/assets/storybook/` is not removed.** `ura serve` embeds
  [`uraeda-pick.js`](../../skills/uraeda/assets/storybook/uraeda-pick.js) to pick an element in a
  mockup, in [`files.rs`](../../crates/serve/src/files.rs), and the skill's
  [`projects.md`](../../skills/uraeda/references/projects.md) still tells a user's Storybook to copy
  both scripts. The name is the only thing left of the app's Storybook.
- **`ura usage` removes `CLAUDE_CONFIG_DIR` for `~/.claude`.** A session started under another
  account carries that account's variable, and the child would report it as `default`. The folder
  Claude Code reads on its own is reached without the variable, and any other folder with it.
  [`usage.rs`](../../crates/serve/src/usage.rs) does so through the `None` of an environment pair.
- **`ura usage` finds Codex's windows by length, not by name.** `primary` is the five hours and
  `secondary` the week today, but the code reads `windowDurationMins`: 300 and 10,080. A signed-out
  Claude folder answers without a five-hour window, and is a `problem`, never an empty account.
- **The tests of `ura usage` read recorded answers.** A real run took 4.7 seconds for four accounts
  and Codex, and no test starts an agent.
- **The data folder's old content is not read.** The owner's 2.x data is kept aside in
  `~/.local/share/uraeda-2.x/`, the settings and the backup are in `~/Backups/uraeda-2026-11-14/`,
  and `ura` makes `~/.local/share/uraeda/` and its default vault at the first `ura serve`.
- **The sync with Obsidian needs the plugin trusted.** A fresh Obsidian stops at "Do you trust the
  author of this vault?". The check on the hidden display pressed "Trust" through Electron's
  DevTools port, because the dev shell has no click tool any more.
- **Records link files that are gone.** `specs/done/` still links the app's code and fixtures, and
  [`check`](../../crates/core/src/check/links.rs) accepts a record's dead link on purpose.
- **A record in `specs/done/` that this feature supersedes is not edited.** Its behaviour is gone,
  and `v2.1.0` holds it.

## Questions

### Round 01

#### Q1: Last release of the full Uraeda before the removal: which release, and who runs it?

**Answer:** "This is 3.0", read as no extra release. The owner changed it in round 02.

#### Q2: Backup of the server's data before cutting: where?

**Answer:** A plain copy, `cp -a`, of the data folders into `~/Backups/uraeda-2026-11-14/`.

#### Q3: What happens to your running `ura serve-app` on port 4310?

**Answer:** "You can kill it I don't even remember running it it must be another session." Nothing
was listening on 4310.

### Round 02

#### Q1: "This is 3.0": is it no extra release of the full Uraeda, and 3.0 for the light `ura`?

**Answer:** Not that: "Release main as the last full", as a 2.x release first, then the light `ura`
is 3.0.

#### Q2: What survives beyond pages, vault, and checks?

**Answer:** The benchmarks' suites and records, and a sandbox for `ura serve`. Not `ura usage`, and
not the skill's Storybook assets. The owner asked for `ura usage` later.

#### Q3: Distribution of the small `ura`: what stays?

**Answer:** cargo-dist, the installer, and Homebrew, for `ura` alone.

#### Q4: What do I do with the tailnet's `tailscale serve`, still pointed at port 4310?

**Answer:** Leave it, and decide at the end. It was left: `ura serve` is on 4310 again, so it works
without a change.

### Round 03

#### Q1: Final yes for the last full release, `just release 2.1.0`?

**Answer:** "Yes, release 2.1.0", named "Last of the full Uraeda". It was tagged `v2.1.0` and pushed
from a clean clone of `origin/main`.

### Round 04

#### Q1: Where do the 10 proposals of `specs/proposals/` go?

**Answer:** "All 10 to vault", then overruled by round 06: none of them moved.

#### Q2: Where do `PRIORITIES.md` and `INBOX.md` go?

**Answer:** One archive note each, then overruled by round 06: neither moved.

#### Q3: Where do the 4 agent notes of `specs/notes/` go?

**Answer:** Nowhere. They stay in git history.

#### Q4: Do the records of `specs/done/` for features this step removes stay?

**Answer:** They stay as they are, and `ura check` does not break on their links to removed files.

### Round 05

#### Q1: Approve the design and its order?

**Answer:** "Approved, go": one commit per task, checks after each, nothing pushed.

#### Q2: What happens to the 30 decisions, `specs/ui/`, and the guides that govern only the app?

**Answer:** "Remove app-only, and move the ui specs to the vault, I want to reread them and edit
them."

#### Q3: `SKILL.md` is 22,267 characters and a test caps it at 20,000. Fix how?

**Answer:** Trim `SKILL.md`, moving detail into the references, with the meaning unchanged.

#### Q4: `ura vault rm`: the skill says it deletes, the code moves to `.trash/`. Which wins?

**Answer:** Move to `.trash/`.

### Round 06

#### Q1: `ura`'s config names no vault, so where should the notes go?

**Answer:** "I just want specs/ui to be moved to Vaulki. Move it to the inbox. No need to move the
rest. The vault for uraeda will be another one, dedicated to it, in its default location." The 15
guides of `specs/ui/` were copied into the Vaulki inbox, and the proposals, the priorities, and the
inbox stayed in git history only.

### Round 07

#### Q1: What do I do with the 5 unfinished change folders left in `specs/changes/`?

**Answer:** Delete them: `coherence-pass`, `6-stories`, `reading-long`, `skill-ref`, and `vim-mode`
stay in git history and in `v2.1.0`.

### Round 08

#### Q1: The repositories list is in `config.toml`, not `repositories.json`. Which way?

**Answer:** Keep `config.toml` and rewrite the decision.

#### Q2: The file-length limit lived in `.oxlintrc.json`, now gone. Keep a Rust one?

**Answer:** Drop it: limits are `clippy.toml`'s alone.

#### Q3: How do I proceed with the drafts of `AGENTS.md` and the decisions?

**Answer:** Commit them as drafted, with the two choices above applied.

#### Q4: Add pictures of `ura serve`'s pages to the README?

**Answer:** Yes: the round and the review pages, at a phone's width, light and dark.

#### Notes

The owner's free messages after the last round, each a decision:

- "Why isn't ura serve 4310 by default? Why did we change? Also remove the old settings keys. I want
  a clean codebase." The port went back to 4310, and the settings keep only what `ura` reads.
- "Yes, name it properly", for renaming the data folder from `uraeda-next` to `uraeda`.
- `ura usage`: JSON on stdout, no table. The Claude accounts are a list in `config.toml`, not a scan
  of the home folder. Nothing about it in the skill.
- "Fix the old settings for the new format": the owner's `config.toml` was converted, with a copy
  kept in the backup.
- "Yes, remove both": the desktop app's `dev.uraeda.app` folder and the empty
  `~/.config/uraeda/extensions/`, both copied to the backup first.

## Decisions

- [Git](../decisions/git.md): tools never write git, and never lose the user's work.
- [Settings](../decisions/settings.md) and [run options](../decisions/run-options.md): one file, and
  the picks the pages edit and `ura next` prints.
- [Repositories](../decisions/repositories.md): the list stays in the settings file.
- [Distribution](../decisions/distribution.md), [stack](../decisions/stack.md), and
  [toolchain](../decisions/toolchain.md): `ura` alone, Rust alone, no Node.
- [CLI](../decisions/cli.md), [compatibility](../decisions/compatibility.md),
  [testing](../decisions/testing.md), [feature status](../decisions/feature-status.md),
  [diagrams](../decisions/diagrams.md), [benchmarks](../decisions/benchmarks.md), and
  [code quality](../decisions/code-quality.md): rewritten for the small `ura`.
- Removed with the app: the decisions on agents, attachments, colour themes, extensions, keyboard,
  notifications, performance, preview, protocol, run lifecycle, sandbox, sign-in, text editing, UI
  behaviour, UI components, and undo, and the guides on agent runs, mockups, and performance.

## Changes after approval

- The owner approved the design, then asked for `ura serve` on 4310 again, and for every settings
  key `ura` does not read to go. About 830 lines left with them.
- The data folder is `uraeda` again, the 2.x folders moved aside to `uraeda-2.x`.
- `ura usage` was added as its own commit, after the owner's list of what survives had left it out.
- A review found two things. `ura usage` reported a session's other account as `default`, and the
  core still held an image encoder and a short-slug helper that nothing called.
- The owner's `config.toml` was converted to the new format, and two leftover folders were removed.

## Follow-ups

- The sandbox's sample data is stale. Its sample decisions are the old app's, in
  [`fixtures/realistic/decisions/`](../../fixtures/realistic/decisions), and a few sample files have
  `ura check` problems. It is only sample content.
- `ura check` still runs the system `git`, for `git log` and `git status`, while the
  [git decision](../decisions/git.md) says tools read git without running it. No hook runs. Either
  the three calls move to gix, or the decision names the exception: see
  [`git/history.rs`](../../crates/core/src/git/history.rs),
  [`git/log.rs`](../../crates/core/src/git/log.rs), and
  [`git/status.rs`](../../crates/core/src/git/status.rs).
- The workspace version is still `2.1.0`. `just release 3.0.0` sets it, and refuses one already set.
- The owner's main checkout needs `git pull` and `git fetch --tags --force`: its local `v2.0.0` tag
  points at an older commit than GitHub's.
