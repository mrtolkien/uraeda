---
status: auto-approved
spec-revision: 1
---

# Plan: Proposal start flow

**Goal:** Give the New page's three cards one composer and one stored draft, have a line's Start
replace that draft with an Undo, and start a feature from the Feature card straight into its
session, through a typed feature start in the core.

**Architecture:** The core's typed start, change-only today, takes a kind. It owns the title rule,
the images' place and links, the line of **Now** it replaces, and for a feature the `discovery`
frontmatter, for both kinds, in one plan and one commit. The binding gives it to the server as a
plan and a start, as it gives a proposal file's. The server's `feature.startText` plans it in the
same turn as `feature.start`, answers with the plan and the discovery's message, and queues the
start. In the browser, one module owns the New page's draft: its text and sources in the unsaved
store, one entry per repository, the old cards' entries joined into it once, its images kept for the
document's life. The cards read and write it; the Feature card's composer asks the slug and the
effort, then opens the session with the message unsent, as the editor's Start does. The proposal
drafting goes with every layer of it. See the [spec's architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

This branch carries the [Feature state](/specs/2026-10-30-feature-state/plan.md) branch, merged at
`287a1b9c`, whose line replacement for a typed change the spec builds on: see ruling R1.

## Review focus

1. **A feature whose start the hook refuses, after its session opened.** The New page's text stays:
   it is cleared only once the feature can be read. Its other sources stay in their files. Task 4.
2. **The Start into a composer holding only spaces.** Nothing is replaced: no toast shows. Task 3.
3. **A research effort that is not a level.** The plan refuses it, as `set_discovery` does, before
   anything is queued. Task 1.
4. **A reload after an Undo.** The draft restored is stored with its own sources, never the line's.
   Task 3.

## Global constraints

- [UI behaviour](/specs/decisions/ui-behaviour.md): "Unsaved text SHOULD NOT be dropped without
  asking." "Small edits MUST happen in place, with a dialog only to confirm an irreversible action
  or to hold a short form." "A refused write MUST put back what it showed and say why next to what
  it concerns." "A git write MUST show its progress in a toast until it lands." "Back and reload
  MUST keep the human's place and what they were reading."
- [Stack](/specs/decisions/stack.md): "Workflow logic, parsing, validation, and states MUST live in
  the Rust core." "TypeScript MUST reach the core only through the binding, never reimplementing
  it." The research effort's levels come from the core, as the editor's do.
- [UI components](/specs/decisions/ui-components.md): "Views MUST use Astryx components wherever one
  fits the job." The dialog's effort is the `SegmentedControl` the editor uses.
- [Keyboard](/specs/decisions/keyboard.md): "A shortcut MUST be declared in the key registry, and
  listened for nowhere else." The toast's `u` is `UndoKey`'s.
- [Code quality](/specs/decisions/code-quality.md): files at most 500 lines, functions at most 100,
  7 parameters, nesting 4, for Rust and TypeScript. "A new marker MUST NOT be added unless a human
  approves it in the plan." `crates/core/src/actions/start/plan.rs` is at 500 lines.
- [Testing](/specs/decisions/testing.md): the stage is `early`. "A test of the web UI MUST guard
  behaviour that is costly to lose and that using the UI would not show, such as unsaved text or a
  git write." A test of replaced behaviour is rewritten or removed in the task that replaces it.
  Each changed view is reviewed in the sandbox, in both themes, at a phone's and a desktop's width.
- Exact texts and values, from the spec and its stories:
  - The dialog: "Name the feature", field "Slug", help "Two words at most: it names the folder and
    the branch.", "Research effort" with Low, Medium, High, High picked first, button "Start the
    feature".
  - A taken slug: "A feature named dark-mode exists already.", under the field, the dialog open.
  - The empty text's refusal: "a feature needs a text: its first line is its title".
  - The Feature card: placeholder "Write Proposal", send "Start the feature".
  - The toast: "Draft replaced", with Undo, for 5 seconds, `u` pressing it.
  - The proposal: `discovery: <level>` in its frontmatter, then `# <title>`, the first written line
    cut at 80 characters, the rest as typed, then `![Image N](images/<file>)` per image.
  - The old drafts joined: the Change's text, a blank line, then the Feature's.
- The data model's [New page's draft](data-model.md#the-new-pages-draft): `text` and `sources`, one
  entry per repository; images stay with the page.

## Code read

- [`crates/core/src/actions/start/mod.rs`](/crates/core/src/actions/start/mod.rs): `run_text_with`
  starts a typed text as `Kind::Change` only, refusing an empty one: "a change needs a text: its
  first line is its title". `plan` plans a proposal file only. `Source::Text` carries the typed
  text, its images, and its line.
- [`crates/core/src/actions/start/typed.rs`](/crates/core/src/actions/start/typed.rs): `Typed::read`
  is the title rule; `proposal` writes the heading, body, and image links; `write_text` saves the
  images into `plan.destination`, which `folder_path(kind, …)` gives for either kind.
- [`crates/core/src/actions/start/plan.rs`](/crates/core/src/actions/start/plan.rs), 500 lines:
  `started_line` replaces the line of **Now** and takes its nested lines, for any kind;
  `typed_write_left` names what is left by hand.
- [`crates/core/src/files/proposal.rs`](/crates/core/src/files/proposal.rs): `discovery_levels` and
  `set_discovery`, which refuses a value that is not a level.
- [`crates/core/src/api/start.rs`](/crates/core/src/api/start.rs): `plan_start` and `start_planned`
  for a proposal file, with the plan's `day`; `start_change` for a typed change; `refusal` names a
  taken feature slug "A feature named {slug} exists already".
- [`crates/binding/src/start.rs`](/crates/binding/src/start.rs): `planStart`, `startFeature`,
  `startChange`; generated `packages/binding/index.d.ts` and `index.js`.
- [`crates/core/src/api/drafts.rs`](/crates/core/src/api/drafts.rs) and
  [`crates/binding/src/drafts.rs`](/crates/binding/src/drafts.rs): `draft_proposal`, read only by
  [`fate/draft-mutations.ts`](/packages/server/src/fate/draft-mutations.ts).
- [`packages/server/src/fate/starts.ts`](/packages/server/src/fate/starts.ts): `startPlanned` plans
  in `inPlanTurn`, refuses a slug `startQueued` holds, opens `starts` for messages kept meanwhile,
  and queues the run with the plan's `day`; `startMessage` is the discovery's message.
- [`packages/server/src/fate/change-starts.ts`](/packages/server/src/fate/change-starts.ts):
  `changeImages` turns the composer's images into bytes; `change.start` passes the line's text.
- [`packages/server/src/fate/views-proposal-file.ts`](/packages/server/src/fate/views-proposal-file.ts):
  `SlugProposalRecord`, read by the web's `useSlugProposal`.
- [`packages/web/src/NewPage.tsx`](/packages/web/src/NewPage.tsx), 417 lines: three texts
  (`useDraft()` in memory, `useTextField("new-change")`, `useTextField("new-feature-proposal")`),
  `useSources` in React state, `LineInsert` appending with `withAdded`, `FeatureComposer` and
  `titleOfText`.
- [`packages/web/src/NewChangePage.tsx`](/packages/web/src/NewChangePage.tsx): `ChangeComposer`, its
  images in its own `useDraft()`, its start clearing the text only while the store holds the one
  sent.
- [`packages/web/src/NewEntries.tsx`](/packages/web/src/NewEntries.tsx): `insertion` adds the
  `From [PRIORITIES.md]` line; `Source` carries `section`, read by the change's start.
- [`packages/web/src/fields/unsaved.ts`](/packages/web/src/fields/unsaved.ts): the unsaved store,
  `Unsaved` validated by `isUnsaved`, `forgetUnsaved` for tests' reloads.
- [`packages/web/src/useStart.ts`](/packages/web/src/useStart.ts) and
  [`session/StartingSession.tsx`](/packages/web/src/session/StartingSession.tsx): the planned starts
  by folder, the session drawn from the plan until `useLanded` reads the feature.
- [`packages/web/src/useStartFrom.ts`](/packages/web/src/useStartFrom.ts): the proposal writing
  (`proposals.draft`, `inbox.toProposalFile`, `proposals.expand`) and `takeOut`.
- [`packages/web/src/StartDialog.tsx`](/packages/web/src/StartDialog.tsx) and its
  [stories](/packages/web/src/StartDialog.stories.tsx), with the effort control already;
  [`NewStart.stories.tsx`](/packages/web/src/NewStart.stories.tsx).
- [`packages/web/src/layout/useUndoToast.ts`](/packages/web/src/layout/useUndoToast.ts):
  `useUndoToast()(message, undo)`, 5 seconds, `u`.
- Tests: [`crates/core/tests/actions.rs`](/crates/core/tests/actions.rs) (`start_text`,
  `now_line_repo`, `start_line`), [`proposal.rs`](/crates/core/tests/proposal.rs),
  [`cache.rs`](/crates/core/tests/cache.rs);
  [`start-queue.test.ts`](/packages/server/src/__tests__/start-queue.test.ts) (`heldHook`,
  `startWrite`, `idle`); [`new-page.test.tsx`](/packages/web/src/__tests__/new-page.test.tsx)
  (`renderHeld`, `filledFrom`, `start`),
  [`keys-pages.test.tsx`](/packages/web/src/__tests__/keys-pages.test.tsx).
- Validation: `nix develop -c vp run fast` after each task, `nix develop -c vp run ready` before the
  push. `nix develop -c cargo nextest run -p uraeda-core --test <file>` and
  `nix develop -c vp test <file>` while working.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Complexity tracking

| Item                                       | Why                                                                     | Simpler alternative rejected                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `start::Text`, the typed start's input     | the kind and the effort would put `run_text_with` at 9 parameters       | more parameters: over the limit of 7                                            |
| `api::TextStart` and the binding's options | the same, for the API and the napi call                                 | one function per kind: the line and image rules would be passed twice           |
| `start/line.rs`, out of `plan.rs`          | `plan.rs` is at 500 lines, and the typed start's plan grows it          | a marker on `plan.rs`: needs the human's approval                               |
| `newDraft.ts`, the New page's draft        | the three cards, the Start, the entries, and the starts share one store | `useTextField`: it holds a text only, not the sources nor the old entries' join |

## Test map

The core's tests start real repositories with `TestRepo`, on the change's day, 2026-10-16. The
server's tests run the app over a fixture repository, a pre-commit hook holding commits. The web's
tests render the app over the fixture repository through the real server, with a fake agent, the
clock set by `today`; `forgetUnsaved` stands for a reload.

| Requirement                                                      | Task | Test                                                                                      |
| ---------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------- |
| US1 key 1: `Ctrl+Enter` opens "Name the feature", High           | 4    | `new-feature.test.tsx`: "a feature typed in the Feature card starts into its session"     |
| US1 key 2: Low, then its session, the message unsent, `low`      | 1, 4 | core `a_typed_text_starts_a_feature_with_its_research_effort`; the web test above         |
| US1 key 3: the line becomes the feature's link, nested lines in  | 1    | `a_feature_started_from_a_line_of_now_replaces_it_by_its_link`                            |
| US1 more 1: a taken slug keeps the dialog and the text           | 2, 4 | server "a typed feature answers once planned…", its taken row; the web test, its row      |
| US1 more 2: an image in `images/`, linked at the end             | 1    | `a_typed_text_starts_a_feature_with_its_research_effort`, its image                       |
| US1 more 3: Escape starts nothing, the text stays                | 4    | none: the dialog's Cancel is the change's, unchanged                                      |
| US1 more 4: a note leaves `INBOX.md` once started                | 4    | none: `takeOut`, unchanged, runs on the landing; checked in the sandbox                   |
| US2 key 1: Change to Feature keeps the text, "Start the feature" | 3    | "a line's Start replaces the draft, and `u` brings it back", its card switch              |
| US2 key 2: a line's source survives a reload                     | 3    | "a line filled into the composer is still its source after a reload"                      |
| US2 key 3: a session sent empties the composer                   | 3    | none: the session's send, as today; checked in the sandbox                                |
| US3 key 1: an empty composer gets the line, no link, no toast    | 3    | "a line's Start replaces the draft…", its first Start                                     |
| US3 key 2, 3: replaced, toast, `u` brings it back                | 3    | "a line's Start replaces the draft, and `u` brings it back"                               |
| Edge: the line edited elsewhere                                  | 1    | `a_start_from_a_changed_line_adds_its_link_and_leaves_the_line`, as a change's: same code |
| Edge: the hook refuses, the text stays                           | 4    | none: Review focus 1, checked in review                                                   |
| Edge: old drafts joined once                                     | 3    | "old drafts of the Change and Feature cards are joined into one, once"                    |
| Edge: emptied composer forgets its line                          | 3    | none: the existing rule, moved                                                            |
| Edge: a second Start during the toast                            | 3    | none: the same restore, with the first line's sources                                     |
| Edge: "Dark Mode!" refused under the field                       | 1    | none: `free_folder`'s refusal, unchanged, shown as every refusal                          |
| Edge: no agent available                                         | 4    | none: the message is unsent in every case                                                 |
| Edge: only spaces or heading marks                               | 4    | none: the composer's Send, unchanged                                                      |
| Edge: a line with a file opens its page                          | 3    | none: unchanged                                                                           |
| Edge: images gone after a reload                                 | 3    | none: as today                                                                            |
| SC-001: two actions after the Start                              | 4    | the web test: `Ctrl+Enter`, then Enter                                                    |
| SC-002: one commit; a refused slug writes nothing                | 1, 2 | the core test's changed files; the server test's taken row                                |
| SC-003: three switches keep the text byte for byte               | 3    | the replace test's card switch                                                            |
| SC-004: `u` within 5 seconds brings the draft back whole         | 3    | the replace test                                                                          |
| Review focus: hook refusal after the session opened              | 4    | none: checked in review, the landing read only on a readable feature                      |
| Review focus: a Start into spaces                                | 3    | none: the replace's rule, checked in review                                               |
| Review focus: an effort that is not a level                      | 1    | the core feature test, its refused row                                                    |
| Review focus: a reload after an Undo                             | 3    | the replace test, its reload row                                                          |
| Replaced: the Feature card writes a proposal file                | 4    | `keys-pages.test.tsx` "US3 5: … `i` focuses the composer", rewritten                      |
| Replaced: a typed proposal drafted in one call                   | 5    | `proposal.rs` and `cache.rs` draft tests, removed                                         |
| Replaced: each card keeps its own text                           | 3    | `new-page.test.tsx` "a start that answers late…", rewritten on the shared text            |

## Waves

1. Task 1: the core's typed start of a feature, and its binding. Every later task consumes it.
2. Tasks 2 and 3: the server's `feature.startText` (2), and the New page's draft (3). They share no
   file.
3. Task 4: the Feature card starts the feature. It consumes tasks 2 and 3.
4. Task 5: the proposal drafting goes, and the docs say what the New page starts.

---

## Task 1: The core starts a typed feature

**Risky:** it changes the start shared by both kinds, and writes a new field in a stored file.

**Files:**

- Create: `crates/core/src/actions/start/line.rs` (`started_line`, `typed_write_left`, moved)
- Modify: `crates/core/src/actions/start/mod.rs`, `typed.rs`, `plan.rs`
- Modify: `crates/core/src/api/start.rs`, `crates/core/src/api.rs`
- Modify: `crates/binding/src/start.rs`, `packages/binding/index.d.ts`, `index.js` (generated)
- Test: `crates/core/tests/actions.rs`

**Interfaces:**

- Produces, in the core:
  - `pub struct start::Text<'a> { pub text: &'a str, pub images: &'a [Encoded], pub line: Option<&'a str>, pub kind: Kind, pub discovery: Option<&'a str> }`
  - `start::run_text_with(git: &Git, workspace: &Workspace, text: &Text<'_>, slug: Option<&str>, run: &Run<'_>) -> Result<Started, StartError>`
  - `start::plan_text(git: &Git, root: &Path, workspace: &Workspace, text: &Text<'_>, slug: Option<&str>, today: Date) -> Result<Planned, StartError>`
  - `start::run_text` keeps its signature, as a change.
  - `pub struct api::TextStart<'a> { pub text: &'a str, pub images: &'a [Vec<u8>], pub line: Option<&'a str>, pub kind: Kind, pub discovery: Option<&'a str> }`
  - `api::plan_text_start(repo: &Path, start: &TextStart<'_>, slug: Option<&str>) -> Result<PlannedView>`
  - `api::start_text(repo: &Path, start: &TextStart<'_>, slug: Option<&str>, day: Option<&str>, on_step: &dyn Fn(StartProgress)) -> Result<StartedView>`,
    in place of `api::start_change`.
- Produces, in the binding:
  - `planTextStart(repo: string, text: string, options: TextStartOptions): Promise<PlannedView>`
  - `startText(repo: string, text: string, images: Array<Buffer>, options: TextStartOptions, onStep?: (step: StartStepView) => void): Promise<StartedView>`
  - `TextStartOptions = { day?: string; discovery?: string; kind?: "feature" | "change"; line?: string; slug?: string }`,
    a feature when no kind is given.
  - `discoveryLevels(): Array<string>`, the core's levels, in order.
  - `startChange` keeps its signature, over `api::start_text`.

- [x] **Step 1: Move the line replacement out of `plan.rs`**

Move `started_line` and `typed_write_left` to `start/line.rs`, unchanged. Run
`nix develop -c cargo nextest run -p uraeda-core --test actions`: PASS before and after. Commit:
`refactor(proposal-start): move a typed start's line of Now to a module of its own`.

- [x] **Step 2: Write the failing tests**

In `actions.rs`, a `start_feature_text(repo, text, images, slug, (line, discovery))` helper beside
`start_text`, on the change's day:

```rust
/// US1.2: a typed feature's proposal holds its research effort, its title, and its image.
#[test]
fn a_typed_text_starts_a_feature_with_its_research_effort() {
    let repo = proposal_file_repo();

    let started = start_feature_text(&repo, "Dark mode: follow the system theme", &[image()], "dark-mode", (None, Some("low"))).unwrap();

    assert_eq!(started.branch, "2026-10-16-dark-mode");
    assert_eq!(in_feature(&repo, "proposal.md"),
        "---\ndiscovery: low\n---\n\n# Dark mode: follow the system theme\n\n![Image 1](images/image-1.webp)\n");
    assert_eq!(repo.changed_in("2026-10-16-dark-mode"), [priorities, proposal, image]);
    // Without an effort, High; an effort that is not a level is refused, nothing written.
    ... "kanban", (None, None) → "discovery: high"
    ... "board", (None, Some("huge")) → Err, message "discovery \"huge\" is not one of low, medium, high", no folder
}
```

```rust
/// US1.3: a feature started from a line of Now replaces it by its link, its nested line in it.
#[test]
fn a_feature_started_from_a_line_of_now_replaces_it_by_its_link() { … now_line_repo(), the link
/// `/specs/2026-10-16-amend/proposal.md`, the proposal `---\ndiscovery: high\n---\n\n# {title}\n\n{NOW_LINE}\n\n- only when nothing was pushed\n` }
```

The breaks they catch: a feature started as a change's folder; the effort missing or not written
first; the image outside the feature's folder; a line of **Now** left beside the link.

- [x] **Step 3: Run them to check they fail**

- Run:
  `nix develop -c cargo nextest run -p uraeda-core --test actions typed_text_starts_a_feature feature_started_from_a_line`
- Expected: FAIL to compile, `cannot find struct Text in module start`

- [x] **Step 4: Implement the typed start for both kinds**

`run_text_with` and `plan_text` read the text with `Typed::read`, refusing an empty one as "a {kind}
needs a text: its first line is its title", `feature` or `change`. A feature's proposal is
`Typed::proposal`'s text with `discovery` set by `files::proposal::set_discovery`, `high` when none
is given; its refusal of a level is a `StartError::Refused`, made in the plan, before any write. A
change gets no `discovery`, and refuses one. `plan_text` is `plan`'s checks for a text, as
`start::plan` is for a proposal file. The API's `TextStart` encodes the images as `start_change`
does before the write lock; `plan_text_start` reaches the default checkout as `plan_start` does, and
`start_text` runs on `day` when given, as `start_planned` does.

- [x] **Step 5: Run the task's validation**

- Run: `nix develop -c vp run --filter uraeda-binding build`, then `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 6: Commit**

`feat(proposal-start): the core starts a typed feature with its research effort`

## Task 2: The server starts a typed feature once planned

**Files:**

- Modify: `packages/server/src/fate/starts.ts`, `views-proposal-file.ts`, `sources.ts`
- Test: `packages/server/src/__tests__/start-queue.test.ts`

**Interfaces:**

- Consumes: `planTextStart`, `startText`, `discoveryLevels` (task 1).
- Produces:
  - `feature.startText`, input
    `Queued<{ discovery?: string; images?: Array<ChatImage>; line?: string; slug: string; text: string }>`,
    type `StartPlan`: `{ folder, id, message, title }`, answered once planned.
  - `SlugProposal` gains `discoveryLevels: Array<string>`.

- [x] **Step 1: Write the failing test**

```ts
test("a typed feature answers once planned with its discovery's message, then lands in one commit", async () => {
  const { hook, server } = await startServer();

  const planned = await mutate(
    server.app,
    "feature.startText",
    { discovery: "low", slug: "dark-mode", text: "Dark mode: follow the system theme" },
    PLAN_FIELDS,
  );

  const folder = planned.data.folder as string;
  expect(planned.data.message).toContain(`specs/${folder}/ on branch ${folder}`);
  // Row: the same slug again is refused at once, and nothing more is queued.
  expect((await again).error?.message).toBe("refused: A feature named dark-mode exists already");
  hook.release();
  await idle(server);
  expect(git(server.repo, "log", "-1", "--format=%s", "main")).toBe(
    "chore(dark-mode): start Dark mode: follow the system theme",
  );
  expect(git(server.repo, "show", `main:specs/${folder}/proposal.md`)).toMatch(
    /^---\ndiscovery: low\n---\n\n# Dark mode/,
  );
  // Row: the dialog's levels come from the core.
  expect(slugProposal.discoveryLevels).toEqual(["low", "medium", "high"]);
});
```

The breaks it catches: a start that waits for its landing to answer; a slug a queued typed start
holds taken twice; the effort lost between the server and the core.

- [x] **Step 2: Run it to check it fails**

- Run: `nix develop -c vp test packages/server/src/__tests__/start-queue.test.ts`
- Expected: FAIL, `no mutation feature.startText`

- [x] **Step 3: Implement `feature.startText`**

`startPlanned` takes what it plans and runs, so a proposal file's start and a text's share its turn,
its slug check, its kept messages, and its queue: the text's plan is `planTextStart`, its run
`startText` on the plan's `day`, its images from `changeImages`. The write's label is "Starting the
feature {title}", its `href` the input's, the New page by default. `SlugProposal` reads
`discoveryLevels` from the binding.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 5: Commit**

`feat(proposal-start): the server starts a typed feature once planned`

## Task 3: One draft for the New page's three cards

**Risky:** it changes the format of the browser's stored draft, and joins the old entries into it.

**Files:**

- Create: `packages/web/src/newDraft.ts`
- Modify: `packages/web/src/fields/unsaved.ts` (`Unsaved.sources`, `isUnsaved`)
- Modify: `packages/web/src/NewPage.tsx`, `NewChangePage.tsx`, `NewEntries.tsx` (`insertion`)
- Test: `packages/web/src/__tests__/new-page.test.tsx`

**Interfaces:**

- Produces:
  - `useNewDraft(): NewDraft`, with
    `NewDraft = { images; setImages; text: string; setText: (update: SetStateAction<string>) => void; sources: ReadonlyArray<Source>; insert: (entry: Entry) => void; start: (entry: Entry) => void; sent: (text: string) => void; unsavedNow: () => string | undefined }`.
  - `insert` adds an entry under the text with its link, as today; `start` replaces the draft with
    the entry alone, without its link, and shows "Draft replaced" with Undo when the draft held more
    than spaces; `sent(text)` empties the draft while the store still holds `text`.
  - `insertion(entry: Entry, { link }: { link?: boolean } = {}): string`, `link` true by default.
  - `ChangeComposer({ draft, inputRef })`, in place of `{ inputRef, sources, text }`.
  - The stored entry: key `unsavedKey(repo, "new-draft")`, `Unsaved` with
    `sources?: ReadonlyArray<Source>`. The old keys, `new-change` and `new-feature-proposal`, are
    joined into it at its first read and dropped.

- [x] **Step 1: Write the failing tests**

```ts
test("old drafts of the Change and Feature cards are joined into one, once", async () => {
  // Both old entries stored, as the cards kept them.
  … renderPage("/new?kind=change")
  expect(composerText()).toBe("Centre the x\n\nDark mode");
  expect(localStorage.getItem(oldKey("new-change"))).toBeNull();
  // A reload reads the shared draft alone: nothing is joined twice.
  forgetUnsaved(); … renderPage("/new?kind=feature")
  expect(composerText()).toBe("Centre the x\n\nDark mode");
});

test("a line's Start replaces the draft, and `u` brings it back", async () => {
  // An empty composer: the line and its nested lines, no link, no toast.
  … navigate(atRepo("/new?kind=feature"), { insert: "line:now-…" })
  expect(composerText()).not.toContain("From [PRIORITIES.md]");
  expect(screen.queryByText("Draft replaced")).toBeNull();
  // Over a draft: replaced, then back with `u`.
  … type "Widen the sidebar", Start again
  await screen.findByText("Draft replaced");
  await press("u");
  expect(composerText()).toBe("Widen the sidebar");
  // Row: switching cards three times keeps it byte for byte, and a reload keeps no line's source.
});

test("a line filled into the composer is still its source after a reload", async () => {
  … fill the line of Now from its card, forgetUnsaved(), render /new?kind=change, start()
  expect(read(repo)).toContain("- [<line>](/specs/changes/2026-10-16-<slug>/proposal.md)");
  expect(read(repo)).not.toContain("- <line>\n");
});
```

Rewrite "a start that answers late clears only the text it sent" over the shared draft: its newer
text is the shared one, and stays.

The breaks they catch: an old entry dropped or joined on every load; the Start appending; the Undo
restoring nothing, or the line's sources; sources forgotten by a reload, the line added twice.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/new-page.test.tsx`
- Expected: FAIL, the joined test's composer text `""`

- [x] **Step 3: Implement the shared draft**

`newDraft.ts` owns the entry: its text and sources written together, an emptied text forgetting its
sources, as `useSources` did. Its images and the session's run stay in a `useDraft` kept by the
repository's key, for the document's life. The New page draws each card's composer from it: the
session's send calls `sent`, the change's start too, and `LineInsert` calls `start`. The undo
restores the text and the sources the draft held before.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 5: Commit**

`feat(proposal-start): one draft for the New page's three cards, a line's Start replacing it`

## Task 4: The Feature card starts the feature into its session

**Files:**

- Create: `packages/web/src/NewFeatureComposer.tsx`, from `FeatureComposer` in `NewPage.tsx`
- Modify: `packages/web/src/NewPage.tsx`, `useStart.ts` (`PlannedStart`, `planned`),
  `session/StartingSession.tsx` (`useLanded`)
- Modify: `packages/web/src/useStartFrom.ts`, renamed `takeOut.ts`, the proposal writing removed
- Test: `packages/web/src/__tests__/new-feature.test.tsx`; `keys-pages.test.tsx` rewritten

Start from: [Name the feature](/packages/web/src/StartDialog.stories.tsx#NameTheFeature),
[Slug taken](/packages/web/src/StartDialog.stories.tsx#FeatureSlugTaken), and
[Filled from a line](/packages/web/src/NewStart.stories.tsx#FromALine).

**Interfaces:**

- Consumes: `feature.startText` and `SlugProposal.discoveryLevels` (task 2); `useNewDraft` (task 3).
- Produces:
  - `PlannedStart` gains `landed?: () => void`, called once its feature can be read, and its
    `proposal` becomes optional; `remember(repo: string, folder: string, start: PlannedStart)` keeps
    a plan made outside the editor.
  - `takeOut(fate, taken)` and `Taken`, moved to `takeOut.ts`, unchanged.

- [ ] **Step 1: Write the failing test**

```ts
test("a feature typed in the Feature card starts into its session", async () => {
  … renderPage("/new?kind=feature") with a fake agent
  await type(composer("Write Proposal"), "Dark mode: follow the system theme");
  await press("Control+Enter");
  const dialog = await screen.findByRole("dialog", { name: "Name the feature" });
  expect(slugOf(dialog)).toBe("dark-mode");
  expect(within(dialog).getByRole("radio", { name: "High" })).toBeChecked();
  await click(within(dialog).getByRole("radio", { name: "Low" }));
  await press("Enter");
  await waitFor(() => expect(address()).toBe(atRepo(sessionPath("2026-10-16-dark-mode"))));
  expect(sessionComposer().textContent).toContain("specs/2026-10-16-dark-mode/");
  await quiet();
  expect(git(repo, "show", "main:specs/2026-10-16-dark-mode/proposal.md")).toMatch(/^---\ndiscovery: low\n---/);
  // Row: once landed, the New page's composer is empty; a second start of the slug stays open.
  … "A feature named dark-mode exists already." in the dialog, the composer's text kept
});
```

Rewrite "US3 5: on the New page, `i` focuses the composer of the kind picked" for one composer: `i`
focuses the "Write Proposal" box on the Feature card, and the change's after `c`.

The breaks it catches: the proposal file written and the editor opened; the message sent; the effort
not passed; the text dropped before the start landed, or kept after.

- [ ] **Step 2: Run it to check it fails**

- Run: `nix develop -c vp test packages/web/src/__tests__/new-feature.test.tsx`
- Expected: FAIL, no dialog named "Name the feature"

- [ ] **Step 3: Implement the Feature card's start**

The composer takes images, sends with "Start the feature", and opens "Name the feature" with the
slug the core proposes and the levels it gives, High picked. Enter calls `feature.startText` with
the text, its images, the slug, the level, and the first source that is a line of **Now** without a
file, as the change's start finds it. A refusal shows under the field, the dialog open. Once
planned, the plan is remembered with its message, its session opens with the message unsent, and its
`landed` empties the draft, through `sent`, and takes the other sources out of their files.

- [ ] **Step 4: Run the task's validation, and review the New page in the sandbox**

- Run: `nix develop -c vp run fast`; then `vp run sandbox`, the New page and the dialog in both
  themes, at a phone's and a desktop's width.
- Expected: PASS

- [ ] **Step 5: Commit**

`feat(proposal-start): the Feature card starts the feature into its session`

## Task 5: The proposal drafting goes, and the docs say what New starts

**Files:**

- Delete: `crates/core/src/api/drafts.rs`, `crates/binding/src/drafts.rs`,
  `packages/server/src/fate/draft-mutations.ts`
- Modify: `crates/core/src/api.rs`, `crates/binding/src/lib.rs`,
  `packages/server/src/fate/mutations.ts`, the generated binding files
- Modify: `crates/core/tests/proposal.rs`, `cache.rs`: the three draft tests removed
- Modify: `specs/ui/flows.md` (Starting the agent), `README.md`, `docs/web-ui.md`,
  `skills/uraeda/references/projects.md`

- [ ] **Step 1: Remove the drafting and its tests**

`a_drafted_proposal_writes_its_line_and_its_file_in_one_call`,
`a_refused_draft_leaves_the_priorities_and_the_folder_as_they_were`, and
`a_draft_after_a_start_seen_by_the_watcher_goes_below_it` go, as the spec's replaced behaviour
lists. Code only they used goes with them.

- [ ] **Step 2: Write the docs**

The flows guide's Start fills the composer with the line alone, replacing the draft with an Undo,
and the Feature card starts the feature into its session. The README's first proposal and the web UI
docs say the same; the skill's projects say what the New page starts.

- [ ] **Step 3: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [ ] **Step 4: Commit**

`refactor(proposal-start): the New page's proposal drafting goes`
