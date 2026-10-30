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
  composer held, which the toast's Undo brings back: the intent is clear. The three cards share the
  composer's one draft, and the Feature card starts the feature into its session.
- **A new feature, change, or session is written first, then named**: its slug or title is asked for
  after `Ctrl+Enter`, in one short dialog.
- **Asking the agent** about a question puts it, quoted, in the session's composer, in the column on
  wide screens; a settled point's comment form can send its text to the session with "Ask AI".

## Committing

- **Commit is a place of its own**: while changes wait, a Commit in the sidebar and in the phone's
  tabs opens the commit page, with what the commit holds, edited proposal files included.
  "Committing is its own dedicated view/flow."
- **Discard asks first**, through the shared confirmation, since it destroys what was typed.
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
  not depends on me." On a spec, a comment on a part of it holds Approve back, with the reason under
  the buttons, since approving says the written spec needs no change; a general comment, pointers
  for the implementation, does not. Both commit and open the session prefilled. The verdict's
  buttons are at the review's end only, never repeated in a sheet or a column.
- **Answers come back where the comments were**: a revised file says, under each of the human's
  comments, what was done.

## Answering questions

- **Each answer saves as it is picked**, an option's card toggled, a comment saved with its button.
- **The page's end commits the round**, with one Commit; `n` and `p` reach the blank questions, and
  the phone's bar ends with Next until none is left.

## Moving things

- **A move shows where it lands**: promoting a note offers the priority levels first, then proposal
  files, and every one of them.
- **A note's category is changed with its picker (`c`); a proposal's section with the priorities'
  segmented control**, which stays: "I like the segmented control of the priorities". The priorities
  have no `c`.
- **The human lands with what moved**: after promoting, the priorities open at the new line.
- **A proposal file always opens as a page**: "just open the page every time".
