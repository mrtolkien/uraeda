# UI iteration

Settles what users will see, with the human. You draw a first draft that is as close to right as you
can make it alone, and push it. The human looks when they have time, and writes all their comments
in one pass. Then the exchange is live: you change the views at once, until they say the views are
right. Then one commit, and the spec.

- **Runs when**: the latest discovery says `ui: true`, and what the feature does is settled: its
  round is `answered`, or the discovery says `round: none`. There is no `views.md` yet, and no
  `spec.md`. It opens the [spec step](spec.md), before `spec.md` is written
- **Writes**: `views.md`, the feature's mockups, and in the UI's guide each taste the human stated
- **Stops at**: a human gate, `views.md` with `status: awaiting-human`, the first draft, pushed
- **Ends at**: the human's "ok" in the session, `views.md` with `status: approved`, then the spec,
  in the same session

A look is not decided from a file. The human sees a view, says what is wrong with it, and sees it
again: each turn takes them a minute when the change shows at once, and a day when it waits for a
round, a commit, and a push. So this step keeps one short file, `views.md`, and makes no commit per
comment. What git keeps is the draft, and the result.

## Function is asked, a look is shown

- **A round asks what the feature does**: what it is for, how it behaves, what it stores, what it
  refuses. See [what to ask](discovery.md#what-to-ask-and-what-to-settle).
- **This step shows how it looks and moves**: a layout, a control, a motion, a density, a colour.
  None of these is a question of a round, and a round never links variants to pick from.
- **A feature that is only a look has no round.** Its discovery file says `round: none`, with no
  `clarifications-NN.md` for that round, and is committed alone. This step starts: the human answers
  on the views.
- **A feature with both** has its round first, on function alone. A look that depends on an answer
  is drawn once the answer is known, never asked before it.

A label's wording is a look: draw it, and change it when the human says so.

## The first draft

The bulk of this step's work is done here, before the human looks. The draft takes time, and nobody
waits for it: the human reads it later, away from the session. Every defect you could have found
alone costs them a comment, so find it now:

- **Read first**: the project's guides and look decisions, and what the human said about earlier
  views, in the records of `specs/done/`. A taste they already stated is not taught twice.
- **In the project's own look**, with its components. For a view that exists, the draft is the real
  view, changed. With an active preview decision, each state is a story, written where the decision
  says. Without one, the drafts go in the feature's `mockups/` folder.
- **Each view as its user meets it**: at the narrowest and the widest width the project serves, with
  nothing in it, and with more than fits.
- **Where the direction is open, a few variants**, distinct, side by side: if two could swap their
  text unnoticed, drop one. Say which one you would keep, and why, in a line.
- **A [prototype](#prototypes)** when building each direction with the real components costs too
  much, like a whole layout or a colour scheme.
- **Look at each one, as a picture, at each width**, before showing it. A view that renders can
  still be one grey block with no hierarchy.
- **Check each view against the guides**, rule by rule, and fix what breaks one.
- **Walk the views once, as a persona**: the one of the project's personas the feature is most for,
  or a first-time user when it has none. Only this feature's views, at that persona's width and with
  their input, each act a view offers, with real content. Fix what is clearly wrong: a control the
  keyboard cannot reach, a text cut at the narrowest width, a state that draws nothing. What is a
  matter of taste becomes a variant, or a line of your message.

Write `views.md`, from [the template](../assets/templates/specs/YYYY-MM-DD-feature-slug/views.md),
with `status: awaiting-human`. It opens with [the block](writing.md#the-block), then lists the
views. Each view is a link: the story that draws it, alone in its paragraph, when the project has a
[preview decision](spec.md#mockups), so that `ura serve` draws it live, or else a file of
`mockups/`. Under each link goes what to look at first. Each open variant follows, with the one you
would keep and why. The last section says what the persona walk fixed. The file is short, and it is
the only one this step keeps: the human's comments are never written into it.

Commit the draft and `views.md`, `ui(<slug>): first draft of the views`, with the block's first line
as the body, and push it. Then come back to the human: a link they can open from anywhere, without
the session, and what to look at first, in two sentences. With a preview that shows what is pushed,
link it. Otherwise say how to open the views from the branch. `views.md` is the gate: `ura next`
reads it, and `ura serve` lists it among what waits on the human, and shows the file with its story
links drawn. The human resumes the step in the session, or in a new one, which finds the draft in
the last commit.

## The loop

The loop starts when the human comes back with their comments on the draft. From here they are in
the session, and a change must show at once: start the project's preview from the feature's
worktree, so that a change shows without a commit, and give its link with your first answer.

1. **The human makes a full pass of comments**, where it is easiest for them: on the preview, when
   it takes notes, or in the session. Then they say so. Never watch for their comments, and never
   act on a pass they have not finished.
2. **Read every comment of the pass before you change anything.** Each one is their words: nothing
   you draw later contradicts it.
3. **Change the views**, in the worktree, all of the pass. No commit, nothing written in `views.md`,
   no question that the next look would answer.
4. **Answer in a line per comment**: what changed, and its link when it is not the view they were
   on. Never a report. Then wait for their next pass.

Along the way:

- **A comment that leaves a real choice open gets variants**, not a question in words: draw two, and
  let them pick on the view.
- **A question about function that the views raise is asked in the session**, with your
  recommendation, and its answer goes in the spec, in the human's words. One that changes a
  decision, a guard, or data users already have is a
  [new round](../SKILL.md#going-back-to-the-human-with-new-questions).
- **A comment that goes against a decision or the guide** is followed, as
  [a human's request](../SKILL.md) is: say what it changes, in the same line, and change the guide
  with it.
- **A session that must end before the human's "ok"** commits the views as they are,
  `ui(<slug>): the views so far`, with the comments still open in its body. `views.md` stays
  `awaiting-human`, and the next session finds the gate where this one left it.

## When the human says it is right

Their "ok" ends the loop, in any words. Then, without asking:

1. **Walk again, as the same persona, the views that changed since the draft.** Fix what is clearly
   wrong, and say it in a line. Never reopen what the human commented on.
2. **Keep what was picked**: the picked variant becomes the view, and the other variants and the
   prototypes are deleted. A picked prototype is rebuilt with the real components when the project
   has a preview.
3. **Write each taste down**: what the human said that holds beyond this feature goes in the UI's
   guide, `specs/ui/`, with their words quoted, as [writing a guide](spec.md#writing-a-guide) says.
4. **Set `views.md` approved and commit once**: write `status: approved`, as the human's word that
   the views are right, and turn the block into a note, as [the block](writing.md#the-block) says:
   "Approved on <date>.", then in a line each what they agreed to. Update its list to the views that
   remain. Commit it with the views, `ui(<slug>): the views the human agreed to`. Its body quotes
   their "ok", and says in a line each what you changed after it.
5. **Write the spec, in the same session**, whatever the human's settings cut: until the spec is
   committed, what they said about the views exists only in the session. Its mockups are these
   views, as [Mockups](spec.md#mockups) says, and it quotes each comment that decides something.

## Prototypes

A direction may be compared as throwaway prototypes, in any format: HTML pages, SVGs, generated
images. They go in the feature's `mockups/` folder. With a preview decision, they are never the
spec's mockups: the picked one is rebuilt as stories, and the commit that ends this step deletes
them all. Without one, the picked prototype is the spec's mockup, and the
[plan step](plan.md#delete-the-prototypes) deletes every file the spec does not link.
