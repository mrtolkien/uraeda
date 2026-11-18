# Rulings: Pages look like 1.4 again

What the build settled that the human must see: a behaviour users will notice that
[the proposal](proposal.md) does not state. Other choices are explained in the bodies of the commits
that make them. None binds future work: those are decisions.

## R1: A phone has no outline

- **Decision**: the outline column shows from 1080 px of width. On a phone, a round and a review
  read top to bottom as before, with the bar at the foot, and a question is no card: a line above
  it, its text and options at the page's width.
- **Rationale**: 1.4 put the outline behind a tab of its app bar on the phone, and the pages have no
  app bar. 1.4 drew a phone's question without a card too.
- **Where**: [`ura.css`](/crates/serve/assets/ura.css), the outline and the round.

## R2: The palette is every page's

- **Decision**: the home page, the settings, the sign-in, and the vault's page take the same
  palette, square corners, and monospace titles as the round and the review.
- **Rationale**: the pages share one style sheet, and two looks side by side would read as a bug.
- **Where**: [`ura.css`](/crates/serve/assets/ura.css).

## R3: What the page is about stands over its title

- **Decision**: "Questions, round 1" and "Spec to review" are a yellow label over the feature's
  name, where they were a grey line under it. "Why it matters:" and "Example:" are their frame's
  label, and no longer open the paragraph.
- **Rationale**: 1.4's "Waiting for your review" label, and its framed boxes.
- **Where**: [`round/view.rs`](/crates/serve/src/round/view.rs),
  [`review/view.rs`](/crates/serve/src/review/view.rs).

## R4: The refresh button reloads the page

- **Decision**: "Refresh", beside the home page's title, is a link to the page itself: it reads the
  repositories again, and works without the script.
- **Rationale**: a page added to the phone's home screen has no reload button of its own.
- **Where**: [`waiting.rs`](/crates/serve/src/waiting.rs).
