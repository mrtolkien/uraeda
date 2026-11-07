# Discovery, round 01: Keyboard nav in questions and specs

## Summary

Keyboard review tools share one shape: a cursor that `j` `k` move over the document's units (lines
in Gerrit, blocks in Notion), a key that comments on the cursor's unit, a way to stretch it over a
range (Shift with the arrows, or Vim's visual mode), and keys that act on an existing comment.
Answering tools with keys (Typeform) show a letter on each option and take that letter only while
the question has the focus.

The proposal asks for both on Uraeda's two most-read pages: blocks of a spec or plan selected like a
list's rows and commented on without the mouse, and a question's option picked with its letter. It
also asks to keep the layer small, and accepts that letters change meaning by context.

Today, both pages only scroll with `j` `k`. A review's block is reached by Tab, one stop per block
and per link; an option by Tab, then Space or Enter. The round has `n` `p` for blank questions, the
reviews `n` for the verdict. Every block already carries a focusable toggle, and the lists already
have a cursor hook, `useListKeys`, so the layer can reuse both. What is in the way: the option
letters collide with the base keys (`b` Back, `a` add, `d` delete, `u` undo, `g` go), and the
[Keyboard](../decisions/keyboard.md) decision says a key never means two things on one page.

## How other products do it

### Gerrit

- A line cursor: `j` `k` move to the next and previous line, `c` drafts a comment on it, or on a
  selected block of code
  ([user review UI](https://gerrit-review.googlesource.com/Documentation/user-review-ui.html)).
- `n` `p` jump between diff chunks, `N` `P` between comment threads, `e` `E` expand and collapse all
  threads, `r` marks a file reviewed, `?` lists the keys
  ([shortcuts-config.ts](https://gerrit.googlesource.com/gerrit/+/refs/heads/master/polygerrit-ui/app/services/shortcuts/shortcuts-config.ts)).
- Ctrl+Enter or Ctrl+S saves a comment. The closest match to "move with `j` `k`, then a letter acts
  on the cursor".

### GitHub

- Files changed has no documented line cursor. `r` quotes the selected text in a reply, Ctrl+Enter
  submits a comment, and single-character keys can be turned off in the accessibility settings
  ([keyboard shortcuts](https://docs.github.com/en/get-started/accessibility/keyboard-shortcuts),
  [changelog](https://github.blog/changelog/2021-11-16-managing-keyboard-shortcuts-using-accessibility-settings/)).
- Commenting on a range of lines needed the mouse from 2021 until November 2025, when Shift with the
  arrows came in the new Files changed page; screen reader users still report gaps
  ([discussion 7876](https://github.com/orgs/community/discussions/7876)).

### GitLab

- In a merge request, `j` `k` move between files, `n` `p` between open threads, and `r` starts a
  comment quoting the selected text. Ctrl+Enter adds a pending comment
  ([shortcuts](https://docs.gitlab.com/user/shortcuts/)).
- Shortcuts can be turned off, except the editing keys of text fields.

### Phabricator

- `j` `k` between changesets, `n` `p` between inline comments, `r` replies to the selected comment
  or comments on the selected code, `R` replies quoting, `e` edits the selected comment. Seen in
  commit messages only, not user docs
  ([commit](https://projects.blender.org/archive/phabricator/commit/e4e91ebf6f15936a90ab7fff4e249b3fb6dd0058)).

### Google Docs

- Ctrl+Alt+M inserts a comment. Chords move between comments (Ctrl+Alt then `n` `c`). Once a comment
  is selected, single keys act on it: `R` reply, `J` `K` next and previous, `E` resolve, `U` leave
  ([shortcuts](https://support.google.com/docs/answer/179738)).
- A selection that gives single letters their meaning only while it holds: the same idea as the
  proposal's letters "while the question is highlighted".

### Notion and Logseq

- Notion: Escape selects the block being edited, the arrows select another block, Shift with the
  arrows extends the selection, Enter edits the selected block, and Cmd+Shift+M comments on the
  selected blocks ([shortcuts](https://www.notion.com/help/keyboard-shortcuts)).
- Logseq: Escape selects the block, the arrows move, Shift extends, Enter edits; a Vim plugin adds a
  visual mode on `j` `k`. Forum and plugin pages only, seen in search results
  ([forum](https://discuss.logseq.com/t/keyboard-navigations-shortcuts/366)).
- The closest analogue of "select blocks as a list's rows".

### Gmail and Linear

- Gmail: `j` `k` move between conversations, then `r` `a` `e` act on the one under the cursor; the
  keys are off until turned on ([shortcuts](https://support.google.com/mail/answer/6594)).
- Linear separates the highlight, which `j` `k` move, from the selection, which `x` toggles and
  Shift with the arrows extends. Actions apply to the selection, else to the highlight; nothing is
  selected by default ([select issues](https://linear.app/docs/select-issues)).

### octo.nvim and Helix

- octo.nvim, GitHub reviews in Neovim: a leader key then `ca` adds a comment, in normal mode on the
  line, in visual mode on the range; `]t` `[t` move between threads; `<leader>vs` submits the review
  ([README](https://github.com/pwntester/octo.nvim)).
- Helix: `x` selects the line, and again extends to the next; `v` enters select mode, where moves
  extend ([keymap](https://docs.helix-editor.com/keymap.html)). For a Vim user, `V` then `j` `k` is
  the range gesture (judgement, from Vim's habits).

### Typeform

- A letter is drawn on each option of a choice question, and its key picks it; turning the letters
  off turns the keys off, leaving the arrows, Tab, and Space. Help pages blocked automated reads:
  seen in search results only
  ([letters on answers](https://help.typeform.com/hc/en-us/articles/12814361189396)).
- Enter moves to the next question; staff said in 2021 the keys cannot be turned off (forum, search
  results only).

### What they have in common

1. A cursor moved by `j` `k` and the arrows, drawn apart from what is selected for an action.
2. A key that comments on the cursor's unit: `c`, `r`, or a chord.
3. A way to stretch it over a range: Shift with the arrows, or a visual mode.
4. Keys on an existing comment: reply, edit, delete, resolve.
5. Jumps to the next and previous comment, or the next item not yet done.
6. Ctrl+Enter sends a comment.
7. Letters that pick options only while the question holds the focus, drawn on the options.
8. A `?` list of the keys, and a switch for single-character keys.
9. A focus that stays visible and in view.

## Standards and libraries

### WCAG 2.1.4, Character Key Shortcuts

- A shortcut made only of printable characters needs a way to turn it off, to remap it, or to be
  active only while its component has the focus. Listboxes and menus are not affected
  ([understanding 2.1.4](https://www.w3.org/WAI/WCAG21/Understanding/character-key-shortcuts.html)).
- Letters that work only on a focused question, or `j` `k` on a focused block, meet it even without
  the switch, which Uraeda already has.

### WAI-ARIA practices

- Roving tabindex focuses the active item, and the browser scrolls it into view; the selected state
  must look different from the focus
  ([keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)).
- A radio group: Tab enters on the checked option, the arrows move and check
  ([radio](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)). Uraeda's options are checkboxes, since
  an answer may hold several letters.
- A listbox cannot hold interactive elements; a layout grid can, with Enter to go into a cell and
  Escape to come back ([listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/),
  [grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)). A block holding links and comments is
  closer to a grid's row.

### Focus visible and not obscured

- WCAG 2.4.7: the keyboard focus is visible
  ([understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)). WCAG 2.4.11:
  the focused element is never entirely hidden by sticky content, which `scroll-padding` solves
  ([understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)).
  The round's sticky question header and the status line are such content.

### Screen readers

- NVDA's browse mode keeps single letters for its own moves: `h` heading, `p` paragraph, `c` combo
  box, `r` radio, `a` annotation, `e` edit field, `n` text after links; `j` `k` are free. Focus on a
  composite widget switches it to focus mode, where keys reach the page
  ([NVDA user guide](https://download.nvaccess.org/documentation/userGuide.html)).
- `role="application"` hands every key to the page, but users lose reading by heading and paragraph,
  which a document needs (W3C bug 20088, search results only).

### Key libraries

- react-aria's GridList has rows with interactive children, a row or child focus mode, and Escape
  clearing the selection ([useGridList](https://react-aria.adobe.com/GridList/useGridList)).
- react-hotkeys-hook and tinykeys ignore keys typed in fields by default
  ([react-hotkeys-hook](https://github.com/JohannesKlauss/react-hotkeys-hook),
  [tinykeys](https://github.com/jamiebuilds/tinykeys)). Uraeda's registry already does the same.

## The code

### Important reads

- [`keys/registry.tsx`](/packages/web/src/keys/registry.tsx) and
  [`keys/store.ts`](/packages/web/src/keys/store.ts): one window listener; components declare keys
  with `useKeys`, while mounted. A binding has `keys`, `label`, `run`, `hint`, `fallback`, and a
  `when` guard on the focused element. A key handled by a widget first (`preventDefault`) never
  reaches it.
- Clashes are checked across every declared binding whatever `when` says
  ([`store.ts`](/packages/web/src/keys/store.ts), `clash`): a key that applies only in some context
  must be declared while that context is mounted, and removed after.
- The shell's single keys a page cannot take, since they are no fallback: `b` Back
  ([`LeaderKeys.tsx`](/packages/web/src/keys/LeaderKeys.tsx)), `u` undo
  ([`useUndoToast.ts`](/packages/web/src/layout/useUndoToast.ts)), `[` `]`, `?`, Escape, and the `g`
  and Space prefixes. `j` `k`, the arrows, Home, End, `G`, and `Ctrl+D` `Ctrl+U` are fallbacks: a
  page may bind them ([`scroll.ts`](/packages/web/src/keys/scroll.ts)).
- [`KindCards.tsx`](/packages/web/src/KindCards.tsx): the New page's `s` `c` `f` pick a card as a
  click would, with hints. The precedent for letters that pick a choice.
- [`lists/useListKeys.ts`](/packages/web/src/lists/useListKeys.ts) (355 lines): the lists' cursor,
  on Astryx's `useListFocus`: `j` `k`, Home, End, `gg`, `G`, Enter, Escape, each guarded to a
  focused row or the page. Used by the priorities, the inbox, the Git page, and the decisions page.
  Its selection is the DOM focus.
- [`layout/picked.ts`](/packages/web/src/layout/picked.ts): the one selection look the
  [keyboard guide](../ui/keyboard.md#selection) asks for, the accent's tint with a bar.
- [`Selection.tsx`](/packages/web/src/Selection.tsx): `selectable` makes a block selectable (a
  top-level block but a list or table, a list item, a table row). `Selectable` wraps it in
  `data-lines` with a `<button aria-pressed>` over the whole block, labelled by its text. Its
  selected look is the yellow `--color-selection`, not the picked look.
- [`useCommentDraft.ts`](/packages/web/src/useCommentDraft.ts): a tap merges the tapped lines into
  the comment's range, so a second tap extends it; only Cancel clears it. On a wide screen the
  comment field takes the focus after a tap. Its main function is at the 100-line limit.
- [`ReviewCommentForm.tsx`](/packages/web/src/ReviewCommentForm.tsx),
  [`ReviewComments.tsx`](/packages/web/src/ReviewComments.tsx): one comment form, under the last
  block tapped, with Ask the agent, Cancel, and Add comment; Ctrl+Enter sends. A pending comment has
  Edit and Remove; Remove deletes at once, with no confirmation and no undo.
- [`ReviewVerdict.tsx`](/packages/web/src/ReviewVerdict.tsx): `n` focuses the first verdict button.
- [`EmbedNode.tsx`](/packages/web/src/EmbedNode.tsx),
  [`spec/StoryPick.tsx`](/packages/web/src/spec/StoryPick.tsx): mockups and stories are not
  selectable blocks; a story's "Pick an element" needs the pointer in its frame.
- [`QuestionOption.tsx`](/packages/web/src/QuestionOption.tsx): each option is an Astryx
  `SelectableCard` over a hidden checkbox; Space and Enter toggle it. Several letters may be picked
  ([`useAnswer.ts`](/packages/web/src/useAnswer.ts), `toggle`), and a pick saves at once.
- [`RoundOutline.tsx`](/packages/web/src/RoundOutline.tsx), `useBlankKeys`: the round's only keys,
  `n` `p` to the next and previous blank question, and `n` to Commit once none is blank.
- [`roundJump.ts`](/packages/web/src/roundJump.ts): a jump scrolls a question to the top and focuses
  its title; `questionAtTop` names the question at the top, which the outline marks. Nothing on the
  page itself marks a current question.
- [`SettledPoints.tsx`](/packages/web/src/SettledPoints.tsx): settled points reuse the review's
  `Selectable` blocks, so one block cursor serves both pages.
- [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx) also draws the inbox triage and the decisions
  check; [`DocumentPage.tsx`](/packages/web/src/DocumentPage.tsx) draws a read-only proposal or
  round with the same `Selectable`, for Ask the agent.

### The proposal's path and existing actions

- **Reach a block of a spec**: today Tab, stepping through every block's toggle and every link. With
  the feature, `j` `k` move a cursor from block to block.
- **Comment on it**: today Enter on its toggle, or a click, then the field takes the focus. With the
  feature, one key on the cursor's block.
- **Comment on a range**: today a second click extends the range. No key does.
- **Edit or remove a pending comment**: buttons only. Remove deletes at once.
- **Clear a selection**: Cancel, after Escape leaves the field.
- **Ask the agent about a block**: the form's button, after selecting the block.
- **Open a fold** ("More scenarios", "Under the hood"): its toggle button, by Tab or click.
- **Switch the right column's tabs** (Outline, Notes, Session; Contents, Review, Session): click
  only. Asking the agent and Edit notes open their tabs.
- **Give the verdict**: `n` then Enter, already.
- **Pick an option**: Tab to it, Space or Enter. With the feature, a key on the current question.
- **Reach a question's comment field, or Ask the agent on a question**: Tab or click.
- **Comment on a settled point**: as a review's block, by its toggle.
- **Write notes**: the column's Notes tab, or "Write a note" at the page's end.
- **Submit**: `n` once nothing is blank, then Enter, already.
- **Inside a mockup or a story**: the pointer, and the proposal accepts it.
- **On the phone**: no keyboard; nothing changes there.

### Rules and their owners

- **One key, one meaning per page**: the [Keyboard](../decisions/keyboard.md) decision's rule,
  checked by the registry's `clash`. The [keyboard guide](../ui/keyboard.md) adds "A page never
  gives a base key another meaning". Move mode (`m`) already gives `j` `k` another meaning while it
  lasts.
- **One selection look**: the guide's [Selection](../ui/keyboard.md#selection), owned by
  `layout/picked.ts`; the review's yellow is a second look.
- **Every page's key listening goes through the registry**: the structural test
  `keys-structural.test.ts`, "only the registry listens for the page's keys", with its allowlist.

### Other features in flight

- Global undo, on branch `2026-11-07-global-undo` (proposal only): `u` undoes and `U` redoes, and
  actions without undo ask first. Removing a pending comment is such an action today. `u` and `U`
  stay free here.
- Color themes, on branch `2026-11-07-color-themes` (proposal only): may rename the selection
  colours a block cursor would use.

### Likely changes

Under every option:

- [`lists/useListKeys.ts`](/packages/web/src/lists/useListKeys.ts), or a new hook beside it: a
  cursor over the blocks' toggles. The file is at 355 of 500 lines: a new hook rather than growth.
- [`Selection.tsx`](/packages/web/src/Selection.tsx): the block's toggle as a cursor row, and the
  picked look for the cursor.
- [`useCommentDraft.ts`](/packages/web/src/useCommentDraft.ts): a range set from keys. Its main
  function is at the limit, so the range logic moves out.
- [`RoundOutline.tsx`](/packages/web/src/RoundOutline.tsx),
  [`QuestionCard.tsx`](/packages/web/src/QuestionCard.tsx),
  [`QuestionOption.tsx`](/packages/web/src/QuestionOption.tsx): the current question and its keys.
- [`keys/groups.ts`](/packages/web/src/keys/groups.ts), if a new sequence is added.
- [`specs/ui/keyboard.md`](/specs/ui/keyboard.md), and [Keyboard](../decisions/keyboard.md) if
  letters change meaning on one page.
- `keys-structural.test.ts`'s allowlist, if an option's own `onKeyDown` takes the letters.

Tests that guard behaviour the feature changes:

- `keys-pages.test.tsx`: "US6 1, US2 more 3: the questions page's status line reads
  `n p unanswered`, and `n` jumps"; "on a round with no blank question, `n` takes the focus to the
  page's Commit".
- `keys-walkthrough.test.tsx`: "`n` then Enter approves a spec, and its session opens with the
  composer focused"; "on a desktop, what the keys bring into view scrolls clear of the status line".
- `keys-scroll.test.tsx`: "a page whose list declared j moves its selection, and nothing scrolls".
- `review.test.tsx`: "a block selected from its toggle gives its comment field the focus".
- `round-steps.test.tsx`: "a round reopened at its saved question opens there, its title focused".
- `keys-registry.test.tsx`: "two bindings of one key throw, with the labels of both".

## The proposal

### Letters that already mean something

The proposal's "a/b/c picks answers" meets the base keys: `a` adds, `b` goes back, `d` deletes, `i`
edits, `g` starts a go sequence, `u` undoes, and `n` `p` are the round's. Options run from A,
usually to C or D. The [Keyboard](../decisions/keyboard.md) decision forbids a key meaning two
things on one page; the proposal says "It's ok to change some letters in different contexts". The
two conflict.

### "Mouse is not necessary to do any action"

Beyond commenting, the two pages hold actions the proposal does not name: editing and removing a
pending comment, Ask the agent, folds, the column's tabs, notes. The proposal also says "Make sure
this isn't too complex" and "maybe … a small navigation layer". The two pull apart: scope is a
question.

### Mockups and stories

The proposal accepts the mouse inside mockups. A story's "Pick an element" needs the pointer in its
frame; its "Comment" button and a mockup's Full screen are buttons a cursor can reach.

### The pages the proposal does not name

The round's page also draws the inbox triage and the decisions check; the read-only document page
uses the same blocks for Ask the agent. A layer on the shared components reaches them too.

## Worth it and feasibility

- **Gain**: the two pages the human spends most time on stop needing the mouse, as the
  [personas](../ui/personas.md) require ("A step that needs the mouse, or a long run of Tab, is a
  bug").
- **Cost**: moderate. Every block already has a focusable toggle, and the lists' cursor exists; the
  work is a cursor over those toggles, a current question, a few keys, and tests. Three functions at
  the size limit must be split first.
- **Outside behaviour**: none new. The keys go through the existing registry; focus and scrolling
  follow the browser's roving focus, which the lists already use.
- **No guard is relaxed.**

## Approaches

Criteria: the proposal (no mouse for any action, small, letters may change by context), the
[Keyboard](../decisions/keyboard.md) decision (one meaning per key per page, base keys, few mnemonic
page keys), the [personas](../ui/personas.md), and WCAG 2.1.4.

### How far the layer goes

The actions the layer covers. See [the proposal's path](#the-proposals-path-and-existing-actions).

| Option                                     | Mouse left                 | Keys added | Work     |
| ------------------------------------------ | -------------------------- | ---------- | -------- |
| A. Cursor and every action but in mockups  | inside mockups and stories | about 8    | moderate |
| B. Cursor, comment, pick; the rest by Tab  | none, but long Tab runs    | about 4    | small    |
| C. Jumps only, no cursor: key on top block | ranges, comment actions    | about 3    | smallest |

### The round's current question

What the option letters act on. See [roundJump.ts](#important-reads).

| Option                                        | Visible      | Moves by           | Scrolling keys     |
| --------------------------------------------- | ------------ | ------------------ | ------------------ |
| A. A cursor over questions and settled points | picked look  | `j` `k`, `n` `p`   | `Ctrl+D`, `Ctrl+U` |
| B. The question at the top of the screen      | outline only | scrolling, `n` `p` | `j` `k` stay       |

### Picking an option by key

What picks an option of the current question. See
[letters that already mean something](#letters-that-already-mean-something).

| Option                                         | Keys per pick | Decision changed | Matches the letter shown |
| ---------------------------------------------- | ------------- | ---------------- | ------------------------ |
| A. The option's letter, while a question holds | 1             | yes              | yes                      |
| B. An answer mode: a key, then letters, Escape | 2 to enter    | no, as move mode | yes                      |
| C. Digits 1 to 9                               | 1             | no               | no                       |
| D. Tab and arrows only                         | 2 or more     | no               | no                       |

### Commenting on a range

How a comment covers several blocks. See [Notion and Logseq](#notion-and-logseq),
[octo.nvim and Helix](#octonvim-and-helix).

| Option                                    | Habit          | Clash                     |
| ----------------------------------------- | -------------- | ------------------------- |
| A. `V` or `v`, then `j` `k` stretch it    | Vim, LazyVim   | none                      |
| B. Shift with `j` `k` and the arrows      | Notion, GitHub | `J` `K` move a list's row |
| C. No range by key: one block per comment | none           | none                      |

### Needs no choice

- **Ctrl+Enter sends a comment**: it does already.
- **A `?` list and a switch**: the key map and the single-key switch read the registry; new keys
  show there with no work.
- **Jumping to the next item not done**: `n` `p` do it on the round; the verdict's `n` on reviews.
- **Next and previous comment**: the cursor passes through pending comments when they are rows.
- **Focus visible and in view**: the lists' roving focus and the existing scroll margin.
- **Resolving a comment**: Uraeda's comments are pending until the verdict; nothing to resolve.

## Not checked

- Typeform's help center refused automated reads: its facts come from search results.
- Review Board's shortcut pages, Logseq's official docs, and Superhuman's shortcut list could not be
  read.
- Phabricator's user documentation: only its commits were found.
