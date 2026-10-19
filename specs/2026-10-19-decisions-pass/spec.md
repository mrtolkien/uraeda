---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Decisions pass

> [!IMPORTANT]
>
> Spec to review, about 35 minutes.
>
> - You approve a stricter bar for decisions, the rewrite of all 21 decisions to it, a decisions
>   page that draws rules as the spec page does, and a "check decisions" run.
> - The rewrite cut the ledger from 11,152 to 8,773 words, a fifth. Read it as diffs on the
>   decisions page: it changed every decision at once, as you chose, past the split rule.
> - Rules dropped that a record shows you asked for: see the list under Assumptions, such as 19 px
>   body text, left-aligned text, and the 15-minute idle close.
> - The bar is a judgement and nothing measures it, as you answered. A proposal that drifts back to
>   specifics is caught only by you or by the check.
> - The decisions check shows each option as a diff, and applying starts a change. How a change
>   approves decisions is not verified: the plan's first task checks it.
> - UI coherence is a new decision, short on purpose: three rules.
> - Risk tier medium: skill text, a new file format, and UI, with no stored user data.

Decisions hold your intent, and lately they read as specifications. This feature gives them a bar
that says so, rewrites the ledger to it, draws their rules the way a spec does, and adds a run that
finds decisions competing with each other. Read the [proposal](proposal.md), the
[discovery](discovery-01.md), and the [clarifications](clarifications-01.md).

## Decisions

- **New: [UI coherence](../decisions/ui-coherence.md)**. The same information is drawn by one shared
  component on every page.
- **Changed: [Agents](../decisions/agents.md)**. Keeps least permission, one adapter, and one
  neutral session model; flags, timings, and storage names go.
- **Changed: [Attachments](../decisions/attachments.md)**. Keeps one small safe image format,
  committed beside its file; sizes and byte checks go.
- **Changed: [CLI](../decisions/cli.md)**. Keeps stable output and non-interactive use; exit codes
  and target lookup go.
- **Changed: [Code quality](../decisions/code-quality.md)**. Keeps measured limits that never go up;
  the numbers live in the lint configuration.
- **Changed: [Compatibility](../decisions/compatibility.md)**. Same rules, tighter wording.
- **Changed: [Diagrams](../decisions/diagrams.md)**. Keeps fenced diagrams drawn without script;
  sizes and versions go.
- **Changed: [Distribution](../decisions/distribution.md)**. Keeps one npm install and tagged
  releases; names, platforms, and the Node version go.
- **Changed: [Git](../decisions/git.md)**. Keeps "tools never lose the user's work"; mechanisms and
  paths go.
- **Changed: [Notifications](../decisions/notifications.md)**. Keeps never interrupting a human
  already looking; the title count becomes a SHOULD.
- **Changed: [Preview](../decisions/preview.md)**. Keeps stories as mockups over fixture data; file
  names and scripts go.
- **Changed: [Problems](../decisions/problems.md)**. Same five rules, tighter wording.
- **Changed: [Repositories](../decisions/repositories.md)**. Keeps one server for all repositories,
  stored as data; the file name and URL shape go.
- **Changed: [Settings](../decisions/settings.md)**. Keeps settings apart from data and secrets;
  file name, variables, and library go.
- **Changed: [Sign-in](../decisions/sign-in.md)**. Keeps the owner's key, hashed sessions, and 30
  days; byte sizes and cookie flags go.
- **Changed: [Stack](../decisions/stack.md)**. Keeps the Rust core, a loopback-only server, and
  sandboxed frames; header values and crate names go.
- **Changed: [Toolchain](../decisions/toolchain.md)**. Keeps one cached `ready` and pinned tools;
  cache inputs, worker counts, and file names go.
- **Changed: [TUI](../decisions/tui.md)**. Keeps a terminal-themed, keyboard-first interface;
  library and colour details go.
- **Changed: [UI behaviour](../decisions/ui-behaviour.md)**. Keeps explicit saves, status beside its
  subject, and keyboard paths; exact keys go.
- **Changed: [UI checks](../decisions/ui-checks.md)**. Keeps tests that guard a requirement and
  drive the UI as a user does; tool names go.
- **Changed: [UI components](../decisions/ui-components.md)**. Keeps Astryx and its theme as the
  only style source; StyleX syntax details go.
- **Changed: [UI layout](../decisions/ui-layout.md)**. Keeps two width classes, panes, and URL-held
  state; pixel sizes go.

Relied on:

| Decision                                       | What it means for this spec                                      |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| [UI components](../decisions/ui-components.md) | The new views use Astryx and the theme.                          |
| [UI behaviour](../decisions/ui-behaviour.md)   | The check's button and its answers follow the existing patterns. |
| [Preview](../decisions/preview.md)             | The two mockups are stories of the real components.              |
| [Git](../decisions/git.md)                     | Applying a check starts a change, never switching a checkout.    |
| [Agents](../decisions/agents.md)               | The check's runs go through the adapter, in the main checkout.   |

## User stories

### US1: A decision states intent, not specifics (P1)

An agent writing or reviewing a decision tests it against a fourth question: is this the human's
goal or approach, or a value the code holds? The ledger is rewritten to that bar.

Why this priority: it is the proposal's core, and the other stories rest on it.

Key scenarios:

1. **Given** an answer "harnesses must not use CLI flags", **When** the spec step weighs it,
   **Then** it is an assumption of the spec, not a listed decision.
2. **Given** an answer "agents never run with permissions skipped", **When** the spec step weighs
   it, **Then** it is a decision, written as the boundary without the flag's name.
3. **Given** the rewritten [Agents](../decisions/agents.md), **When** you read its rules, **Then**
   none names a flag, a timeout, or a file, and each stands alone.

More scenarios:

1. **Given** a decision whose rule states a hard value you chose, such as 30 days for a session,
   **When** the spec step writes it, **Then** the value stays and the Why links your answer.

### US2: Rules look the same on every page (P1)

Open a decision on the decisions page: each rule shows its strength icon, its words, and its check
on a muted line, as on the spec page, from the same component.

[Open decision](/packages/web/src/decisions/DecisionRules.stories.tsx#Open)

Key scenarios:

1. **Given** the decisions page with [UI coherence](../decisions/ui-coherence.md) open, **When** the
   page draws, **Then** its first rule shows a green "Must" icon and "Checked by review." under it,
   as the spec page draws it.
2. **Given** a rule that is a MUST NOT, **When** drawn on both pages, **Then** both show the same
   red icon and the same name for a screen reader.
3. **Given** a decision with a rule that has no check, **When** drawn, **Then** it shows the icon
   and the words only.

### US3: Check the decisions against each other (P2)

On the decisions page, "Check decisions" starts an agent. It reads the constitution and every
decision and writes a file of questions: each finding is two or three ways to keep the ledger clean,
each option shown as the edited decision against the active text. You answer in the questions view,
like the inbox triage, and apply the answers.

[A check's question](/packages/web/src/decisions/DecisionCheck.stories.tsx#Option)

Key scenarios:

1. **Given** two decisions that both require shared components, **When** the check runs, **Then**
   `specs/DECISIONS-CHECK.md` has a question naming both, with the merge as option A and the reason,
   and `specs/decisions-check/q1-a/` holds the edited decision.
2. **Given** a decision that fails the bar, **When** the check runs, **Then** its question offers
   the shorter text as option A and keeping it as option B.
3. **Given** you answered A to the merge, **When** you apply the check, **Then** a change starts
   whose branch holds the edited decision as `proposed`, and the check file and candidates are
   deleted from the default branch.
4. **Given** a check waits, **When** you ask for another, **Then** the button is disabled and the
   file's page opens instead.

More scenarios:

1. **Given** a decision that conflicts with the constitution, **When** the check runs, **Then**
   every option changes a decision and none changes the constitution.
2. **Given** nothing competes or fails the bar, **When** the check runs, **Then** the file holds one
   question confirming that, answered like any other.

## Architecture

The bar is written once, in the skill's decision reference, and the other files link to it. The
check mirrors the inbox triage and shares its code, so the questions-file reader, the answering
page, and the chat messages exist once. See the
[discovery](discovery-01.md#how-the-coherence-check-runs).

- **The bar** is
  [`spec.md`'s "What is a decision"](/skills/uraeda/references/spec.md#what-is-a-decision) with a
  fourth test, "intent, not mechanism", and examples. It owns the rule. `writing.md`,
  `discovery.md`, the decision template, and the spec's self-review and red flags link to it.
  `ura check` gains no measure.
- **The ledger** is the 21 rewritten decisions and the new one, `proposed` on this branch until you
  approve the spec.
- **The check's reference**, `references/decisions-check.md`, with a template `DECISIONS-CHECK.md`
  and an example file, says how to read every decision against the constitution, how to write the
  questions and candidates, and how to apply the answers. It owns the check's rules, and `SKILL.md`
  lists it.
- **The round file on the default branch** is the triage's reader and view, made to serve both
  `INBOX-TRIAGE.md` and `DECISIONS-CHECK.md`, so a second file adds a name, not a copy.
- **The candidate view** draws each option's candidate decision with the spec page's decision card,
  from the core's existing comparison of two texts. It owns nothing new.
- **The decision rule line** is the spec page's `RuleLine`, which the decisions page now uses. It
  owns how a rule is drawn.
- **The server's messages** gain one to start the check and one to apply it, beside the triage's.

Tradeoffs:

- The check leaves candidate files on the default branch until applied: plain text, but not
  decisions.
- Sharing the triage's code means refactoring working code first.
- The rewrite changes 21 files at once: one long review, chosen over batches.

## Edge cases

| Importance | Situation                                                       | What happens                                                                              |
| ---------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| High       | A decision changed on a branch after the check wrote its option | Applying skips that option and says which decision moved, so no edit is based on old text |
| High       | An option would change the constitution                         | It is never offered: only a human amends it                                               |
| Normal     | A second check is requested while one waits                     | The button is disabled, and the page opens the waiting file                               |
| Normal     | A rule has no "Checked by" words                                | The page draws its icon and words only                                                    |
| Normal     | An unreadable decision file                                     | The page keeps its banner and the check reports it as a finding                           |
| Niche      | A check with no findings                                        | One question confirms it                                                                  |

## Success criteria

- **SC-001** (one component): The decisions page and the spec page draw a rule through the same
  component, which one test asserts.
- **SC-002** (no specifics): No rewritten decision names a flag, a timeout, or a file that its own
  checks do not name.
- **SC-003** (valid ledger): `ura check` reports no problem on the ledger and on a check's files.
- **SC-004** (one file per run): A check's run ends with one questions file waiting for you, and
  applying it leaves none.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. Your answers changed two of them: the rewrite covers every decision here, and the
check shares the triage's code. Settled while writing this spec:

- **No measure.** You answered that the bar needs no length limit, so `ura check` keeps its 10-rule
  warning only.
- **Names.** The file is `specs/DECISIONS-CHECK.md`, and its candidates are
  `specs/decisions-check/q<N>-<letter>/<topic>.md`.
- **The change's slug** is `decisions-check`, with the date, started by the apply run as you asking
  for it.
- **Rewrites follow the records.** The agents compared each decision with the answers of the records
  its Why links, and dropped values that only an agent chose.
- **The benchmark branch's decision** is left alone; the new bar applies when its spec is reviewed
  again.
- **Rules dropped that a record shows you asked for.** Object to any, and it returns as intent:
  - [Agents](../decisions/agents.md): the 15-minute idle close, the mid-turn message shown greyed,
    and "Allow and retry".
  - [UI layout](../decisions/ui-layout.md): 17 and 19 px body text, left-aligned text, and the
    sidebar's small visual cards.
  - [UI behaviour](../decisions/ui-behaviour.md): the keys that move a list's selection.
  - [Sign-in](../decisions/sign-in.md): the "Sign out" and "Sign out everywhere" buttons.
  - [CLI](../decisions/cli.md): one optional target, a path or a name.
  - [Git](../decisions/git.md): new worktrees under `.worktrees/` by default.
  - [Preview](../decisions/preview.md): the pick-mode script the skill's embedding may rely on.
  - [Notifications](../decisions/notifications.md): the title count, now a SHOULD.
- **Unverified.** How a change approves decisions without a spec: the plan's first task reads
  [Change](/skills/uraeda/references/change.md#decisions). If it cannot, the apply run starts a
  feature instead.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

## Risk tier

**Medium**: a new file format and a refactor of the triage's code, with no change to stored user
data.
