# Discovery, round 01: Scratchpad

## Summary

Established tools split this kind of feature into two separate moves: **capture**, which costs
almost nothing (one line of text, sent to one default place), and **processing**, a regular pass
that takes each item and gives it one outcome from a short list: make it real work, do it now if it
is tiny, merge it with a duplicate, park it, or delete it. GTD, Todoist, Things, OmniFocus, Linear's
Triage, and GitHub's draft issues all follow this shape. They differ in where captured items live,
in how much context is added automatically, and in who processes them. Every source warns that an
inbox nobody processes turns into a backlog that is never read.

The [proposal](proposal.md) asks for this shape: capture first, organization second, both in the
repository. Today the human writes notes as bullets under a `## Scratchpad` heading at the end of
[`specs/PRIORITIES.md`](/specs/PRIORITIES.md). The core ignores that section: the web UI does not
show it, the tools cannot act on its lines, and three small bugs follow from it. In practice, notes
left the scratchpad by being grouped into themed drafts, appended to existing drafts, fixed in
passing, or deleted. None of the spec-driven tools Uraeda draws from (Spec Kit, superpowers,
OpenSpec, Kiro) has a lightweight scratchpad. A parallel feature, the
[bugfixing and low-impact change flow](#the-bugfixing-feature-in-flight), will define the "fix it
quickly" path a note may take.

## How other products do it

### GTD

- Five steps: Capture, Clarify, Organize, Reflect, Engage. Capture collects everything that has your
  attention into a "collection tool". Clarify asks "Is it actionable?"
  ([What is GTD](https://gettingthingsdone.com/what-is-gtd/)).
- An inbox item only needs to "make enough sense that when you return to the Inbox, you can recall
  your intention for the entry". Processing goes "line by line, and deciding what each item really
  is", daily or at a regular time
  ([OmniFocus, GTD, and You](https://downloads.omnigroup.com/software/MacOSX/Extras/OmniFocus/GTDandOmniFocus.pdf)).
- Outcomes of processing, from the same guide: not actionable gives **trash**, **someday/maybe**, or
  **reference**; actionable gives **do it** (under two minutes), **delegate it**, or **defer it** as
  an action, a step of an existing project, or a new project. The weekly review starts with "Get
  'IN' to Zero", and moves someday/maybe items into projects when their time comes.

### Todoist, Things, and OmniFocus

- Todoist: "Any task that isn't added to a specific project goes to your Inbox by default". Users
  process it daily or weekly, by moving each task to a project, adding a date, and a priority. "It's
  okay to decide that a task doesn't need your attention"
  ([Todoist help](https://www.todoist.com/help/articles/use-the-inbox-in-todoist-HwHvYErS)).
- Things: Quick Entry opens from any app with a shortcut and needs only a title. "Quick Entry with
  Autofill" adds a link to the page, email, or file the user had selected: the source is captured
  without typing it ([Things support](https://culturedcode.com/things/support/articles/2249437/)).
- OmniFocus: items stay in the inbox until they have a project or a context, then leave it at the
  next clean-up ([Omni support](https://support.omnigroup.com/omnifocus-inbox-processing/)).

### Linear

- Triage is a team inbox, reviewed before issues enter the normal workflow. Issues land there from
  integrations, support tools, Asks, and people outside the team
  ([Linear docs, Triage](https://linear.app/docs/triage)).
- Its outcomes: **accept** (into the normal statuses), **decline** with a reason, **mark as
  duplicate** (merged into the existing issue), **snooze** until a date or new activity, or ask for
  more information. A rotating owner triages, and an AI suggests properties and duplicates (same
  page).
- Linear's method: "You don't need to save every feature request or piece of feedback indefinitely.
  Important ones will resurface, low priority ones will never get fixed"
  ([Linear Method](https://linear.app/method/introduction)).

### GitHub

- In Projects, a draft issue is typed in "Add item" and saved with Enter: a title and a markdown
  body, no repository, labels, or milestone until it is converted
  ([GitHub docs, adding items](https://docs.github.com/en/issues/planning-and-tracking-with-projects/managing-items-in-your-project/adding-items-to-your-project)).
  "Convert to issue" turns it into a real issue
  ([GitHub docs, converting](https://docs.github.com/en/issues/planning-and-tracking-with-projects/managing-items-in-your-project/converting-draft-issues-to-issues)).
- Issue forms can label every new issue `triage`, a convention that marks it as not processed yet
  ([GitHub docs, issue templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)).

### Shape Up

- "Backlogs are a big weight we don't need to carry. [...] The time spent constantly reviewing,
  grooming and organizing old ideas prevents everyone from moving forward." Only recent pitches, or
  ones somebody revives, are considered. Programmers keep their own list of bugs, fixed during
  cool-down ([Shape Up, chapter 7](https://basecamp.com/shapeup/2.1-chapter-07)).

### Plain-text and agent tools

- **Spec Kit** has no notes or backlog in its core commands. Its opt-in `assess` extension keeps one
  folder per idea, `.specify/assessments/<slug>/`, with intake, research, and a go or kill verdict
  that hands off to `/speckit.specify`
  ([assess extension](https://github.com/github/spec-kit/tree/main/extensions/assess)). An idea is a
  heavy item there, not a quick note.
- **superpowers** and **OpenSpec** have no notes, ideas, or backlog concept: an idea becomes a
  design or a change, or is lost ([superpowers](https://github.com/obra/superpowers),
  [OpenSpec workflows](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/workflows.md)).
- **Backlog.md** keeps one markdown file per task in `backlog/`, with a `drafts/` folder:
  `backlog draft create "..."` captures, `backlog draft promote <id>` promotes, and `task archive`
  is for "canceled, duplicate, or invalid work"
  ([CLI instructions](https://raw.githubusercontent.com/MrLesk/Backlog.md/main/CLI-INSTRUCTIONS.md)).
- **BMAD** keeps a `backlog/` folder of standalone tickets named `<type>-<slug>.md`. Saying "File a
  bug: checkout ignores discounts" writes one ticket straight into it
  ([BMAD docs](https://docs.bmad-method.org/plan/set-up-the-ticket-tree/)).
- **todo.txt** and **TODO.md** are single files, one item per line, with optional inline metadata: a
  creation date, `+project`, `@context`
  ([todo.txt](https://raw.githubusercontent.com/todotxt/todo.txt/master/README.md),
  [TODO.md](https://github.com/todomd/todo.md)).
- **Claude Code's memory** keeps a `MEMORY.md` index, one line per entry, and tells the agent to
  "merge or drop stale entries" near its size limit
  ([Claude Code docs](https://code.claude.com/docs/en/memory)).

### What they have in common

Capabilities users of these products may expect, whether or not the proposal mentions them:

- **Capture in one line**, with nothing else required, from wherever the user is.
- **One default landing place** for anything not classified yet.
- **Context added automatically**: the date, the source (a page, a requester, an integration).
- **A separate processing pass**, item by item, with a small set of outcomes: promote into real
  work, do it now when tiny, merge with a duplicate, park, delete with a reason.
- **Items leave the inbox once processed**, by a move or a conversion.
- **Deleting is a normal outcome**, and an inbox needs a policy against growing stale.
- **Grouping**: several notes about the same subject become one piece of work (GTD's project, a
  draft gathering several notes).

## Standards and libraries

### Pitfalls reported

- ProductPlan's team deleted 600+ backlog items after exporting them, and shipped faster: "If an
  idea has high enough value for customers, it will come back"
  ([ProductPlan](https://www.productplan.com/blog/backlog-bankruptcy)).
- Old items "are more likely to cause harm than good": they carry outdated context. Removing an item
  should be as easy as adding one
  ([Dan Wyks](https://betterways.substack.com/p/its-time-to-declare-backlog-bankruptcy)).
- Next.js found that closing issues on inactivity is "a poor stand-in for relevance". An agent
  researched each issue and proposed a close reason, with evidence and a confidence, to a queue a
  human reviewed: 37% were already fixed, 19% duplicates, 16% expected behaviour
  ([Next.js blog](https://nextjs.org/blog/how-we-closed-1500-github-issues)).
- Gradle labels issues `stale` after about two years without activity, and closes them after 21 days
  ([Gradle blog](https://blog.gradle.org/stale-issue-backlog)).

### One file or one file per item

- Git's `merge=union` attribute keeps the lines of both sides instead of conflict markers, but
  "tends to leave the added lines in the resulting file in random order", and the docs warn against
  using it without understanding it ([gitattributes](https://git-scm.com/docs/gitattributes)).
  Judgement: it suits one-line bullets appended at the same place, not edits or multi-line items.
- towncrier writes one fragment file per change to avoid "having one single file which developers
  all write to and produce merge conflicts", and deletes the fragments when it builds the changelog
  ([towncrier](https://towncrier.readthedocs.io/en/stable/)).
- Keep a Changelog keeps an `## [Unreleased]` section that collects entries and is emptied at
  release: a single-file precedent for a section filled now and sorted later
  ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/)).
- In Uraeda, every write to `PRIORITIES.md` happens on the default branch
  ([git decision](/specs/decisions/git.md)), so two branches never append to it at once: the merge
  conflicts towncrier avoids come from many writers on many branches, which this project does not
  have for that file.

## The code

### Important reads

- [`crates/core/src/files/priorities.rs`](/crates/core/src/files/priorities.rs): the parser knows
  four sections, `Section { Now, Next, Later, Blocked }`. Any other heading ends the current
  section, so bullets under `## Scratchpad` are skipped. Every edit splices lines in the raw text,
  so the scratchpad survives every save. The file is 685 lines, listed in the size baseline and
  frozen: a change to it splits it first ([code quality](/specs/decisions/code-quality.md)).
- [`crates/core/src/actions/priorities.rs`](/crates/core/src/actions/priorities.rs): the commit
  messages of `PRIORITIES.md` edits, `chore: add "<entry>" to <Section>` and the others listed in
  [conventions](/skills/uraeda/references/conventions.md#commits), built from a diff of entries
  only.
- [`crates/core/src/watch.rs`](/crates/core/src/watch.rs): the live-update snapshot hashes the
  parsed entries and the drafts, not the file.
- [`crates/core/src/actions/draft.rs`](/crates/core/src/actions/draft.rs): `ura draft` and the UI's
  Draft button turn a `PRIORITIES.md` entry into `specs/drafts/<slug>.md` and link the line to it.
- [`crates/core/src/check/names.rs`](/crates/core/src/check/names.rs): the top-level folders of
  `specs/` are a fixed list, `drafts`, `backlog`, `decisions`, `bugs`, `done`; another folder is
  reported. Top-level files other than `PRIORITIES.md` are not checked at all.
- [`crates/core/src/actions/init.rs`](/crates/core/src/actions/init.rs): `ura init` copies the
  `PRIORITIES.md` template, four empty sections, and creates the fixed folders.
- [`packages/web/src/QuickAdd.tsx`](/packages/web/src/QuickAdd.tsx): the ＋ button in the top bar,
  on Home and the priorities page. It opens a short form, a text field and a choice of the four
  sections, `Next` by default, adds the line without committing, and shows "Added to Next, not
  committed" with Undo. It works on narrow screens as a sheet.
- [`packages/web/src/PrioritiesPage.tsx`](/packages/web/src/PrioritiesPage.tsx) and
  [`TaskView.tsx`](/packages/web/src/TaskView.tsx): the priorities page renders the four sections,
  with drag and drop, an inline add per section, and a commit bar for uncommitted changes. Opening a
  line shows it with rename, move, remove, and Draft. Both page functions are over the 100-line
  limit, marked: a task that grows them splits them first.
- [`crates/lsp/src/commands.rs`](/crates/lsp/src/commands.rs): exactly 500 lines, at the limit; the
  editor's draft command refuses a line that is not an entry.
- [`packages/server/src/runner/message.ts`](/packages/server/src/runner/message.ts): the prompts
  that start an agent exist only for a feature's or a bug's step. An agent that processes notes
  would need a new kind of run.
- `skills/uraeda/references/bug.md`: the bug flow, an agent-authored draft, starts from a human's
  `report.md` on a `fix/` branch. No tool creates a bug yet.

### The proposal's path and existing actions

- **Capturing a note today**: the human edits `PRIORITIES.md` by hand, under `## Scratchpad`, and
  commits it. ＋ cannot target the scratchpad. On a feature branch, the human has to reach the
  default branch's checkout first.
- **Seeing notes**: the web UI never shows them, nor do `ura status`, Home, or the editor's hints.
- **Editing only the scratchpad on disk**: no live update reaches the UI, since the snapshot ignores
  it. The next edit made in the UI is then refused with "PRIORITIES.md changed on disk", and the
  page reloads ([actions/priorities.rs](/crates/core/src/actions/priorities.rs)).
- **Committing**: the change count ignores scratchpad lines, so the commit bar stays hidden when
  only notes changed. When entries changed too, the commit includes the notes under a message that
  names only the entries.
- **Discard** restores the whole file with `git restore`, and loses uncommitted notes with the
  entries.
- **Drafting a note**: `ura draft`, the UI's Draft button, and the editor's command only accept
  entries of the four sections.
- **How notes left the scratchpad**, from the history of `PRIORITIES.md`:
  - grouped into three themed drafts in one commit, `88abddf` "group the scratchpad into drafts for
    the look and feel, the session view, and text inputs";
  - appended later to an existing draft: [look and feel](/specs/drafts/look-and-feel.md) gathers six
    former notes;
  - fixed in passing, like "Text column is too slim on desktop", removed in `5839e63`, a `fix(web)`
    commit;
  - deleted, in `cc65bc7`, with no record of why.

  Eleven notes are in the scratchpad today, the oldest from 2026-10-14.

### The bugfixing feature in flight

The branch `2026-10-15-add-bugfixing` holds only its proposal: a shorter flow for bugs and small
changes, which "should itself be able to ask the user to upgrade it to a full feature". The
[draft](/specs/done/2026-10-15-add-bugfixing.md) is still on the default branch. Its small changes
are the "could be fixed quickly without a full dev flow" of this proposal: whichever lands second
links to the other.

### Rules and their owners

- **Drafts, backlog files, and `PRIORITIES.md` are written on the default branch**: the
  [git decision](/specs/decisions/git.md), enforced by `on_default_branch` in
  [`api.rs`](/crates/core/src/api.rs) and `draft_path`, and by the editor's `on_default_branch` in
  [`commands.rs`](/crates/lsp/src/commands.rs). A new inbox file or folder outside `PRIORITIES.md`
  needs the decision changed and both guards extended.
- **The four sections**: owned by `Section` in
  [`files/priorities.rs`](/crates/core/src/files/priorities.rs), and copied as title maps in four
  TypeScript files: `PrioritiesPage.tsx`, `QuickAdd.tsx`, `TaskView.tsx`, `EditorPage.tsx`. A new
  section touches the five.
- **Images live in a feature's, a bug's, or a draft's folder**: the
  [attachments decision](/specs/decisions/attachments.md). A note with a screenshot has no place
  today unless it becomes a draft.
- **The top-level folders of `specs/`**: `check_folder_names` in
  [`check/names.rs`](/crates/core/src/check/names.rs), the folder list of
  [`init.rs`](/crates/core/src/actions/init.rs), and the layouts in
  [`SKILL.md`](/skills/uraeda/SKILL.md) and the README template.

### Likely changes

- [`crates/core/src/files/priorities.rs`](/crates/core/src/files/priorities.rs): split first, under
  every option. With option A of [where notes live](#where-notes-live), a fifth section; with B or
  C, its line-splicing helpers shared with a new inbox module.
- [`skills/uraeda/`](/skills/uraeda/SKILL.md): the layout, a reference for capturing and organizing,
  the templates (`PRIORITIES.md` with A, a new file or folder with B or C), the example, and the
  README template, under every option.
- `packages/web`: ＋ gets the inbox as its default target under every option; with A, the four title
  maps get a fifth entry; with B or C, a new page, route, and navigation item.
- `crates/cli`: a capture command, with option A of [capture surfaces](#capture-surfaces).
- [`specs/decisions/git.md`](/specs/decisions/git.md) and
  [`attachments.md`](/specs/decisions/attachments.md): changed with B or C.
- `packages/server/src/runner/`: a new kind of agent run, with A or B of [organizing](#organizing).
- [`specs/PRIORITIES.md`](/specs/PRIORITIES.md): its scratchpad moved into the inbox, under every
  option.

## The proposal

### Capture and organization in one feature

The proposal asks for both, with capture first. They can be built together: the organizing step
needs the notes to be somewhere the tools can read, which capture decides.

### The name

The proposal says "scratchpad" and asks whether "Inbox" is better. A scratchpad, in common use, is a
place for working notes kept as they are; an inbox is a place items pass through until processed,
the meaning in GTD, Todoist, Things, and OmniFocus (see
[how other products do it](#how-other-products-do-it)). The proposal describes the second.

### "Could be fixed quickly without a full dev flow"

This outcome depends on the [bugfixing feature in flight](#the-bugfixing-feature-in-flight), which
defines that flow. The proposal does not say which feature comes first.

### Who processes, and when

The proposal says organization must be integrated, but not who does it, how often, or what stops the
inbox from growing: the main pitfall of every source in [pitfalls reported](#pitfalls-reported).

### Who captures

The proposal speaks of the human's own feedback. Agents also find things outside their scope while
they work: the implementation step writes them in `rulings.md` or drops them. The proposal does not
say whether agents may write notes.

### Notes with images

UI feedback often needs a screenshot, and the
[attachments decision](/specs/decisions/attachments.md) only allows images in feature, bug, and
draft folders.

## Approaches

Criteria come from the [proposal](proposal.md) (capture first, simple but structured, organization
included), the [constitution](/specs/CONSTITUTION.md) (I: humans decide; II and III: plain text in
git, every step ends with a commit; V: works without tools; VI: rules in one place, no growth of
measured size), and the active decisions [git](/specs/decisions/git.md),
[stack](/specs/decisions/stack.md), [CLI](/specs/decisions/cli.md),
[attachments](/specs/decisions/attachments.md), and
[code quality](/specs/decisions/code-quality.md).

### Naming

What the concept and its file or section are called. See [the name](#the-name).

| Option        | Meaning for a reader                       | Matches other tools                 |
| ------------- | ------------------------------------------ | ----------------------------------- |
| A. Inbox      | Items wait here until processed            | GTD, Todoist, Things, OmniFocus     |
| B. Scratchpad | Working notes, kept as they are            | None of the tools reviewed          |
| C. Notes      | Neutral, but says nothing about processing | Backlog.md's drafts are the closest |

### Where notes live

How notes are stored. See [one file or one file per item](#one-file-or-one-file-per-item) and
[important reads](#important-reads).

| Option                               | Capture by hand               | Organizing                                        | Images                           | Code                                                             | Decisions changed |
| ------------------------------------ | ----------------------------- | ------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------- | ----------------- |
| A. A section of `PRIORITIES.md`      | Add a bullet, as today        | Move, Draft, remove already work on lines         | None: a note with one is a draft | Small: a fifth section, through the existing actions and UI      | None              |
| B. One file, `specs/INBOX.md`        | Add a bullet to a second file | Every move crosses two files, with two hashes     | A new place, or none             | Medium: a parser, actions, a page, live updates                  | git               |
| C. One file per note, `specs/inbox/` | Create a file per note        | Moving a file into `drafts/` is close to drafting | Each note can hold its images    | Large: a reader, a check, a page, commit messages, a note format | git, attachments  |

With A, the inbox shares the priorities' version check: a note added while another edit is pending
is refused like any priorities edit today. With C, every note is a file and a commit, and the check
needs a format for it.

### Context at capture

What a note holds beyond its text. See [what they have in common](#what-they-have-in-common).

| Option                                           | Capture speed | Context for the organizer                   | Readable by hand |
| ------------------------------------------------ | ------------- | ------------------------------------------- | ---------------- |
| A. Text, plus a link to the feature it came from | Same          | Which feature the note is about, when known | A trailing link  |
| B. Text, the date, and the feature link          | Same          | Also the note's age, for staleness          | A trailing date  |
| C. Text only                                     | Same          | Only what the human wrote; git has the date | Clean            |

The date of a line is also in git's history (`git log -S`), though a move rewrites it.

### Organizing

Who turns notes into work, and how. See [GTD](#gtd), [Linear](#linear), and the Next.js queue in
[pitfalls reported](#pitfalls-reported).

| Option                                                 | Human effort                     | Principle I: humans decide                   | Principle III: ends with a commit | Code                                      |
| ------------------------------------------------------ | -------------------------------- | -------------------------------------------- | --------------------------------- | ----------------------------------------- |
| A. An agent proposes, as questions; the human answers  | Answering, as for clarifications | Yes                                          | Yes                               | A new run, a file in the questions format |
| B. An agent organizes and commits; the human reverts   | Reading the commit, reverting    | Placement in priorities is product direction | Yes                               | A new run                                 |
| C. The human organizes, with the UI's existing actions | Every note, by hand              | Yes                                          | Yes                               | None beyond the storage                   |

### Outcomes of a note

Where a processed note goes. See [what they have in common](#what-they-have-in-common) and
[how notes left the scratchpad](#the-proposals-path-and-existing-actions).

- A priority entry, in Now, Next, Later, or Blocked
- A new draft, possibly gathering several notes
- An addition to an existing draft, or to a feature in flight before its spec is approved
- A bug report, for the bug flow, `skills/uraeda/references/bug.md`
- A small change, for the [bugfixing feature in flight](#the-bugfixing-feature-in-flight)
- Deleted: done already, a duplicate, or not wanted

| Option                                                      | Covers the history   | Depends on the bugfixing feature |
| ----------------------------------------------------------- | -------------------- | -------------------------------- |
| A. All six, the small change once the bugfixing flow exists | Yes                  | For one outcome                  |
| B. The six, and this feature defines the small change too   | Yes                  | No, but overlaps it              |
| C. Priority, draft, delete only                             | Not fixes in passing | No                               |

### Capture surfaces

Where a note can be written from. See [important reads](#important-reads) and the
[CLI decision](/specs/decisions/cli.md).

| Option                              | Reach                                   | Code                                                                                         |
| ----------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| A. ＋ in the web UI, and `ura note` | Browser, phone, any terminal, any agent | Small: ＋ gets a target, the CLI a command                                                   |
| B. ＋ in the web UI only            | Browser and phone                       | Smallest                                                                                     |
| C. A, plus an editor command        | Also Neovim                             | The LSP file is at its size limit; the plugin's future is in doubt in the current scratchpad |

### Agents writing notes

Whether agents may add notes. See [who captures](#who-captures).

| Option                                | Out-of-scope findings      | Noise                |
| ------------------------------------- | -------------------------- | -------------------- |
| A. Yes, marked as written by an agent | Kept for the human to sort | Grows with every run |
| B. No, humans only                    | In rulings, or lost        | None                 |

### Staleness

What keeps the inbox from growing unread. See [pitfalls reported](#pitfalls-reported).

| Option                                           | Visibility                | Code   |
| ------------------------------------------------ | ------------------------- | ------ |
| A. A count of notes on Home                      | Seen at every visit       | Small  |
| B. Nothing: the human organizes when they choose | Only on the inbox itself  | None   |
| C. A, plus a nudge past a number or an age       | Also a prompt to organize | Medium |

### Needs no choice

- **One default landing place**: every option has one.
- **Items leave the inbox once processed**: every outcome removes the note, in the same commit as
  what it became.
- **Merging duplicates**: a duplicate note is deleted, or gathered into the same draft; no merge
  feature is needed.
- **Parking, like someday/maybe or snooze**: the existing **Later** section and `backlog/` folder
  already hold it.
- **Removal**: an empty inbox shows nothing; projects that do not want it never write to it.
- **Accessibility, locales, time zones, scale, offline, security**: notes are lines of text in the
  existing pages; a few dozen at most, by the history.

## Not checked

- Logseq's official journal documentation: the page was too large to fetch; only a forum thread was
  read.
- Atlassian's backlog refinement articles: their body did not load.
- Cursor's memories documentation: it redirected to a generic page.
- GTD's two-minute rule from its own site: only search snippets were seen; the rule is cited from
  the OmniFocus guide instead.
