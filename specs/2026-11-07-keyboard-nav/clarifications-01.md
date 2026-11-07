---
status: answered
---

# Clarifications, round 01: Keyboard nav in questions and specs

> [!NOTE]
>
> Answered on 2026-11-07.
>
> - Verdict: worth building, with changes: the option letters clash with keys every page shares. The
>   Keyboard decision forbids that, so either the decision or the letters change.
> - Picking an option by its letter changes the Keyboard decision, and lasts beyond this feature.
> - How far the layer goes sets the size of the work: every action, or a small layer as the proposal
>   wonders.
> - The current question and the cursor's keys work together: the letters act on the question the
>   cursor holds.
> - Six points to check come before the questions, among them `d` removing a pending comment after a
>   yes or no, and `s` asking the agent.

## Context

### Goal

The [proposal](proposal.md) asks for the spec and plan reviews, and the rounds of questions, to work
without the mouse. Blocks are selected with keys like a list's rows, and commented on. A question's
option is picked with a key. It also asks to keep this a small layer.

### Today

Both pages scroll with `j` `k`; nothing moves from block to block.

- **A review**: a block is reached by Tab, one stop per block and per link. Enter then selects it,
  and opens the comment field under it. A second click stretches the comment over more blocks; no
  key does. A pending comment's Edit and Remove are buttons. `n` goes to the verdict
  ([`ReviewVerdict.tsx`](/packages/web/src/ReviewVerdict.tsx)).
- **A round**: an option is reached by Tab, then Space or Enter toggles it, and several may be
  picked ([`QuestionOption.tsx`](/packages/web/src/QuestionOption.tsx)). `n` `p` jump to blank
  questions ([`RoundOutline.tsx`](/packages/web/src/RoundOutline.tsx)). Nothing on the page marks a
  current question; the outline marks the one at the top.
- **What helps**: every block already has a focusable toggle
  ([`Selection.tsx`](/packages/web/src/Selection.tsx)), and the lists have a cursor hook,
  [`useListKeys`](/packages/web/src/lists/useListKeys.ts). Settled points use the same blocks.

| Product   | Moves by           | Comments with | A range               |
| --------- | ------------------ | ------------- | --------------------- |
| Gerrit    | `j` `k`, a line    | `c`           | a selected code block |
| Notion    | arrows, a block    | Cmd+Shift+M   | Shift with arrows     |
| octo.nvim | Vim's moves        | leader, `ca`  | visual mode           |
| GitHub    | no cursor          | `r` quotes    | Shift with arrows     |
| Typeform  | a question at once | letters pick  | none                  |

### Scope

The keys of the spec, plan, and round pages. The pages built on them come too: the inbox triage, the
decisions check, and a read-only proposal or round. Inside a mockup or a story, the pointer stays,
as the proposal accepts. The phone is unchanged.

### Sources

- The key registry, the review's blocks and comment form, the round's options and jumps, linked
  above.
- Gerrit's, GitHub's, GitLab's, Google Docs', Notion's, Gmail's, and Linear's shortcut pages,
  octo.nvim, Helix, and Typeform (search results only).
- WCAG 2.1.4, 2.4.7, and 2.4.11; WAI-ARIA's radio, listbox, and grid patterns; NVDA's guide.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Check these

- **Enter comments on the cursor's block**, as a click does now, opening the field under it. Gerrit
  uses `c`, but Enter is the base keymap's "obvious action". See
  [discovery](discovery-01.md#gerrit).
- **A pending comment is a row the cursor stops on**, under its block: Enter or `i` edits it, `d`
  removes it after a yes or no. Today Remove deletes at once; the Global undo feature may make it
  undoable later. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **`s` asks the agent** about the cursor's block, question, or settled point, opening the Session
  tab with the quote, as the button does. `s` already means sessions on a feature's page. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Picking an option keeps the cursor on its question**, unlike Typeform, which moves on: an answer
  often holds two letters and a comment. `n` goes on to the next blank question. See
  [discovery](discovery-01.md#typeform).
- **The right column's tabs get no key**: asking the agent opens Session, and the notes' row opens
  Notes, as their buttons do. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The pages built on the same parts get the keys too**: the inbox triage, the decisions check, and
  a read-only proposal or round. See
  [discovery](discovery-01.md#the-pages-the-proposal-does-not-name).

## Q1: How far should the keyboard layer go?

The proposal asks that no action need the mouse, then wonders whether this should be "a small
navigation layer". The two pages hold more actions than commenting and picking. Examples are editing
or removing a pending comment, Ask the agent, folds like "More scenarios", and the notes. Inside a
mockup or a story, the pointer stays whatever the answer. More in
[discovery](discovery-01.md#how-far-the-layer-goes).

Why it matters: it sets the work and the number of new keys. The next three questions apply with A
or B; with C, the letters act on the question at the top of the screen.

- **A (recommended). A cursor that `j` `k` move over every block, comment, fold, and question, with
  a few keys on it. Every action outside mockups and stories works without the mouse.**
  - [pro] the persona "never touches the mouse" is met on both pages.
  - [con] about 8 keys and a cursor to build and test.
  - Why recommended: blocks already have their toggles and lists their cursor, so the full layer
    costs little more than the small one.
- **B. A cursor over blocks and questions, with only commenting and picking by key; the other
  actions stay reachable by Tab.**
  - [pro] about 4 keys.
  - [con] editing a comment or opening a fold still takes a long run of Tab.
- **C. No cursor: keys act on the block or question at the top of the screen, and `j` `k` keep
  scrolling.**
  - [pro] the smallest change.
  - [con] no ranges, no comment actions, and the target is wherever the scroll stopped.

**Answer:** A: Cursor should not be visible when using the mouse, and should start by selecting the
topmost visible element if the cursor is used in the middle of the page

## Q2: What is the round's current question, the one the option keys act on?

Example: you are on Q3, and Q4's title is at the top of the screen as you read on.

Today nothing on the page marks a current question; the outline marks the one at the top. `n` `p`
jump between blank questions. More in [discovery](discovery-01.md#the-rounds-current-question).

Why it matters: it decides what the letters pick, and whether `j` `k` still scroll the round.

- **A (recommended). The question the cursor holds, drawn with a list's selected look: `j` `k` move
  it through the questions, follow-ups, settled points, notes, and Commit.**
  - Example: Q3 stays current, and Q4's title shows no selection until `j`.
  - [pro] what the keys act on is always visible.
  - [con] `j` `k` stop scrolling the round; `Ctrl+D` and `Ctrl+U` still scroll half a screen.
  - Why recommended: the target never changes under a scroll, and it matches the review's cursor.
- **B. The question whose title is at the top of the screen, as the outline marks it; `j` `k` keep
  scrolling.**
  - Example: Q4 becomes current as you read on, and a letter picks in Q4.
  - [pro] nothing to move: reading is choosing.
  - [con] reading a long question's options can scroll its title away, and the target with it.

**Answer:** A

## Q3: Which key picks an option of the current question?

Example: Q2 has options A, B, and C, and is the current question. You want B.

The proposal suggests "a/b/c picks answers while the question is highlighted", and accepts letters
that change by context. The [Keyboard](../decisions/keyboard.md) decision says "A key MUST NOT mean
two things on one page". Every page also shares base keys: `a` adds, `b` goes back, `d` deletes, `i`
edits, `g` starts a go. Move mode already gives `j` `k` another meaning while it lasts. More in
[discovery](discovery-01.md#picking-an-option-by-key).

Why it matters: A changes an active decision every later page follows; a letter shown on the option
should be the key that picks it.

- **A (recommended). The option's letter, while a question is current; `b` goes back again once
  Escape clears it. The Keyboard decision allows a selection to give its own keys a meaning while it
  holds, shown on it.**
  - Example: `b` picks B; a second `b` unpicks it.
  - [pro] one key, the letter on screen, as the proposal and Typeform do.
  - [con] the decision changes, and Back needs Escape first while a question is current.
  - Why recommended: it is the proposal's design, and Google Docs' comment mode gives letters a
    meaning the same way, only while a comment is selected.
- **B. An answer mode, as move mode: Enter on the question starts it, the letters pick, and Escape
  or Enter ends it.**
  - Example: Enter, then `b`, then Escape.
  - [pro] no decision changes.
  - [con] two more keys per question, and Enter no longer opens the comment field.
- **C. Digits: `1` picks the first option, `2` the second.**
  - Example: `2` picks B.
  - [pro] no clash and no decision change.
  - [con] the key does not match the letter on screen.
- **D. No key: Tab into the options, and Space toggles one, as today.**
  - Example: Tab twice, then Space.
  - [pro] nothing to build.
  - [con] the proposal's request is dropped.

**Answer:** A

## Q4: How does a comment cover several blocks by keyboard?

Example: you want one comment on the three bullets of a story's scenario.

Today a second click stretches the comment over more blocks. Notion and GitHub extend with Shift and
the arrows; Vim and octo.nvim, its GitHub reviews, use visual mode. In Uraeda, `J` `K` and Shift
with the arrows already move a list's row. More in
[discovery](discovery-01.md#commenting-on-a-range).

Why it matters: it adds a mode or a key every review page keeps.

- **A (recommended). `V` or `v` starts a range on the cursor's block, `j` `k` stretch it, Enter
  comments on it, and Escape drops it.**
  - Example: on the first bullet, `V` `j` `j` then Enter.
  - [pro] Vim's and LazyVim's own gesture.
  - [con] a mode to learn for whoever does not use Vim.
  - Why recommended: the persona uses LazyVim every day, and it clashes with no key.
- **B. Shift with `j` `k` or the arrows stretches the comment's range from the cursor.**
  - Example: on the first bullet, Shift+`j` twice, then Enter.
  - [pro] Notion's and GitHub's habit, no mode.
  - [con] `J` `K` mean "move the row" on a list, and "stretch" here.
- **C. No range by key: a comment covers one block, and a range takes the mouse.**
  - [pro] nothing to build.
  - [con] a scenario's comment lands on one bullet, or needs the mouse.

**Answer:** B

## Settled without the human

### Behaviour

- **The cursor's look** is the selected look of the lists, the accent's tint with a bar. The
  comment's range keeps its yellow: a cursor and a selection must look different. See
  [discovery](discovery-01.md#wai-aria-practices).
- **A page opens with no cursor**, as a list does; the first `j` takes the first block or question.
  A round reopened at its saved question opens with the cursor there. See
  [the keyboard guide](../ui/keyboard.md#focus).
- **The pointer moves the cursor** when it moves onto a block, as on a list, never when the page
  scrolls under it. See [the keyboard guide](../ui/keyboard.md#selection).
- **Escape clears the cursor**, after it leaves a field or a range. See
  [discovery](discovery-01.md#notion-and-logseq).
- **The single-key switch turns the new keys off**, and the options stay reachable by Tab and Space,
  as WCAG 2.1.4 asks. See [discovery](discovery-01.md#wcag-214-character-key-shortcuts).
- **The cursor's keys show in its bar**, under the selected block or question, as a list's row shows
  "⏎ edit", and in the key map. See [the keyboard guide](../ui/keyboard.md#what-shows-the-keys).
- **A story's and a mockup's buttons are rows** the cursor stops on; what is inside them stays the
  pointer's. See [discovery](discovery-01.md#mockups-and-stories).
- **`u` and `U` stay free** for the Global undo feature, which claims them. See
  [discovery](discovery-01.md#other-features-in-flight).

### Under the hood

- **The cursor is the browser's focus** on each block's existing toggle, moved by a new hook beside
  `useListKeys`, so screen readers follow it. See [discovery](discovery-01.md#screen-readers).
- **Keys that hold only on a selection** are declared while it holds and removed after, since the
  registry checks clashes whatever a guard says. See [discovery](discovery-01.md#important-reads).
- **Three functions at the size limit are split first**: `useCommentDraft`, `SpecLayout`, and
  `QuestionCard`. See [discovery](discovery-01.md#likely-changes).

**Notes:** The important thing for questions is being able to see all the question text + navigate
all answers. It might be hard on a MacBook Air screen for example.

I think the cursor needs to:

- Work on full panes (big ones). Only scroll on full panes moves or if the cursor would go outside
  of the screen with maybe a 100px limit (to make sure the cursor is always comfortable to read and
  never at the very bottom or top)
- Not appear with the mouse. I think it’s distracting. It’s ok in lists because it’s much smaller
  and focus matters much more.

- **A pending comment is a row the cursor stops on**: d should delete at once because it can be
  undone
