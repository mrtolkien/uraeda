# Discovery, round 01: Decisions understandable with no context

## Summary

A decision, in `specs/decisions/`, is the rule a human chose that agents follow across features.
Agents often read it alone, before a task, without the record of the feature that made it. The
[proposal](proposal.md) says three things are wrong with today's decisions. They need context found
elsewhere. Many are too specific for the human to validate. Their **Why** is verbose.

Established formats agree on most of it. A decision record is short, one or two pages at most, and
holds one decision. Its reason is required but brief, often one "because" clause. It must stand
alone: links add to it, but the decision is clear without them. Design detail, code, and values live
elsewhere, in other documents or in the code. Guidance on agent instructions adds two points. Length
lowers how well an agent follows each line. Instructions should hold only what the agent cannot find
by reading the repository. The formats differ on one point: whether a record is immutable and
superseded, or a living document amended in place. Uraeda already chose the second.

The skill already says most of what the proposal asks:
[intent, not mechanism](/skills/uraeda/references/spec.md#what-is-a-decision), and
[the history stays in the record](/skills/uraeda/references/writing.md#a-decision). The ledger does
not follow it. A [decisions pass](/specs/done/2026-10-19-decisions-pass.md) rewrote it ten days ago,
to 9,441 words over 23 decisions. It holds 13,658 words over 27 decisions today. The problem is less
the guidelines' words than what nothing measures, and the way decisions get edited.

## How other products do it

The "products" here are the established formats for recording decisions, and the guidance coding
agents' vendors give for the instructions agents read. Every source was read in this session,
through a summarizing fetch for most of them; the quotes are as it returned them.

### Nygard's architecture decision records

- One or two pages: "Small, modular documents have at least a chance at being updated."
  ([Nygard, 2011](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions))
- The reason exists to avoid "blind acceptance or blind reversal": a newcomer who lacks the
  rationale cannot tell whether the decision still holds. Context states "the forces at play" in
  value-neutral facts. Consequences list all of them, not only the positive ones.
- Only significant decisions: those that "affect the structure, non-functional characteristics,
  dependencies, interfaces, or construction techniques". Write "as if it is a conversation with a
  future developer".
- A reversed decision is kept and marked superseded.

### MADR

- "A streamlined template" to "capture these records in a lean way". The problem statement takes
  "two to three sentences" ([MADR](https://adr.github.io/madr/)).
- The rationale is one clause: "Chosen option: '…', because {justification}". Consequences read
  "Good, because…" and "Bad, because…".
- Most sections are optional: "Feel free to remove". A "confirmation" element says how compliance is
  checked, as Uraeda's "Checked by" does.

### Y-statements

- A whole decision in one sentence: "In the context of [use case], facing [concern], we decided for
  [option] to achieve [quality], accepting [downside]."
  ([ADR templates](https://adr.github.io/adr-templates/)). The paper's long form was not reached:
  see [not checked](#not-checked).

### Zimmermann's anti-patterns

- "Watch the word count of an ADR as it evolves."
  ([How to create ADRs, and how not to](https://www.ozimmer.ch/practices/2023/04/03/ADRCreation.html))
- **Mega-ADR**: "detailed information about the architecture is stuffed into several multi-page
  ADRs". The fix: "Move the detail design to a separate document."
- **Blueprint or Policy in Disguise**: a cookbook or a law rather than a decision. **Sales Pitch**:
  background pasted in, where "hyperlinks or bibliographic references can be provided instead".
  **Free Lunch Coupon**: consequences hidden.
- His [significance test](https://www.ozimmer.ch/practices/2020/09/24/ASRTestECSADecisions.html)
  gives a class name as the canonical decision too small to record: invisible to stakeholders, and
  easy to refactor.

### Microsoft, AWS, Fowler, GDS

- Microsoft: "Avoid making decision records design guides. If more justification or design ideation
  is available, provide a link… but the decision must be clear and stand alone without that
  material." "Keep records pithy, assertive, on-topic, and factual." A record without its reason
  "loses its value over time as stakeholders can't evaluate whether the decision still applies."
  ([Maintain an ADR](https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record))
- AWS: the record "focuses on the reason for the decision rather than how the team implemented it"
  ([ADR process](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html)).
- Fowler: "Keep the ADR short and to the point - typically a single page", and "put the most
  important material at the start, and push details to later in the record"
  ([bliki](https://martinfowler.com/bliki/ArchitectureDecisionRecord.html)).
- GDS: an ADR "isn't a complete description of a software system"; broader documentation lives
  elsewhere
  ([GDS Way](https://gds-way.digital.cabinet-office.gov.uk/standards/architecture-decisions.html)).
- On changes: Nygard, Fowler, Microsoft, and AWS keep accepted records immutable and supersede them.
  Henderson's teams found "mutability has worked better", with dated, living records
  ([architecture-decision-record](https://github.com/joelparkerhenderson/architecture-decision-record)).

### Claude Code's memory and best practices

- "Only write down what Claude can't find by reading the repo", with "a decision your team made in a
  meeting" as an example. Its test: "Could it find this by reading the code? Would it actually go
  and look? If both are yes, leave it out."
  ([Best practices](https://code.claude.com/docs/en/best-practices))
- "Every line in it takes a little of Claude's attention on every task." Describing the architecture
  and file layout is listed as an old practice to drop.
- Instructions should be "concrete enough to verify", and "the more specific and concise your
  instructions, the more consistently Claude follows them". Files over 200 lines "reduce adherence".
  Contradicting instructions make Claude "pick one arbitrarily"
  ([Memory](https://code.claude.com/docs/en/memory)).

### Anthropic's prompting and context guidance

- Giving the reason behind an instruction lets the model generalize: "NEVER use ellipses" becomes a
  rule with its reason, a text-to-speech engine, and "Claude can generalize from the explanation"
  ([Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)).
- Context rot: recall drops as the context grows. The goal is the "smallest possible set of
  high-signal tokens", at the "right altitude" between "hardcoding complex, brittle logic" and
  "vague, high-level guidance"
  ([Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)).

### Cursor, Copilot, and Spec Kit

- Cursor: rules "focused, actionable, and scoped", under 500 lines, split when large; "reference
  files instead of copying their contents"; leave out what duplicates the codebase
  ([Rules](https://cursor.com/docs/context/rules)).
- Copilot: instructions "should be short, self-contained statements", and requests "to refer to
  external resources" do not work well
  ([Custom instructions](https://docs.github.com/en/copilot/concepts/prompting-and-context/custom-instructions)).
- Spec Kit: the constitution holds named principles of a line or two; specs say "WHAT users need and
  WHY", not "HOW to implement", and detail goes to an `implementation-details/` file
  ([spec-driven.md](https://raw.githubusercontent.com/github/spec-kit/main/spec-driven.md)).

### Practitioners

- A Hacker News thread on decision records for agents: "hundreds of meaningless ADRs that your agent
  has to wade through", "They got longer and longer", and "the same old problem of doc rot, but now
  the docs are blindly obeyed". Workarounds named: token budgets that force compression, and
  recording a rule only once it keeps coming up in reviews
  ([HN 50227041](https://news.ycombinator.com/item?id=50227041)).
- "Stale documentation is worse than no documentation because it creates false confidence"
  ([Java Code Geeks, 2026](https://www.javacodegeeks.com/?p=143468)); its figures are composite
  practitioner data, not a study.

### What they have in common

- **Short**: one or two pages at most, the reason in a clause or a few sentences. Length is named as
  a cause of lower adherence, not only of cost.
- **One decision per file**, with a title naming it.
- **A brief reason, always**: so a reader can tell whether the decision still holds, and an agent
  can apply it to a case it does not name.
- **Honest costs**: what was given up, stated plainly.
- **Intent and tradeoffs, not implementation**: design detail, code, and values go to the code or
  another document.
- **Standing alone**: links add to the record, but are never needed to understand it.
- **Only what cannot be found elsewhere**: for agents, what reading the repository does not show.
- **Pruned**: conflicting or stale rules are obeyed blindly, so files are reviewed and cut.

## Standards and libraries

### RFC 2119 keywords

- Uraeda's rules use MUST, SHOULD, and MAY, ordered by strength, as
  [writing a decision](/skills/uraeda/references/writing.md#a-decision) asks. No source above
  recommends more than one keyword per statement; Copilot's "short, self-contained statements" is
  the closest.

### `ura check`'s rules on decisions

- `decision.rules` warns past 10 rules, `decision.order` on a rule stronger than the one before it
  ([`decision.rs`](/crates/core/src/check/decision.rs)). Warnings never fail a check, as
  [the CLI](/skills/uraeda/references/cli.md) says.

## The code

### Important reads

- [The 27 decisions](/specs/decisions/): 13,658 words, 178 rules, 83 links to records in
  `specs/done/`. A decision averages about 500 words, against about 290 for
  [the skill's example](/skills/uraeda/assets/example/specs/decisions/). Measured in this session
  with `wc` and `awk` over each section.
- The largest **Why** sections: [UI layout](/specs/decisions/ui-layout.md) 401 words,
  [UI look](/specs/decisions/ui-look.md) 213, [UI components](/specs/decisions/ui-components.md)
  181, [UI behaviour](/specs/decisions/ui-behaviour.md) 165,
  [Toolchain](/specs/decisions/toolchain.md) 150. The example's are 27 to 69.
- The longest **Alternatives considered**: UI layout 9 items, [Agents](/specs/decisions/agents.md)
  7, Toolchain 7. Several are earlier versions of a detail, not options an agent would propose
  again: "Justified paragraphs: rivers on the phone's narrow lines", "CSS `zoom` on desktop: it
  breaks dragging's position math" (UI layout).
- Growth since the pass, in words: UI layout 429 to 985, UI components 303 to 656, Agents 464 to
  712, UI behaviour 436 to 638, Toolchain 470 to 665. UI look, Keyboard, and Testing are new, at 516
  to 746 words each. Measured against the pass's merge commit, `72c9cf98`.
- [The bar's test](/crates/core/tests/decisions_bar.rs): fails when a rule names a `--flag`, a time
  in seconds or minutes, or a backticked file name its check does not name. It reads only the rules,
  never the intent, **Why**, or **Consequences**, and misses component and function names.
- [`decision.rs`](/crates/core/src/check/decision.rs): `ura check` warns past 10 rules and on a rule
  stronger than the one before it. Nothing measures the length of a section, or a rule holding two
  ideas.

### What a reader with no context meets

Each pattern below was found by reading every decision in full.

- **History told as a story.** [Compatibility](/specs/decisions/compatibility.md)'s **Why** opens:
  "You asked not to keep backward compatibility before version 1.0 [...]. Reviewing the spec, you
  added that an agent meeting a file that fails `ura check` fixes it anyway (C1 of the spec's
  review)." Its reason comes last, in one sentence. [Diagrams](/specs/decisions/diagrams.md) cites
  "Q10". Thirteen decisions say "the human chose", "asked", or "you".
- **Reasons left behind a link.** [Agents](/specs/decisions/agents.md)'s **Why** is five claims,
  each carried by a link to a record. A record keeps a question's answer in one line: the link to
  "the visual direction" in [UI look](/specs/decisions/ui-look.md) leads to
  [`C: "Terminal with some inspirations from Cyber"`](/specs/done/2026-10-20-layout-look.md#q2-which-visual-direction-should-the-ui-take).
  The question's context, options, and tradeoffs are only in git history. An agent that follows the
  link finds less than the decision already says.
- **Code facts in the decision.** [UI components](/specs/decisions/ui-components.md) has a rule for
  "the closed rail's `SideNavItem` rows, whose width, centring, and label no prop reaches". Its
  **Consequences** name `ToolGroups.tsx`, `theme/PickedFonts.tsx`, `useFontStyle`, and the class
  `.astryx-side-nav-item`, and its **Applies to** lists five source files.
  [UI behaviour](/specs/decisions/ui-behaviour.md)'s consequences name the hook `useOutlineField`.
  [UI look](/specs/decisions/ui-look.md)'s **Why** explains what `theme/fonts.ts` writes over the
  theme's tokens. [UI coherence](/specs/decisions/ui-coherence.md) names `Prose`'s path and a
  property of `Page`.
- **Lists the human cannot validate at a glance.** [Benchmarks](/specs/decisions/benchmarks.md) has
  a rule listing the fourteen fields a run records. [Keyboard](/specs/decisions/keyboard.md) lists
  the base keymap's keys. [Sign-in](/specs/decisions/sign-in.md) has five rules on its frame secret
  and sessions.
- **Two or more ideas per rule.** 57 of the 178 rules hold a second MUST, SHOULD, or MAY after a
  comma or a semicolon, against
  [one sentence per rule](/skills/uraeda/references/writing.md#a-decision). Example, from Agents:
  "Every conversation with an agent MUST be a session, and a change or a feature MUST have one or
  more sessions, all in its worktree and with the server's copy of the skill, where the agent acts
  on a human's message only when asked." Counted with a regular expression, so a few may be one idea
  written twice.
- **Terms defined nowhere in the decision.** fate, Astryx, the binding, the frame secret, an
  outline's row, a width class, the leader menu. A term is clear to the session that wrote it, and
  [writing rule 3](/skills/uraeda/references/writing.md#every-document) already asks to define it at
  its first use.
- **Long intents.** UI look's intent is six sentences, against two or three in
  [the template](/skills/uraeda/assets/templates/specs/decisions/decision-topic.md).

### How the detail got in

- Decisions are edited outside features too. Commit `89c3a735`, "the UI decisions say what the code
  does", rewrote four UI decisions to match the code after the UI work, adding the rail's rows, the
  fonts' code, and the parts that measure their own room. A decision written to describe the code
  takes on the code's detail.
- [Writing a decision](/skills/uraeda/references/spec.md#writing-a-decision) asks the **Why** for
  "links to the question and the discovery topic", and
  [the finish step](/skills/uraeda/references/finish.md#rewrite-the-links) rewrites them to the
  record. Each answer added to a decision adds a sentence and a link: UI look links seven records.
- **Alternatives considered** lists every reversed choice, as
  [new decision or change](/skills/uraeda/references/spec.md#new-decision-or-change) asks, "so no
  agent proposes it again". Nothing ever removes one, so the section only grows.
- The rule "a rule keeps a value only when the human chose that value" lets in details the human
  approved once in a round, such as the base keymap's keys, though they are not what they would
  check a plan against.

### Overlaps between decisions

Found while reading, for the scope question. The
[decisions check](/skills/uraeda/references/decisions-check.md) is the skill's tool for these.

- [Testing](/specs/decisions/testing.md) and [UI checks](/specs/decisions/ui-checks.md) both say UI
  tests are rare and the human reviews the UI by using it.
- [UI coherence](/specs/decisions/ui-coherence.md) and
  [UI components](/specs/decisions/ui-components.md) both govern which component draws what.
- [Stack](/specs/decisions/stack.md) holds the server's origin and preview-frame rules, which
  [Sign-in](/specs/decisions/sign-in.md) also covers.
- [Keyboard](/specs/decisions/keyboard.md) and [UI behaviour](/specs/decisions/ui-behaviour.md) both
  say every action works by keyboard and by tap, never by hover or a key alone.

### The proposal's path and existing actions

The proposal's path is an agent reading a decision before a task, and the human validating it.

- Agents: [the spec step](/skills/uraeda/references/spec.md#the-specs-decisions) lists the decisions
  a spec relies on, [the plan](/skills/uraeda/references/plan.md) copies their rules word for word
  as global constraints, and [the implementation](/skills/uraeda/references/implementation.md) reads
  those that apply to the code it touches before each task. None of them reads the records a **Why**
  links.
- The human: on the web UI's decisions page, which draws the file as a document, its rules with
  their strength and check ([`DecisionRules.tsx`](/packages/web/src/decisions/DecisionRules.tsx)). A
  proposed change shows as a diff against the default branch, at the spec's approval.
- [The UI guides](/specs/ui/README.md), in `specs/ui/`, already hold "what those rules aim at, and
  how a view meets them": a home for UI detail that is not a decision.

### Other features in flight

The changes [amend-latest](/specs/changes/2026-10-29-amend-latest/proposal.md) and
[help-keybindings](/specs/changes/2026-10-29-help-keybindings/proposal.md) have only started: their
branches hold no commit yet. Help-keybindings adds the `?` key, so it will likely touch
[Keyboard](/specs/decisions/keyboard.md), which this feature may rewrite. Whichever merges second
rebases its text on the other.

### Likely changes

Under every option:

- [`references/spec.md`](/skills/uraeda/references/spec.md): what is a decision, and writing a
  decision.
- [`references/writing.md`](/skills/uraeda/references/writing.md): the rules of a decision.
- [The decision template](/skills/uraeda/assets/templates/specs/decisions/decision-topic.md), and
  [the example's decisions](/skills/uraeda/assets/example/specs/decisions/) when they break a new
  rule.
- [`references/decisions-check.md`](/skills/uraeda/references/decisions-check.md): what counts as a
  finding.

With a rewrite of the ledger: the 27 files of [`specs/decisions/`](/specs/decisions/), and links to
them from `specs/ui/` and the code when a decision is merged or removed.

With measured limits: [`decision.rs`](/crates/core/src/check/decision.rs), its tests in
[`crates/core/tests/check.rs`](/crates/core/tests/check.rs),
[`cli.md`](/skills/uraeda/references/cli.md)'s list of rules, and the fixtures under
[`fixtures/`](/fixtures/) that hold decisions.

With a changed template: the core reads section names from the embedded templates, so
`sections.unknown` follows the template, and every decision of the ledger, the example, and the
fixtures changes at once, as [Compatibility](/specs/decisions/compatibility.md) asks.

Tests that guard behaviour this may change: `decision.rules` and `decision.order` in
[`crates/core/tests/check.rs`](/crates/core/tests/check.rs), and
`no_decision_names_a_mechanism_its_checks_do_not` in
[`decisions_bar.rs`](/crates/core/tests/decisions_bar.rs).

## The proposal

### "Too specific" has no test yet

The fourth test of [what is a decision](/skills/uraeda/references/spec.md#what-is-a-decision)
rejects mechanisms: a flag, a timeout, a file name. The examples above pass it, yet the human cannot
validate them: a component's name, a hook, a list of fields, a stylesheet's single exception. What
the human can validate is a rule they can judge from their own goals, without opening the code. The
proposal does not say where the removed detail goes.

### "Valuable information only" is not defined

Nothing says which sections of a decision an agent needs. Alternatives guard against an agent
proposing a rejected option again. Consequences tell a feature what it must do. Both have grown with
detail no feature needs.

### Rewriting the ledger, or only the guidelines

The proposal asks to "review decisions and the guidelines". The last pass rewrote the ledger and set
no measure, and the ledger regrew by 45% in ten days. Guidelines alone leave 27 decisions as they
are.

### The human's own words

Some **Why** sections quote the human: "we're a todo app, not a calendar" in the example, "I trust
the dev" in Diagrams. A quote is short when it is the reason, and history when it is not.

## Worth it and feasibility

The feature changes text and, depending on the answers, one or two `ura check` rules. Its cost is
the rewrite and the human's review of 27 diffs, shorter than the text they replace. Its gain is a
ledger an agent reads in a few minutes and the human validates rule by rule. Relying on nothing
outside the repository, it has no unverified behaviour and relaxes no guard.

A risk: a shorter **Why** may drop a reason an agent needs to apply a rule to a case it does not
name. Anthropic's guidance says a reason lets the model generalize, and Microsoft's says a record
without one loses its value: the **Why** shrinks, it does not go.

## Approaches

Criteria come from the proposal (an agent understands the file alone; the human validates every
rule; only valuable information), the constitution's
[principle IV](/specs/CONSTITUTION.md#iv-review-effort-matches-impact) (human attention is the
scarcest resource), and [Compatibility](/specs/decisions/compatibility.md) (a format change applies
to every file at once).

### Scope of the rewrite

Whether this feature rewrites the 27 decisions, or only the guidelines. See
[rewriting the ledger](#rewriting-the-ledger-or-only-the-guidelines).

| Option                                          | Ledger fixed      | Guidelines proven on real cases | Human's review               |
| ----------------------------------------------- | ----------------- | ------------------------------- | ---------------------------- |
| A. Guidelines and every decision, here          | at the merge      | yes                             | one spec, 27 diffs           |
| B. Guidelines here, the ledger by a later check | after a 2nd round | no                              | a spec, then a check's round |
| C. Guidelines only; decisions as features touch | never all         | no                              | small                        |

### Merging overlapping decisions

Only with option A of [scope of the rewrite](#scope-of-the-rewrite). The four pairs of
[overlaps](#overlaps-between-decisions).

| Option                                  | Ledger           | Risk                                  |
| --------------------------------------- | ---------------- | ------------------------------------- |
| A. Merge the four pairs in this rewrite | 23 or 24 files   | a larger diff to review               |
| B. Rewrite each alone, merge by a check | 27 files for now | duplicated rules stay until the check |

### How specific a rule may be

What makes a rule specific enough for the human to validate. See
[too specific](#too-specific-has-no-test-yet) and
[Zimmermann's anti-patterns](#zimmermanns-anti-patterns).

| Option                                                             | Human validates without the code | Where code detail goes                       | Change to the skill    |
| ------------------------------------------------------------------ | -------------------------------- | -------------------------------------------- | ---------------------- |
| A. A fifth test: the human judges each line from their goals alone | yes                              | code, its comments, its tests, the UI guides | the bar, writing rules |
| B. Code detail allowed in **Applies to** and **Consequences** only | the rules, yes                   | those two sections                           | writing rules          |
| C. Today's bar, applied more strictly                              | partly                           | unchanged                                    | none                   |

### What a Why holds

See [reasons left behind a link](#what-a-reader-with-no-context-meets) and
[Anthropic's prompting guidance](#anthropics-prompting-and-context-guidance).

| Option                                                              | Self-contained | Length      | Trace to the answer |
| ------------------------------------------------------------------- | -------------- | ----------- | ------------------- |
| A. The reason itself, present tense, one link to the record at most | yes            | a few lines | one link            |
| B. The same, with no link to records                                | yes            | a few lines | git history only    |
| C. No Why: the intent carries the reason                            | partly         | shortest    | none                |

### Which sections a decision keeps

See [valuable information](#valuable-information-only-is-not-defined) and [MADR](#madr).

| Option                                                                            | Format change  | Guards against re-proposals | Size      |
| --------------------------------------------------------------------------------- | -------------- | --------------------------- | --------- |
| A. Keep the sections; alternatives and consequences limited to what features need | no             | yes, the close calls        | small     |
| B. Fold alternatives and consequences into the Why                                | yes, all files | in prose                    | smallest  |
| C. Keep everything as it is                                                       | no             | yes                         | unchanged |

### Measuring the limits

See [`ura check`'s rules](#ura-checks-rules-on-decisions) and the
[growth since the pass](#important-reads).

| Option                                                   | Stops regrowth           | Cost                     |
| -------------------------------------------------------- | ------------------------ | ------------------------ |
| A. Warnings per section, and on a rule with two keywords | each decision, each edit | rules in the core, tests |
| B. One word budget per decision, as a warning            | the total only           | one rule                 |
| C. Measure nothing, as decided in the decisions pass     | no                       | none                     |

### Needs no choice

- **One decision per file, titled by its topic**: already the skill's rule.
- **Living decisions, edited in place**: already chosen; superseding records would contradict
  [new decision or change](/skills/uraeda/references/spec.md#new-decision-or-change).
- **A check per rule**: "Checked by" already plays MADR's confirmation.
- **Defining terms**: already [writing rule 3](/skills/uraeda/references/writing.md#every-document).
- **Pruning conflicts**: the [decisions check](/skills/uraeda/references/decisions-check.md) exists.

## Not checked

- The Y-statement paper (Zdun et al., IEEE Software 2013): its repository refused the connection, so
  its long form is not verified.
- Zimmermann's "How to review ADRs" and MADR's minimal templates: linked, not opened.
- Red Hat, Hackernoon, and TechTarget articles on ADRs: seen in search results only.
