# Flows

How the human hands work to the agent, commits, and decides. One rule runs through them: **the human
decides, and sees what they decide**. One primary action per step, nothing destructive without a
question, and no agent started behind their back.

## One primary action

A step offers one primary button, named by what it does. "Remove 'commit and start the agent', just
have a single primary 'commit' that opens the session prefilled." Variants of the same action
("Commit only", "Approve and start the agent", "Request changes only") are one button: what follows
is the human's choice in the next view, not a second button here. Two buttons are for two different
decisions, like a review's Approve and Request changes, or a round asked during the implementation,
whose answers either continue the implementation or revise the spec.

## Starting the agent

- **The agent never starts unseen.** A commit that hands the feature over opens its session with the
  workflow's message in the composer, unsent; the human sends it, edits it, or leaves it.
- **A proposal's Start fills the New page's composer** with the line and its nested lines, rather
  than starting a feature without a word: "this way it's coherent!" It replaces the draft the
  composer held, which `u` or the toast's Undo brings back: the intent is clear. The three cards
  share the composer's one draft, and the Feature card starts the feature into its session.
- **A new feature, change, or session is written first, then named**: its slug or title is asked for
  after `Ctrl+Enter`, in one short dialog.
- **Asking the agent** about a question puts it, quoted, in the session's composer, in the column on
  wide screens; a settled point's comment form can send its text to the session with "Ask AI".

## Committing

- **Git is a place of its own**: Git, in the sidebar and `Space g`, opens the Git page, with every
  changed file of the main checkout, edited proposal files included, and each feature worktree's a
  buffer saved into. "Committing is its own dedicated view/flow." `/commit` leads to it.
- **Saving never commits**: a buffer, a form, and a list only save their file, and the edit waits on
  the Git page, unless the action says it commits.
- **Changes are a tree, staged as in lazygit**: one tree per checkout with changes, the main
  checkout's first. A worktree's tree is set apart from it, its pane's border dashed and blue, a
  branch's icon and "· worktree" after its feature's name and count; only the main checkout's
  changes count on Git. Space stages a file or a folder, `a` stages or unstages them all, and a
  staged file keeps its row. Each tree has its own message, empty until typed, and under it its own
  Commit, where the eye ends after typing, which commits what is staged and says how many files,
  "Commit 2 files"; Enter in the message does the same, the key shown on the button on wide screens.
  No line under the field explains it, and no second Commit sits in the pane's border.
- **Discard asks first**, through the shared confirmation, and restores one file, as git does.
- **Pull, push, fetch, and merge are the page's**, as lazygit's keys, `p`, `P`, `f`, and `M`; a
  conflict they stop on is fixed in the page, in the shared editor, then continued or aborted.
- **Starting work may commit by itself**: a flow whose only sense is to start, like starting a
  feature, commits what it must without asking. "That much is ok."

## Reviewing

- **A comment starts by tapping what it is about**, a block, a row, a decision's part, or by
  selecting it with the keys; no button per block. "It's pointless. We start a comment by clicking
  the line."
- **The general comment's field is always there**, at the review's end: the one place for what is
  not about one block. A general comment started otherwise, by an image dropped with no comment
  open, takes its place while it is written: one general field at a time. There is no separate
  summary: "the only one that matters is the general comment."
- **The verdict is the human's**: Approve, or Request changes, which needs a comment. "Approving or
  not depends on me." Either is accepted with comments anywhere, on a part or general: an approval
  leaves them to the next step, the plan or the implementation, which carries them out. Once there
  is a comment, one line under the buttons says so, "With comments, Approve leaves them to the plan;
  Request changes revises the spec first.", so the human requests changes when a comment changes
  what the file says, without a warning or a held button. Both commit and open the session
  prefilled. The verdict's buttons are at the review's end only, never repeated in a sheet or a
  column.
- **Answers come back where the comments were**: a revised file says, under each of the human's
  comments, what was done.

## Answering questions

- **Each answer saves as it is picked**, an option's card toggled, a comment saved with its button.
- **The page's end commits the round**, with one "Commit answers", a verb and its object; `n` and
  `p` reach the blank questions, and the phone's bar ends with Next until none is left.

## Moving things

- **A move shows where it lands**: promoting a note offers the priority levels first, then proposal
  files, and every one of them.
- **A note's category is changed with its picker (`c`); a proposal's section with the priorities'
  segmented control**, which stays: "I like the segmented control of the priorities". The priorities
  have no `c`.
- **The human lands with what moved**: after promoting, the priorities open at the new line.
- **A proposal file always opens as a page**: "just open the page every time".
