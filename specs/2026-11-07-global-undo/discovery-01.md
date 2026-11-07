# Discovery, round 01: Global undo

## Summary

App-level undo, not a text field's own, takes one of two shapes in established products:

- **The moment.** Todoist, Gmail, and Superhuman give one Undo on a toast for a few seconds.
- **The session.** Linear and Trello keep a stack of the session's actions, with redo, and Linear
  takes the human back to where each change happened.

Every product keeps confirmations for what cannot be undone, and guidance agrees: undo first,
confirm only without undo. Redo is less common than undo. When present, it sits on a shifted key.

The proposal asks for the session shape. It wants a stack, `u` to undo, `U` to redo, a visible line
between what can and cannot be undone, and a confirmation for the rest.

Today the web UI has the moment shape. [`useUndoToast`](/packages/web/src/layout/useUndoToast.ts)
shows a toast with Undo for 5 seconds, and `u` presses the newest toast still on screen. About 12
actions offer it, all of them uncommitted writes to the inbox and the priorities. Many sibling
actions offer nothing: deleting a priority, moving or indenting a row, removing a review comment.
Two deletes both ask and offer Undo. Several actions that lose work neither ask nor undo. No redo
exists, and nothing lists what can be undone.

## How other products do it

### Vim and Neovim

- `u` undoes, and `CTRL-R` redoes. `U` is not redo: it "undo[es] all latest changes on one line",
  and is itself a change that `u` undoes ([Vim's undo.txt](https://vimhelp.org/undo.txt.html),
  [Neovim's undo](https://neovim.io/doc/user/undo/)).
- One undo takes back one command, however many changes it made: an undo block.
- Undone changes are kept as branches of an undo tree, walked by `g-` and `g+`, and listed by
  `:undolist`. The history survives a restart only with `'undofile'`, and is dropped when the file
  changed since.

### Helix and LazyVim

- Helix: `u` is "Undo change" and `U` is "Redo change"
  ([Helix keymap](https://docs.helix-editor.com/keymap.html)). The proposal's keys are Helix's.
- LazyVim keeps Vim's `u`, `U`, and `<C-r>`, and opens an undo tree panel with `<leader>su`
  ([LazyVim keymaps](https://www.lazyvim.org/keymaps),
  [keymaps.lua](https://raw.githubusercontent.com/LazyVim/LazyVim/main/lua/lazyvim/config/keymaps.lua)).

### Linear

- Undo covers "almost every operation that changes issues, notifications, cycles or projects",
  single or batch, by Cmd+Z or "Undo" in the command menu. Redo is Shift+Cmd+Z or "Redo"
  ([Linear changelog, undo](https://linear.app/changelog/undo-actions)).
- After an undo, Linear goes back to the page where the change happened and selects the issues it
  touched (same source).
- A deleted issue comes back with Cmd+Z, and later from the archive, for 30 days
  ([Linear, delete and archive](https://linear.app/docs/delete-archive-issues)).
- Inside the editor, the same keys undo typing ([Linear editor](https://linear.app/docs/editor)).
  How the two are kept apart is not documented.

### Gmail

- `z` is "Undo last action", among single-key shortcuts that work only once turned on
  ([Gmail shortcuts](https://support.google.com/mail/answer/6594)). No redo key is listed.
- Undo Send lasts 5, 10, 20, or 30 seconds, set by the user
  ([Undo Send](https://support.google.com/mail/answer/2819488)).
- Trash keeps deleted mail 30 days ([Gmail, delete](https://support.google.com/mail/answer/7401)).

### Todoist

- Cmd/Ctrl+Z undoes, and "Undo only works while the confirmation message with the Undo button is on
  screen"
  ([Todoist shortcuts](https://www.todoist.com/help/articles/use-keyboard-shortcuts-in-todoist-Wyovn2)).
  No redo is listed. This is today's Uraeda shape.

### Trello

- `z` undoes the last action, and Shift+Z redoes. "Undo cannot reverse deletion of content such as
  cards, lists, labels"
  ([Trello shortcuts](https://support.atlassian.com/trello/docs/keyboard-shortcuts-in-trello/)).

### Slack

- Deleting a message "is permanent", and asks first. Unsend works for 15 seconds, by Cmd/Ctrl+Z, and
  puts the text back in the field
  ([Slack, edit or delete](https://slack.com/intl/en-gb/help/articles/202395258-Edit-or-delete-messages)).

### Superhuman, Notion, Figma, Google Docs, GitHub

- Superhuman: `Z` within 10 seconds undoes the last action (search snippet only: its help pages
  refused the fetch).
- Notion: version history and a 30-day trash, no undo documented on its help page
  ([Notion, delete and restore](https://www.notion.com/help/duplicate-delete-and-restore-content)).
  Its undo resets on reload (snippet only).
- Figma: "undo in a multiplayer environment is inherently confusing". Redoing back to the present
  must leave the document unchanged
  ([Figma multiplayer](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)).
- Google Docs: undo Ctrl+Z, redo Ctrl+Shift+Z
  ([Docs shortcuts](https://support.google.com/docs/answer/179738)).
- GitHub: deleting a repository asks for its typed name. A merged pull request's deleted branch has
  "Restore branch"
  ([GitHub, delete a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/deleting-a-repository)).

### What they have in common

1. **One key undoes the last action.** Single letters (`z`, `u`) in keyboard-first apps, Cmd+Z
   elsewhere.
2. **The undo window varies.** It is a toast's life (Todoist), seconds (Superhuman, Slack), or the
   whole session (Linear, Trello).
3. **Redo, when present, is the shifted key**: Shift+Z, Shift+Cmd+Z, Helix's `U`. Vim's is `CTRL-R`.
4. **The undo names what it takes back**: Apple's "Undo Typing", a toast's "Moved to Trash · Undo".
5. **The result shows.** Linear goes back to the change and selects it, and Apple scrolls to it.
6. **Confirmations only for the truly irreversible**, with a button that names the outcome.
7. **A backstop behind the short undo**: a trash or an archive, for 30 days. For Uraeda's files, git
   is that backstop once committed.
8. **Undo is per user, and skips what changed since** (Figma, Liveblocks).

## Standards and libraries

### Guidance on undo and confirmation

- NN/g: confirm only "before committing to actions with serious consequences". "If you cry wolf too
  many times, people will stop paying attention". Undo is the first safeguard, confirmation the
  fallback ([NN/g, confirmation dialogs](https://www.nngroup.com/articles/confirmation-dialog/)).
- NN/g: "Support undo and redo", and make undo findable rather than assume users know the keys
  ([NN/g, user control and freedom](https://www.nngroup.com/articles/user-control-and-freedom/)).
- Apple HIG: name the undo by its result ("Undo Typing"), let people undo several times, and "show
  the results of an undo or redo", scrolling to them
  ([HIG, undo and redo](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo),
  read through its data file).
- Material: a snackbar times out, holds one action, and must not be "the only way to access a core
  use case" ([Material snackbars](https://m1.material.io/components/snackbars-toasts.html)).
- Ministry of Justice design patterns: confirm an action that "cannot be undone (or not undone
  easily)"; "not all actions need" it
  ([Confirm an action](https://design-patterns.service.justice.gov.uk/patterns/confirm-an-action/)).
- AWS Cloudscape: one-click delete for what is easy to recreate, a confirmation for what is not, a
  typed one for cascading deletes
  ([Cloudscape, delete](https://cloudscape.design/patterns/resource-management/delete/)).

### WCAG 2.2

- **2.1.4 Character Key Shortcuts** (A): `u` and `U` need an off switch, a remap, or focus scoping
  ([Understanding 2.1.4](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html)).
  The [keyboard](/specs/decisions/keyboard.md) decision's switch covers it.
- **2.2.1 Timing Adjustable** (A): a timed message is a time limit when it is the only window to act
  ([Understanding 2.2.1](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html)).
  Today's 5-second toast is the only way to undo on a phone, where `u` does not exist.
- **3.3.4 Error Prevention** (AA): a page that deletes user data makes it reversible, checked, or
  confirmed
  ([Understanding 3.3.4](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html)).
  Undo satisfies it alone.

### Undo architecture

- The command pattern keeps each action on a stack with a backup or its inverse. An inverse "may
  turn out to be hard or even impossible to implement"
  ([Refactoring Guru, command](https://refactoring.guru/design-patterns/command)).
- Shared data: undo only your own changes, store inverses rather than snapshots, and do nothing when
  the target changed since. Selection and page belong in the entry
  ([Liveblocks, undo in multiplayer](https://liveblocks.io/blog/how-to-build-undo-redo-in-a-multiplayer-environment)).
- A compensating action, not a rollback, once others may have changed the data. Name the points of
  no return
  ([Azure, compensating transaction](https://learn.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction)).
- Git: `git revert` adds a commit that reverses an earlier one, safe once pushed. Amend and reset
  rewrite history, safe only before a push ([git-revert](https://git-scm.com/docs/git-revert),
  [Pro Git, undoing things](https://git-scm.com/book/en/v2/Git-Basics-Undoing-Things)).
- A text field's Ctrl+Z clashing with an app's undo is a known bug class
  ([Gutenberg #18755](https://github.com/WordPress/gutenberg/issues/18755)). A single-letter `u`
  avoids it: the registry already ignores keys typed in text fields.

### CodeMirror's history

- Every field has CodeMirror's `history()` and `historyKeymap`: Mod+Z undoes, Mod+Y and Mod+Shift+Z
  redo ([Editor.tsx](/packages/web/src/fields/editor/Editor.tsx)). With Vim on, the Vim engine's `u`
  and `<C-r>` work inside the field. Text undo stays the field's own, out of this feature.

## The code

### Important reads

- [`layout/useUndoToast.ts`](/packages/web/src/layout/useUndoToast.ts): the whole undo today. A
  toast with one Undo for 5 seconds, paused while hovered or focused. `u` clicks the newest toast's
  button found in the page, so a hidden toast is gone for good. A refused Undo shows in the page
  until dismissed. Its `commits` mode, an Undo that commits, has no caller.
- `closeUndoToasts`, in the same file, has no caller. The old Commit page called it once committed:
  "An Undo would write a change back over the committed file". Commit `d751a3ab`, which made the Git
  page, dropped that call. Today an Undo after a Git-page commit writes an uncommitted change.
- The core's undos ([`actions/inbox/undo.rs`](/crates/core/src/actions/inbox/undo.rs),
  [`categories.rs`](/crates/core/src/actions/inbox/categories.rs),
  [`unlink.rs`](/crates/core/src/actions/inbox/unlink.rs)) never use git. They find the lines a
  write wrote and take them out, or write a saved text back while the file still hashes as the write
  left it. Either refuses once the file changed in between: the safe, per-change shape Liveblocks
  describes.
- Several undo mutations exist on the server with no web caller: `inbox.undoCategory`,
  `inbox.undoCommitted`, `proposals.undoCommitted`.
- [`keys/registry.tsx`](/packages/web/src/keys/registry.tsx) and
  [`keys/store.ts`](/packages/web/src/keys/store.ts): a binding shows a status-line hint while it is
  declared. A `U` declared only while a redo exists shows only then, as the proposal asks. `U` is a
  free key: the registry keeps Shift's case.
- [`fields/Confirm.tsx`](/packages/web/src/fields/Confirm.tsx): the one shared confirmation,
  answered by `y` or `n`, used by 13 callers, listed below.
- The [UI behaviour](/specs/decisions/ui-behaviour.md) decision already holds 12 rules, past the
  limit of 10 for a decision.

### The proposal's path and existing actions

Every action that changes something, by page. "Undo" means a toast with Undo today, "asks" the
shared confirmation.

| Page            | Action                                         | Writes                            | Today         |
| --------------- | ---------------------------------------------- | --------------------------------- | ------------- |
| Inbox           | Add a note, with or without images             | `INBOX.md`, a note file           | Undo          |
| Inbox           | Add, edit, indent, drag a row                  | `INBOX.md`                        | nothing       |
| Inbox           | Move to a category                             | `INBOX.md`                        | nothing       |
| Inbox           | Delete a note, `d`                             | `INBOX.md`, its note file         | asks and Undo |
| Inbox           | Delete a nested row, `d`                       | `INBOX.md`                        | asks          |
| Inbox           | Promote, `p`: to a section, a proposal, a file | `INBOX.md`, priorities, proposals | Undo          |
| Inbox           | New and rename a category                      | `INBOX.md`                        | nothing       |
| Inbox           | Delete a category                              | `INBOX.md`, note files            | asks and Undo |
| Inbox           | Remove an image                                | a note file                       | Undo          |
| Priorities      | Add a proposal                                 | `PRIORITIES.md`                   | Undo          |
| Priorities      | Add, edit, indent, drag, move a row            | `PRIORITIES.md`                   | nothing       |
| Priorities      | Delete a row, `d`                              | `PRIORITIES.md`                   | asks          |
| Priorities      | Expand into a file, `e`                        | a proposal file, priorities       | nothing       |
| Proposal pane   | Delete                                         | `PRIORITIES.md`                   | Undo          |
| Proposal pane   | Rename, change section, expand                 | `PRIORITIES.md`, a proposal file  | nothing       |
| New page        | A line's Start replaces the draft              | the browser's draft               | Undo          |
| New page        | Start a feature, a change, a chat              | branch, worktree, commit, agent   | nothing       |
| New page        | Take the source note or line out, after Start  | `INBOX.md` or priorities          | nothing       |
| Round           | Pick an answer, write notes or comments        | the round's file                  | nothing       |
| Round           | Submit answers                                 | a commit, then the agent          | nothing       |
| Review          | Remove a comment, Start over                   | the review file                   | nothing       |
| Review          | Approve, Request changes                       | a commit, then the agent          | nothing       |
| Editor, buffer  | Save                                           | any file                          | nothing       |
| Editor          | Commit, Start                                  | a commit, a feature               | nothing       |
| Session         | Send, Stop, Take back, Allow                   | the agent's run                   | nothing       |
| Session         | Rename, Archive, Dismiss                       | the session's record              | nothing       |
| Session         | Drop the feature or change                     | worktree removed, a commit        | asks          |
| Session         | Start the change, Make it a feature            | branch, worktree, commits         | nothing       |
| Git page        | Stage, Commit, Fetch, Pull, Push, Merge        | git, `origin`                     | nothing       |
| Git page        | Discard a file, Remove or Clean a worktree     | files, worktree, branch           | asks          |
| Git page        | Resolve a conflict, Continue                   | git                               | nothing       |
| Git page        | Abort a pull or merge                          | git                               | asks          |
| Priorities, Git | Clean a merged feature, `c`                    | worktree, branch, a commit        | asks          |
| Settings        | Every setting                                  | the settings file                 | nothing       |
| Settings        | Remove this browser's host                     | the settings file                 | asks          |
| Settings        | Sign out everywhere                            | every sign-in                     | asks          |
| Repositories    | Remove from Uraeda                             | Uraeda's list                     | nothing       |

The shared confirmation's other callers protect typed text: "Discard your changes?", "Discard your
comment?", "Leave page?". The leader's "Restore the default fonts?" asks too.

Findings from the table:

- **The same kind of action differs by page.** A priorities row deleted with `d` asks and has no
  Undo. The same proposal deleted from its pane does not ask, and has Undo. An inbox note asks and
  has Undo.
- **Losing typed text without a word.** Removing a review comment, and a review's Start over, drop
  the human's text with neither a question nor an Undo.
- **The take-out after a Start is silent.** A note or line that started a change leaves its list
  with nothing said.
- **The phone has no second way.** With no `u`, an Undo exists for 5 seconds only.
- **Committing actions hand over to the agent.** Submitting, approving, and starting commit, then
  open a session whose run may start at once. Taking one back means a revert commit, and stopping or
  undoing what the agent did since.

### Rules and their owners

- **What can be undone** has no owner: each page calls `useUndoToast` or not. The rule "only what
  cannot be undone asks first" lives in [Surfaces](/specs/ui/surfaces.md#undo) and
  [Guidelines](/specs/ui/guidelines.md), as prose.
- **The undo key** is owned by `UndoKey` in `useUndoToast.ts`, and documented in
  [the keyboard guide](/specs/ui/keyboard.md).
- **The 5 seconds** are written in `useUndoToast.ts`, Surfaces, and the guidelines' list of
  deliberate departures.
- **The key that deletes asks** is written in [the keyboard guide](/specs/ui/keyboard.md): "`d`,
  `dd`: Delete the selection, after a yes/no". The [UI behaviour](/specs/decisions/ui-behaviour.md)
  decision allows a dialog "only to confirm an irreversible action": an undoable delete that asks
  breaks it.

### Likely changes

Under every option:

- A new undo stack in `packages/web/src/layout/` (or `undo/`), owning the entries, `u`, `U`, and the
  toast, in place of `useUndoToast`'s toast-scraping.
- Each caller of `useUndoToast`: `InboxList.tsx`, `useNoteActions.ts`, `InboxImages.tsx`,
  `SidebarAdd.tsx`, `pane/useProposalActions.ts`, `newDraft.ts`, `lists/useCategoryActions.ts`.
- `specs/ui/surfaces.md`, `keyboard.md`, `guidelines.md`, and `docs/web-ui.md`.

Depending on the scope chosen:

- The outline rows: `lists/useOutline*.ts`, `InboxList.tsx`, `lists/PrioritiesList.tsx`, with core
  inverses in [`files/priorities/edits.rs`](/crates/core/src/files/priorities/edits.rs) and
  [`api/inbox_edits.rs`](/crates/core/src/api/inbox_edits.rs).
- Review comments: `useReviewActions.ts`, `ReviewComments.tsx`, `YourReview.tsx`.
- Committing actions, if made undoable: the core's deferred commits
  ([`actions/deferred.rs`](/crates/core/src/actions/deferred.rs)) and a revert path through `git`.
- Deletes that stop asking: `lists/useRowKeys.ts`.

Tests guarding behaviour that may change:

- [`undo-toast.test.tsx`](/packages/web/src/__tests__/undo-toast.test.tsx): "an Undo that rejects
  shows its failure in the page", "the toast stays while hovered or focused, and hides once both
  leave".
- [`phone-t3.test.tsx`](/packages/web/src/__tests__/phone-t3.test.tsx): "on the phone, the toast's
  Undo shows no key; on a wide screen it shows `u`".
- [`inbox-note-delete.test.tsx`](/packages/web/src/__tests__/inbox-note-delete.test.tsx): "d on a
  note with a note file asks, naming the file, and yes deletes both, which Undo brings back".
- [`keys-promote.test.tsx`](/packages/web/src/__tests__/keys-promote.test.tsx) and
  [`inbox-images.test.tsx`](/packages/web/src/__tests__/inbox-images.test.tsx): the Undo of each
  promotion and of an image's removal.
- The core's [`inbox_undo.rs`](/crates/core/tests/inbox_undo.rs).

### Features in flight

- [Keyboard nav in questions and specs](/specs/PRIORITIES.md), branch `2026-11-07-keyboard-nav`,
  only a proposal so far. It adds letter keys on rounds and reviews, such as picking an option. `u`
  and `U` are base keys, which a page must not reuse, as the
  [keyboard](/specs/decisions/keyboard.md) decision says. Review comments' removal may move there
  too.

## The proposal

### `U` is Helix's redo, not Neovim's

The proposal says "u should undo like in nvim, U should redo". In Neovim, `U` undoes a whole line,
and redo is `CTRL-R`. Helix is where `U` redoes. `CTRL-R` reloads the page in every browser.

### "A centralized undo stack" has no stated depth or lifetime

Todoist's undo lives with its toast, Linear's for the session, Vim's past a restart with
`'undofile'`. The proposal does not say how far back `u` reaches, or whether a reload keeps it.

### "Actions without undo need a confirmation dialog" covers about 25 actions

Taken literally, it asks before every send, submit, approve, start, push, setting, and sign-out.
NN/g and every product read warn that routine questions get clicked through. The
[UI behaviour](/specs/decisions/ui-behaviour.md) decision allows a dialog only "to confirm an
irreversible action", which the literal reading meets, and the guidelines' "prefer undo to a
question" warns against.

### "Key actions" are not named

The notes say "what matters is that key actions are un doable", without saying which.

### "A clean interface" is open

It may mean the code's interface, one module every action goes through, or the human's, how undo
shows. Both are covered below.

### Undo after a Git-page commit

Edits wait on the Git page until the human commits them. An Undo after that commit still takes the
lines out, as an uncommitted change. The old Commit page closed the toasts instead.

## Worth it and feasibility

- **Gain**: one consistent rule for the whole UI, a second way to undo on the phone, and no more
  silent loss of a review's comments. It also removes an inconsistency the human hits daily: the
  same delete asks on one page and not on another.
- **Cost**: the stack itself is small. Most uncommitted writes already have a core inverse that
  refuses when the file changed. The work grows with scope. Outline edits need inverses for edit,
  indent, drag, and move, about 6 core functions. Committing actions need revert commits and an
  agent stopped: much larger, and risky.
- **Outside behaviour**: none new. The registry's case-kept `U`, the status line's hints, and the
  core's hash-checked writes were read in the code.
- **Guards**: none relaxed. Dropping a question before an undoable delete leaves the file in git and
  the Undo as the guard.

## Approaches

### Which actions join the stack

What `u` can take back. Criteria: the proposal's "key actions", the cost of each inverse, and the
risk of taking back something an agent already acted on. See
[the actions](#the-proposals-path-and-existing-actions).

- **The human's lists and texts**: every uncommitted write to the inbox, the priorities, proposal
  files, categories, images, and review comments. Inverses mostly exist.
- **Also typed saves**: an editor's or a buffer's Save. Its inverse writes the previous text back.
  It overlaps the Git page's Discard, and the field's own history.
- **Also committing actions**: submit, approve, start, drop. Each inverse is a revert commit, and
  some must stop an agent first.

### How long undo lasts

- **The toast's life**, as today and as Todoist.
- **The tab's life**, as Linear: in memory, gone on reload.
- **Across reloads**: stored in the browser or on the server. Stored on the server, it is shared by
  tabs, and must stay out of git as a cache.

### Redo's key

- `U`, as Helix, and as the proposal. `CTRL-R` as Vim, which overrides the browser's reload.
- Mod+Z and Mod+Shift+Z, as Linear and Docs, outside text fields.

### Which actions ask first

- Only what loses work for good, today's set mostly.
- Every action without undo, as the proposal reads literally.

### Undoable deletes

- Delete at once, with Undo, as Gmail and Linear.
- Ask, then offer Undo, as the inbox does today.

### Where `u` acts

- Undo in place, wherever the human is now.
- Go back to the change's page and select what it restored, as Linear.
- Only undo changes made on the current page.

### How what can be undone shows

- The toast names the action, and the status line names the next undo and redo.
- A history list, as Vim's `:undolist` or LazyVim's undo tree.
- A documented list of what can and cannot be undone, in `docs/web-ui.md`.

### Where the rules live

- A new `undo` decision.
- New rules in the [UI behaviour](/specs/decisions/ui-behaviour.md) decision, already past 10 rules.
- The UI guides alone.

### Needs no choice

- **Undo inside text fields** stays CodeMirror's own history: the registry never hears keys typed in
  a field.
- **Single keys turned off**: `u` and `U` go with them, as WCAG 2.1.4 asks, and the leader menu's
  entries remain.
- **Several tabs and devices**: each tab undoes only its own actions, and an undo refuses once its
  file changed, as the core already does.
- **Redo after a new action**: a new action clears the redo side, as every product read does.

## Not checked

- Superhuman's help pages refused the fetch: its 10 seconds and `Z` come from search snippets.
- Material 3's snackbar pages rendered no content.
- Notion's undo shortcuts and reload behaviour: snippets only.
- Things 3's own undo documentation was not found.
- How Linear, Notion, and Figma separate a field's Cmd+Z from the app's undo is not documented.
- Whether the leader menu can be opened on the phone was not checked in a running app.
