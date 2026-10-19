---
status: auto-approved
spec-revision: 1
---

# Plan: Decisions pass

**Goal:** Decisions state intent under a written bar, the decisions page draws rules as the spec
page does, and a "Check decisions" run asks the human how to keep the ledger clean.

**Architecture:** The bar is text, written once in the skill's `spec.md`. The check mirrors the
inbox triage: one questions file on the default branch, answered in the round's view. To avoid a
second copy of the triage's code, the triage's core, binding, server, and web code is first made
generic over a `DefaultRound`, an enum in the core with two members, `Triage` and `DecisionsCheck`,
that owns each file's path, id, and commit subjects. That structural task changes no behaviour. Then
the core learns the check's file, its candidates, and their comparison against the active decisions.
The rules view needs no new parser: the core's `compare(name, Some(text), Some(text))` already cuts
a decision into rules with strength and check, and the ledger sends the "Rules" section's parts to
the page, which draws them with `PartText` as the spec page does. See the
[spec's architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

- **Candidates never reach the ledger or the spec's diff**: files under `specs/decisions-check/**`
  are not decisions of `specs/decisions/`. Task 3 tests that the ledger lists none, and task 4 that
  `ura check` validates them as decisions without calling them unknown files.
- **A triage still works while a check waits, and the reverse**: the two files share code and may
  exist together, each with its own id, hash, and commit subject. Task 2 tests that a write to one
  never touches the other.
- **A question naming a candidate that does not exist, or a candidate no question names**: the
  file's view must not crash. Task 4 tests that the option shows no candidate, and `ura check`
  reports the stray folder.

## Global constraints

Every task follows these, copied from the active decisions and the constitution:

- "Each rule MUST live in one place. A copy in another layer or language MUST be justified in the
  plan's complexity tracking." (constitution VI)
- "Warnings, size, complexity, and duplication measured by the project's checks MUST NOT go up."
  (constitution VI)
- "Rust and TypeScript functions and files MUST stay within limits on length, parameters, and
  nesting, enforced by the existing linters." A new lint marker MUST NOT be added.
  ([Code quality](../decisions/code-quality.md))
- "A kind of information MUST be drawn by one shared component on every page that shows it."
  ([UI coherence](../decisions/ui-coherence.md))
- The new views use Astryx and the theme, and the two mockups are stories of the real components:
  start from them ([UI components](../decisions/ui-components.md),
  [Preview](../decisions/preview.md)).
- A change never switches a checkout, and an agent run goes through the adapter in the main checkout
  ([Git](../decisions/git.md), [Agents](../decisions/agents.md)).
- The check never offers an edit to the constitution: "only a human amends it".
- Skill, template, and example agree: a step's reference, its template, and the example's file
  ([AGENTS.md](/AGENTS.md)).
- No file or commit names a coding agent, a model, or an AI tool ([AGENTS.md](/AGENTS.md)).

## Code read

- The triage's core: [`api/answers/triage.rs`](/crates/core/src/api/answers/triage.rs) (read, save,
  notes, submit, retry, all on the default branch's checkout, under `write_lock`),
  [`actions/inbox.rs`](/crates/core/src/actions/inbox.rs) (`TRIAGE`, `TRIAGE_ANSWERED`,
  `ensure_triage`, `submit_triage`, `retry_triage`, `Inbox.triage`),
  [`check/mod.rs`](/crates/core/src/check/mod.rs) (`Checked::Triage`, `kind_of`),
  `check/sections.rs`, `check/values.rs`, [`workspace.rs`](/crates/core/src/workspace.rs) (`triage`
  read with the priorities), and [`watch.rs`](/crates/core/src/watch.rs). Its tests are
  [`tests/triage.rs`](/crates/core/tests/triage.rs).
- The binding: [`inbox_writes.rs`](/crates/binding/src/inbox_writes.rs) has the six triage
  functions. The server: `fate/sources.ts` (`TRIAGE_ID` among workflow files), `fate/views.ts`,
  `fate/inbox-mutations.ts` (`triage.answer|notes|retry|submit`), `live.ts`, and
  [`runner/triage-messages.ts`](/packages/server/src/runner/triage-messages.ts). Tests:
  `__tests__/inbox.test.ts`, `live.test.ts`, `runner/__tests__/message.test.ts`.
- The web: [`roundTarget.ts`](/packages/web/src/roundTarget.ts)
  (`RoundTarget = { folder } | { triage: true }`, `Hashes`, `useRoundWrites`), `RoundPage.tsx`,
  `RoundSubmit.tsx`, `TriagePage.tsx`, `InboxTriage.tsx` (the buttons and banners), `data.ts`
  (`useTriage`), `routes.tsx` (`{ page: "triage" }`), `App.tsx`. Tests: `__tests__/triage.test.tsx`,
  which renders the app on a copy of the fixture repository with a real core and server, as
  [`helpers.tsx`](/packages/web/src/__tests__/helpers.tsx) sets up.
- The comparison: [`decisions/change.rs`](/crates/core/src/decisions/change.rs) `compare`, used by
  `decisions/branch.rs` for the spec's diff; `FileView.decision_changes` carries it to the page;
  [`DecisionCard.tsx`](/packages/web/src/spec/DecisionCard.tsx) draws it with
  [`RuleLine.tsx`](/packages/web/src/spec/RuleLine.tsx)'s `PartText`.
- The ledger: [`api/ledger.rs`](/crates/core/src/api/ledger.rs) reads only the files directly in
  `specs/decisions/` (`disk_texts`, `tip_texts` skip subfolders), so candidates in
  `specs/decisions-check/` are already outside it; `DecisionDetail.tsx` draws a decision with
  `Blocks`.
- The check's file walk: `kind_of` in `check/mod.rs` types a file by its folder; a decision is a
  `.md` directly in a folder named `decisions`.
- The mockups already in the repository: `decisions/DecisionRules.stories.tsx` and
  `decisions/DecisionCheck.stories.tsx`.
- **The spec's unverified item, verified by reading.**
  [Change, "Decisions"](/skills/uraeda/references/change.md#decisions) lets a change edit a decision
  in place on its branch as `proposed`, and the round asks to approve it, "A" activating it. It does
  not say that a change may delete a decision file, as a merge does. Ruling 1 settles that a merge
  is a change with an edited decision and a removed one, the removal named in the round like the
  edit. No stop is needed: the spec says a feature is the fallback only if a change cannot carry the
  edit.
- Validation: `nix develop -c cargo nextest run`, `nix develop -c cargo clippy --all-targets`,
  `nix develop -c vp check`, `nix develop -c vp test`, and `ura check` on `specs/`.

## Constitution check

| I. Humans in control                                                   | II. Plain text                                  | III. Async                                               | IV. Review effort | V. Tools optional                                                   | VI. Checked code                                                       |
| ---------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------- | ----------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| ✅ The check's options are edits to decisions, applied only on a "yes" | ✅ The check and its candidates are plain files | ✅ The check is a committed file, resumable by any agent | ✅                | ✅ The reference works by hand; the tools only validate and draw it | ✅ One generic round code, with the tests of the triage kept unchanged |

## Complexity tracking

| What                                          | Why it is needed                                                                                  | Simpler alternative rejected                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `DefaultRound` enum (core)                    | Two files answered the same way on the default branch: the human chose to share the triage's code | A second copy of each triage function, which the human rejected in Q3            |
| `RoundTarget = { folder } \| { round }` (web) | The page's answers go to a feature or to a default-branch round, by id                            | Another `isDecisionsCheck` branch in every function of `roundTarget.ts`          |
| `Candidate` view type (core)                  | The questions view needs each option's candidate, compared with the active decision               | Sending raw texts and comparing in the browser, which would copy the core's rule |
| `Decision.rules` (core)                       | The decisions page draws rules with the spec's component, from the one comparison                 | A second Markdown parse of rules in TypeScript, which would copy a rule          |

No constitution exception. No unit grows past a limit: the largest touched, `actions/inbox.rs` (448
lines) and `inbox_writes.rs` (323 lines), stay under 500 lines because the generic functions replace
the triage's, and any task that finds a function over 100 lines starts with a structural step.

## Test map

The core's tests run on a temporary repository with the fixture files, as `tests/triage.rs` does.
The server's run the real binding on a copy of the fixture repository. The web's render the whole
app on that copy with the real server, as `__tests__/triage.test.tsx` does. Scenarios that are an
agent's behaviour have no code to drive: they are the reference's text, and the example and the
fixture, which `ura check` validates in task 4; each says so below.

| Scenario                                                                     | Task | Test                                                                                                                                 |
| ---------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| US1 1, 2, 3 and the more scenario: the bar, an assumption or a decision      | 1    | Agent behaviour: the bar's text and examples; `ura check` on the skill's example                                                     |
| US1 3, no flag, timeout, or file in a rewritten decision (SC-002)            | 1    | `crates/core/tests/decisions_bar.rs`: no decision of `specs/decisions/` has a `--flag` or a unit of time that its checks do not name |
| US2 1: the first rule shows a green "Must" and "Checked by review."          | 3    | `decision-rules.test.tsx`: open UI coherence, assert the "Must" icon and the check line                                              |
| US2 2: a MUST NOT shows the same red icon and name on both pages (SC-001)    | 3    | `decision-rules.test.tsx`: the decisions page and the spec page of a fixture draw "Must not" through `PartText`                      |
| US2 3: a rule with no check shows icon and words only                        | 3    | `decision-rules.test.tsx`                                                                                                            |
| US3 1: a question names two decisions, option A's candidate in `q1-a/`       | 4    | `decisions_check.rs`: the view of a fixture check holds `candidates` for `q1` option `a`                                             |
| US3 1, 2: the merge, the shorter text, and keeping it                        | 1, 4 | Agent behaviour: the reference's text and the example; `ura check` on the example (task 4)                                           |
| US3 3: answering A starts a change, and the check and candidates are deleted | 5, 6 | Agent behaviour: the reference's apply steps (task 6); task 5 tests the apply message                                                |
| US3 4: a waiting check disables the button and opens its page                | 7    | `decisions-check.test.tsx`                                                                                                           |
| More 1: no option changes the constitution                                   | 4    | `decisions_check.rs`: `ura check` reports a candidate named `CONSTITUTION.md`                                                        |
| More 2: no findings, one question                                            | 4    | Agent behaviour: the reference and the template; the fixture holds one confirming question                                           |
| Edge: a decision changed after the check wrote its option                    | 4    | Review focus below; the reference tells the apply run to skip it; the view shows both texts                                          |
| Edge: a second check requested while one waits                               | 7    | `decisions-check.test.tsx`                                                                                                           |
| Edge: a rule has no "Checked by" words                                       | 3    | `decision-rules.test.tsx`                                                                                                            |
| Edge: an unreadable decision file                                            | 3    | `ledger.rs`: an unreadable file has empty `rules` and keeps its problem                                                              |
| SC-003: `ura check` reports no problem on the ledger and on a check's files  | 4    | `decisions_check.rs`: `api::check` on the fixture check; `ura check specs/` on the repository                                        |
| SC-004: one questions file per run, none after applying                      | 4, 6 | `decisions_check.rs`: a second check is refused as the triage is; the apply deletes the files (reference)                            |
| Review focus: candidates never reach the ledger                              | 3    | `ledger.rs`                                                                                                                          |
| Review focus: a triage and a check together                                  | 2    | `tests/default_rounds.rs`                                                                                                            |
| Review focus: a stray or missing candidate                                   | 4    | `decisions_check.rs`                                                                                                                 |

The candidate of the stale-option edge case compares the active decision as it is now, so a human
sees the moved text in the diff, and the reference makes the apply run compare each decision's
history with the check's commit.

## Waves

1. **Wave 1: tasks 1 and 2.** The bar is skill text only. The generic round changes the core,
   binding, server, and web. They share no file.
2. **Wave 2: tasks 3 and 4.** The rules view changes `api/ledger.rs`, `DecisionDetail.tsx` and the
   binding's types. The check's file changes `check/`, `workspace.rs`, `view.rs`, and the binding's
   types. The generated `packages/binding/index.d.ts` is regenerated after the merge, not merged.
3. **Wave 3: tasks 5 and 6.** The server's messages and mutations, and the skill's check files: task
   6 needs task 4's validation, and neither touches the other's files.
4. **Wave 4: task 7.** The web page consumes task 5's messages and ids.

---

## Task 1: The bar

**Files:**

- Modify: `skills/uraeda/references/spec.md` ("What is a decision", "Writing a decision", the
  self-review and red flags), `skills/uraeda/references/writing.md` (a decision, rules 33 to 37),
  `skills/uraeda/references/discovery.md` ("what to ask and what to settle"),
  `skills/uraeda/assets/templates/specs/decisions/decision-topic.md`
- Create: `crates/core/tests/decisions_bar.rs`

**Interfaces:**

- Produces: the fourth test in `spec.md#what-is-a-decision`, named "Intent, not mechanism", with the
  examples of the spec's US1: "harnesses must not use CLI flags" is an assumption; "agents never run
  with permissions skipped" is a decision, written without the flag's name; a hard value the human
  chose, like 30 days, stays and the Why links the answer. The other files link to it and repeat
  nothing. `ura check` gains no measure.

- [x] **Step 1: Write the failing test**

```rust
// crates/core/tests/decisions_bar.rs
#[test]
fn no_decision_names_a_mechanism_its_checks_do_not() {
    for (name, text) in decisions_of_the_repository() {
        for rule in rules_of(&text) {
            assert!(
                mechanisms_in(&rule.words).iter().all(|m| rule.check.contains(m)),
                "{name}: a rule names {:?}, which its check does not",
                mechanisms_in(&rule.words)
            );
        }
    }
}
```

`decisions_of_the_repository` reads `specs/decisions/*.md` from the repository's root. A mechanism
is a `--flag`, a number followed by a unit of time (`seconds`, `minutes`, `days`), or a backticked
file name with an extension, outside links. The break it catches: a rewritten decision that drifts
back to a flag, a timeout, or a file that nothing checks.

- [x] **Step 2: Run it to check it fails or passes on the rewritten ledger**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test decisions_bar`
- Expected: PASS on the rewritten ledger. If a decision fails, fix its rule's wording, keeping the
  intent, and note it in the pull request: the human approved the rewrite, so a rule that names a
  value it checks stays.

- [x] **Step 3: Write the bar in `spec.md`, and link it from the other files**

Add the fourth test and its examples to "What is a decision". In "Writing a decision" and the
self-review, add: "Is each rule the human's goal or approach, or a value the code holds?" Replace
the text of `writing.md`'s decision rules, `discovery.md`'s and the template's by a link to it,
keeping `writing.md`'s limit of 10 rules.

- [x] **Step 4: Run the project's validation**

- Run: `nix develop -c vp check` then `nix develop -c cargo nextest run -p uraeda-core` and
  `ura check`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add skills crates/core/tests/decisions_bar.rs
git commit -m "feat(decisions-pass): a decision states intent, not mechanism"
```

## Task 2: One code for the default branch's rounds

**Risky:** several callers share the rule that answers a default-branch round: the triage's core,
binding, server, and web. A change here that breaks the triage breaks answering the inbox.

**Files:**

- Create: `crates/core/src/actions/default_round.rs` (`DefaultRound`)
- Modify: `crates/core/src/actions/inbox.rs`, `crates/core/src/api/answers/triage.rs` (renamed
  `default_round.rs`), `crates/core/src/check/mod.rs`, `check/sections.rs`, `check/values.rs`,
  `crates/core/src/workspace.rs`, `crates/core/src/watch.rs`, `crates/core/src/api/mod.rs` exports,
  `crates/binding/src/inbox_writes.rs`, `packages/server/src/fate/sources.ts`, `fate/views.ts`,
  `fate/inbox-mutations.ts`, `live.ts`, `packages/web/src/roundTarget.ts`, `RoundPage.tsx`,
  `RoundSubmit.tsx`, `TriagePage.tsx`, `data.ts`
- Test: `crates/core/tests/default_rounds.rs`; the existing `crates/core/tests/triage.rs`,
  `packages/server/src/__tests__/inbox.test.ts`, and `packages/web/src/__tests__/triage.test.tsx`
  must pass without a change to their assertions, only to the names they call.

**Interfaces:**

- Produces (core, `uraeda_core::actions::default_round`):

```rust
pub enum DefaultRound { Triage, DecisionsCheck }
impl DefaultRound {
    pub fn path(self) -> &'static str;        // "specs/INBOX-TRIAGE.md" | "specs/DECISIONS-CHECK.md"
    pub fn id(self) -> &'static str;          // "inbox-triage" | "decisions-check"
    pub fn answered_subject(self) -> &'static str; // "chore: answer the inbox triage" | "chore: answer the decisions check"
    pub fn from_id(id: &str) -> Option<Self>;
}
```

The functions of `api/answers/triage.rs` become `read_round(repo, round)`,
`save_round_answer(repo, round, question, letters, comment, previous, base)`, `save_round_notes`,
`submit_round`, `retry_round`, each taking a `DefaultRound` first, and the triage's names stay as
one-line wrappers only if the binding or tests need them. The binding's functions take the round's
id as a string and refuse an unknown id. `Checked::Triage` becomes
`Checked::DefaultRound(DefaultRound)`; `Workspace.triage` stays, and
`Workspace.decisions_check:   Option<String>` is read beside it, `None` until task 4 adds the file
(the field is added here, its reader in task 4).

- Produces (server): the mutations `defaultRound.answer|notes|retry|submit`, each with an `id` in
  its input; the `triage.*` names are removed. `WorkflowFile` ids `inbox-triage` and
  `decisions-check` both resolve through `readRound`.
- Produces (web): `RoundTarget = { folder: string } | { round: string }`, `isDefaultRound(target)`
  replacing `isTriage`; `useRound(id)` replacing `useTriage`. The triage page passes
  `{ round: "inbox-triage" }`.
- Built beyond the interfaces above: `api::default_round(id)` (core, refuses an unknown id, used by
  the binding), `DefaultRound::ALL`, `file_name()` and `from_file_name()` (the check's file kind and
  template name), `actions::default_round::{ensure_unchanged, submit, retry}`; the binding's
  `readRound|saveRoundAnswer|saveRoundNotes|retryRound|submitRound(repo, id, ...)`; the server's
  `TRIAGE_ID`, `DECISIONS_CHECK_ID`, `DEFAULT_ROUND_IDS` and `DEFAULT_ROUND_FILES` in
  `fate/views.ts`; the web's `TRIAGE_ID` in `roundTarget.ts`. `Checked::DefaultRound` already types
  `DECISIONS-CHECK.md` as a round (status field, answers, no template yet), and the watcher's inbox
  hash includes it. Step 2 did not run as written: the restructure and its tests were written
  together, and the breaks below stood in for it.

- [x] **Step 1: Write the failing tests**

```rust
// crates/core/tests/default_rounds.rs
#[test]
fn a_write_to_the_triage_never_touches_a_waiting_check() {
    let repo = repo_with_both_files();
    let check_before = read(&repo, "specs/DECISIONS-CHECK.md");

    api::save_round_answer(repo.path(), DefaultRound::Triage, "Q1", &letters(&["A"]), "", "", &base(&repo, DefaultRound::Triage)).unwrap();

    assert_eq!(read(&repo, "specs/DECISIONS-CHECK.md"), check_before);
}

#[test]
fn each_round_commits_with_its_own_subject() { /* submit each, check `git log -1 --format=%s` */ }

#[test]
fn a_save_based_on_the_other_rounds_hash_is_refused() { /* base of the triage used on the check */ }
```

The `repo_with_both_files` helper writes the fixture triage and a minimal check file (the plain
`INBOX-TRIAGE.md` fixture text under the check's name, with its title changed) in one commit. The
break each test catches: a generic function that hard-codes one file's path, one commit subject, or
one hash.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test default_rounds`
- Expected: FAIL to compile, `cannot find type DefaultRound in this scope`

- [x] **Step 3: Restructure, with no behaviour change**

Move the triage's constants, `ensure_triage`, `submit_triage`, `retry_triage`, and the API's
functions behind `DefaultRound`, as the interface says. Update the check's kind, the workspace, the
watcher (a change of either file counts as the inbox's change), the binding, the server, and the web
to the generic names. Rename the calls in the existing triage tests only.

- [x] **Step 4: Run the project's validation**

- Run: `nix develop -c cargo nextest run`, `nix develop -c cargo clippy --all-targets`,
  `nix develop -c vp check`, and `nix develop -c vp test` (the server's and the web's suites,
  including `triage.test.tsx`)
- Expected: PASS, with the triage tests unchanged in their assertions

- [ ] **Step 5: Commit**

```bash
git add crates packages
git commit -m "refactor(decisions-pass): answer default-branch rounds through one code"
```

## Task 3: Rules drawn as the spec page draws them

**Start from:** `packages/web/src/decisions/DecisionRules.stories.tsx`, story `Open`.

**Files:**

- Modify: `crates/core/src/api/ledger.rs` (`Decision`, the reader of each text),
  `packages/web/src/decisions/DecisionDetail.tsx`; regenerate the binding's `index.d.ts` as the
  repository's build does
- Create: `packages/web/src/decisions/DecisionRules.tsx`
- Test: `crates/core/tests/ledger.rs`, `packages/web/src/__tests__/decision-rules.test.tsx`

**Interfaces:**

- Consumes: `decisions::compare(name, Some(text), Some(text))`.
- Produces: `Decision.rules: Vec<PartChange>`, the kept parts of the decision's `## Rules` section,
  empty for an unreadable file or one without the section; `DecisionRules({ parts })` draws each
  part with `PartText` (intent flag off) under the pane's "Rules" heading. `DecisionDetail` draws
  the decision's intent and other sections with `Blocks` as now, and leaves the `## Rules` section's
  blocks out, so each rule is drawn once.

- [x] **Step 1: Write the failing tests**

```ts
// packages/web/src/__tests__/decision-rules.test.tsx
test("a MUST rule shows a green Must icon and its check on a muted line", async () => {
  await renderPage("/decisions/ui-coherence");
  const rule = await screen.findByText(/drawn by one shared component on every page/);
  expect(within(rule.closest("li, div")!).getByRole("img", { name: "Must" })).toBeTruthy();
  expect(screen.getByText("Checked by review.")).toBeTruthy();
});

test("the decisions page and the spec page name a MUST NOT the same way", async () => {
  const onLedger = await mustNotIconOf("/decisions/<a fixture decision with a MUST NOT>");
  const onSpec = await mustNotIconOf("/f/<the fixture feature listing that decision>");
  expect(onLedger.accessibleName).toBe(onSpec.accessibleName);
  expect(onLedger.color).toBe(onSpec.color);
});

test("a rule with no check shows its icon and words only", async () => {
  /* no "Checked by" line */
});
```

```rust
// crates/core/tests/ledger.rs
#[test]
fn rules_of_a_decision_are_its_kept_parts_with_strength_and_check() { /* strength, check, text */ }
#[test]
fn an_unreadable_decision_has_no_rules_and_keeps_its_problem() {}
#[test]
fn files_under_decisions_check_are_not_in_the_ledger() { /* a candidate in specs/decisions-check/q1-a/x.md */ }
```

The tests read the fixture repository's `git` decision (a MUST with its check) and its
`task-storage` decision, whose MUST NOT the spec page's feature also lists, so the fixtures need no
new file (ruling R2). The break each test catches: the page drawing a rule as a plain bullet, a
second renderer with its own colours, a candidate listed as a decision.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test ledger` and
  `nix develop -c vp test run packages/web/src/__tests__/decision-rules.test.tsx`
- Expected: FAIL, `no field rules on type Decision`, and
  `Unable to find an accessible element with the role "img" and name "Must"`

- [x] **Step 3: Implement `rules` and `DecisionRules`**

The ledger fills `rules` from the compared "Rules" section for each readable decision, over the same
text it already reads. The page's `DecisionRules` is built from the story's markup, with the styles
of the spec page's `RuleLine`.

- [x] **Step 4: Run the project's validation**

- Run: `nix develop -c cargo nextest run`, `nix develop -c vp check`, `nix develop -c vp test`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add crates packages fixtures
git commit -m "feat(decisions-pass): draw a decision's rules as the spec page does"
```

## Task 4: The check's file and its candidates

**Files:**

- Modify: `crates/core/src/check/mod.rs` (`kind_of`, the walk), `crates/core/src/workspace.rs` (read
  the check's text), `crates/core/src/api/answers/default_round.rs` (the check's view),
  `crates/core/src/view.rs` (`FileView.candidates`), `crates/core/src/watch.rs`; regenerate the
  binding's `index.d.ts`
- Create: `crates/core/src/decisions/candidates.rs`, `fixtures/DECISIONS-CHECK.md`,
  `fixtures/decisions-check/q1-a/<topic>.md` (the fixture's candidate, a valid decision,
  `status: proposed`)
- Test: `crates/core/tests/decisions_check.rs`

**Interfaces:**

- Consumes: `DefaultRound::DecisionsCheck` from task 2, `decisions::compare`.
- Produces:

```rust
#[napi(object)]
pub struct Candidate {
    pub question: String,   // "q1"
    pub option: String,     // "a"
    pub change: DecisionChange, // the candidate against the active decision of the same name
}
// FileView.candidates: Vec<Candidate>, empty for every file but the check
```

`decisions::candidates::read(root: &Path) -> Vec<Candidate>` reads
`specs/decisions-check/q<N>-<letter>/<topic>.md` from the default branch's checkout, comparing each
against `specs/decisions/<topic>.md`, `None` before for a new decision. `ura check` types a `.md`
directly in a folder named `q<N>-<letter>`, inside `specs/decisions-check/`, as a decision, and
`DECISIONS-CHECK.md` in `specs/` as a round of questions, like the triage. It reports as a problem a
candidate that is not a decision, a folder not named `q<N>-<letter>`, and a file named
`CONSTITUTION.md` ("only a human amends the constitution").

- [ ] **Step 1: Write the failing tests**

```rust
// crates/core/tests/decisions_check.rs
#[test]
fn the_view_of_a_check_holds_each_options_candidate_compared_with_the_active_decision() {
    let repo = check_repo(); // fixtures: the check, and q1-a/ui-components.md
    let view = api::read_round(repo.path(), DefaultRound::DecisionsCheck).unwrap().unwrap();
    let candidate = &view.candidates[0];
    assert_eq!((candidate.question.as_str(), candidate.option.as_str()), ("q1", "a"));
    assert_eq!(candidate.change.kind, "changed");
    assert!(candidate.change.sections.iter().any(|s| s.parts.iter().any(|p| p.kind != "kept")));
}

#[test]
fn ura_check_reports_nothing_on_a_check_and_its_candidates() { /* api::check, no problems */ }

#[test]
fn a_candidate_that_edits_the_constitution_is_a_problem() { /* q1-a/CONSTITUTION.md */ }

#[test]
fn a_stray_folder_is_reported_and_an_option_with_no_candidate_shows_none() {}

#[test]
fn a_second_check_is_refused_while_one_waits() { /* as the triage's */ }
```

The break each test catches: a candidate checked as an unknown file or not at all, a candidate that
offers to edit the constitution, a view that crashes on a missing candidate. The fixture's
`DECISIONS-CHECK.md` follows the spec's US3: two decisions that both require shared components, the
merge as option A, keeping them as option B.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test decisions_check`
- Expected: FAIL to compile, `no field candidates on type FileView`

- [ ] **Step 3: Implement the kinds, the reader, and the view**

Add the walk's cases, the reader, and fill `candidates` in the check's view only. Add the check's
text to `Workspace` and to the watcher's snapshot. A decision under `decisions-check/` is never read
by the ledger or the branch's decisions: tested in task 3.

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c cargo nextest run`, `nix develop -c cargo clippy --all-targets`,
  `nix develop -c vp check`, `ura check`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crates packages fixtures
git commit -m "feat(decisions-pass): read a decisions check and its candidates"
```

## Task 5: The server's messages and the check's records

**Files:**

- Modify: `packages/server/src/runner/triage-messages.ts` (renamed `round-messages.ts`),
  `packages/server/src/runner/message.ts`, `fate/sources.ts`, `fate/views.ts` (`candidates` in the
  file's view, and the decisions page's data: `decisionsCheck`, the check's status or null, beside
  the inbox's `triage`), `live.ts`
- Test: `packages/server/src/__tests__/decisions-check.test.ts`, `runner/__tests__/message.test.ts`

**Interfaces:**

- Consumes: `defaultRound.*` mutations and ids from task 2, `FileView.candidates` from task 4.
- Produces:
  `RUN_DECISIONS_CHECK = "/uraeda Check the decisions: write specs/DECISIONS-CHECK.md, following references/decisions-check.md. Stop when the check waits for my answers."`
  and
  `APPLY_DECISIONS_CHECK = "/uraeda Apply my answers in specs/DECISIONS-CHECK.md, following references/decisions-check.md."`,
  exported from `uraeda-server/round-messages`; `WorkflowFile` `decisions-check` readable like
  `inbox-triage`; a change of the check file sends the live update for its id.

- [ ] **Step 1: Write the failing tests**

```ts
test("both messages name the reference and a waiting stop", () => {
  expect(RUN_DECISIONS_CHECK).toContain("references/decisions-check.md");
  expect(APPLY_DECISIONS_CHECK).toContain("specs/DECISIONS-CHECK.md");
});

test("the check's file is read as a round with its candidates", async () => {
  /* via fate */
});

test("an answer to the check is written to its file and not to the triage", async () => {});

test("a change of the check's file is announced for its id", async () => {
  /* live */
});
```

The break each test catches: a message pointing at the triage's reference, a check read as missing,
an answer landing in the wrong file, a page that never learns the check changed.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test run packages/server/src/__tests__/decisions-check.test.ts`
- Expected: FAIL, `Cannot find module '../runner/round-messages.ts'`

- [ ] **Step 3: Implement the messages, the source, and the live update**

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c vp check`, `nix develop -c vp test`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages
git commit -m "feat(decisions-pass): serve a decisions check and its messages"
```

## Task 6: The check's reference, template, and example

**Files:**

- Create: `skills/uraeda/references/decisions-check.md`,
  `skills/uraeda/assets/templates/specs/DECISIONS-CHECK.md`,
  `skills/uraeda/assets/templates/specs/decisions-check/q1-a/decision-topic.md`,
  `skills/uraeda/assets/example/specs/DECISIONS-CHECK.md`,
  `skills/uraeda/assets/example/specs/decisions-check/q1-a/<topic>.md`
- Modify: `skills/uraeda/SKILL.md` (the references list and the `specs/` layout block),
  `skills/uraeda/references/conventions.md`, `references/writing.md` (where it names
  `INBOX-TRIAGE`), `references/inbox.md` (a link to the check), `skills/uraeda/references/cli.md` if
  `ura check` messages changed, `skills/uraeda/assets/templates/specs/README.md`, `specs/README.md`,
  `README.md` if it lists the workflow's files
- Test: the existing check of the example and the templates (`crates/core/tests/check.rs`), and
  `ura check` on `skills/uraeda/assets/example/specs`

**Interfaces:**

- Consumes: task 4's validation of the check's files, and the bar from task 1.
- Produces: the reference's steps: **Running a check** (refuse a second check when the file exists;
  read the constitution and every decision; per finding, two or three options, each a full edited
  decision in `specs/decisions-check/q<N>-<letter>/<topic>.md`, `status: proposed`; one confirming
  question when nothing competes; never an edit to the constitution; commit `specs/` alone with
  `chore: propose a decisions check` and the block's first line as the body), and **Applying the
  answers** (skip an option whose decision changed since the check's commit and say which; start a
  change, `decisions-check`, with the date, whose branch holds the edited decisions as `proposed`,
  and deleted ones removed; its round asks to approve them as
  [Change](/skills/uraeda/references/change.md#decisions) says; delete the check and its candidates
  on the default branch in one commit, `chore: apply the decisions check`). Questions follow
  [Writing for the human](/skills/uraeda/references/writing.md) like the triage's.

- [ ] **Step 1: Write the example and the template, then the failing check**

Add the example file and one candidate, then run `ura check skills/uraeda/assets/example/specs`
before the reference exists, to see the file validate.

- Run: `ura check skills/uraeda/assets/example/specs`
- Expected: PASS on the new files (task 4 made them valid), and FAIL the existing test that every
  `references/*.md` file is listed in `SKILL.md`, `references/decisions-check.md is not listed`

- [ ] **Step 2: Write the reference, and link it from `SKILL.md`**

Follow `references/inbox.md#the-triage`'s shape. The reference owns the check's rules. The spec's
US3 scenarios are its steps.

- [ ] **Step 3: Run the project's validation**

- Run: `nix develop -c vp check`, `nix develop -c cargo nextest run -p uraeda-core`, and `ura check`
- Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add skills specs/README.md README.md
git commit -m "feat(decisions-pass): the decisions check's reference, template, and example"
```

## Task 7: "Check decisions" on the decisions page

**Start from:** `packages/web/src/decisions/DecisionCheck.stories.tsx`, story `Option`.

**Files:**

- Create: `packages/web/src/decisions/DecisionsCheckBanner.tsx`,
  `packages/web/src/decisions/CheckPage.tsx`
- Modify: `packages/web/src/decisions/DecisionsPage.tsx`, `packages/web/src/routes.tsx`
  (`{ page: "decisions-check" }` at `/decisions/check`), `App.tsx`, `data.ts` (`useRound`),
  `RoundPage.tsx` and the question card that draws an option (to draw the option's candidate with
  `DecisionCard`), `InboxTriage.tsx` (the shared `useStartChat`, `AgentMessage` move to
  `StartChat.tsx`, imported by both)
- Test: `packages/web/src/__tests__/decisions-check.test.tsx`

**Interfaces:**

- Consumes: `RUN_DECISIONS_CHECK`, `APPLY_DECISIONS_CHECK`, the check's status on the decisions
  page's data, `FileView.candidates`, `{ round: "decisions-check" }` as a `RoundTarget`.
- Produces: a "Check decisions" button on the decisions page, disabled while a check waits, with a
  banner leading to `/decisions/check`, and "Apply the answers" once answered, or the message to
  copy without an agent, as the inbox page does for the triage.

- [ ] **Step 1: Write the failing tests**

```tsx
test("Check decisions starts a chat with the check's message", async () => {});
test("a waiting check disables the button and the banner opens its page", async () => {});
test("an option shows its candidate as the spec page shows a changed decision", async () => {
  // the fixture check: option A's card has a "Changed" pill and an added and a removed rule
});
test("answering the check writes specs/DECISIONS-CHECK.md and Submit commits it alone", async () => {});
test("an answered check offers to apply its answers", async () => {});
```

The break each test catches: a second check started while one waits, an option drawn without its
diff, an answer written into the triage's file, Submit committing other files.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test run packages/web/src/__tests__/decisions-check.test.tsx`
- Expected: FAIL,
  `Unable to find an accessible element with the role "button" and name "Check decisions"`

- [ ] **Step 3: Implement the page, the button, and the candidate view**

Start from the story's markup: the option's candidate is the spec page's `DecisionCard` with
`crumbs` naming the option, drawn from the `Candidate` of the option's question and letter.

- [ ] **Step 4: Run the project's validation, with the browser suite for this view**

- Run: `nix develop -c vp check`, `nix develop -c vp test`, and the browser tests of the decisions
  page (`__browser__/`), including the existing `inbox.test.tsx`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages
git commit -m "feat(decisions-pass): check the decisions from their page"
```
