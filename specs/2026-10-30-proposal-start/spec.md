---
status: approved
revision: 1
clarifications: 2
risk-tier: medium
plan-review: false
---

# Spec: Proposal start flow

> [!NOTE]
>
> Approved on 2026-10-30.
>
> - You approve a New page with one composer for its three cards, whose Feature card starts the
>   feature and opens its session, and a line's Start that replaces the draft, with an Undo.
> - UI behaviour changes: dropping unsaved text without asking becomes a SHOULD NOT, as you
>   answered.
> - The New page no longer writes a proposal for later: the priorities' Add, then Expand, do.
> - The core gains a typed feature start, built on Feature state's line replacement: that branch
>   merges first.
> - Old drafts of the Change and Feature cards are joined into the shared one once, never dropped.
> - Risk tier medium: the core's start changes, and the composer's stored draft changes shape.

Starting planned work from the web UI takes four steps today, and the New page's composer mixes
texts. This feature gives the Session, Change, and Feature cards one composer, has a line's Start
replace its text instead of adding to it, and starts a feature straight from it into its session. It
follows the [proposal](proposal.md), the investigation in [discovery](discovery-01.md) and
[round 02's](discovery-02.md), and the answers of [round 01](clarifications-01.md) and
[round 02](clarifications-02.md).

## Decisions

- **Changed: [UI behaviour](../decisions/ui-behaviour.md)**. Dropping unsaved text without asking
  goes from MUST NOT to SHOULD NOT, so an action whose intent is clear may replace a draft.

Relied on:

| Decision                                       | What it means for this spec                                                                   |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [Stack](../decisions/stack.md)                 | the typed feature start, its title, and its line's replacement live in the Rust core          |
| [UI behaviour](../decisions/ui-behaviour.md)   | the dialog holds a short form; a refused start says why in the dialog; reload keeps the draft |
| [UI components](../decisions/ui-components.md) | the dialog's effort is Astryx's segmented control, as the editor's                            |
| [Keyboard](../decisions/keyboard.md)           | `Ctrl+Enter`, Enter, and the undo toast's `u` stay in the one registry                        |
| [Preview](../decisions/preview.md)             | the mockups are stories with the real components                                              |
| [Testing](../decisions/testing.md)             | tests guard the core's start and the server's contract; the UI is checked in the sandbox      |

## User stories

### US1: Start a feature from the New page into its session (P1)

The human writes a feature in the Feature card, or fills it from a line, and presses `Ctrl+Enter`. A
dialog asks the slug and the research effort; Enter starts the feature and opens its session, the
discovery's message waiting in the composer, unsent.

[Name the feature](/packages/web/src/StartDialog.stories.tsx#NameTheFeature)

[Slug taken](/packages/web/src/StartDialog.stories.tsx#FeatureSlugTaken)

Key scenarios:

1. **Given** the Feature card holds "Dark mode: follow the system theme" on 2 November 2026,
   **When** the human presses `Ctrl+Enter`, **Then** "Name the feature" opens, its slug `dark-mode`
   selected, its research effort on High.
2. **Given** that dialog, **When** the human picks Low and presses Enter, **Then** the session of
   `2026-11-02-dark-mode` opens with the discovery's message unsent, and its `proposal.md` starts
   with `discovery: low` and the heading `# Dark mode: follow the system theme`.
3. **Given** the line "Proposal start flow" of **Now**, with two nested lines, filled into the
   Feature card, **When** the feature starts as `proposal-start`, **Then** in the start's commit
   that line becomes a link to `specs/2026-11-02-proposal-start/proposal.md`, and the two nested
   lines are in the proposal under its heading.

More scenarios:

1. **Given** a feature named `dark-mode` exists already, **When** the human confirms `dark-mode`,
   **Then** the dialog stays open with "A feature named dark-mode exists already.", and the composer
   keeps its text.
2. **Given** the Feature card holds the text and one pasted image, **When** the feature starts,
   **Then** the image is in the feature's `images/`, linked at the end of its proposal as
   `![Image 1](images/<file>)`.
3. **Given** the dialog open, **When** the human presses Escape, **Then** nothing starts and the
   composer keeps its text.
4. **Given** an inbox note "Export to CSV" filled into the Feature card, **When** the feature
   starts, **Then** the note leaves `INBOX.md` once the feature has started.

### US2: One composer for the three cards (P1)

The human writes once and picks what the text starts: switching between Session, Change, and Feature
keeps the text, its images, and the line or note it was filled from. A reload keeps the text and
what it came from.

[Filled from a line](/packages/web/src/NewStart.stories.tsx#FromALine)

Key scenarios:

1. **Given** the Change card holds "Centre the x in failure circles", **When** the human picks
   Feature, **Then** the Feature card's composer holds the same text, and its send reads "Start the
   feature".
2. **Given** the line "Proposal start flow" filled into the composer, **When** the page reloads and
   the human starts it as a change, **Then** that line of **Now** is replaced by the change's link,
   and no second line is added.
3. **Given** the composer holds a text, **When** the human sends it as a session, **Then** the
   session opens with it as its first message, and the composer is empty on the next visit.

### US3: A line's Start replaces the draft, with an Undo (P2)

The human presses Start on a line of the priorities: the New page opens on the Feature card, the
composer holding that line alone. A draft it replaced comes back with the toast's Undo.

[Draft replaced](/packages/web/src/NewStart.stories.tsx#DraftReplaced)

Why this priority: the first two stories already shorten the path; this one fixes the mixed texts
when a draft was left.

Key scenarios:

1. **Given** an empty composer, **When** the human presses Start on the line "Proposal start flow",
   **Then** the composer holds the line and its nested lines as bullets, with no "From
   PRIORITIES.md" line, and no toast shows.
2. **Given** the composer holds "Widen the sidebar", **When** the human presses Start on that line,
   **Then** the composer holds the line alone, and "Draft replaced" shows with Undo for 5 seconds.
3. **Given** that toast, **When** the human presses `u` within 5 seconds, **Then** the composer
   holds "Widen the sidebar" again, and no source is kept from the line.

## Replaced behaviour

- **The Feature card writes a proposal file and opens it in the editor.** Guarded by
  [`keys-pages.test.tsx`](/packages/web/src/__tests__/keys-pages.test.tsx): "US3 5: on the New page,
  `i` focuses the composer of the kind picked", which finds the "Write Proposal" box by that name.
- **A typed proposal is drafted as a line of Now and a file, in one call.** Guarded by
  [`proposal.rs`](/crates/core/tests/proposal.rs):
  `a_drafted_proposal_writes_its_line_and_its_file_in_one_call` and
  `a_refused_draft_leaves_the_priorities_and_the_folder_as_they_were`; and
  [`cache.rs`](/crates/core/tests/cache.rs):
  `a_draft_after_a_start_seen_by_the_watcher_goes_below_it`.
- **Each card keeps a text of its own.** Guarded by
  [`new-page.test.tsx`](/packages/web/src/__tests__/new-page.test.tsx): "a start that answers late
  clears only the text it sent", which reads the Change card's own text.
- **A line's Start appends the line, with a link to `PRIORITIES.md`, under the draft.** Not guarded
  by a test.

## Architecture

The core already starts a change from a typed text in one commit
([the core's start](discovery-01.md#the-cores-start)). The feature's start becomes the same typed
start with a feature's kind, so a refused slug leaves nothing behind, and the browser keeps one text
([how the feature starts from a text](discovery-01.md#how-the-feature-starts-from-a-text)). It goes
through the write queue as a proposal file's start does: the session opens once the start is
planned, its commit landing behind it.

- **The typed start**, in the core, reads a typed text as a proposal for a change or a feature. It
  owns the title rule, the first written line cut at 80 characters, the images' place and links, and
  for a feature the `discovery` frontmatter. It refuses an empty text, "a feature needs a text: its
  first line is its title".
- **The start's line replacement**, in the core, from Feature state's merge: a start given a line's
  text replaces that line of **Now** by the started folder's link, in the start's commit. It owns
  which line a start replaces, for both kinds.
- **The feature's text start**, on the server, plans the typed feature start, answers with the plan
  and the discovery's message, and queues it, as `feature.start` does for a proposal file. The
  message stays unsent: the session opens with it in the composer.
- **The New page's draft**, in the browser, one per repository: the text, its images, and its
  sources, the lines and notes it was filled from. It owns what the three cards share, keeps the
  text and the sources across reloads, and reads the old cards' drafts once.
- **The start dialog** asks the slug the core proposes, and for a feature the research effort, High
  first. It owns the one-start-at-a-time guard it has today.
- **A line's Start** fills the draft with the line and its nested lines, replacing what it held, and
  shows the undo toast when it replaced a text. It owns the insertion of a line without a link.

The Feature card's proposal drafting goes: the `proposals.draft` mutation, the core's
`draft_proposal`, its binding, and the browser's `useStartFrom`. The guide's
[flows](/specs/ui/flows.md#starting-the-agent), the [README](/README.md), the
[web UI docs](/docs/web-ui.md), and the skill's [projects](/skills/uraeda/references/projects.md)
say what the New page starts.

Tradeoffs:

- The New page no longer writes a proposal for later; a proposal to keep goes through the
  priorities.
- The build waits for Feature state's merge, which changes the same start code.
- A replaced draft is gone once its toast is.

## Edge cases

| Importance | Situation                                                              | What happens                                                                                                            |
| ---------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| High       | The line was edited in another tab before the start                    | the start adds the feature's link at the top of **Now**, and leaves the edited line, as Feature state does for a change |
| High       | The start's commit is refused by a hook                                | the toast says why, as every start's, and the composer still holds the text: it is cleared only once a start lands      |
| High       | Old drafts in both the Change and the Feature cards at the first load  | the shared draft holds the Change's text, a blank line, then the Feature's; both old entries go                         |
| Normal     | The composer is emptied after a line's Start                           | it no longer holds the line: a start from it leaves the line in **Now**                                                 |
| Normal     | A second line's Start while the first's toast shows                    | the second replaces the first; its toast's Undo brings back the first line, with its source                             |
| Normal     | The feature's slug is not one: "Dark Mode!"                            | the dialog shows the core's refusal under the field, and stays open                                                     |
| Normal     | No agent is available                                                  | the session opens with the message unsent, as it does with one                                                          |
| Niche      | The text is only spaces or heading marks                               | Send stays disabled, as today for an empty composer                                                                     |
| Niche      | A line with a file of its own is picked under the composer, or Started | its file's page opens, as today                                                                                         |
| Niche      | The draft's images after a reload                                      | they are gone, as today: only the text and its sources are kept                                                         |

## Success criteria

- **SC-001** (two steps): A line of **Now** without a file starts as a feature in two actions after
  its Start: `Ctrl+Enter`, then Enter, ending on its session page.
- **SC-002** (one commit): A feature started from the New page lands in one start commit, its
  proposal, images, and line in **Now** included; a refused slug writes nothing.
- **SC-003** (one text): Switching cards three times keeps the text byte for byte.
- **SC-004** (nothing lost): A draft replaced by a line's Start comes back whole with `u` within 5
  seconds.

## Assumptions

The points settled in round 01, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there. Settled
while writing this spec:

- **The rule softened as a SHOULD NOT alone**: the decision keeps its wording otherwise, without an
  exception named in it, as you answered "just make it a SHOULD".
- **Old drafts joined once**: the Change's and the Feature's stored texts are read into the shared
  draft at the first load, then removed, so no text is dropped
  ([data model](data-model.md#the-new-pages-draft)).
- **The Session card's text kept across reloads**, as the other two were: the shared draft is one.
- **A feature's research effort in the proposal's frontmatter** from the start, High included, so
  the proposal says it ([data model](data-model.md#a-started-features-proposal)).
- **The Feature card's placeholder stays "Write Proposal"**, its send reading "Start the feature",
  as the dialog's button does.
- **No CLI change**: `ura start` keeps starting proposal files; a typed start stays the web UI's.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Risk tier

**Medium**: the core's start gains a kind and the browser's stored draft changes shape, with no
change to a format users write.
