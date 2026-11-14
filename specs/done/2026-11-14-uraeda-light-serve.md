---
kind: feature
finished: 2026-11-14
pull-request: https://github.com/mrtolkien/uraeda/pull/125
supersedes: [2026-10-30-reading-pass, 2026-11-08-run-options, 2026-11-09-spec-comments]
---

# Record: Uraeda light, step 1: the pages of `ura serve`

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-11-14, finished on
> 2026-11-14, in [its pull request](https://github.com/mrtolkien/uraeda/pull/125). Its full files
> are in git: `git log -- specs/2026-11-14-uraeda-light-serve/`.
>
> The four "Uraeda light" steps share one branch and one pull request. The records of the other
> three are [the workflow](2026-11-14-uraeda-light-workflow.md),
> [the vault](2026-11-14-uraeda-light-vault.md), and
> [the removal](2026-11-14-uraeda-light-removal.md). This one covers the pages, the guard, the
> settings page, the list of agents and models, and waking a session. The vault's sync and
> `ura usage`, which live in the same crate, are in the others.

## What and why

The human answers rounds and reviews specs from their phone, over their own network. `ura serve`
draws the pages for it from the `ura` binary alone: what waits on them, a round, a spec or a plan to
review, mockups in both, and, added while it was built, a settings page for how each step of the
workflow runs. The pages write files and never commit: the next agent step commits the human's work.
The workflow never needs them, since by hand the human edits the same files. The proposal had no
clarifications, spec, or plan: the human worked it in a chat session, and the answers are the rounds
below.

## Behaviour

- **What waits on the human.** The home page lists every file with `status: awaiting-human` that is
  a round's latest, a spec, or a plan, across the repositories of `[serve] repositories` (else the
  repository `ura serve` started in) and the worktrees they hold. Each card gives the feature's
  name, what is asked ("Questions, round 2", "Spec to review"), and the first line of the file's
  block. A repository with nothing waiting takes no place on the page, and one that cannot be read
  shows as a line. A feature without a worktree is not served: it is postponed.
- **A round.** One card per question: its text, an "Example" and a "Why it matters" box, each option
  with its letter, `+` and `−` lines, and a "★ Recommended" tag. Options combine, as checkboxes,
  only when the question says so. A follow-up shows when its parent's letter is picked, or when it
  already has an answer. "In your words" wins over the option, as the round's own text says. The
  answer is saved when it is chosen, and 700 ms after the human stops typing, or when the field
  loses focus. The "Settled without you" points take a comment each, and "Anything else?" takes the
  round's notes. A bar at the foot stays on screen, with "n of m answered", "Next question", which
  scrolls to the first open one, and, once every shown question is answered, "Send answers", which
  asks to confirm. Sending records the round answered. An answered round is drawn read only.
- **A review.** The spec or the plan, drawn, under a list of what changed since the human's last
  review: each part new, changed, or removed, its changed words inline, each a link that jumps to
  the part. A tap on a passage opens a comment on that block, a list item or a table row counting as
  a block of its own. A selection comments on the lines it covers. A comment on the whole file, and
  an edit or a removal of any comment, are there too. "Approve" and "Request changes" end the
  review, with an optional word for the agent. Request changes needs one comment.
- **Mockups.** A link in a round or a review to an HTML file under the feature's `specs/` folder
  gets a "See it" button, which draws the file in a frame in place, with "Pick an element", "Comment
  on it", and "Open alone". A comment on a pick starts with `Mockup <file>, <role> “<name>”: `, in
  the option's "In your words" field in a round, or the block's comment in a review. Other links to
  files of the repository open as pages: a markdown file drawn, anything else as it is.
- **Settings.** `/settings` draws the six steps in order (`discovery`, `spec`, `plan`, `build`,
  `review`, `comments`) as a track: one row each with the agent's mark, the model, and the effort as
  a meter, and between two steps a strip, "Same session" or "✂ New session", that a tap flips.
  Implementers sit under Build, reviewers under Review, each an agent or a command, with "Each wave"
  or "Branch only". A row opens one picker, a bottom sheet on a phone and a dialog at a desk: the
  agents, then that agent's models, then that model's efforts. A switch sets `[serve] wake`. Each
  change is saved at once into `[runs]` of `config.toml`, the rest of the file kept as it was.
- **Waking the session.** With `wake = "t3"`, a Send or a verdict tells the feature's T3 Code
  session to continue. The page then says "Your session was told to continue.", "No open session
  works on this feature: start one, or tell yours to continue.", or "Your session could not be told:
  tell it to continue yourself." Without it: "Tell your session to continue."

Rules a later feature keeps:

- **The pages write files and never commit, branch, or make a worktree.** The core's answer and
  review actions write the files and return what changed, and the pages drop it. Tests compare HEAD
  before and after each write.
- **A page reads without its script.** The server writes the HTML, one style sheet and one script
  are embedded, and nothing is fetched from outside: no font, no CDN, no remote image.
- **Every address starts with the token.** A wrong one is a 404, as any guessed address. The token
  is 32 random bytes in hex, kept in `serve-token` of the data folder, readable by its owner alone,
  so the address survives a restart. A page keeps it by relative links and never names it.
- **Every write must come from the page itself.** Its `Origin` has the request's `Host`, and a
  `Sec-Fetch-Site`, when sent, says `same-origin`. A `Host` that is not this machine's, or a name of
  `[serve] hosts`, is a 403 even with the token. It listens on 127.0.0.1 only: the phone reaches it
  through `tailscale serve`, never `funnel`, and the tailnet name goes in `hosts`.
- **A write is refused over what changed.** An answer, a note, and a settled comment carry what the
  page last read of them, a review's comment or verdict carries a hash of the file it drew, and the
  settings carry a hash of the settings file. A mismatch is a 409, nothing is saved, and the page
  offers to reload. One lock holds every write from its read to its write, and a page queues its own
  saves.
- **A page of a file shows what the file says.** The round and the review are drawn from the file's
  text, cut by line ranges, never from a second copy.
- **A waiting file is the human's only when the core says so.** A file marked `awaiting-human`
  before its agent's commit is still the agent's: the page of what waits lists a file only when the
  core's step for the feature is a human gate, as the
  [feature status](../decisions/feature-status.md) says.

## Design

`crates/serve/` (`uraeda-serve`) is an axum router over the core. A request is checked by the guard,
then a handler locates the feature fresh on a blocking thread, reads or writes through the core's
functions, and answers HTML or small JSON. The core gained one public function, `since_commit`
([`since.rs`](../../crates/core/src/api/since.rs)), for what changed since a review. The decisions
it follows: [settings](../decisions/settings.md), [repositories](../decisions/repositories.md),
[diagrams](../decisions/diagrams.md), [git](../decisions/git.md), and
[distribution](../decisions/distribution.md), the single binary.

- [`lib.rs`](../../crates/serve/src/lib.rs): the routes, the shared state, and `run`, which reads
  the settings and the token, binds 127.0.0.1, prints `http://127.0.0.1:<port>/<token>/`, and starts
  listing the agents' models in the background. `Shared` holds the settings, the write lock, and the
  models, listed again after 10 minutes.
- [`config.rs`](../../crates/serve/src/config.rs): `[serve]` of `config.toml`: `port`,
  `repositories`, `wake`, `hosts`. `ura serve --port` wins over the file, and the default is 4310.
- [`guard.rs`](../../crates/serve/src/guard.rs) and [`token.rs`](../../crates/serve/src/token.rs):
  the token, Origin, and Host checks above, and the headers every answer carries,
  `Referrer-Policy: no-referrer` and `nosniff`. The token is compared in constant time.
- [`assets.rs`](../../crates/serve/src/assets.rs), [`html.rs`](../../crates/serve/src/html.rs): the
  style sheet and script, embedded, at an address holding a hash of both, kept for a year, so a
  change to either changes the address.
- [`waiting.rs`](../../crates/serve/src/waiting.rs): what waits, and `locate`, which finds a feature
  by repository name and folder and refuses a folder with a slash or a leading dot. It reads files
  with gix and runs no git.
- [`render.rs`](../../crates/serve/src/render.rs) and its modules: a workflow file's markdown as
  HTML. Every block carries `data-lines`, and a paragraph's, heading's, list item's, or table cell's
  source lines are spans carrying `data-line`: a review's comment names lines, and the page finds
  them by these. Its module header lists what a page can rely on. Callouts are `aside`s, raw HTML is
  shown as text, and a link that leaves the repository is its text alone.
- [`render/diagram.rs`](../../crates/serve/src/render/diagram.rs): Mermaid drawn on the server with
  `merman`, once per source, 2 s at most, in a cache of 512 that keeps failures too. The colours are
  Mermaid's `neutral` theme, which the style sheet turns over in a dark theme.
- [`round/`](../../crates/serve/src/round/): `parts.rs` cuts a round's file into the block, the
  context, the settled points, and each question's parts and options as line ranges; `view.rs` draws
  it; `routes.rs` has the writes and `told`, which says what the human does next.
- [`review/`](../../crates/serve/src/review/): `view.rs` draws the file and the changes; `routes.rs`
  has the comment and verdict writes, and the version hash. Only `spec.md` and `plan.md` have a
  page.
- [`files.rs`](../../crates/serve/src/files.rs): `file/<path>` draws a markdown file, `raw/<path>`
  serves any other file, and an HTML one gets the element picker appended.
- [`settings.rs`](../../crates/serve/src/settings.rs), its `sent.rs`,
  [`marks.rs`](../../crates/serve/src/marks.rs), and
  [`providers.rs`](../../crates/serve/src/providers.rs): the page, what it posts, the agents' marks,
  and the list of agents and models. The core's `set_run_options` writes `[runs]`.
- [`wake.rs`](../../crates/serve/src/wake.rs): the T3 Code wake.
- [`assets/ura.js`](../../crates/serve/assets/ura.js) and
  [`assets/ura.css`](../../crates/serve/assets/ura.css): the round's saving, the review's comments,
  the frames, and the picker of the settings, with a light and a dark theme.
- Tests are in [`crates/serve/tests/`](../../crates/serve/tests/): a temporary repository, the real
  router, and a fake `t3` and a fake agent list where one is needed.

## Replaced behaviour

- **The app's questions, spec, and plan pages and their reading pass**, which the
  [reading pass](2026-10-30-reading-pass.md) last shaped: a round or a review is now one of these
  small pages. The app stayed beside them as `ura serve-app` until
  [the removal](2026-11-14-uraeda-light-removal.md) deleted it with its tests.
- **The run map in the app's settings**, [run options](2026-11-08-run-options.md): the same `[runs]`
  file, now edited by the track and one picker, without keys, and without the server's chained runs,
  which `ura` no longer has.
- **The verdict line of [spec comments](2026-11-09-spec-comments.md)**: comments still go with
  either verdict, but the page no longer says what each does with them.

## Gotchas

- A mockup's frame must never get `allow-same-origin`, in the frame's `sandbox` attribute in
  [`ura.js`](../../crates/serve/assets/ura.js) or in the `Content-Security-Policy` that
  [`files.rs`](../../crates/serve/src/files.rs) sends. The frame's opaque origin is what makes a
  mockup's own writes carry `Origin: null`, which [the guard](../../crates/serve/src/guard.rs)
  refuses even with the token in the address.
- `files.rs`'s `inside` refuses any hidden component of a path, after following links: `.git/config`
  may hold a remote's credentials, and a link in the checkout to a hidden file was served until the
  last fix.
- "See it" appears only for a link whose address reads `raw/specs/<folder>/<name>.html`. A mockup
  elsewhere, a story link, or an address stays a plain link: the mockups of the human's proposal at
  any address were left out (see Round 01).
- A review's comment names lines of the file as committed on the feature's branch (`review::comment`
  in the core), while the page draws the file on disk. They agree because an agent commits a file
  before it waits on the human, and the page of what waits relies on the same order.
- "Changed since your last review" reads the review file as committed at the worktree's HEAD, not
  the one on disk: the human's new comments on disk replace it, and its commit still names the
  version they reviewed. A review whose commit does not resolve shows no list.
- Approving from the page passes no risk tier and no plan review, so a spec keeps the ones it
  proposed, and `plan-review` follows the core's default for them.
- A comment with a line starting with `#` is refused by the core: its review file would read it as a
  heading.
- [`wake.rs`](../../crates/serve/src/wake.rs) finds the session with `t3 thread list --project
  <main checkout> --json`, keeps the unsettled threads, newest first, and asks `t3 thread show` of
  each until a thread's `worktreePath` is the feature's worktree. A thread without one matches the
  main checkout. All its commands share 5 s, no shell is involved, and a failure never fails the
  Send: it is the page's sentence.
- No `t3` command lists agents or models, and T3 Code's own snapshots in `~/.t3/caches/` are its
  private files: reading them was built and reverted. The pages ask the agents instead, once at
  start and again after 10 minutes: Claude Code through a short `claude -p` with `list_models` and
  `get_settings` requests, which spends no usage but runs the human's SessionStart hooks, and Codex
  through `codex app-server`. Each answers in a few seconds and has 15 s. The page of settings waits
  for the first listing if it is not ready.
- A pick stores the agent's command, `claude` or `codex`, and a model's slug, never T3 Code's ids. A
  value in the file that the agent no longer lists stays on the page, named "(not offered)". Claude
  Code models that cannot run unattended in `auto` mode, and Codex's hidden models, are not offered.
- The round's file is the page's only source, so the page depends on its format: options start at
  `- **A. ` lines, `[pro]`, `[con]`, and "Why recommended:" are rewritten as marks, and the option's
  sentence loses its leading `A (recommended). `. A change to the round template changes
  [`parts.rs`](../../crates/serve/src/round/parts.rs) and
  [`view.rs`](../../crates/serve/src/round/view.rs); a test cuts the skill's example round.
- Mermaid's text widths are measured without a font, because the server cannot know the reader's:
  labels may be a little tight or loose in another font, and are text, so they stay selectable.

## Questions

The session was a chat with the repository's owner, who is often on a phone: no clarifications file.
The questions are the agent's, as asked, and the answers the human's.

### Round 01

#### Q1: What must step 1 do on day one?

**Answer:** The recommended core plus file mockups: the list, the round, the review with "changed
since", mockups that are files of the feature, and the element picker. Mockups at another address,
desktop keys, and the handling of comments gone stale wait.

#### Q2: After Submit or a verdict, who wakes the agent?

**Answer:** Neither of the two options: "It should be a setting, off by default. Turn it on for me.
It should be pretty trivial though, it's just calling the t3 code CLI."

#### Q3: One service for all repositories, or one per worktree?

**Answer:** One per machine, with the repositories listed in the configuration file and their
worktrees found through git.

#### Q4: How should the pages look?

**Answer:** The question assumed an app to match: "We don't have an app anymore though." Asked again
in the next round.

### Round 02

#### Q1: Since there is no app to match, what look for the pages?

**Answer:** "Review the clarifications and specs page of 1.4 it was pretty decent, albeit too heavy.
Also right now look and feel is less important than readability and speed." The pages keep that
version's structure, with its Example and "Why it matters" boxes, `+` and `−` lines, and a framed
recommended option, without its weight: no app chrome, the system's fonts.

#### Q2: How does it live beside today's `ura serve` until step 3?

**Answer:** "`ura serve` now, old one renamed": the new pages take the name, and today's server
became `ura serve-app` until the removal.

#### Q3: Where do its settings live?

**Answer:** In today's `config.toml`, as a `[serve]` section, not a new file.

### Round 03

#### Q1: Approve the design, and start building task by task?

**Answer:** The question dialog hid the design, which the human could not see: "I can't see any
design?" The agent gave it in a message, and the human answered: "Yes, LGTM, parallelize what can
be, use sub agents".

#### Q2: What name for today's server until step 3 removes it?

**Answer:** "Just do ura serve and move away the old one": the new pages are `ura serve`, and the
old server moved to `ura serve-app`.

### Round 04

#### Q1: When do roleplay agents run, how many, on which pick, and where does their report go?

**Answer:** Not answered, on purpose. The human had added "roleplay agents for personas" and "a
small settings view" to the proposal, and replied to these questions: "Drop the personas model
actually it's complicated. Just do a small settings page, in particular for the setting of workflow
models and flow. Review how it was in 1.4, it looked decent (but not perfect)".

## Changes after approval

- **A settings view, and roleplay agents dropped** (the owner's addition of 2026-11-14, in the
  proposal's notes): the settings page was added, and the human dropped the roleplay agents for
  personas before any were built.
- **The settings' models come from the agents.** The human first asked: "The settings should pull
  the available models from t3code." The agent read T3 Code's snapshots, after finding that no `t3`
  command lists models. The human answered: "Seems weird that we can specify a model from the CLI
  but not list them", then ruled: "Actually revert that, read models from codex and claude
  directly." The first was reverted, and the settings page asks the agents.
- **A compact workflow view and one picker.** The human asked: "Could we have a nicer and more
  compact workflow view with agent icons and a good picker for harness model effort instead of three
  dropdown". The three menus per row became the track and the picker.
- **Hardening after an independent review of the code**: one write at a time with queued saves;
  review writes tied to the version drawn; the Host check, against DNS rebinding; hidden files never
  served; a remote image shown as a link, never fetched.
- **The page of what waits asks the core**, and a link to a hidden file is refused, the last fixes.
- **Later steps of the same branch**: the port went back to 4310 once `ura serve-app` was gone, as
  the new pages took 4320 beside it, and the settings the removed server alone read were cut: the
  file holds `[serve]`, `[runs]`, and what the vault and `ura usage` read.

## Follow-ups

- Left out by the human's choice of the day's scope: mockups at an address (a live preview, a
  Storybook story) with the picker and a comment, desktop keys, and the handling of review comments
  gone stale.
- The two persona walkthroughs of the pages, one at a desk and one on a phone, stopped when the
  first session ended and never ran again: the pages were driven by hand at desk width and at 440 by
  956 with touch, never by a persona.
- [`docs/cli.md`](../../docs/cli.md) says the page of what waits shows "each feature's track through
  the workflow": it shows a name, what is asked, and the file's first line.
- Waking a session knows T3 Code alone: another host needs another `Wake`.
