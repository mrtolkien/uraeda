---
status: answered
---

# Clarifications, round 01: Global undo

> [!NOTE]
>
> Answered on 2026-11-07.
>
> - Verdict: worth building, with changes: `U` redoes in Helix, not in Neovim. Asking before every
>   action without undo would mean about 25 new questions, which guidance says get clicked through.
> - Two choices last beyond this feature: which actions every new page must make undoable, and which
>   must ask first. They become a new decision.
> - Which actions join the stack, and which ask first, work together: what leaves the stack is what
>   may need to ask.
> - Today's undo dies with its 5-second toast, and on the phone that is the only way to undo.
> - Check the two points settled without you, before the questions: an undo after a Git-page commit,
>   and undo per tab.

## Context

### Goal

The [proposal](proposal.md) asks for one undo stack for the whole web UI. `u` undoes as in Neovim,
and `U` redoes, shown only while there is something to redo. What can and cannot be undone should be
plain, and what cannot should ask first. "Key actions" matter more than covering everything.

### Today

Undo is a toast with one Undo button, for 5 seconds, from
[`useUndoToast`](/packages/web/src/layout/useUndoToast.ts). `u` presses the newest toast still on
screen, so once the toast hides, nothing can be undone. About 12 actions offer it, all of them edits
to the inbox and the priorities that wait on the Git page.

The same kind of action differs from page to page:

| Action                                       | Asks first | Undo |
| -------------------------------------------- | ---------- | ---- |
| Delete an inbox note, `d`                    | yes        | yes  |
| Delete a priorities row, `d`                 | yes        | no   |
| Delete a proposal from its pane              | no         | yes  |
| Move, indent, drag, or rename a row          | no         | no   |
| Remove a review comment, or Start over       | no         | no   |
| Submit answers, approve a spec, start a chat | no         | no   |
| Discard a file, drop a feature, clean, abort | yes        | no   |

The full list of about 40 actions is in the
[discovery](discovery-01.md#the-proposals-path-and-existing-actions).

| Product | Undo key | Redo key      | How long undo lasts     |
| ------- | -------- | ------------- | ----------------------- |
| Neovim  | `u`      | `Ctrl+R`      | the session, or on disk |
| Helix   | `u`      | `U`           | the session             |
| Linear  | `Cmd+Z`  | `Shift+Cmd+Z` | the session             |
| Trello  | `z`      | `Shift+Z`     | the session             |
| Gmail   | `z`      | none          | a few seconds           |
| Todoist | `Cmd+Z`  | none          | while its toast shows   |

### Scope

Undo and redo of the web UI's actions, the line between what can and cannot be undone, and the
questions asked before the rest. Undo inside a text field stays the field's own, CodeMirror's
history. The CLI and the language server are left out.

### Sources

- The undo toast and the key registry, linked above, and every page's writes.
- Vim's and Neovim's undo help, Helix's keymap, and the help pages of Linear, Gmail, Todoist,
  Trello, and Slack.
- NN/g on confirmation dialogs, Apple's guidelines on undo, WCAG 2.2, and git's revert.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Check these

- **An undo after a Git-page commit** still works: it writes the reverse as a new change, waiting on
  the Git page like any edit. It never commits or rewrites history on its own, as the
  [git](/specs/decisions/git.md) decision asks. The old Commit page closed the undos instead, a call
  lost when the Git page replaced it. See [discovery](discovery-01.md#undo-after-a-git-page-commit).
- **Undo is per tab**: each tab undoes only what it did. An undo is refused, with the reason next to
  what it concerns, once its file changed since: another tab, an agent, or a hand edit. The core's
  undos already refuse this way. See [discovery](discovery-01.md#undo-architecture).

## Q1: Which actions can `u` take back?

Example: you move "Spec comments" from Next to Now, indent it under another line, then delete it.

Today only the delete, in the proposal's pane, has an Undo, and only for 5 seconds. Edits to the
inbox and the priorities wait on the Git page. Most already have a reverse in the core, which
refuses when the file changed. Committing actions are different. Submitting answers or approving a
spec commits, then hands the feature to the agent. Taking one back means a revert commit, and the
agent's work since. Which of the rest ask first is the next question. More in
[discovery](discovery-01.md#which-actions-join-the-stack).

Why it matters: it sets the rule every new page follows, and the size of this feature. Anything left
out either asks first or stays as it is.

- **A (recommended). Every edit to your lists and texts that waits on the Git page: the inbox, the
  priorities, proposals, categories, images, and review comments. Committing, starting, git, and
  settings stay out.**
  - Example: `u` three times puts the line back, then outdents it, then moves it back to Next.
  - [pro] the actions you repeat many times a day, and every silent loss of a comment, are covered.
  - [con] submitting or approving by mistake still cannot be undone.
  - Why recommended: it covers the "key actions", and each reverse mostly exists already.
- **B. A, plus an editor's or a buffer's Save, whose undo writes the text back as it was.**
  - Example: as A, and a proposal file saved by mistake goes back to its last text.
  - [pro] a wrong save is one key away.
  - [con] it repeats the Git page's Discard and the field's own history.
- **C. B, plus committing actions, each taken back by a revert commit: submit, approve, request
  changes, start, drop.**
  - Example: as A, and an approved spec goes back to waiting, with a revert commit.
  - [pro] nothing you do in Uraeda's pages is final.
  - [con] about three times the work, and an agent may have acted on the commit already.
- **D. Keep today's set, and only give it a stack, `U`, and one look.**
  - Example: only the delete comes back; the move and the indent stay.
  - [pro] the smallest change.
  - [con] the same kind of action keeps differing from page to page.

**Answer:** A

## Q2: How far back can `u` reach?

Example: you promote three inbox notes, read a spec for ten minutes, then press `u`.

Todoist's undo dies with its toast, as Uraeda's does today. Linear and Trello keep the whole
session's actions. Vim keeps its history past a restart only when asked. A stack stored past a
reload must live outside git, as a cache. More in [discovery](discovery-01.md#how-long-undo-lasts).

Why it matters: it decides whether undo is a moment or a habit, and whether the stack needs storage.

- **A (recommended). As long as the tab stays open, up to the last 50 actions; a reload empties
  it.**
  - Example: the third promotion comes back, ten minutes later.
  - [pro] undo works the way Vim's does within a session, with nothing stored.
  - [con] a reload or a phone's closed tab forgets it.
  - Why recommended: it gives the stack the proposal asks for, with no storage to keep right.
- **B. Across reloads, kept in the browser, until the tab's session ends.**
  - Example: as A, even after reloading the page.
  - [pro] a reload loses nothing.
  - [con] stored entries must be read back and checked against files changed meanwhile.
- **C. As today: only while the action's toast is on screen.**
  - Example: nothing comes back; the toast hid long ago.
  - [pro] nothing new to build.
  - [con] no stack, which the proposal asks for.

**Answer:** A

## Q3: Which keys redo?

`U` redoes in Helix. In Neovim, `U` undoes a whole line, and redo is `Ctrl+R`, which reloads the
page in every browser. Linear and Google Docs undo with `Ctrl+Z` and redo with `Ctrl+Shift+Z`.
Inside a text field, those keys already undo your typing. C can come on top of A or B. More in
[discovery](discovery-01.md#u-is-helixs-redo-not-neovims).

Why it matters: a habit key that does nothing, or the wrong thing, is felt at every use.

- **A (recommended). `U` redoes, as you asked and as in Helix.**
  - [pro] the key you asked for, free on every page.
  - [con] a Neovim hand may press `Ctrl+R` and reload the page.
  - Why recommended: it is what you asked for, and reload stays the browser's.
- **B. `U` and `Ctrl+R` both redo, outside text fields; `Ctrl+R` no longer reloads there.**
  - [pro] both habits work.
  - [con] reloading the page needs F5 or the browser's button.
- **C. On top of A or B, `Ctrl+Z` and `Ctrl+Shift+Z` undo and redo outside text fields too.**
  - [pro] a habit from every other app works.
  - [con] the same keys mean the field's undo or the app's, depending on the focus.

**Answer:** A and C

## Q4: Which actions without undo ask before they run?

Example: you press "Approve" on a spec, with `n` then `Enter`.

Taken literally, the proposal asks before every action without undo: about 25, including send,
submit, approve, start, push, and every setting. NN/g warns that "if you cry wolf too many times,
people will stop paying attention". Every product read asks only before what cannot come back. Today
the shared confirmation asks before discarding a file, dropping a feature, cleaning, removing a
worktree, aborting a merge, and signing out everywhere. This depends on Q1: whatever it leaves out
lands here. More in
[discovery](discovery-01.md#actions-without-undo-need-a-confirmation-dialog-covers-about-25-actions).

Why it matters: it sets how often you meet a question, and the rule every new page follows.

- **A (recommended). Ask only before what loses work for good: discarding, dropping, cleaning,
  removing, aborting, signing out everywhere. Actions whose button names what they do, like Approve
  or Push, run at once.**
  - Example: the spec is approved at once, and the commit toast shows it landing.
  - [pro] a question still means danger, so you read it.
  - [con] a mistaken Approve or Submit needs its own fix, like requesting changes.
  - Why recommended: it keeps questions rare enough to be read, as every product does.
- **B. A, plus every action that commits or hands the feature to the agent: submit, approve, request
  changes, start.**
  - Example: "Approve the spec of Global undo?" asks first, `y` approves.
  - [pro] the agent never starts from a slip.
  - [con] one more key on the actions you take most, soon pressed without reading.
- **C. Every action without undo, as the proposal reads.**
  - Example: as B, and Send, Push, and each setting ask too.
  - [pro] nothing irreversible happens without a yes.
  - [con] about 25 new questions, the pattern guidance warns against.

**Answer:** A

## Q5: Does a delete that can be undone still ask first?

Example: you press `d` on the priorities line "Color themes".

Today `d` asks "Delete this line?" on both lists, and the inbox's note also gets an Undo. A proposal
deleted from its pane does not ask, and has an Undo. Gmail and Linear delete at once and offer Undo.
The [UI behaviour](/specs/decisions/ui-behaviour.md) decision already allows a dialog "only to
confirm an irreversible action". More in [discovery](discovery-01.md#undoable-deletes).

Why it matters: `d` is one of the keys you press most, and this sets whether it costs one key or
three.

- **A (recommended). Delete at once, with an undo, everywhere an undo exists; `dd` and `d` stay as
  they are.**
  - Example: the line goes, a toast shows its Undo, and `u` puts it back.
  - [pro] one key, as the UI behaviour decision and the guidelines already ask.
  - [con] a habit of answering `y` changes.
  - Why recommended: a question before an undoable delete is the "cry wolf" case.
- **B. Keep asking before every delete, with an undo after it too.**
  - Example: "Delete this line?", `y`, then the toast with its Undo.
  - [pro] two guards against a slip.
  - [con] it breaks the UI behaviour decision, and the question soon goes unread.

**Answer:** A: Dd disappears and becomes d, right? I’m down with it

## Q6: What does `u` do when the action happened on another page?

Example: you promote a note to Now on the inbox, open a spec, and press `u`.

Linear goes back to the page where the change happened and selects the items it touched. Apple's
guidelines ask to "show the results of an undo", scrolling to them. The
[UI behaviour](/specs/decisions/ui-behaviour.md) decision asks a write to "take the human where it
leads". More in [discovery](discovery-01.md#where-u-acts).

Why it matters: it decides whether you see what came back, or must trust a toast.

- **A (recommended). Undo it, then go to that page and select what came back; Back returns to the
  spec.**
  - Example: the inbox opens with the note selected in its place.
  - [pro] you see what changed, where it changed.
  - [con] `u` can move you off the page you were reading.
  - Why recommended: it follows the decision's "where it leads", as Linear does.
- **B. Undo it where you are, with a toast naming what came back and an Open button.**
  - Example: the spec stays, and "Put back the note in the inbox · Open" shows.
  - [pro] you never leave the page.
  - [con] the result is out of sight.
- **C. Only undo actions made on the page you are on.**
  - Example: nothing happens on the spec; `u` on the inbox undoes it.
  - [pro] no surprise.
  - [con] one stack per page, not the global one you asked for.

**Answer:** A

## Q7: How do you see what can be undone?

The proposal asks that what can and cannot be undone be clear. Apple's guidelines name each undo by
its result, "Undo Typing". Linear puts Undo and Redo in its command menu, Uraeda's leader menu.
LazyVim opens an undo tree with `Space s u`. On the phone there are no keys, so today the toast is
the only way. WCAG 2.2.1 asks for a second way when a timed message is the only one. B can come on
top of A. More in [discovery](discovery-01.md#how-what-can-be-undone-shows).

Why it matters: it decides whether you can tell what `u` will do before pressing it.

- **A (recommended). The status line names the next undo and redo: "u undo move · U redo". The
  leader menu and the phone get Undo and Redo, each naming its action. The docs list what can and
  cannot be undone.**
  - [pro] you read what `u` will do where you already look for keys.
  - [con] the status line gets longer by a few words.
  - Why recommended: it makes the line plain with what exists, and gives the phone its second way.
- **B. On top of A, a list of the stack, opened from the leader menu, where any entry can be undone
  up to it.**
  - [pro] the whole history at a glance, as Vim's undo tree.
  - [con] a new view to build and keep, for a rare need.
- **C. Only the toast and the docs page, as today with a stack behind it.**
  - [pro] nothing new on screen.
  - [con] after the toast hides, you cannot tell what `u` will do.

**Answer:** C: But show U in the status bar when a redo is possible

## Q8: Where do these rules live?

The rules of this feature would last: which actions must be undoable, which must ask, and the keys.
The [UI behaviour](/specs/decisions/ui-behaviour.md) decision already holds 12 rules, past its limit
of 10. The UI guides, like [Surfaces](/specs/ui/surfaces.md#undo), describe how the undo looks, but
bind no agent. More in [discovery](discovery-01.md#where-the-rules-live).

Why it matters: a decision is what stops a later feature from adding a write with no undo, or a new
question.

- **A (recommended). A new "Undo" decision: what must be undoable, what must ask, the keys, and how
  long undo lasts.**
  - [pro] agents read it before any page that writes.
  - [con] one more decision in the ledger.
  - Why recommended: the rules apply to every future write, and the UI behaviour decision is full.
- **B. New rules in the UI behaviour decision.**
  - [pro] one decision for how the UI behaves.
  - [con] it grows further past its limit of 10 rules.
- **C. The UI guides only, no decision.**
  - [pro] nothing to approve beyond the spec.
  - [con] a later feature may skip undo without anything saying so.

**Answer:** A

## Settled without the human

### Behaviour

- **Undo inside a text field** stays the field's own history, with Vim's `u` and `Ctrl+R` when Vim
  is on. Page keys never reach a field. See [discovery](discovery-01.md#codemirrors-history).
- **A new action clears what could be redone**, as in every product read. See
  [discovery](discovery-01.md#what-they-have-in-common).
- **`U` shows in the status line only while there is something to redo**, as you asked. The registry
  shows a key's hint only while it is declared. See [discovery](discovery-01.md#important-reads).
- **With single-key shortcuts off**, `u` and `U` go with them, as the
  [keyboard](/specs/decisions/keyboard.md) decision asks. The leader menu's entries stay, if they
  come with your answer on how undo shows.
- **The toast stays**: each undoable action still shows what it did for 5 seconds, with its Undo. It
  is a reminder now, not the only way. See [Surfaces](/specs/ui/surfaces.md#undo).
- **An undo that is refused** shows why next to what it concerns, as today. It leaves the stack, and
  the next `u` takes back the action before it.
- **A review comment you remove, and Start over,** become undoable if review comments join the
  stack. Otherwise they ask first, since they drop your text.

### Under the hood

- **One undo module** in the web UI owns the stack, `u`, `U`, and the toast. Each action gives it a
  label, an undo, and a redo, in place of the toast-scraping `u` of today. See
  [discovery](discovery-01.md#important-reads).
- **Undo and redo reuse the core's hash-checked writes**, never git's revert or reset, for edits
  waiting on the Git page. See [discovery](discovery-01.md#important-reads).
- **The unused `closeUndoToasts`** and the toast's unused committing mode are removed. See
  [discovery](discovery-01.md#important-reads).

**Notes:**

- **An undo after a Git-page commit**: The undo should have a validation dialog then, a new write is
  a big change
