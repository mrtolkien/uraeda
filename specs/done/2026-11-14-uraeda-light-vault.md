---
kind: feature
finished: 2026-11-14
pull-request: https://github.com/mrtolkien/uraeda/pull/125
---

# Record: Uraeda light, step 2: the vault and its sync

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-11-14, finished on
> 2026-11-14, in [its pull request](https://github.com/mrtolkien/uraeda/pull/125). Its full files
> are in git: `git log -- specs/2026-11-14-uraeda-light-vault/`.
>
> The four "Uraeda light" steps share one branch and one pull request. The other three records are
> [2026-11-14-uraeda-light-workflow](2026-11-14-uraeda-light-workflow.md),
> [2026-11-14-uraeda-light-serve](2026-11-14-uraeda-light-serve.md), and
> [2026-11-14-uraeda-light-removal](2026-11-14-uraeda-light-removal.md).

## What and why

`ura` keeps one Obsidian vault for every repository, in a folder of its own, and syncs it with
Obsidian on the human's phone. On the desktop, Obsidian opens that folder as it is. The notes change
daily, from a phone, so they stay out of git: nothing in git depends on them, and without them an
agent says in its last message what it would have written. The sync is free: `ura serve` on the
desktop and a small plugin on the phone, over Tailscale. The human did not want one `inbox.md` per
project piling up, so there is one shared `inbox/`, a note per capture. The human works in a chat
session: there was no spec and no plan, and the proposal is the human's words.

## Behaviour

- **One vault, one place.** It is `Uraeda` in Uraeda's data folder, or the folder `[vault] path` of
  `config.toml` names, with `~/` read as the home folder. Its folder's name is its name in
  `obsidian://` links. `ura serve` makes its folders at start and before a plan, and
  `ura vault write` makes them too. A folder is never removed: one the human emptied stays. The
  layout is `inbox/`, `wiki/` with `libraries`, `apps`, `standards`, `topics`, and `gotchas`,
  `projects/<repository>/` with `proposals/` and `research/`, and the human's own folders. The
  human's existing vault was left alone: `~/Documents/Vaulki` is never read or written, and the
  human moves folders into the new one by hand.
- **The repositories' workflow files show in the vault, to read.** `projects/<repository>/specs/`
  holds links to the main checkout's `CONSTITUTION.md` and `decisions/`, and to the folder of every
  feature or change in progress, from the worktree that holds it. A link is made, moved, or removed
  as worktrees come and go, and only links are: a real file or folder of `specs/` is never touched.
  A repository no longer in the settings loses its links, and keeps its notes. A folder whose record
  is written, or that the default branch holds, is not linked. A repository is named by its folder's
  name, numbered when two share one.
- **Writes and deletions never go through a link; reads do.** `ura vault write` and `rm`, and the
  phone's `PUT` and `DELETE`, refuse a path with a link in it: a link leads to a repository's files,
  or out of the vault. Reads and listings follow links.
- **The phone starts from a zip.** The page "Obsidian setup" of `ura serve` offers `Uraeda.zip`: the
  plugin, already on, with the address the page was opened at and its token, and a note. The human
  unzips it in Files, moves the folder into On My iPhone › Obsidian, opens it, and trusts the
  plugin. The first sync brings the rest. The page warns when it is open at the computer's own
  address, because the zip would carry that address. The same page sets the vault's place.
- **What the phone writes: everything but git's files.** New notes and edits anywhere in the vault,
  except `projects/<repository>/specs/` and the plugin's files, which the desktop alone writes. An
  edit of a git file on the phone is kept as a note in `inbox/`, named
  `name (phone edit 2026-11-14 1630).md`, and the file comes back as git has it.
- **What the phone receives: the whole vault**, the specs in progress included. Hidden files never
  travel: each device keeps its own `.obsidian/`, save the plugin's `main.js` and `manifest.json`,
  which travel from the desktop only. A vault of `uraeda`'s own notes and specs is some 0.4 MB, and
  each feature in progress adds about 1.3 MB.
- **When it syncs.** As Obsidian opens, as it comes back to the foreground, 5 seconds after an edit,
  and every minute while it is open. The ⟳ button syncs at once. iOS pauses Obsidian when it leaves
  the screen: nothing syncs while it is closed. The plugin's settings say how the last sync went,
  and a failure shows a notice with its reason.
- **Conflicts keep both versions.** A note changed on both sides keeps the desktop's under its name,
  and the phone's beside it as `name (conflict phone 2026-11-14 1630).md`, on both sides. The time
  is the phone's local time.
- **A deletion travels, into the trash.** A file deleted on one side and unchanged on the other is
  moved to `.trash/` on the other side. Deleted on one side and changed on the other, the change
  wins and the file comes back. A rename is a deletion and a new file.
- **A phone of another vault merges, and deletes nothing.** The vault has an identity, and a phone
  that last synced with another folder, or with this one before it was emptied, plans as if it had
  never synced.
- **The plugin links to the pages.** A ribbon button opens what waits on the human on `ura serve`.
  On a round, a spec, or a plan whose `status` is `awaiting-human`, a button opens its page: "Answer
  on ura serve" or "Review on ura serve". On the desktop the plugin syncs nothing and only shows
  these buttons.
- **The pages link to the vault.** Each card of what waits has "Open in Obsidian", an
  `obsidian://open?vault=…&file=…` link to its file, and the page lists each repository's board.
- **A board per project.** `projects/<repository>/Board.base` is an Obsidian base of the project's
  proposals, a kanban with a column per `status` (`now`, `next`, `later`, `idea`, `started`,
  `postponed`, `done`) and cards sorted by `rank`. It is made once and is the human's afterwards.
- **`ura vault` is for agents.**
  - `ls [folder]` lists folders, then notes with their `description`, never hidden names.
  - `read` prints a note.
  - `write` takes the note on standard input, or `--set name=value` sets one frontmatter field and
    leaves the rest byte for byte.
  - `rm` moves a note to `.trash/`.
  - `check` reports wikilinks to no note and wiki notes without a `description`, and fails when it
    finds one.
  - Every path is from the vault's folder, and `ura vault` never touches git. The commands are
    documented in [`docs/cli.md`](../../docs/cli.md#ura-vault).

Rules a later feature keeps:

- **The desktop decides every sync.** The plugin lists its files, asks for a plan, and carries it
  out. A new rule goes in [`plan.rs`](../../crates/vault/src/plan.rs), where `cargo` tests it, never
  in the plugin, which has no test.
- **A write names what it replaces.** A `PUT` or a `DELETE` of the sync carries the hash the phone
  expects the desktop's file to have, and gets `409` when it has changed: the next plan keeps both.
  A deletion without `expect` is refused.
- **Paths are the vault's.** Every path of the sync is cleaned by
  [`paths::clean`](../../crates/vault/src/paths.rs): no `..`, no absolute path, no backslash. What
  travels, what is read only, and what is writable are the three functions of that file.
- **A file is written whole or not at all.**
  [`notes::write_atomic`](../../crates/vault/src/notes.rs) writes a hidden file beside the target
  and renames it over it, and hidden files do not travel, so a half-written file is never planned.
- **The workflow never needs any of this.** A repository with no vault works as before.

## Design

The vault's logic is one crate, `crates/vault`, used by `ura serve` and by the CLI, so the sync and
the agents' commands read and write notes by the same rules. The sync is three-way: the desktop's
files, the phone's, and the phone's record of both at its last sync, its base, each file a path and
a SHA-256. The desktop turns the three lists into a plan of actions, and the phone carries them out
and records each file's new hash when its action is done. The spike's sync was naive, with no
deletions and plain writes; this one decides in Rust, so every combination is a unit test.

- The place, from `[vault] path`, kept with the rest of the file when the setting page writes it:
  [`config.rs`](../../crates/vault/src/config.rs).
- The layout and the board's text: [`layout.rs`](../../crates/vault/src/layout.rs). What travels,
  what is read only, and what is writable: [`paths.rs`](../../crates/vault/src/paths.rs).
- The links, which read git with gix and never run it, and take what is in progress from
  `uraeda_core::workspace::in_progress`, the one rule `ura status` uses too:
  [`links.rs`](../../crates/vault/src/links.rs).
- Walking the vault through its links, each folder once, so a link that loops ends:
  [`walk.rs`](../../crates/vault/src/walk.rs).
- The hashed listing, which keeps a file's hash while its size and time of change stay the same, so
  a sync reads only what changed: [`manifest.rs`](../../crates/vault/src/manifest.rs).
- The plan, with its actions `pull`, `push`, `copy`, `trash`, `trash-remote`, and `forget`:
  [`plan.rs`](../../crates/vault/src/plan.rs), tested in
  [`plan_tests.rs`](../../crates/vault/src/plan_tests.rs).
- Notes for `ura vault` and the sync, with the `.trash/`, the field setter, and the refusal of a
  path behind a link: [`notes.rs`](../../crates/vault/src/notes.rs),
  [`check.rs`](../../crates/vault/src/check.rs), and the CLI in
  [`vault.rs`](../../crates/cli/src/vault.rs).
- The plugin, `plugin/main.js`, plain JavaScript with no bundler, embedded in the binary and written
  into the vault whenever it differs, with the starter zip and the vault's identity:
  [`plugin.rs`](../../crates/vault/src/plugin.rs) and
  [`main.js`](../../crates/vault/plugin/main.js).
- The routes of `ura serve`: `POST /{token}/vault/plan`, and `GET`, `PUT`, and `DELETE` of
  `/{token}/vault/file?path=&expect=`, in [`sync.rs`](../../crates/serve/src/sync.rs). The page of
  the notes, its zip, and its place form are in
  [`vault_page.rs`](../../crates/serve/src/vault_page.rs). The guard's rule for the plugin's writes
  is in [`guard.rs`](../../crates/serve/src/guard.rs).
- Tests: the plan's every case, the links against temporary repositories and worktrees, the routes
  and their guard, the starter zip and the place form, and the commands. The plugin was driven by
  hand in Obsidian 1.15 on a hidden display, in the app's mobile emulation, with a second vault
  standing in for the phone.
- The starter zip uses the `zip` crate, already in the lockfile for the updater of the native shell,
  so nothing new was downloaded.

## Gotchas

- **The plugin's requests carry no `Origin`**, which the guard needs for any write. Measured on the
  human's iPhone: `requestUrl` sends `Obsidian/404 CFNetwork`, with neither `Origin` nor
  `Sec-Fetch-Site`. So a write under `/{token}/vault/` may carry the token in
  `Authorization: Bearer` instead, which a page of another site cannot send without CORS, and
  `ura serve` allows none. The exemption is any `POST`, `PUT`, or `DELETE` under `/vault/`, so a
  later route there inherits it. A test checks that the bearer opens no other route. See
  [`guard.rs`](../../crates/serve/src/guard.rs).
- **A symlink to a folder is followed live; one to a single file is not watched.** Measured on
  Obsidian 1.15: links to folders, made or removed while it runs, are listed and watched, and writes
  go through them. A linked file shows its current content when opened, and only Obsidian's search
  lags behind a change. So the constitution, a single file, is acceptable as a link. Links to code
  are dead in the vault. See [`links.rs`](../../crates/vault/src/links.rs).
- **What is in progress cannot come from branch names.** The first version read core's feature
  detection, which missed this branch's folders because `uraeda-light` matches none of their names.
  A fix that ignored branch names linked an old change committed on `main`, which every branch
  inherits: 648 files and 22 MB. The rule is now core's one rule: a folder counts when its worktree
  is on a branch of its own and the default branch lacks the folder and its record. See
  [`in_progress.rs`](../../crates/core/src/workspace/in_progress.rs).
- **`Board.base` is written as Obsidian writes it back.** Opened on the phone, Obsidian 1.15 rewrote
  `note.status` and `note.rank` as `status` and `rank`, and the rewrite synced to the desktop as a
  change. The board's text now uses the short names, and opening it changes nothing. Its `groupBy`
  is `{property, direction}`, read from Obsidian's own code. The board is written only when missing,
  so a later change to [`board_text`](../../crates/vault/src/layout.rs) does not reach an existing
  vault.
- **The vault needs an identity, or moving it wipes the phone.** Without one, a phone whose base
  names notes that the new folder lacks reads each as deleted, and trashes them all. The identity is
  a hash in `.obsidian/uraeda-vault-id`, hidden and never synced. A phone that sends another one
  plans with an empty base: both sides merge. See [`plugin.rs`](../../crates/vault/src/plugin.rs)
  and [`sync.rs`](../../crates/serve/src/sync.rs).
- **Empty folders are not files, so the plan lists them.** Without `folders` in the plan's answer,
  an empty `inbox/` never reached the phone, which had nowhere to write a first note.
- **A large vault needed three changes.** The plan route's body limit is 64 MB, because the default
  2 MB cannot hold the paths and hashes of some 10,000 files. The plan reads its body whatever the
  `Content-Type` says. The phone fetches six files at a time: one request per file took 17.7 s for a
  first sync of 5,249 files and 220 MB against the desktop, and 12.1 s with six at once. An empty
  sync and a sync of one edit took 0.33 s and 0.34 s across 5,252 files, because both sides keep
  hashes by size and time of change. The plugin writes its record, a line per file, only when a sync
  changed something.
- **A sync's own writes would start the next sync.** The plugin ignores file events for 2 seconds
  after a sync, and runs one sync at a time: one asked during another runs after it.
- **A repository's files are the desktop's, even in a conflict.** The phone's edit of a git file, or
  its new file in `specs/`, is copied to `inbox/` and the file is pulled again. A file the phone
  cannot write, such as one behind a link of the owner's own, is refused with `403` at every sync,
  and shows as "to retry" in the plugin's report.
- **The plugin's files travel from the desktop only.** A phone's change to its own `main.js` is
  overwritten. When a sync brings a new version, the plugin disables and enables itself. That was
  measured on the desktop's stand-in only. `data.json`, which holds the address with the token and
  whether to sync, never travels, and the starter zip's carries `sync: true`.
- **`plugin::install` turns the plugin on only in a vault with no list of plugins.** A human's vault
  that already has `community-plugins.json` must enable "Uraeda" itself, on the desktop too.
- **The `obsidian://` links were opened through Obsidian's own handler.** A second launch of
  Obsidian on the hidden display hung, so the check called the window's link handler with the parsed
  parameters. Both a spec file and the board opened. Tapping one on a phone was not tried.
- **What a plan does with `.trash/`.** It is hidden, so it never travels: a deletion lands in the
  trash of the side that received it, and there is no backup of the vault, by the human's choice.
- **What was never verified on iOS.** Verified on the human's iPhone: Files keeps the hidden
  `.obsidian` of an unpacked vault, Obsidian asks once to trust the plugin and loads it, the plugin
  reaches the tailnet address, and the starter vault of the real build syncs, opens the board, and
  sends a note written on the phone (`Ping.md`, at the root) to the desktop. Not verified there: the
  time of a first sync of a large vault over the tailnet, a sync as Obsidian comes back after iOS
  paused it, conflicts, deletions, renames, the plugin's reload, the `obsidian://` links and the
  page buttons through `window.open`, and the two late fixes below. The human's trial vault was a
  few dozen files.

## Questions

### Round 01

#### Q1: What may the phone write through the sync?

**Answer:** "Everything but specs": new notes and edits anywhere, except `projects/*/specs/`, which
is git's and read only. The human's other options were new notes only, and inbox and proposals only.

#### Q2: What should a deletion or a rename do across the sync?

**Answer:** "Travels, kept in trash": a deletion on either side is applied on the other, into
`.trash/`, the edit wins when the other side changed the file, and a rename is a deletion plus a new
file.

#### Q3: How should your existing vault, `~/Documents/Vaulki`, relate to the new one?

**Answer:** "New vault, move by hand": `ura` starts an empty vault of its own, never reads Vaulki,
and the human moves folders like `inspiration/` or `docs/` in themselves.

#### Q4: Can I publish a tiny test vault on the tailnet so you can check early on your iPhone?

**Answer:** Yes, now. A test vault with a plugin that only shows a notice and calls the tailnet
address, on port 8447, tailnet only. It passed, and it showed that the plugin's requests carry no
`Origin`.

### Round 02

#### Q1: Do you approve the vault and sync design I posted?

**Answer:** The human first sent the test's result, `plugin loaded: yes`, `iOS app: true`,
`tailnet request: 200 pong`. Asked again once the agent had read the result, they chose "Approve,
start building". The design put the vault in Uraeda's data folder, decided the sync in Rust, kept
the plugin to syncing and linking, and listed 10 tasks.

### Round 03

#### Q1: May I publish a trial `ura serve` on your tailnet, on port 8447?

**Answer:** Yes, on 8447. The step 1 demo on 8446 stayed as it was.

#### Q2: Which vault should the trial sync?

**Answer:** "Throwaway, seeded": a temporary vault of the skill's example notes, with links to
uraeda's constitution, decisions, and features in progress. Nothing of the human's was written.

### Round 04

#### Q1: Try it on your iPhone: how did it go?

**Answer:** "All worked but add some spacing between buttons, and call the button “Obsidian setup”
or stg". The home page's buttons got spacing, and the page is called "Obsidian setup".

#### Notes

- After the trial the human wrote "I created a note": `Ping.md` had reached the desktop.
- Asked to stop the trial, the human wrote "Stop the demos, both", and both were taken down.

## Changes after approval

- **The vault has its own page.** The design put the vault's place in the settings page, which was
  near its line limit: "Obsidian setup" holds the place form, the starter zip, and the steps, and
  home and settings link to it.
- **The vault has an identity**, added when moving the vault would otherwise have wiped the phone's
  notes. See Gotchas.
- **What is in progress** is every dated folder of every worktree on a branch of its own, not the
  default branch's. The design took it from core's detection, which missed this branch.
- **`ura vault rm` moves a note to `.trash/`**, where the skill's `cli.md` said it deletes. The
  skill's reference and `docs/cli.md` now say so.
- **A phone's edit of git's files lands in `inbox/`**, as the design said, not beside the file as
  the answer to the first question described.
- **The phone's trial asked for two fixes**: the home page's buttons are spaced, and the page is
  named "Obsidian setup". The board is written as Obsidian writes it back.
- **Two fixes after a review.** A write or a deletion, `ura vault write` and `rm` and the phone's
  `PUT` and `DELETE`, never goes through a link of the vault, while reads follow links: before, a
  link inside `inbox/` led a write out of the vault or into a repository. And the phone's plugin
  checks that its file is still the one the plan was made from before a pull or a deletion, so an
  edit made during a sync is never written over or trashed. After a push it records the hash of what
  it sent, which an edit since the plan can make differ from the plan's. A file that fails is
  retried by the next sync, and stops no other file. The first fix is tested by cargo. The second
  has no test, as the plugin has none, and was not driven on a phone.

## Follow-ups

- The human tries a first sync of a large vault from the phone over the tailnet, and a sync as
  Obsidian comes back to the screen. Both were only measured on the desktop.
- `ura` and the vault do not back up the notes, by the human's choice.
- The human's own notes move into the vault by hand, when they like.
- The trial's throwaway vault is in the spike's research folder, outside the repository, and was
  left for the human to delete.
