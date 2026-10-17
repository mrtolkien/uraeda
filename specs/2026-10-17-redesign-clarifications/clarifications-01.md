---
status: awaiting-human
---

# Clarifications, round 01: Redesign clarifications

> [!IMPORTANT]
>
> 10 questions and 1 follow-up, about 35 minutes.
>
> - Verdict: worth building, with two cuts: the session in a side column, and diagrams, each move to
>   a later feature.
> - Two requests already work: answering with a comment alone, and follow-ups that appear once their
>   option is picked. What fails is that the page does not show it.
> - Opening the session in a side column conflicts with the layout decision, and the server refuses
>   to save answers while the agent replies. The recommendation moves it to its own feature.
> - The format gains structure the core does not read today: sub-headings in the opening and in the
>   settled points.
> - The writing rules will be shared with the specs redesign.
> - The card layouts come as live mockups to try.

## Context

**Goal.** A round you can read once, top to bottom, and answer quickly. It says what the feature is
for and whether it is a good idea before asking anything. Facts are grouped by kind, comparisons are
tables, and each question stands apart. "Readable" here means that a different model, following the
same rules, writes the same file.

**Today.** The 26 answered rounds average 2,829 words, 1.5 times the skill's example. All of them
open by retelling the proposal. None states the goal or gives a verdict on the proposal, and five
misread its intent, which only your answers revealed. Pushback with evidence was followed every time
it was given. 279 settled points form flat lists, of which 11 drew a reaction, and scope cuts draw
reactions four times as often as the rest. On the page, an 8 px band is all that separates
questions, a follow-up sits inside its parent with a 4 px border, and text runs to about 110
characters. More in [discovery](discovery-01.md#the-rounds-so-far).

**Scope.** The round's wording and format: the skill, its template, and its example. Then the
round's page, which the inbox triage shares. The specs redesign comes next, and reuses the writing
rules.

**Sources.**

- Every round in this repository, read as asked and as answered.
- The core's parser ([`round.rs`](/crates/core/src/files/items/round.rs)) and the round page
  ([`RoundPage.tsx`](/packages/web/src/RoundPage.tsx),
  [`Question.tsx`](/packages/web/src/Question.tsx)).
- Decision documents: BLUF, MADR, Rust RFCs, Shape Up, Amazon's PR/FAQ.
- GOV.UK, NN/g, and Baymard on forms and reading.
- Spec Kit, Codex, Claude Code, and Superpowers on asking questions.
- OpenAI, Anthropic, and Google on writing instructions models follow.
- The links are in [discovery](discovery-01.md#how-other-products-do-it).

## Q1: Does the session in a side column belong to this feature?

The proposal asks for "Ask the agent" to open the session beside the round, rather than leave the
page. Three things stand in the way:

- the [layout decision](/specs/decisions/ui-layout.md) says a session SHOULD be a page of its own,
  since its old 480 px pane was "too small to follow";
- the round already has a right column, its question index;
- the server refuses every save while the agent replies, so your answers could not be saved until
  its reply.

The specs redesign has the same need ("TODO: Define what goes in the right sidebar on desktop!").
More in [discovery](discovery-01.md#scope).

Why it matters: it decides the feature's size, and whether the right sidebar's purpose is decided
for rounds alone or for every page.

- **A (recommended). This feature covers the round's wording, format, and page. The session in a
  side column becomes its own feature, which decides the right sidebar for rounds and specs at
  once.**
  - [pro] a smaller feature, and one design for the sidebar on every page.
  - [con] "Ask the agent" still leaves the page until then.
  - Why recommended: the sidebar is shared work, and it changes an active decision.
- **B. This feature also opens the session in a side column beside the round, in place of the
  question index while it is open.**
  - [pro] you never leave the round.
  - [con] a larger feature, a change to the layout decision, and the follow-up below.

**Answer:**

### Q1.B: Can you keep saving answers while the agent replies in the side column?

Only if you picked B in Q1. Today every save on a feature waits until the agent's turn ends, so that
you and the agent never write the same file at once
([chat record](/specs/done/2026-10-13-chat-in-the-web-ui.md)). Text you type is kept in the browser
either way.

- **A (recommended). No: saving waits for the reply, and the page says so. What you type stays in
  the browser and saves after.**
  - [pro] the agent and you never write the same file at once.
  - [con] a save waits a reply's length, often under a minute.
  - Why recommended: nothing is lost, and no guard is relaxed.
- **B. Yes: answers save during a chat turn, each save refused if the file changed since the page
  read it.**
  - [pro] nothing waits.
  - [con] if the agent edits the round while you answer, one of you loses the race, and the page
    shows the newer text to redo your answer from.

**Answer:**

## Q2: What opens the round?

Today the `> [!IMPORTANT]` block gives a count and a time, then previews the questions ("Two choices
last beyond this feature"), counts the settled points, and sometimes reports git chores. About 30%
of its words describe questions you have not read yet. Decision documents put the bottom line first
([BLUF](https://mattstromawn.com/writing/bluf/)). Pushback has a fixed place in them, like the
"Drawbacks" of Rust RFCs. The block above is written the way A describes. More in
[discovery](discovery-01.md#where-the-review-goes).

Why it matters: it is the first thing you read in every round, and its first line is the commit
message.

- **A (recommended). The block opens with the count and the time. Next comes a verdict on the
  proposal: worth building as proposed, with changes, or not as proposed. Then come the pushback
  items, changes to decisions, and risks, one line each. Question previews, the settled count, and
  git chores leave it.**
  - [pro] the review comes first, and every line is a finding.
  - [con] the questions that work together are no longer announced: each question says it instead.
  - Why recommended: it is the content you followed every time, in the place you read first.
- **B. The block stays a summary of where your attention matters. A "Review of the proposal" section
  follows it, before the context.**
  - [pro] the review gets room for its evidence.
  - [con] two openings to read before the first question.
- **C. The review becomes the first question of every round: "Go ahead as proposed, with these
  changes?"**
  - [pro] the verdict needs your explicit answer.
  - [con] a question even when there is no pushback, and the block keeps its previews.

**Answer:**

## Q3: Which parts follow the block, and how are they marked?

The proposal asks for typed facts (sources, goal, current state against the goal), with categories
drawn from every round so far. The rounds' Context sections contain three kinds of content:

| Kind                                        | Rounds | Useful for the decision |
| ------------------------------------------- | -----: | ----------------------- |
| The proposal retold ("The proposal asks …") |     23 | never corrected         |
| Current state of the code, with numbers     |     24 | the strongest part      |
| Outside research                            |      6 | mostly repeated in Q1   |

The parts proposed from them, in this order:

- **Goal**: the outcome and the key concepts as read, never the list of requests.
- **Today**: the current state against the goal, with numbers and links.
- **Scope**: what the round covers and leaves out.
- **Sources**: what was read, in a few lines.
- In later rounds, **Since the last round** comes first: how your answers were read, then what was
  found.

The Context above uses these parts, marked as B does, because the core drops sub-headings today.
More in [discovery](discovery-01.md#the-openings-parts).

Why it matters: these parts become the template of every round, and of the specs redesign's opening.

- **A (recommended). These parts, each under its own sub-heading in the Context section, which the
  core keeps and the page draws.**
  - [pro] each part is a heading you can scan to, as readers do first.
  - [con] a core change, so that sub-headings reach the page.
  - Why recommended: the goal is where intent was misread, and headings are how you scan.
- **B. These parts, each a paragraph starting with its bold label, as in the Context above.**
  - [pro] no core change.
  - [con] the parts read as one block of paragraphs, with nothing to scan.
- **C. Goal and Today only, the sources staying in the discovery and in each question's links.**
  - [pro] the shortest opening.
  - [con] no list of what was read, which the proposal asks for.

**Answer:**

## Q4: How are the settled points grouped?

Rounds settle 1 to 16 points each, in one flat list. Scope cuts drew reactions in 13% of cases.
Behaviour points drew 3%, and architecture and tests almost none. A point keeps a unique bold
subject at its start, which your comments on it attach to. The groups proposed, in this order:

- **Check these**: scope cuts, and readings of the proposal or of your answers, at most about 5.
- **Behaviour**: what users see, and edge cases.
- **Under the hood**: architecture, reuse, tests, and docs.

The settled points below use these groups as a "Check" prefix, as B does. More in
[discovery](discovery-01.md#grouping-settled-points).

Why it matters: it decides what you check before answering, and how long the end of a round is.

- **A (recommended). The three groups, each under its sub-heading, with "Under the hood" folded on
  the page.**
  - [pro] what you react to comes first, and the rest stays in view for objections.
  - [con] the same core change as A in Q3.
  - Why recommended: the order follows what you have reacted to so far.
- **B. One list in the same order, each point's subject starting with its group's word: "Check",
  "Behaviour", or "Detail".**
  - [pro] no core change.
  - [con] still one long list, sorted by a word.
- **C. Only "Check these" in the round. Behaviour and under-the-hood points go to the discovery and
  the spec's assumptions.**
  - [pro] the shortest round.
  - [con] you meet the other points only when approving the spec.

**Answer:**

## Q5: How does the skill make every model write the same round?

The format is described in about a dozen places today, which disagree on the block's contents and
the time per question. The rules use words models read differently: "short", "honest", "one line
each". OpenAI's guides say contradictions hurt GPT-5 most, and that GPT-4.1 reuses sample phrases
verbatim. Anthropic and Google both say a filled-in example steers format best. Those rules can be
measured: words per part, sentences over 25 words, terms used before they are defined. More in
[discovery](discovery-01.md#wording-every-model-follows).

Why it matters: the specs redesign will reuse whatever this sets up, and it lasts as long as the
skill.

B can come on top of A or C.

- **A (recommended). A writing reference for every document written for you, shared with the specs
  redesign. It holds numbered rules with their reasons and limits in numbers. The template becomes a
  bare skeleton, and filled examples show a first round, a later round, and a change's round.**
  - [pro] one home per rule, and the examples steer every model the same way.
  - [con] a model can still drift from the rules, until a reviewer catches it.
  - Why recommended: A, with B on top. The rules and examples guide every model, and the warnings
    catch what drifts.
- **B. `ura check` warns on the measured limits of a round waiting for you: words per part,
  sentences over 25 words, a question count that does not match.**
  - [pro] a tool catches drift on any model.
  - [con] limits written into the core, which the skill and the tool must keep in step.
- **C. The agent writes the round freely, then a second agent rewrites it for you, following the
  rules.**
  - [pro] the first pass researches without format constraints.
  - [con] one more agent run per round, and two files that can disagree.

**Answer:**

## Q6: How does a question's card use a wide screen?

Each mockup draws the fixture's web UI round as cards, with Q1 answered B so that its follow-up
shows. Options are Astryx selectable cards, and the comment says a comment alone answers. Single-
column forms cause fewer errors than multi-column ones
([Baymard](https://baymard.com/blog/avoid-multi-column-forms)). That research is about columns of
input fields, though, not one group of options beside its question. At 1440 px with the app's
sidebar and the question index open, the cards are about 900 px wide. More in
[discovery](discovery-01.md#question-layout).

Why it matters: it is how every round reads on a computer, and the inbox triage too. On a phone,
every option is one column.

- **A (recommended). Two columns: the question and its context on the left, the options and the
  comment on the right. One column when the card is narrower than about 900 px, or when an option
  holds story variants.**

  [Two columns](/packages/web/src/QuestionCard.stories.tsx#TwoColumns)

  - [pro] the width is used, and a long context sits beside the options it explains.
  - [con] two layouts to keep working, and options wrap at about 45 characters.
  - Why recommended: it answers "the width of a wide page is not used". The fallback keeps narrow
    screens and story variants readable.

- **B. One column: the question, its context, its options, and the comment, stacked, the text held
  to the reading measure.**

  [One column](/packages/web/src/QuestionCard.stories.tsx#OneColumn)

  - [pro] one reading direction, and story variants keep the full width.
  - [con] the card's right side stays empty on wide screens.

- **C. Options in a row: the question and its context above, the options side by side below.**

  [Options in a row](/packages/web/src/QuestionCard.stories.tsx#OptionsInARow)

  - [pro] options compare at a glance.
  - [con] long options wrap in narrow columns, and the recommended one looks no different from the
    others.

**Answer:**

## Q7: How does a follow-up show once its option is picked?

A follow-up already appears only once you pick the option it depends on. What the proposal sees is
its separation: today a 4 px border, inside its parent, with a title the same size. One follow-up
that did not apply was answered anyway (nvim-plugin, Q1.A). Astryx advises against a card inside a
card. More in [discovery](discovery-01.md#follow-ups).

Why it matters: it is how dependent questions read, in every round that has one.

- **A (recommended). Its own card after its parent's, slightly indented, joined to it by a line, its
  header saying "follows Q1, because you picked B".**

  [After its parent](/packages/web/src/QuestionCard.stories.tsx#OneColumn)

  - [pro] it reads as a question of its own, and keeps its own entry in the index.
  - [con] it sits below the parent's comment, away from the option that opened it.
  - Why recommended: separation is what the proposal asks for, without nesting cards.

- **B. Inside the parent's card, right under the option it depends on.**

  [Inside its parent](/packages/web/src/QuestionCard.stories.tsx#FollowUpInside)

  - [pro] cause and effect side by side.
  - [con] a card inside a card, and the parent's other options pushed down.

**Answer:**

## Q8: When does the agent write a follow-up?

The skill asks every round to anticipate follow-ups, so you answer once. 6 of the 18 follow-ups so
far never applied: 29% of their words. All 4 follow-ups of an option that was not recommended went
unused. More in [discovery](discovery-01.md#follow-ups).

Why it matters: it trades words you skip against a new round when your answer surprises the agent.

- **A (recommended). Only under the recommended option. Another option that needs a choice states,
  in its sentence, what the agent would pick: "B. Answering and reviewing only, reviewing specs,
  plans, and assessments". Your comment can change it.**
  - [pro] no follow-up you skip, and still no new round.
  - [con] options that need a choice get longer sentences.
  - Why recommended: it keeps one round, without the words that went unused.
- **B. Under every option that needs one, as today.**
  - [pro] every branch is fully asked.
  - [con] about a third of follow-ups go unread.

**Answer:**

## Q9: How are a question's context and options written?

No round has used a table so far. Contexts run to a median of 78 words before the options, against
the rule's "two or three sentences". Options are bold sentences of about 20 words, with one pro and
one con. Spec Kit puts its options in a table, with the recommendation above it. More in
[discovery](discovery-01.md#question-format).

Why it matters: it is the bulk of every round, 74% of its words.

- **A (recommended). At most 60 words of context, or a table when it compares several facts, then
  "Why it matters". Options stay bold sentences of at most about 20 words, each with one pro and one
  con.**
  - [pro] each option stays a card you tap, and the parser is unchanged.
  - [con] a question that compares many facts needs its table to stay small.
  - Why recommended: the cards need sentences, and tables go where they compare.
- **B. Options as a table, one row each: the option, its pro, its con.**
  - [pro] the most compact.
  - [con] table rows make poor cards on a phone, and the core must read options from a table.

**Answer:**

## Q10: Can a round hold a diagram?

The proposal names Mermaid charts. No round has had a diagram so far. The three drawings in earlier
rounds were page layouts, which are now mockups. GitHub and GitLab render Mermaid in Markdown files.
The library is about 500 KB when loaded on demand. It had a critical XSS advisory in 2025 and
several HTML injection advisories in 2026. Data models and flows, in the specs redesign, need it
more. More in [discovery](discovery-01.md#diagrams).

Why it matters: it adds a dependency, which becomes a decision.

- **A (recommended). Not in this feature: the specs redesign decides diagrams, for rounds and specs
  at once.**
  - [pro] no dependency for a need not shown yet.
  - [con] a flow in a round is a table or a list until then.
  - Why recommended: specs need diagrams more, and the decision is made once.
- **B. Rounds may hold Mermaid diagrams, drawn by the page on demand, with its strict security level
  and a pinned version.**
  - [pro] flows and states drawn now.
  - [con] a 500 KB dependency, and its advisories to follow.

**Answer:**

## Settled without the human

- **Check: a comment alone is an answer, and the page says so.** The comment field reads "Comment,
  or your own answer instead of a letter". When a question is answered without a letter, its
  follow-ups do not apply, and you no longer mark each one "Does not apply". This changes the
  skill's rule, which asks for `-` today. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Check: an answer's letters are read one way.** "B, let's not" picks B everywhere. Today it opens
  B's follow-ups but shows no letter picked on the page, as in the skill's own example. One function
  reads letters followed by a comma, a colon, a full stop, or nothing. See
  [discovery](discovery-01.md#rules-and-their-owners).
- **Check: git chores leave the round.** Branches, merges, and features in flight go in the agent's
  last message. A round only names another feature when your answer depends on it. See
  [discovery](discovery-01.md#the-opening).
- **The time estimate is computed**: the words at 250 a minute, plus a minute per question.
  Follow-ups are counted apart from questions. Claimed times were off by half for long rounds, and
  by three to seven times for short ones. See [discovery](discovery-01.md#size-and-time).
- **A point that depends on an answer** is written into that option, not among the settled points:
  28 such points went stale when another letter was picked. See
  [discovery](discovery-01.md#settled-points).
- **Notes are labelled "Anything else"** on the page, since 4 of 12 Notes were new requests. The
  file keeps `**Notes:**`. See [discovery](discovery-01.md#settled-points).
- **Question titles grow one size, and reading text holds to about 75 characters**, within the
  layout decision's 120. See [discovery](discovery-01.md#forms-and-questions).
- **Options become Astryx selectable cards**, which closes the raw button gap in `Question.tsx`. The
  mockups use them. See [discovery](discovery-01.md#important-reads).
- **Older rounds stay valid**: every new part is optional for `ura check`, so rounds on other
  branches pass unchanged. See [discovery](discovery-01.md#likely-changes).
- **The inbox triage** takes the new page and the new writing rules, since it reuses both. See
  [discovery](discovery-01.md#important-reads).
- **The skill's example round is rewritten** in the new format, with the core tests that read it.
  See [discovery](discovery-01.md#likely-changes).
- **Files at their limits are split first**: `clarifications.rs`, `RoundPage.tsx`, `Question.tsx`,
  and `SettledPoints.tsx`. See [discovery](discovery-01.md#likely-changes).

**Notes:**
