---
status: approved
revision: 2
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Decisions understandable with no context

> [!NOTE]
>
> Approved on 2026-10-30.
>
> - You approve a fifth test for decisions, a short self-contained Why, capped alternatives and
>   consequences, five new `ura check` warnings, and the whole ledger rewritten to them.
> - Changed since your review: in Git, reading a branch's step from its latest commit is now a
>   SHOULD, without "never from files on disk", so step detection can stay robust and fast.

Agents often read a decision alone, without the record of the feature that made it. This feature
makes each decision readable on its own and checkable by you rule by rule: no history, no code
detail, a short reason. It changes the skill's guidelines and `ura check`, and rewrites the ledger
to them. Read the [proposal](proposal.md), the [discovery](discovery-01.md), and the
[clarifications](clarifications-01.md).

## Your review

- **C1** (Git's step from the latest commit): done. The rule is a SHOULD, and "never from files on
  disk" goes.

## Decisions

- **Changed: [Agents](../decisions/agents.md)**. Keeps the installed agent, one adapter, least
  permission, and sessions; the history of chats and forks goes.
- **Changed: [Attachments](../decisions/attachments.md)**. Same rules, one idea each; the image
  library's name goes.
- **Changed: [Benchmarks](../decisions/benchmarks.md)**. The record's fourteen fields become what
  makes a run comparable; the list stays in the record's schema test.
- **Changed: [CLI](../decisions/cli.md)**. Same rules, one idea each.
- **Changed: [Code quality](../decisions/code-quality.md)**. Same rules; the lint test's file name
  goes.
- **Changed: [Compatibility](../decisions/compatibility.md)**. Same rules; the Why gives the reason,
  not who asked when.
- **Changed: [Diagrams](../decisions/diagrams.md)**. Same rules, one idea each; one alternative
  goes.
- **Changed: [Distribution](../decisions/distribution.md)**. Same rules, one idea each.
- **Changed: [Git](../decisions/git.md)**. Same rules, one idea each, but reading a branch's step
  from its latest commit becomes a SHOULD; jujutsu's alternative goes.
- **Changed: [Keyboard](../decisions/keyboard.md)**. Takes "every action by keyboard and by tap"
  from UI behaviour; the registry's fields and the base keymap's keys go to the code and the
  [keyboard guide](../ui/keyboard.md).
- **Changed: [Notifications](../decisions/notifications.md)**. Same rules, one idea each.
- **Changed: [Preview](../decisions/preview.md)**. Same rules, Storybook defined.
- **Changed: [Problems](../decisions/problems.md)**. Same rules, one idea each.
- **Changed: [Repositories](../decisions/repositories.md)**. Same rules, one idea each.
- **Changed: [Sandbox](../decisions/sandbox.md)**. Same rules; a pick is defined.
- **Changed: [Settings](../decisions/settings.md)**. Same rules; the test variables' names go.
- **Changed: [Sign-in](../decisions/sign-in.md)**. Takes Stack's rules on which requests and preview
  frames the server accepts; the TLS proxy becomes a consequence.
- **Changed: [Stack](../decisions/stack.md)**. Keeps the core, the languages, and the editors; its
  request and preview rules move to Sign-in.
- **Changed: [Testing](../decisions/testing.md)**. Takes UI checks' four rules on reviewing the UI
  in the running app.
- **Changed: [Toolchain](../decisions/toolchain.md)**. Same rules, one idea each; four alternatives
  go.
- **Changed: [TUI](../decisions/tui.md)**. Same rules; TUI defined.
- **Changed: [UI behaviour](../decisions/ui-behaviour.md)**. Its keyboard rule moves to Keyboard;
  hook names and file links go.
- **Changed: [UI components](../decisions/ui-components.md)**. Takes UI coherence's shared
  components; the rail's stylesheet and the per-frame styles become one general exception.
- **Changed: [UI layout](../decisions/ui-layout.md)**. The container-query rule becomes a
  consequence; six alternatives go.
- **Changed: [UI look](../decisions/ui-look.md)**. Same rules; the fonts' code goes to the
  [reading guide](../ui/reading.md).
- **Removed: UI checks** (`ui-checks.md`). Its rules join Testing, which said the same about UI
  tests.
- **Removed: UI coherence** (`ui-coherence.md`). Its rules join UI components, which governs the
  same components.

Relied on:

| Decision                                       | What it means for this spec                                   |
| ---------------------------------------------- | ------------------------------------------------------------- |
| [Compatibility](../decisions/compatibility.md) | The limits apply to every decision at once, with no fallback. |
| [CLI](../decisions/cli.md)                     | Each new warning is written in the skill, with the CLI.       |
| [Problems](../decisions/problems.md)           | The new rules are warnings, never problems.                   |

## User stories

### US1: An agent writes a decision that reads alone (P1)

An agent writing or editing a decision follows the skill's guidelines: you can judge every line from
your goals, the Why gives the reason in a few sentences, and the alternatives and consequences hold
only what a later feature needs.

Key scenarios:

1. **Given** an answer allowing a stylesheet for the closed rail's `SideNavItem` rows, **When** the
   spec step writes UI components, **Then** its rule reads "A raw element or a plain style MAY stand
   in where Astryx and StyleX cannot do the job", and the rail is named only in the code's comment.
2. **Given** a Why reading "You asked [...] (C1 of the spec's review)", **When** an agent edits the
   decision, **Then** the Why states the reason in the present tense, cites no question or comment,
   and ends with at most one link to the record.
3. **Given** a feature that reverses a choice of UI layout, which lists 3 alternatives, **When** the
   spec step edits it, **Then** the reversed choice joins the alternatives, and the one an agent is
   least likely to propose again goes.

More scenarios:

1. **Given** an answer "a session lasts 30 days", **When** the spec step writes Sign-in, **Then**
   the rule keeps the 30 days: you would check a plan against it.
2. **Given** the base keymap's keys chosen in a round, **When** the spec step writes Keyboard,
   **Then** the rule says the keys follow Vim's habits, and the keys themselves go to the keyboard
   guide.
3. **Given** a decision that names fate, **When** an agent writes it, **Then** fate is defined at
   its first use: "fate, its data library".

### US2: `ura check` warns where a decision regrows (P1)

Run `ura check`, or open a decision in an editor with `ura lsp`, and a decision past a limit shows a
warning on the section to cut, as `decision.rules` does today.

Key scenarios:

1. **Given** UI layout with 4 alternatives, **When** `ura check` runs, **Then** it warns
   `decision.alternatives` on the heading: "4 alternatives: keep at most 3, the ones an agent could
   propose again".
2. **Given** the rule "Sessions MUST be random, and MUST end after 30 days", **When** `ura check`
   runs, **Then** it warns `decision.keywords` on that rule's line: "2 keywords: one rule holds one
   MUST, SHOULD, or MAY".
3. **Given** a Why of 81 words, **When** `ura check` runs, **Then** it warns `decision.why`: "81
   words: keep the reason under 80".

More scenarios:

1. **Given** an intent of 4 sentences, **When** `ura check` runs, **Then** it warns
   `decision.intent` on the title's line.
2. **Given** 5 consequences, **When** `ura check` runs, **Then** it warns `decision.consequences`.
3. **Given** a decision with every warning, **When** `ura check` runs, **Then** it exits with the
   same status as without them.

### US3: The ledger is rewritten to the new rules (P1)

You open the decisions page and read each decision as a diff against today's: 25 decisions, each
shorter, two merged into others, none naming a component, a hook, or a file inside a folder.

Key scenarios:

1. **Given** the rewritten ledger, **When** `ura check specs/decisions` runs, **Then** no decision
   has a warning.
2. **Given** an agent about to change a view, **When** it reads Testing alone, **Then** it finds the
   review in the running app, in both themes, at a phone's and a desktop's width.
3. **Given** the rewritten ledger, **When** its Why sections are read, **Then** none links more than
   one record, and none says who asked what, or when.

## Replaced behaviour

- **The ledger holds UI checks and UI coherence, and 18 rewritten decisions stay under 9,500
  words.** Guarded by `every_decision_of_the_repository_holds_at_most_10_rules` in
  [`crates/core/tests/check.rs`](/crates/core/tests/check.rs), which reads `ui-checks.md`.
- **A decision's Why links the question and the discovery topic.** Guarded by no test: the skill's
  [writing a decision](/skills/uraeda/references/spec.md#writing-a-decision) says so.
- **Every reversed choice stays under Alternatives considered.** Guarded by no test: the skill's
  [new decision or change](/skills/uraeda/references/spec.md#new-decision-or-change) says so.

## Architecture

Each rule keeps one home in the skill, as the decisions pass left it: the bar in the spec reference,
the writing rules in the writing reference, and their measures in `ura check`. The ledger is then
rewritten to them. See [how the detail got in](discovery-01.md#how-the-detail-got-in).

- **The bar**, [what is a decision](/skills/uraeda/references/spec.md#what-is-a-decision), gains a
  fifth test: you can judge each line of a decision from your goals, without opening the code. Names
  of components, hooks, functions, CSS classes, and files inside a folder, and lists of fields or
  keys, stay in the code, its comments and tests, or the project's guides. A value stays when you
  chose it and would check a plan against it. It owns what a decision may say. The decisions check
  and the red flags link to it.
- **The writing rules**, [a decision](/skills/uraeda/references/writing.md#a-decision), own the
  shape and its numbers: an intent of 3 sentences at most, one keyword per rule, a Why of 80 words
  at most, at most 3 alternatives and 4 consequences, terms defined at their first use, and Applies
  to naming folders and kinds of features. They own how a Why reads: the reason in the present
  tense, no history, quotes only when your words are the reason, at most one link to the record.
  [Writing a decision](/skills/uraeda/references/spec.md#writing-a-decision) links to them rather
  than restating them.
- **The template and the example** follow the rules. The example's decisions change where they break
  one: two rules of Preview, one each of Repeating tasks and Testing, and the links of Due dates and
  Repeating tasks.
- **The checks**, in [`decision.rs`](/crates/core/src/check/decision.rs), gain five warnings beside
  `decision.rules`: `decision.intent`, `decision.why`, `decision.alternatives`,
  `decision.consequences`, and `decision.keywords`. Their numbers are constants beside
  `DECISION_RULES`. The [CLI reference](/skills/uraeda/references/cli.md) and the writing reference
  list them.
- **The ledger** is the 25 rewritten decisions, `proposed` on this branch until you approve the
  spec.
- **Links to the two removed decisions**, in the records, the UI guides, and the coherence-pass
  change, point to the decision that took their rules. This feature's own rounds stay as written.

Tradeoffs:

- Details you approved once, such as the base keymap's keys, now change without your review of the
  guides that hold them.
- Rules hold one keyword each, so nine decisions sit at the 10-rule limit, with no room to grow
  without a merge.
- Every project's existing decisions may warn after an upgrade, until a feature or a decisions check
  rewrites them.

## Edge cases

| Importance | Situation                                                                | What happens                                                                                      |
| ---------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| High       | A branch in flight edits a decision this feature rewrites, like Keyboard | Whichever merges second rebases its text on the other's, and its spec step applies the new rules. |
| Normal     | A rule holds MUST NOT                                                    | It counts as one keyword.                                                                         |
| Normal     | A rule quotes a keyword in inline code, or after "Checked by"            | Neither counts: only the rule's own words, before its check, outside code.                        |
| Normal     | A Why holds links                                                        | Their text counts as words, their targets do not.                                                 |
| Normal     | A project's decision breaks a limit from before this feature             | It warns; nothing fails, and the decisions check counts it as a finding.                          |
| Niche      | A candidate in `specs/decisions-check/` breaks a limit                   | It warns like any decision file.                                                                  |
| Niche      | A decision has no Why, alternatives, or consequences                     | Nothing to measure: no warning.                                                                   |

## Success criteria

- **SC-001** (ledger size): The ledger's 25 decisions hold at most 11,000 words, from 13,658.
- **SC-002** (no warnings): `ura check specs/decisions` reports no warning on the rewritten ledger.
- **SC-003** (limits): Each new warning fires on a decision one past its limit, and stays silent at
  the limit.
- **SC-004** (one link): No Why of the ledger links more than one record.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there. Settled
while writing this spec:

- **Sentences and words** are counted as `writing.sentence` reads text: an intent's sentence ends at
  `.`, `!`, or `?`, and inline code and link targets do not count.
- **A decision is never edited to describe the code**, unless you ask: when the code and a decision
  disagree, the code changes, or the question comes to you. The skill's spec reference says so.
- **Rules the rewrite drops or softens**, with where their detail goes:
  - Agents: "the agent acts on a human's message only when asked" goes, and "with the server's copy
    of the skill" becomes a consequence.
  - Benchmarks: the record's fourteen fields, the clean tree, and the transcripts' SHA-256 stay in
    the record's schema test.
  - Keyboard: the registry's fields stay in the registry's type, and the base keymap's keys in the
    [keyboard guide](../ui/keyboard.md).
  - Sign-in: "a public address MUST reach it through a same-machine proxy that ends TLS" becomes a
    consequence, since the server listens only on its own machine.
  - Testing: "the record MUST name the tests of replaced behaviour" goes, as the
    [finish step](/skills/uraeda/references/finish.md) already asks it.
  - UI behaviour: "a component that mounts hidden content is wrapped once, in a shared component"
    goes: the rule keeps "nothing folded is mounted", and each folding component says so in its
    comment, as [the ledger's rows](/packages/web/src/spec/ledger/Rows.tsx) do.
  - UI components: the closed rail's stylesheet and the per-frame styles become one MAY rule, their
    files named in the code. "A page's column width is a named property of `Page`" stays in the
    code.
  - UI layout: "a part MAY follow its own room, measured or by a container query" becomes a
    consequence; the [wide guide](../ui/wide.md) keeps the decisions page's measured split.
  - UI look: the default fonts and how the picked fonts reach the theme stay in the
    [reading guide](../ui/reading.md).
  - Git: "a branch's step MUST be read only from its latest commit" becomes a SHOULD, as you asked,
    so step detection may read files on disk when git is too slow.
  - Toolchain: the coverage rule becomes a consequence. Its cargo-nextest rule joins the pinned
    tools.
  - 27 of the 86 alternatives go across the ledger: earlier versions of a detail that no agent would
    propose again. Their records keep them.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Risk tier

**Medium**: no stored data or format changes, but every agent reads the ledger before its work.

## History

> [!NOTE]
>
> Changes requested on 2026-10-30: reading a branch's step from its latest commit becomes a SHOULD.
>
> - You approve a fifth test for decisions, a short self-contained Why, capped alternatives and
>   consequences, five new `ura check` warnings, and the whole ledger rewritten to them.
> - The ledger goes from 27 decisions and 13,658 words to 25 and about 10,900. UI checks joins
>   Testing, UI coherence joins UI components, and Stack's request rules join Sign-in.
> - Read the rewrite as diffs on the decisions page. It changes every decision at once, as you
>   chose, past the split rule's 2 changed decisions.
> - Rules the rewrite drops or softens are listed under Assumptions. Two to weigh: Sign-in's TLS
>   proxy becomes a consequence, and Agents loses "acts on a message only when asked".
> - Details you approved once, like the base keymap's keys, now live only in the UI guides and the
>   code, which you do not approve line by line.
> - Risk tier medium: every agent reads the ledger before its work, though no stored data changes.
