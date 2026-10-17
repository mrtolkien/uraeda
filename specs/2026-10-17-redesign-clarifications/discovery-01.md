# Discovery, round 01: Redesign clarifications

## Summary

A clarifications file is a decision document: the agent asks for choices it cannot make, and lists
the ones it made. Established decision documents state the bottom line first, give only the
background a decision needs, and keep pushback in a named slot
([decision documents](#decision-documents)). Form design favours one input group per unit, a
question as its heading, and follow-up questions revealed in place
([forms and questions](#forms-and-questions)). AI tools that ask clarifying questions keep each
question to one sentence, 2 to 4 options, and one marked recommendation
([AI tools that ask](#ai-tools-that-ask)).

The proposal asks for a redesign of the round's wording and of its page, for readability and
efficiency:

- an opening that starts with a review of the proposal and gives typed facts instead of a summary;
- tables, diagrams, grouping, and priorities instead of flat bullets;
- each question as a card, with bigger text and better use of the width;
- follow-ups clearly separated from their parent;
- "Ask the agent" in a side column;
- answers with a comment and no option;
- wording that every model follows the same way.

The 26 answered rounds so far average 2,829 words, 1.5 times the skill's example. Each one opens by
retelling the proposal. 13% of their words go to settled points, 4% of which drew a reaction
([the rounds so far](#the-rounds-so-far)). Two of the proposal's requests already work in the code:
comment-only answers, and follow-ups that appear once their option is picked
([the proposal's path](#the-proposals-path-and-existing-actions)). Three are in the way of the code
or of an active decision:

- typed intro sections and sub-headings need the core to stop dropping headings;
- a session in a side column conflicts with the layout decision;
- the server refuses saves while an agent's turn runs.

## How other products do it

### Decision documents

- **BLUF**, "bottom line up front", from the US Army's writing standard AR 25-50: the main point or
  recommendation first, then the essential background
  ([BLUF](<https://en.wikipedia.org/wiki/BLUF_(communication)>),
  [Strom on BLUF](https://mattstromawn.com/writing/bluf/)).
- **MADR**, the Markdown template for architecture decisions, puts the decision outcome before the
  pros and cons of each option, and lists the considered options by name only
  ([MADR template](https://raw.githubusercontent.com/adr/madr/main/template/adr-template.md)).
- **Pushback has a named slot** in established formats: "Drawbacks" and "the impact of not doing
  this" in Rust RFCs
  ([RFC template](https://raw.githubusercontent.com/rust-lang/rfcs/master/0000-template.md)),
  "Rabbit holes" and "No-gos" in Shape Up pitches
  ([Shape Up](https://basecamp.com/shapeup/1.5-chapter-06)), "the top three reasons this product
  will not succeed" in Amazon's PR/FAQ
  ([Working Backwards](https://workingbackwards.com/concepts/working-backwards-pr-faq-process/)).
  The premortem asks a team to assume the project failed and say why
  ([HBR](https://hbr.org/2007/09/performing-a-project-premortem)).
- **Google design docs** keep context "succinct, not a requirements doc", with goals and non-goals,
  then alternatives considered; incremental work gets a 1 to 3 page mini design doc
  ([design docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/)).
- **Microsoft's style guide**: "Lead with what's most important", "Give customers just enough
  information to make decisions confidently"
  ([top 10 tips](https://learn.microsoft.com/en-us/style-guide/top-10-tips-style-voice)).

### Forms and questions

- **GOV.UK** asks one question per page, with the question as the heading, and hints of one short
  sentence ([question pages](https://design-system.service.gov.uk/patterns/question-pages/)). Its
  radios can reveal a related question when an option is picked, for simple questions only, and warn
  that screen reader users are not always told it appeared
  ([radios](https://design-system.service.gov.uk/components/radios/)).
- **Scanning**: readers scan headings first ("layer-cake" scanning, "by far the most effective"),
  and need headings that start with the words that carry information
  ([NN/g layer cake](https://www.nngroup.com/articles/layer-cake-pattern-scanning/)). Bullet lists
  lose their effect when overused, and nested lists are hard to follow
  ([NN/g bullets](https://www.nngroup.com/articles/presenting-bulleted-lists/)). Tables suit up to
  about 5 items compared on the same attributes
  ([NN/g comparison tables](https://www.nngroup.com/articles/comparison-tables/),
  [digital.gov tables](https://digital.gov/guides/plain-language/design/tables)).
- **Line length**: WCAG 1.4.8 sets at most 80 characters and a line height of 1.5
  ([WCAG](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html)); Baymard 50 to 75
  ([Baymard](https://baymard.com/blog/line-length-readability)); Bringhurst 45 to 75, 66 ideal
  ([webtypography.net](https://webtypography.net/2.1.2)).
- **Cards** suit browsing self-contained items, and are poor for comparing options, where lists with
  a consistent structure do better
  ([NN/g cards](https://www.nngroup.com/articles/cards-component/)). Astryx's own guidance: cards
  for discrete items, never a card inside a card (`Card.doc.mjs` in `@astryxdesign/core` 0.6.8).
- **Columns**: multi-column forms cause skipped and misread fields
  ([Baymard](https://baymard.com/blog/avoid-multi-column-forms),
  [NN/g](https://www.nngroup.com/articles/web-form-design/)). That research is about columns of
  input fields: no source tested a question and its context on the left, with one group of options
  on the right.

### AI tools that ask

- **Spec Kit's `/clarify`**: at most 5 questions, one at a time, each with one "why it matters"
  sentence, the recommended option above a table of 2 to 5 options, and a free-form row; questions
  ranked by impact times uncertainty
  ([clarify.md](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/clarify.md)).
- **Codex plan mode**: 1 to 3 questions of one sentence, 2 or 3 options with the recommended one
  first, "Never ask questions you can answer from your environment", and an unanswered question
  taken as its recommendation, recorded as an assumption
  ([request_user_input](https://github.com/openai/codex/blob/main/codex-rs/core/src/tools/handlers/request_user_input_spec.rs),
  [plan template](https://github.com/openai/codex/blob/main/codex-rs/collaboration-mode-templates/templates/plan.md)).
- **Claude Code's AskUserQuestion**: 1 to 4 questions of 2 to 4 options, with an automatic "Other"
  free-text answer ([user input](https://code.claude.com/docs/en/agent-sdk/user-input.md)).
- **Superpowers' brainstorming**: one question at a time, "a guess they can correct often beats a
  question", and choices the agent made recorded "as your call"
  ([SKILL.md](https://raw.githubusercontent.com/obra/superpowers/main/skills/brainstorming/SKILL.md)).
- **Research**: being good at writing code does not make a model good at clarifying, and
  clarification degrades as ambiguities get denser
  ([ClarifyCodeBench](https://arxiv.org/abs/2607.00711)).

### What they have in common

- The bottom line first: a recommendation or a verdict before the background.
- Pushback in a named, always-present place.
- One sentence per question, few options, one marked recommendation, a free-text escape.
- Headings that carry information, and tables for comparisons.
- Text no wider than about 75 to 80 characters.

## Standards and libraries

### Markdown rendering

- GitHub and GitLab render alerts (`> [!NOTE]`), tables, `<details>`, and Mermaid diagrams in
  Markdown files
  ([GitHub diagrams](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams),
  [GitLab Markdown](https://docs.gitlab.com/user/markdown/)). GitHub advises one or two alerts per
  article
  ([GitHub syntax](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)).
- **Mermaid** renders with `securityLevel: 'strict'` by default, and has a beta sandbox level that
  draws in an iframe ([usage](https://mermaid.js.org/config/usage.html)). Its advisories include a
  critical XSS in architecture diagrams (August 2025) and several HTML injection ones in 2026
  ([advisories](https://github.com/mermaid-js/mermaid/security/advisories)). One app measured it at
  about 500 KB as a lazy-loaded chunk ([cmux PR](https://github.com/coder/cmux/pull/354)).
  `accTitle` and `accDescr` give a diagram an accessible name
  ([accessibility](https://mermaid.js.org/config/accessibility.html)).
- Astryx 0.6.8's `Markdown` has a fence plugin API, but no diagram component (`Markdown.doc.mjs` in
  `@astryxdesign/core`), and workflow files do not go through it: the UI draws the core's document
  tree ([stack decision](/specs/decisions/stack.md)).

### Instructions every model follows

- **OpenAI**: GPT-4.1 follows instructions literally, and the later of two conflicting ones; sample
  phrases get reused verbatim
  ([GPT-4.1 guide](https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide)).
  Contradictory or vague instructions are "more damaging to GPT-5 than to other models"
  ([GPT-5 guide](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide)).
- **Anthropic**: explain the reason behind a rule, say what to do rather than what not to do, and
  give 3 to 5 varied examples; the prompt's own format shapes the output's
  ([best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)).
- **Google**: always include few-shot examples with identical formatting, give the output's skeleton
  for the model to complete, and do not mix XML and Markdown
  ([Gemini strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)).
- **In common**: a filled-in example of the exact output, a skeleton to complete, short rules with
  their reason, and no contradictions.
- **Rules a tool can check**: GOV.UK splits sentences over 25 words, and gives every list a lead-in
  line
  ([A to Z](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/style-guides/a-to-z-style-guide/));
  Google's developer style puts conditions before instructions
  ([highlights](https://developers.google.com/style/highlights)).

### Priority labels

- RFC 2119's MUST, SHOULD, and MAY, used "sparingly"
  ([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)).
- Conventional Comments: a label and a decoration, "(blocking)" or "(non-blocking)"
  ([conventionalcomments.org](https://conventionalcomments.org/)); Google's reviews prefix "Nit:",
  "Optional:", "FYI:"
  ([comments](https://google.github.io/eng-practices/review/reviewer/comments.html)).

## The code

### The rounds so far

A review of every round written in this repository: 27 rounds for real features, 26 of them
answered, read as asked and as answered (commits given per round). Method and raw counts:
`git log --all -- '*clarifications-*.md'`, each file read at its asking and answering commits.

#### Size and time

- 72,242 words in 26 answered rounds, 205 questions, 18 follow-ups, 279 settled points. The median
  round has 2,829 words, against the example's 1,937
  ([example](/skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/clarifications-01.md)).
- Questions take 74% of the words, settled points 13%, the `> [!IMPORTANT]` block 6%, and the
  Context section 6%.
- The 12 long first rounds answered in one sitting claimed 405 minutes, and were answered within 213
  (53%). redesign-interface claimed 50 minutes and was answered in 15 (`bf2aa9a` to `40427c1`).
  Small security rounds ran the other way: ui-iteration round 03 claimed 5 minutes and took 36
  (`a359dd1` to `888b4a8`).
- The block's question count is wrong in 11 of the 13 rounds with follow-ups: it counts follow-ups
  as questions.

#### The opening

The opening is the block and the Context section. 140 block bullets and 58 Context paragraphs were
sorted by content:

| Content                                                         | Bullets or paragraphs | Value for the decisions   |
| --------------------------------------------------------------- | --------------------: | ------------------------- |
| Proposal retold ("The proposal asks ...")                       | 23 of 23 first rounds | low: never corrected      |
| Current state of the code, with numbers and links               |                    24 | high                      |
| Preview of "lasting choices" and "questions that work together" |                    36 | low: subjects not met yet |
| Settled count ("N points are settled without you")              |              26 of 26 | low                       |
| Changes to decisions or the constitution                        |                    15 | high                      |
| Gaps in the proposal                                            |                    15 | high                      |
| Feasibility pushback, with evidence                             |                    11 | highest: always followed  |
| Risks, as what someone could do                                 |                     9 | high                      |
| Scope split                                                     |                     9 | high                      |
| Process and git chores ("main and origin/main have diverged")   |                     5 | none                      |

- **Feasibility pushback with evidence was followed every time**: justified text "at its worst on a
  phone", the human then choosing against their own proposal (ui-improvements Q6, `730890d`); "Four
  requests cannot work as written", answered A four times (redesign-interface, `40427c1`). The human
  asks for more of it in 9 places: "Push against it if it's too costly", "Tell me if it's too
  complex".
- **No round states the goal**, the agent's reading of the key concepts, or a verdict on the whole
  proposal. Five rounds misread the intent, and only the answers showed it:
  - "I AM NOT LOOKING FOR SCREENSHOTS" (ui-iteration 01, `cd51446`);
  - "should look and feel like a chat with a light structure on top" (add-bugfixing, `a3148d8`);
  - "they are _not_ priorities, by definition" (add-scratchpad, `02d6973`);
  - "this rework of the flow is about what the human SEES" (code-quality, `635599c`);
  - "A draft is a state of a priority" (redesign-interface, `40427c1`).
- **Three rounds already label the parts of their Context**: the runner ("What exists today:", "What
  other tools do:", `1cbdd78`), code-quality ("Where things stand today:", `aaf4fde`), and
  ui-iteration 01 (`c12e07c`). ui-iteration 02 has the best later-round shape: "Your round 01
  answers ... changed the feature:", then "What this round found:" (`ccf00c8`).

#### Settled points

| Kind                                    | Points | Drew a reaction |
| --------------------------------------- | -----: | --------------: |
| User-visible behaviour and edge cases   |    102 |          3 (3%) |
| Architecture and reuse of existing code |     51 |               1 |
| Scope boundaries: left out, deferred    |     23 |         3 (13%) |
| Tests and checks                        |     23 |               1 |
| Docs, skill, and decisions to update    |     23 |               0 |
| Naming and formats                      |     18 |               1 |
| Security                                |     13 |               0 |
| Libraries and versions                  |     10 |               0 |
| Git, merge order, other features        |     10 |               1 |
| Readings of the proposal                |      6 |               1 |

- Scope boundaries draw reactions at four times the rate of behaviour points, and sit among them at
  any position.
- 28 points depend on an answer ("With A in Q1, ..."). Some went stale when the human picked another
  letter (nvim-plugin, `cc787c9`; add-scratchpad).
- The Notes field holds more than comments on settled points: 4 of the 12 non-empty Notes are new
  requests ("text input boxes should not grow too much ahead of time", text-inputs, `cba94cc`).

#### Questions and answers

- **No table and no diagram in 27 rounds.** Question contexts are prose in 22 of 26 rounds. The
  context before the options has a median of 78 words (the example has 57), and option sentences
  average 19.8 words (15 in the example).
- **Bullets are the template's.** The example has 41.8 bullet lines per 1,000 words, more than the
  median round's 36.8: every option is a bullet with two or three sub-bullets, and every settled
  point a bullet.
- **Answers**: of 223 answers, 54% are "A" alone, 23% "A" with a comment, 13% another letter, 4%
  several letters, 3% own words only, and 2% empty follow-ups that did not apply. The recommendation
  is followed 83% of the time, and the median answer is one word.
- **12 answers fit no option.** Two say the letter was forced: "I picked A because I need to pick
  one" (ui-iteration 01, `cd51446`), "I picked A because you require me picking an option"
  (settings-page Q8, `e12e03b`).
- **Follow-ups**: 6 of 18 never applied, 29% of follow-up words. All 4 follow-ups of a
  non-recommended option went unused. One that did not apply was answered anyway (nvim-plugin Q1.A,
  `cc787c9`).
- **Writing**: against the example, 3.7 times the possessives ("the stack decision's `Origin`
  rule"), 5 times the semicolons, sentences 15% longer. IDs from files the reader has not seen (R10,
  R49, R57, US5, "Task 5"), and terms before their definition (herdr, spike, "the light flow").

### Important reads

- [`crates/core/src/files/items/round.rs`](/crates/core/src/files/items/round.rs): builds the round
  the web UI and the editors read. The block is the first callout before any `##` heading; only
  `## Context` is read before the questions, by name (line 166); a question ends at the next heading
  of level 3 or above (lines 101-105), and its own headings are skipped (line 124).
- [`crates/core/src/files/items.rs`](/crates/core/src/files/items.rs): `section()` (lines 304-311)
  drops every heading of a section, so sub-headings in Context and in the settled points never reach
  the page.
- [`crates/core/src/files/clarifications.rs`](/crates/core/src/files/clarifications.rs), 494 lines,
  just under the 500-line limit: the line parser behind `ura answer`, submit, and `ura check`.
  `picked_letters()` (lines 71-85) and `split_answer()` (lines 363-388) read an answer's letters two
  different ways: "B, let's not" picks B for its follow-ups, but shows no letter picked in the web
  UI.
- [`crates/core/src/check/sections.rs`](/crates/core/src/check/sections.rs): `ura check` takes the
  required sections from the template built into the binary. A `##` section the template lacks is an
  error; a template section is required unless its placeholder starts with `[Optional`.
- [`crates/core/src/files/markdown.rs`](/crates/core/src/files/markdown.rs) lines 246-274: the
  answer record turns `> [!IMPORTANT]` into `> [!NOTE]` and replaces only the block's first
  paragraph with "Answered on DATE".
- [`packages/web/src/RoundPage.tsx`](/packages/web/src/RoundPage.tsx): the page. An 8 px muted band
  is the only separation between questions (lines 27-35); the questions sit beside the 240 px
  question index (lines 137-149).
- [`packages/web/src/Question.tsx`](/packages/web/src/Question.tsx): a question and its options.
  Each option is a raw `<button>`, a listed Astryx gap (line 192); a follow-up renders inside its
  parent's section with a 4 px border, and its title is the same level-2 heading (lines 42-48,
  360-372).
- [`packages/web/src/theme/theme.ts`](/packages/web/src/theme/theme.ts): reading text is 17 px, 19
  px from 1024 px, held to 90ch, about 110 characters (lines 138-144); the page column grows from
  720 to 1200 px at 1024 px.
- [`packages/web/src/Blocks.tsx`](/packages/web/src/Blocks.tsx): renders tables, code, callouts,
  headings, and typed bullets already. A `mermaid` code block shows as code.
- [`packages/web/src/sessions.ts`](/packages/web/src/sessions.ts) line 81: "Ask the agent" navigates
  to the session page with the question quoted.
- [`packages/server/src/fate/sessions.ts`](/packages/server/src/fate/sessions.ts) lines 403-411:
  every save on a feature is refused while its session has a turn running, chat turns included
  ([chat record](/specs/done/2026-10-13-chat-in-the-web-ui.md)).
- [`packages/web/src/TriagePage.tsx`](/packages/web/src/TriagePage.tsx) line 29: the inbox triage
  reuses the round page, so it changes with it.

### The proposal's path and existing actions

- **Answering with a comment and no option already works**, in the core, `ura answer`, and the web
  UI, since the web UI's first version: an answer only has to be non-empty
  ([`actions/answer.rs`](/crates/core/src/actions/answer.rs) line 128, web test "a comment alone is
  the answer", [`round.test.tsx`](/packages/web/src/__tests__/round.test.tsx) line 133, from
  `804e989`). What makes it feel forced:
  - nothing on the page says a comment alone answers;
  - a comment saves only with "Save comment" or Ctrl+Enter, while a tap on an option saves at once;
  - a parent answered with a comment alone leaves its follow-ups "unclear", each then waiting for an
    answer or "Does not apply".
- **A follow-up already appears only once its option is picked**
  ([`clarifications.rs`](/crates/core/src/files/clarifications.rs) lines 60-67, test "a follow-up
  shows inside its parent once it applies"). What the proposal sees is its separation: a 4 px border
  and a heading of the same size.
- **Ask the agent** leaves the page. Opening the session beside the round meets three things:
  - the [layout decision](/specs/decisions/ui-layout.md) says a session "SHOULD be a page of its
    own", because its earlier 480 px pane was "too small to follow";
  - the round already has a right column, the question index;
  - while the agent answers, the server refuses every save, so answers could not be saved until its
    reply.
- **Submitting** flips the block to a record and commits; nothing changes there.
- **Commenting on a settled point** keys the comment on the point's leading bold words
  ([`round.rs`](/crates/core/src/files/items/round.rs) lines 31-44). Grouped or ranked points must
  keep a unique bold subject at their start, or their comments break.
- **Records**: at finish, rounds are copied into the feature's record as `### Round 01` and
  `#### Q2: ...` ([finish](/skills/uraeda/references/finish.md)). Sub-headings inside a question
  would need a level 5 there.

### Rules and their owners

- **The round's format** is described in about a dozen places: the template, the triage template,
  `SKILL.md`, `references/discovery.md`, `conventions.md`, `spec.md`, `change.md`, `inbox.md`,
  `finish.md`, and `cli.md`. They disagree:
  - the block's contents are listed three ways ([`SKILL.md`](/skills/uraeda/SKILL.md) lines 180-190,
    [discovery](/skills/uraeda/references/discovery.md) lines 322-327, the template);
  - the time per question is "two to five minutes" in discovery and "about two minutes" in
    [inbox](/skills/uraeda/references/inbox.md);
  - a follow-up whose parent names no letter must be answered `-` in `SKILL.md` and `ura check`, but
    is ignored in [spec](/skills/uraeda/references/spec.md) line 56;
  - the template's sentence "The full investigation is in discovery" is required, yet a change's
    round must drop it ([change](/skills/uraeda/references/change.md)).
- **Load-bearing wording nowhere stated**: settled points need unique bold subjects, and "Why
  recommended" is recognised by its text ([`round.rs`](/crates/core/src/files/items/round.rs) line
  212).
- **Wording models read differently**: "short", "two or three sentences", "honest", "one line each",
  "with fresh eyes". "Writes back your understanding" invites the retelling the proposal complains
  about.
- **The answer's letters** are read in two places that disagree, `picked_letters()` and
  `split_answer()`, and once more in the web's `composed()` mirror
  ([`useAnswer.ts`](/packages/web/src/useAnswer.ts) lines 13-28).

### Overlaps with features in flight

- [Redesign specs](/specs/drafts/redesign-specs.md), next in **Now**: the same model-agnostic
  wording work, cards, tables, Mermaid for data models, and "TODO: Define what goes in the right
  sidebar on desktop!". Its review proposes a capped block, never citing an answer by number, and
  terms defined at first use.
- [Redesign session](/specs/drafts/redesign-session.md): the composer and the session's speed, which
  a session in a side column would reuse.
- [Redesign feature page](/specs/drafts/redesign-feature-page.md): one "Open session" button with a
  pre-filled message.
- [Look and feel](/specs/drafts/look-and-feel/proposal.md): icons, and resizable right sidebars.
- The [inbox](/specs/INBOX.md) proposes writing files in two passes: a free first draft, then a
  human-readable document.
- No open feature branch changes the round's format or page.

### Likely changes

- [`skills/uraeda/references/discovery.md`](/skills/uraeda/references/discovery.md), the
  [template](/skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/clarifications-01.md),
  the
  [example](/skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/clarifications-01.md),
  [`SKILL.md`](/skills/uraeda/SKILL.md), [`change.md`](/skills/uraeda/references/change.md),
  [`spec.md`](/skills/uraeda/references/spec.md), and the
  [triage template](/skills/uraeda/assets/templates/specs/INBOX-TRIAGE.md): under every option.
- A shared writing reference, `skills/uraeda/references/writing.md`: with A of
  [wording every model follows](#wording-every-model-follows).
- [`round.rs`](/crates/core/src/files/items/round.rs),
  [`items.rs`](/crates/core/src/files/items.rs), and the regenerated
  [`index.d.ts`](/packages/binding/index.d.ts): with typed opening parts or grouped settled points,
  under A of [the opening's parts](#the-openings-parts) or
  [grouping settled points](#grouping-settled-points).
- [`clarifications.rs`](/crates/core/src/files/clarifications.rs), split first: one reading of an
  answer's letters, under every option.
- [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx),
  [`Question.tsx`](/packages/web/src/Question.tsx),
  [`SettledPoints.tsx`](/packages/web/src/SettledPoints.tsx),
  [`RoundNav.tsx`](/packages/web/src/RoundNav.tsx), `theme.ts`, and their tests: under every layout
  option. Their main functions are at 96 to 98 of the 100 lines allowed, so they are split first.
- With the side column: `SessionPage.tsx` split into a reusable session panel,
  [`SideColumn.tsx`](/packages/web/src/layout/SideColumn.tsx), `sessions.ts`, and, to keep answers
  saving, the server's `writable()`.
- With Mermaid: a pinned dependency, a `Diagram.tsx`, and `Blocks.tsx`.

## The proposal

### Two requests already work

Comment-only answers and follow-ups revealed by their option exist. The fix is visibility: a field
label that says a comment alone answers, and a follow-up that looks like its own question. See
[the proposal's path](#the-proposals-path-and-existing-actions).

### Ask the agent in a side column

The proposal asks for the session beside the round. It conflicts with a SHOULD of the active
[layout decision](/specs/decisions/ui-layout.md), and with the server's refusal of saves while an
agent works. It also decides what the right sidebar is for, which the specs redesign has left as a
TODO. See [scope](#scope).

### Categories of the opening

The proposal names three kinds of facts (sources, goal, current state against the goal), and asks
for categories drawn from every round so far. [The rounds so far](#the-opening) give them.

### Mermaid charts

The proposal names Mermaid as a possibility. No round so far needed a diagram, and rendering one
adds a dependency with a security history. See [diagrams](#diagrams).

### Review of the proposal

The proposal asks each round to open with a review of the proposal's quality and feasibility, with
pushback when it would lead to bad or hard to maintain code. The discovery file already weighs
"worth it and feasibility", but the round has no place for it, and the "worth it" check is only two
days old (`978089e`).

### A broken link in the proposal

The proposal's last note links `../redesign-specs.md`, which does not exist: the file is
`specs/drafts/redesign-specs.md`. `ura check` reports it. The proposal's image was left in
`specs/drafts/redesign-clarifications/images/` when the feature started: this round moves it next to
the proposal, and an inbox note reports the cause in `ura start`.

## Worth it and feasibility

- **Worth it**: the human reads a round on every feature, and the review of the workflow found the
  human reads about 13,000 words per feature across the round and the spec. The rounds have grown to
  1.5 times the example, and their opening never says what the feature is for. The cost is the
  skill's text, a core change if the format gains structure, and the round page.
- **Outside behaviour relied on**:
  - Astryx's `SelectableCard` holding interactive content: checked, in the mockups of this round,
    which use it for every option.
  - A session in a side column: not built, and blocked by the server's refusal of saves.
  - Mermaid: not checked beyond its documentation.
- **Guards relaxed**: letting answers save while an agent works would let a chat turn and the human
  write the same file. The agent could then overwrite an answer, or the human an agent's edit,
  unless the save checks the file did not change.

## Approaches

Criteria: readability and efficiency for the human (the proposal); plain text readable without tools
([principle II](/specs/CONSTITUTION.md)); human attention as the scarcest resource
([principle IV](/specs/CONSTITUTION.md)); rules any agent can follow
([principle V](/specs/CONSTITUTION.md)); one home per rule ([principle VI](/specs/CONSTITUTION.md));
the [layout decision](/specs/decisions/ui-layout.md); older rounds on other branches stay valid.

### Scope

What this feature covers: the round's format, wording, and page, with or without the session in a
side column. Relies on [the proposal's path](#the-proposals-path-and-existing-actions) and
[overlaps](#overlaps-with-features-in-flight).

| Option                                                         | Size   | Conflicts                     | Right sidebar decided      |
| -------------------------------------------------------------- | ------ | ----------------------------- | -------------------------- |
| A. Format and page; side column later, with the specs redesign | medium | none                          | once, for rounds and specs |
| B. Everything, side column included                            | large  | layout decision, save refusal | here, for rounds only      |

### Where the review goes

What the file says before Q1, and where the review of the proposal goes. Relies on
[the opening](#the-opening) and [decision documents](#decision-documents).

| Option                                       | Verdict         | Question previews | Fits the record flip                   |
| -------------------------------------------- | --------------- | ----------------- | -------------------------------------- |
| A. The block is the verdict and its pushback | first           | removed           | yes: first paragraph is the count line |
| B. Block as today, a review section after it | after a summary | kept              | yes                                    |
| C. The review as the first question          | in Q1           | kept              | yes                                    |

### The opening's parts

Which typed parts follow the block, and how they are marked. Relies on [the opening](#the-opening).

| Option                                                                   | Parts  | Marked by                               | Core change              |
| ------------------------------------------------------------------------ | ------ | --------------------------------------- | ------------------------ |
| A. Goal, Today, Scope, Sources, and in later rounds Since the last round | 4 or 5 | `###` sub-headings                      | keep headings in Context |
| B. The same parts                                                        | 4 or 5 | bold labels at the start of a paragraph | none                     |
| C. Goal and Today only                                                   | 2      | bold labels                             | none                     |

### Grouping settled points

How settled points are grouped and ranked. Relies on [settled points](#settled-points).

| Option                                                              | Groups | What the human sees first | Core change                  |
| ------------------------------------------------------------------- | ------ | ------------------------- | ---------------------------- |
| A. "Check these", "Behaviour", "Under the hood", under sub-headings | 3      | scope cuts and readings   | keep headings in the section |
| B. One list, a priority word in each subject                        | 1      | the highest priority      | none                         |
| C. Only "Check these" in the round, the rest in the discovery       | 1      | scope cuts and readings   | none                         |

### Wording every model follows

How the skill makes different models write the same file. Relies on
[instructions every model follows](#instructions-every-model-follows).

| Option                                                       | Where the rules live             | Enforced by    | Cost per round     |
| ------------------------------------------------------------ | -------------------------------- | -------------- | ------------------ |
| A. A writing reference, a skeleton template, filled examples | one reference, shared with specs | self-review    | none               |
| B. `ura check` warnings for measured limits                  | the core                         | the tool       | none               |
| C. A second pass rewriting the draft for the human           | the skill                        | a second agent | one more agent run |

### Question layout

How a question's card uses a wide screen. Relies on [forms and questions](#forms-and-questions) and
the mockups in [`QuestionCard.stories.tsx`](/packages/web/src/QuestionCard.stories.tsx).

| Option                                                   | Width used      | Line length          | Story variants under options |
| -------------------------------------------------------- | --------------- | -------------------- | ---------------------------- |
| A. One column                                            | reading measure | 90ch today           | full width                   |
| B. Two columns: question and context left, options right | whole card      | about 45ch each side | half width                   |
| C. Options in a row                                      | whole card      | narrow columns       | a third of the width         |

### Follow-ups

How a follow-up shows, and when the agent writes one. Relies on
[questions and answers](#questions-and-answers).

| Option                                               | Shown            | Index entry | Card in card |
| ---------------------------------------------------- | ---------------- | ----------- | ------------ |
| A. Its own card after its parent's, joined by a line | after the parent | yes         | no           |
| B. Inside the parent's card, under its option        | in place         | yes         | yes          |

| Option                                                                  | Follow-ups written | Unused words, from the rounds so far |
| ----------------------------------------------------------------------- | ------------------ | ------------------------------------ |
| A. Under the recommended option only; another option states its default | fewer              | down from 29%                        |
| B. Every option that needs one, as today                                | all                | 29%                                  |

### Question format

How a question's context and options are written. Relies on
[questions and answers](#questions-and-answers) and [scanning](#forms-and-questions).

| Option                                                  | Context | Options                          | Parser change                  |
| ------------------------------------------------------- | ------- | -------------------------------- | ------------------------------ |
| A. Prose of at most 60 words, or a table when comparing | short   | bold sentences, one pro, one con | none                           |
| B. A comparison table for the options                   | short   | table rows                       | read a table's rows as options |

### Diagrams

Whether rounds can hold Mermaid diagrams the page draws. Relies on
[Markdown rendering](#markdown-rendering).

| Option                                      | Dependency           | Security             | Need shown so far       |
| ------------------------------------------- | -------------------- | -------------------- | ----------------------- |
| A. Not now: decided with the specs redesign | none                 | none                 | 0 diagrams in 27 rounds |
| B. Render Mermaid now, lazy-loaded, strict  | about 500 KB, pinned | advisories to follow | none yet                |

### Needs no choice

- **Comment-only answers**: already supported; the page says so, and the answer's letters are read
  one way. See [the proposal's path](#the-proposals-path-and-existing-actions).
- **One question per page**, GOV.UK's pattern: the rounds' questions depend on each other and are
  read together, so a page per question would hide those links.
- **Bigger question titles and a narrower measure**: a styling choice within the layout decision,
  which allows up to about 120 characters.
- **Time estimates**: computed from the word count, since the claimed times were off both ways.
- **The Notes field**: kept, its label said as "Anything else", since 4 of 12 Notes were new
  requests.
- **Older rounds**: every new part is optional for `ura check`, so rounds on other branches stay
  valid.

## Not checked

- No source tested a two-column layout with one group of options per question: the form research is
  about columns of input fields.
- The GitLab handbook's pages on asynchronous writing redirect to a sign-in page.
- Readability formulas were not compared: the style guides' checkable rules were used instead.
- Annie Duke's kill criteria and NIST SP 800-30's risk levels were seen only in search snippets.
