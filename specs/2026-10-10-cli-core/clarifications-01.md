---
status: awaiting-human
---

# Clarifications, round 01: CLI core features

> [!IMPORTANT]
>
> 16 questions on the `ura` CLI and its TUIs, about 50 minutes.
>
> - Scope comes first: the proposal holds a core, five commands, three TUIs, the skill's rewrite,
>   and the release pipeline the stack decision moved here. The recommendation splits the TUIs into
>   the next feature, but their questions are asked now, so they start from your answers.
> - "Use the CLI for all workflow steps" conflicts with principle V of the constitution if taken
>   literally: the recommendation keeps the rules in the skill, with commands as the fast path.
> - Three choices last beyond this feature: the git backend, where review comments live, and how the
>   skill reaches agents' projects.
> - Features live on their branches, so `status`, `answer`, and `review` must read and write
>   branches that are not checked out: three questions work together on it.
> - `[[spec.md#^50]]` is not a line link in Obsidian, and "typing ASCII goes in the answer box"
>   clashes with `j`/`k`: both come with alternatives, and a mock of the look.
> - Fifteen points are settled without you, at the end: check them.

## Context

The [proposal](proposal.md) asks for a CLI that sets a project up (`ura init`), shows where every
feature stands (`ura status`, with JSON), turns a PRIORITIES line into a file (`ura draft`), and
lets you answer questions (`ura answer`) and review specs and plans (`ura review`) in coherent,
keyboard-driven ratatui screens. The skill should then send agents through the CLI, which makes the
workflow less error-prone than prose instructions.

Today, `ura` has one temporary command, `ura status <folder>`, which reads the `status` field of
three kinds of files in one folder of the working tree
([core](/crates/core/src/temporary_status.rs)). The same types reach the web UI through napi-rs. The
skill describes about thirty mechanical operations that agents do by hand: finding the next step,
starting features, turning `[!IMPORTANT]` blocks into records, setting counters, and following the
templates' structure. Most of them are deterministic, and none has a command yet
([mechanical operations](discovery-01.md#mechanical-operations-in-the-skill)).

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: What does this feature deliver?

The proposal holds independent pieces. They are the core model of the `specs/` folder with its
non-interactive commands, the three TUIs, and the skill's rewrite around the commands. The stack
decision also moved the release pipeline here
([Q11 of the stack decision](../2026-10-10-stack-decision/clarifications-01.md#q11-what-does-the-skeleton-set-up-beyond-local-checks)).
Every TUI action needs the core's actions first, and the web UI needs the same ones. More in
[discovery](discovery-01.md#scope).

Why it matters: it sets when agents get a reliable CLI, when you get the TUIs, and how large the
spec and the pull request you review are.

Whatever your answer, the questions on the screens themselves (Q12 to Q14) are asked now: with A,
the TUI feature starts from your answers.

- **A (recommended). This feature delivers the core model, every command in its non-interactive form
  (flags and JSON), `ura init`, the review file format, the skill's rewrite, and the release
  pipeline. The answer, review, and draft TUIs, with their mock, become the next feature, in Now.**
  - [pro] agents get the reliable CLI first, and the TUIs are built on tested actions.
  - [pro] two reviews of medium size instead of one very large one.
  - [con] you wait one more feature for the screens the proposal describes in most detail.
  - Why recommended: the TUIs are a thin layer over the actions this feature defines, and the
    proposal's main gain, less error-prone agents, comes from the commands.
- **B. Everything in this feature: core, commands, three TUIs, the skill, the release.**
  - [pro] one delivery, with the TUIs.
  - [con] the largest spec and pull request so far, and the longest wait for any of it.
- **C. The core and the three TUIs here; the skill's rewrite and the release in a later feature.**
  - [pro] you get the screens soonest.
  - [con] agents keep the manual path longer, and nobody can install `ura` without Rust meanwhile.

**Answer:**

## Q2: How does the skill send agents through the CLI?

The proposal wants agents to use the CLI for every step. Principle V says "The workflow MUST work
with any agent, with or without the uraeda CLI" and "Tools MUST only enforce rules that humans and
agents can follow unaided" ([constitution](../CONSTITUTION.md#v-tools-are-optional)). Backlog.md's
skill goes the other way: "NEVER EDIT TASK FILES DIRECTLY. Edit Only via CLI"
([guidelines](https://raw.githubusercontent.com/MrLesk/Backlog.md/main/src/guidelines/agent-guidelines.md)).
More in [discovery](discovery-01.md#the-skill-and-the-cli).

Why it matters: it decides whether the skill keeps working in a project without `ura`, and whether a
rule can live only in the CLI.

- **A (recommended). The rules stay written in the skill. Each step names the command that does it,
  "with `ura`, run `ura start`", and agents use it when `ura` is installed. `ura check` verifies
  only rules the skill states.**
  - [pro] keeps principle V; one rule, with one pointer to its command.
  - [con] the skill keeps its full manual instructions, so it does not get shorter.
  - Why recommended: agents gain the reliability where `ura` exists, and nothing breaks where it
    does not.
- **B. One section of `SKILL.md` maps operations to commands; the steps stay unchanged.**
  - [pro] the smallest change to the skill.
  - [con] agents reading a step miss the command, and the section drifts from the steps.
- **C. CLI first: agents must use `ura`, and the rules live in the CLI.**
  - [pro] the fewest agent errors, and a much shorter skill.
  - [con] conflicts with principle V: it needs you to amend the constitution first.

**Answer:**

## Q3: Which commands come beyond the proposal's five?

Spec Kit, OpenSpec, and Backlog.md all have a validation command, and OpenSpec and Backlog.md tell
the agent what to do next ([discovery](discovery-01.md#what-they-have-in-common)). The skill's most
error-prone sequences are finding the next step (a 12-row table) and starting a feature (two commits
on two branches). Postponing merges a branch into the default branch. What `ura draft` becomes is
Q4. More in [discovery](discovery-01.md#commands).

Why it matters: each command is something agents stop doing by hand, and something to build and keep
in step with the skill.

- **A (recommended). Add `ura check` (validate every rule of the skill, exit 1 on errors, for CI and
  pre-commit hooks), `ura next` (the target and its step, as JSON for runners), and `ura start` (the
  full start of a feature or a bug). Postpone, drop, and round scaffolding come later.**
  - [pro] covers the three operations agents get wrong most, and gives the future runner its entry
    point.
  - [con] `start` writes on the default branch, so it needs care around a dirty working tree.
  - Why recommended: the most error-prone and most frequent operations, with no branch merges yet.
- **B. Only `ura check` and `ura next`, both read-only.**
  - [pro] nothing new writes to git besides the proposal's commands.
  - [con] starting a feature stays manual.
- **C. A, plus `ura postpone`, `ura drop`, and `ura round` (the next round's two files from the
  templates).**
  - [pro] every lifecycle operation has a command.
  - [con] `postpone` merges and deletes branches, the riskiest automation, for an operation done
    rarely.

**Answer:**

## Q4: What does `ura draft` create?

The skill has a draft file in `drafts/`, written before a feature starts, and a start that moves the
PRIORITIES entry to Now, creates the branch, and moves the draft to
`specs/YYYY-MM-DD-<slug>/proposal.md`
([skill](/skills/uraeda/SKILL.md#starting-postponing-and-dropping-a-feature)). This feature began a
third way: you wrote the dated folder on `main` and linked the entry to it. With A in Q3,
`ura start` does the full start. More in [discovery](discovery-01.md#drafting).

Why it matters: it decides whether `draft` touches git, and whether the skill keeps one way to begin
a feature.

- **A (recommended). `ura draft` lets you pick a PRIORITIES line, writes `specs/drafts/<slug>.md`
  from the proposal template with the line as its title, turns the line into a link to it, and opens
  `$EDITOR`. It does not commit; starting is `ura start` or a request to an agent.**
  - [pro] no git, so it works on any branch with any working tree, and matches the skill.
  - [con] two commands to go from an idea to a started feature.
  - Why recommended: you write a proposal at your pace, and starting stays a deliberate act.
- **B. `ura draft` does the full start: Now, branch, dated folder, `proposal.md`, two commits, then
  `$EDITOR`.**
  - [pro] one command from a line to a feature an agent can pick up.
  - [con] the commits are made before you write the proposal, so an empty proposal gets committed.
- **C. `ura draft` writes the dated folder and `proposal.md` on the current branch, as you did for
  this feature.**
  - [pro] the shortest path, as you work today.
  - [con] the folder sits on the default branch, against the skill's branch rule, and the agent has
    to move it.

**Answer:**

## Q5: What does `ura status` show?

Each feature's files live on its branch until its pull request is merged; PRIORITIES lives on the
default branch. From `main`, a working-tree status cannot see this feature. A merged branch can
linger on the remote, like `origin/2026-10-10-stack-decision` today. The proposal writes "CLI + TUI"
after `ura status` without saying what the TUI holds. More in [discovery](discovery-01.md#status).

Why it matters: it decides whether `status` answers "what is waiting for me?" from any branch.

- **A (recommended). Every feature and bug, read from the default branch and each branch's tip
  without checking it out, plus the working tree's uncommitted edits, flagged. One line each: its
  PRIORITIES section, the next step, and who it waits on (you or an agent), with the waiting file's
  first line, "16 questions, about 50 minutes". A plain table, or `--json`. The pickers of `answer`
  and `review` are the TUI.**
  - [pro] the full picture from any branch, the order an agent picks work in.
  - [con] one read per branch, and branches as fresh as your last fetch.
  - Why recommended: "what is waiting for me" is the question, and it spans branches.
- **B. A, plus `ura` alone opens a dashboard TUI: the same list, Enter jumps to answer or review,
  lazygit-style.**
  - [pro] one entry point for everything you do.
  - [con] a fourth screen to design, while the web UI, also in Now, is a dashboard too.
- **C. The working tree only, as today.**
  - [pro] fast and simple.
  - [con] blind to every feature not checked out.

**Answer:**

## Q6: How does `ura` run git?

`ura` will list branches, read files on other branches, commit, create and switch branches. The
system `git` runs your hooks (this repository's pre-commit hook runs `vp check --fix`), signing, and
credentials. git2 (libgit2, in C) and gix (pure Rust) run no hooks, and gix cannot switch branches
or push. The stack decision left this choice to the CLI feature. More in
[discovery](discovery-01.md#git-backend).

Why it matters: it becomes a decision for every tool, including the future git listener and runner.

- **A (recommended). Run the system `git` for everything, parsing its plumbing and `--porcelain`
  output, which git promises to keep stable.**
  - [pro] hooks, signing, credentials, and config behave exactly as when you type the command.
  - [pro] no new dependency, and the binary does not grow.
  - [con] `git` must be on PATH, and each call is a process (`git cat-file --batch` reads many files
    in one).
  - Why recommended: a git workflow always has `git`, and commits made by `ura` must pass the same
    hooks as yours.
- **B. gix for reads, the system `git` for writes.**
  - [pro] faster reads across many branches.
  - [con] two ways to talk to git, a larger binary, and `git` still required.
- **C. git2 (libgit2) for everything.**
  - [pro] no `git` needed at runtime.
  - [con] no hooks, manual signing, and a C build.

**Answer:**

## Q7: Where do `answer` and `review` write when the feature's branch is not checked out?

The skill says you answer and approve on the feature's branch. A branch checked out in one worktree
cannot be checked out in another. A temporary worktree has no `node_modules`, so this repository's
pre-commit hook fails there. Committing with plumbing skips the hooks entirely. This works with Q6.
More in [discovery](discovery-01.md#writing-on-a-features-branch).

Why it matters: it decides whether `ura answer` works from `main` without disturbing what you have
open.

- **A (recommended). Use the branch's worktree when it has one (this one or another). Otherwise,
  switch to the branch when the working tree is clean, and stay there afterwards. With uncommitted
  changes, refuse, and say which files.**
  - [pro] hooks run normally, and what you see on disk is what was committed.
  - [con] it changes your current branch when it switches.
  - Why recommended: the safest option that runs your hooks; the switch is what you would do by
    hand.
- **B. Make the commit in a temporary worktree, removed afterwards.**
  - [pro] your working tree and branch never change.
  - [con] hooks that need installed dependencies fail, as this repository's does.
- **C. Write the commit with git plumbing, without any worktree.**
  - [pro] instant, and nothing on disk changes.
  - [con] no hooks, no formatting, and the files on disk differ from the branch until you pull.

**Answer:**

## Q8: Do the commands commit your answers and reviews?

The skill asks for one commit per step, and the web UI draft says the UI "sets the `status` fields
and commits" ([draft](../drafts/web-ui.md)). Uncommitted, an answer reaches no agent (principle
III). More in [discovery](discovery-01.md#committing).

Why it matters: it decides whether submitting is the last thing you do.

- **A (recommended). Commit on submit, with your git identity, only the files the action changed;
  `--no-commit` leaves them for you. `ura` never pushes.**
  - [pro] submitting is one action, and the commit follows the skill's conventions every time.
  - [con] a commit made for you, which you can still amend.
  - Why recommended: the action is complete and asynchronous at once, as the constitution asks.
- **B. Write the files, and print the commit command to run.**
  - [pro] you control every commit.
  - [con] one more step, easy to forget, and agents wait meanwhile.

**Answer:**

## Q9: What can a review conclude?

Today, a spec or plan is approved, or gets changes requested with a `## Changes requested` section.
GitHub requires a body with "request changes" and makes it optional with "approve"; Google's
Critique and Plannotator allow an approval with notes the author still addresses, "non-blocking
guidance, not a request for another revision"
([code review tools](discovery-01.md#code-review-tools),
[plan annotators](discovery-01.md#plan-annotators-plannotator-ano-open-plan-annotator)). A
comment-only review leaves the file waiting, and no agent runs. Where comments are written is Q10.
More in [discovery](discovery-01.md#review-verdicts).

Why it matters: an approval with notes changes the flow. Someone must act on the notes without
another review, and the approved spec must not change silently.

- **A (recommended). Approve, with optional comments, or request changes, with at least one comment.
  On an approved spec, comments do not change it: the plan must address each one, and says how. On
  an approved plan or assessment, the implementation does.**
  - [pro] small remarks no longer cost a full revision round.
  - [pro] the spec stays exactly what you approved.
  - [con] a rule to add to the plan and implementation steps.
  - Why recommended: it answers the proposal's question with the smallest change that keeps you in
    control.
- **B. Approve without comments; request changes with comments.**
  - [pro] no new rule.
  - [con] any remark, however small, costs a revision and another review.
- **C. A, plus a comment-only review that leaves the file waiting for you.**
  - [pro] notes to yourself mid-review.
  - [con] a third state that wakes no agent; with the TUI, a review can be saved in progress anyway.

**Answer:**

## Q10: Where do review comments live?

Today, feedback goes in a `## Changes requested` section at the end of the file. The next revision
removes it, keeping only a one-line record, so the comments survive in git history alone. Your note
suggests a separate `spec-review.md`. Plannotator exports a list of comments, each with its lines
and the quoted text. GitHub keeps every comment and marks it resolved or outdated. More in
[discovery](discovery-01.md#where-review-feedback-lives).

Why it matters: it adds or changes a workflow file, with its template and example, and decides
whether each comment's outcome is recorded.

- **A (recommended). One file per review, next to the reviewed file: `spec-review-01.md`,
  `plan-review-01.md`, numbered like rounds. It holds the verdict, the reviewed `revision`, a
  summary, and numbered comments `## C1: ...`. The reviewed file keeps its `status`. The revision
  that follows says, in its block, how each comment was handled ("C1: done", "C2: declined, because
  ...").**
  - [pro] a durable record per review, and approval comments have a home.
  - [pro] the reviewed file stays clean, and you check each comment's outcome.
  - [con] a new file type, with its template, example, and rules.
  - Why recommended: approval comments (A in Q9) need a place that outlives the revision, and it is
    what you sketched.
- **B. Keep the `## Changes requested` section, with numbered comments, and add a
  `## Approval comments` section kept after approval.**
  - [pro] one file to read, and the smallest change.
  - [con] refusal comments vanish at the next revision, and two sections to manage in every reviewed
    file.
- **C. Comments inline in the reviewed file, as CriticMarkup `{==text==}{>>comment<<}`.**
  - [pro] each comment sits exactly where it applies.
  - [con] literal braces on GitHub and in Obsidian, limited to one paragraph, and the agent's file
    gets edited by the review.

**Answer:**

## Q11: How does a comment point to its place?

In Obsidian, `[[spec.md#^50]]` links to a block marked `^50` inside `spec.md`, not to line 50, and
"won't work outside of Obsidian"; no native line link exists
([Obsidian help](https://obsidian.md/help/links)). GitHub links to a markdown line only in its plain
view. Specs are hard-wrapped at 100 columns, so a sentence spans several lines. More in
[discovery](discovery-01.md#comment-anchors).

Why it matters: the anchor must be typeable by hand (principle V), readable by an agent, and still
meaningful after the revision.

- **A (recommended). The line range at the reviewed `revision`, plus the quoted text and the nearest
  heading: `## C1: Lines 50–52, under "US2: Edit a repeat"`, then the lines quoted, then the
  comment.**
  - [pro] typeable from any editor's line numbers, and the quote reads alone after a revision.
  - [con] the line numbers are only exact for the reviewed revision (git keeps it).
  - Why recommended: it is Plannotator's format, and it is the only one that is exact, readable
    everywhere, and needs no edit to the spec.
- **B. The nearest heading or structured ID only ("US2, scenario 1", "SC-003").**
  - [pro] stable across revisions.
  - [con] coarse: a comment on one sentence points at a whole section.
- **C. Obsidian block IDs (`^c1`) written into the spec, linked as `[[spec.md#^c1]]`.**
  - [pro] follows the text through edits, in Obsidian.
  - [con] the review edits the spec, the link works only in Obsidian, and the skill has agents write
    no wikilinks.

**Answer:**

## Q12: What does `ura review` show, and what is the "active line"?

A rendered view reads like the document, but a wrapped paragraph is not one source line. Rendering
with pulldown-cmark's source offsets maps each block (paragraph, list item, table row, heading) to
its source lines, as Codex's own renderer does. tui-markdown renders well but keeps no mapping
([markdown rendering](discovery-01.md#markdown-rendering-in-a-terminal)). More in
[discovery](discovery-01.md#review-view).

Why it matters: it decides what a comment anchors to, and how much rendering code `ura` owns.

- **A (recommended). Rendered markdown, with the cursor on a block: `j`/`k` move from block to
  block, and `C` comments on the highlighted block's source lines.**
  - [pro] reads like the document, and a block is what you comment on in a hard-wrapped file.
  - [con] a renderer of our own on pulldown-cmark (+335 KB), with tables and callouts to draw.
  - Why recommended: comments on paragraphs and list items match how specs are written.
- **B. The source, styled (headings bold, callouts coloured, tables aligned), line by line, like an
  editor.**
  - [pro] exact lines, trivial to build and test.
  - [con] reads like raw markdown, not the document.
- **C. A, with a key to switch to B for a single line.**
  - [pro] both precisions.
  - [con] two views to build and keep coherent.

**Answer:**

## Q13: How does typing start in `ura answer`?

The proposal has any typed character go to the answer box, while `j`, `k`, `h`, `l` also move: an
answer starting with "just" would scroll instead. Most answers start with an option letter, in
capitals ("B and C: ..."). Answers in other languages need more than ASCII. Lazygit and helix use an
explicit key to start editing. More in [discovery](discovery-01.md#answer-input).

Why it matters: it is the main keystroke of the answer screen.

- **A (recommended). In normal mode, lowercase letters are motions. Uppercase letters, digits, and
  space start typing with that character, so `B` starts the answer "B". `i` or Enter starts typing
  with nothing. Enter or Esc validates; Ctrl+J or Alt+Enter (Shift+Enter in your Ghostty) inserts a
  line; Ctrl+G opens `$EDITOR`.**
  - [pro] answering "B" is one key, and motions never collide with typing.
  - [con] an answer starting with a lowercase letter needs `i` first.
  - Why recommended: it keeps your vi motions and the one-key answer the proposal wants.
- **B. Any key that is not a motion starts typing with it.**
  - [pro] the closest to the proposal.
  - [con] answers starting with `j`, `k`, `h`, `l`, `g`, `n`, or `q` do something else instead.
- **C. The answer box always has focus; motions move to Ctrl keys, arrows, and Tab.**
  - [pro] typing never surprises.
  - [con] no vi motions on the answer screen.

**Answer:**

## Q14: What should the TUIs look like?

Your Neovim is LazyVim with catppuccin-mocha: a bottom bar whose left block shows the mode in bold
colour (blue normal, green insert), then context, then the position on the right, with powerline
separators. Ghostty uses its default theme with a font without Nerd Font glyphs. Codex's style guide
keeps the terminal's own colours and dims secondary text
([terminal UIs](discovery-01.md#terminal-uis), [your setup](discovery-01.md#the-humans-setup)). The
answer screen, with A:

```text
 Clarifications, round 01: CLI core features                       Q3 of 16 · 2 answered
 ──────────────────────────────────────────────────────────────────────────────────────
 Q3: Which commands come beyond the proposal's five?

 Spec Kit, OpenSpec, and Backlog.md all have a validation command ...

 ▌A (recommended). Add ura check, ura next, and ura start ...
    + covers the three operations agents get wrong most
    − start writes on the default branch
  B. Only ura check and ura next, both read-only.
  C. A, plus ura postpone, ura drop, and ura round.

 ╭ Answer ─────────────────────────────────────────────────────────────────────────────╮
 │ A, but also ura round│                                                              │
 ╰─────────────────────────────────────────────────────────────────────────────────────╯
  INSERT  Q3  enter save · ctrl+j new line · ctrl+g editor · esc back           3/16
```

More in [discovery](discovery-01.md#look).

Why it matters: it sets the visual identity every later screen follows.

- **A (recommended). The terminal's own 16 colours, a LazyVim-shaped bottom bar (the mode as a bold
  coloured block, then context, key hints, and progress), rounded borders, and plain separators.**
  - [pro] follows your terminal's theme, and everyone else's.
  - [pro] works with any font.
  - [con] not catppuccin exactly, unless your terminal uses it.
  - Why recommended: it matches LazyVim's shape and stays coherent in any terminal.
- **B. Catppuccin Mocha in true colour, with powerline separators, exactly like your Neovim.**
  - [pro] identical to your editor.
  - [con] clashes with other themes, and needs a Nerd Font.
- **C. Monochrome: bold, dim, and reverse only.**
  - [pro] the most robust.
  - [con] the least distinctive.

**Answer:**

## Q15: Does `ura init` install the skill?

The skill will name `ura` commands (Q2), so its version should match the binary's. Claude Code reads
skills from `.claude/skills/`, Codex and most others from `.agents/skills/`. `npx skills add`
installs this repository's skill into about 80 agents, with no version link to `ura`. Spec Kit
writes its files per agent and tracks their hashes, so upgrades never overwrite your edits. More in
[discovery](discovery-01.md#init-and-the-skill).

Why it matters: it decides how a project gets the skill, and whether teammates and remote agents get
it from git.

- **A (recommended). `ura init` writes the `specs/` files and the skill embedded in the binary into
  `.agents/skills/uraeda/` and `.claude/skills/uraeda/`, committed with the project. Running it
  again updates the skill's files you have not edited, and lists the others.**
  - [pro] the skill always matches the `ura` that installed it, and every clone has it.
  - [con] a copy of the skill in each project, and two agent folders to maintain.
  - Why recommended: a skill that names commands must match the CLI, and remote agents read the
    repository, not your home folder.
- **B. `ura init` writes only the `specs/` files; the skill comes from `npx skills add` or a Claude
  Code plugin.**
  - [pro] no copies to maintain, and about 80 agents reached.
  - [con] the skill and the CLI can drift apart.
- **C. A, plus a pointer block in `AGENTS.md`.**
  - [pro] reaches agents that read no skills folder.
  - [con] edits a file you own; OpenSpec avoids it on purpose.

**Answer:**

## Q16: How do users install `ura`?

The stack decision moved the release pipeline here, for Linux and macOS on x64 and arm64. dist
generates a GitHub Actions workflow that builds binaries and a shell installer on each version tag
([dist](https://axodotdev.github.io/cargo-dist/book/introduction.html)). You use Nix. More in
[discovery](discovery-01.md#release-and-install).

Why it matters: without it, `ura` needs a Rust toolchain to install.

C can come on top of A.

- **A (recommended). dist: on each version tag, release binaries for the four targets, with a shell
  installer (`curl ... | sh`).**
  - [pro] installs without Rust or a package manager, as the stack proposal wanted.
  - [con] a generated workflow to keep, and versions to tag.
  - Why recommended: it is the install the stack decision deferred to this feature, at little cost.
- **B. `cargo install --git` only, for now.**
  - [pro] no work.
  - [con] needs Rust, and no versions.
- **C. Also a Nix flake package (`nix run github:mrtolkien/uraeda`) and a Homebrew tap.**
  - [pro] native for Nix and macOS users.
  - [con] two more channels to keep working.

**Answer:**

## Settled without the human

- **The actions live in the core** (answer, approve, request changes, start, the record blocks),
  shared with the web UI through the binding, as the stack decision requires; the temporary status
  module goes. See [likely changes](discovery-01.md#likely-changes).
- **Machine output** is `--json` on every read command, with a top-level `"version": 1`; new fields
  do not change it, as cargo and Terraform do. See
  [command-line conventions](discovery-01.md#command-line-conventions).
- **Non-interactive use**: every TUI action also has flags (`ura review spec.md --approve`), and a
  TUI starts only when stdin and stdout are terminals and `--no-input` is not set. Otherwise the
  command exits 1 and names the flags to pass. See
  [needs no choice](discovery-01.md#needs-no-choice).
- **Agents and human statuses**: `ura` cannot tell who runs it, so the skill's rule stays: an agent
  sets a human status only when you ask in the session. With A in Q8, the commit says so, as today.
- **Errors exit 1**, validation errors included; messages go to stderr; no colour without a terminal
  or with `NO_COLOR`.
- **The workspace root** is the git top-level folder, holding `specs/`, as the skill assumes;
  monorepos stay under Later.
- **`ura init` on existing files** creates what is missing and never overwrites, like `git init`. It
  creates `drafts/`, `backlog/`, `decisions/`, and `bugs/` with a `.gitkeep` each, since git does
  not keep empty folders, and the skill's setup section says so. The constitution stays a template:
  `init` suggests asking an agent to write it with you.
- **Templates** are embedded in the binary at build time from `skills/uraeda/assets/templates/`, so
  they match the version and work offline, as Spec Kit moved to. See
  [agent skills](discovery-01.md#agent-skills).
- **Follow-up questions** apply when the parent's answer names their letter as an option: "B", "B
  and C: ...", "A, B". `ura answer` hides the others, and `ura check` does not count them as blank.
  When the answer is unclear, the follow-up is shown, marked "may not apply".
- **Answers are saved as you go**: each validated answer is written to the file, so quitting loses
  nothing; the status becomes `answered` only on submit, when no applicable answer is blank.
- **Commit messages for your actions** follow the skill's types:
  `discovery(<slug>): answer round 01`, `spec(<slug>): approve`, `spec(<slug>): request changes`,
  `plan(<slug>): approve`, with the review's summary as the body.
- **Starting writes a link**: `ura start` turns the PRIORITIES entry into a link to the new
  `proposal.md`, as you did for this feature, and the skill's start section says so, since entries
  match branches through their file's name.
- **`ura` never fetches or pushes**: `status` reads remote branches as of your last fetch, and says
  how old it is. With A in Q3, `ura next` reads pull requests through `gh` when installed, and
  reports "unknown" otherwise.
- **Libraries for the TUIs**: ratatui 0.30 with crossterm, ratatui-textarea for the answer box, and
  pulldown-cmark with A or C in Q12; no syntect (+1 MB), no fuzzy matcher: a plain filter is enough
  for tens of lines. The binary stays under the 3 MB limit, at about 1.9 MB. See
  [binary size](discovery-01.md#binary-size).
- **Keys** follow lazygit and helix: `j`/`k` and arrows, `+`/`-` as you asked, `g`/`G`, Ctrl+D/U,
  `/` and `n`/`N`, `?` for help, `q` to quit, `$VISUAL` then `$EDITOR` then `vi` for the editor.
  Shift+Enter works where the terminal reports it; Ctrl+J and Alt+Enter work everywhere, and the
  bottom bar shows the one that works. See
  [Shift+Enter](discovery-01.md#shiftenter-and-the-kitty-keyboard-protocol).
