# Rulings: Round fixes

The low-impact choices made while building the change, inside the limits of
[the proposal](proposal.md) and the decisions. None binds future work: those are decisions.

## R1: A sent-back round is recognised by its wording

- **Decision**: `block.count` skips a block whose first line contains "still need an answer", and
  the skill's SKILL.md now gives that wording: "2 questions still need an answer: Q3 and Q5".
- **Rationale**: the check cannot tell a sent-back round from its block alone, and the proposal's
  own example names the phrase. See [writing.rs](/crates/core/src/check/writing.rs).
- **Alternatives considered**: skipping the check whenever the first line lists question numbers:
  broader, and it would hide real mistakes.
- **If wrong**: an agent that words the line differently gets the warning, which only warns.
- **Where**: the block-count item.

## R2: The comment warning is a copy of the core's letters rule

- **Decision**: the web warns about a comment starting like "B: ..." with a TypeScript port of the
  core's `letters` reading, [readLetters.ts](/packages/web/src/readLetters.ts).
- **Rationale**: the browser cannot call the binding, and the warning needs the rule while the human
  types.
- **Alternatives considered**: a server call per keystroke: too slow for a hint.
- **If wrong**: the two readings drift. Sharing the core's test rows through `fixtures/` is noted in
  the inbox.
- **Where**: the comment-letter item.

## R3: The accent line is a theme token of 4px

- **Decision**: the round cards' accent lines use `--size-round-accent`, 4px, in place of
  `--spacing-1`; the split threshold is re-read when a card's width changes.
- **Rationale**: the spec says 4 px. I could not reproduce the 4.8 px in WebKit (`--spacing-1` was
  4px from 800 to 1920 px), so the tests pin 4 px but cannot fail on the old value; no test fails on
  the old once-on-mount read either, since the round's measure fixes the card's width.
- **Alternatives considered**: a literal `4px` in the styles: the stylex lint refuses it.
- **If wrong**: a theme with another accent width edits one token.
- **Where**: [QuestionCards.tsx](/packages/web/src/QuestionCards.tsx).

## R4: The tests' inline rounds follow the template

- **Decision**: the six inline rounds were rewritten in the current format, and their asserted line
  numbers moved with them (Q1 on 32, Q1.A on 48, Q2 on 64).
- **Rationale**: tests copying an old-format round start from a format `ura check` now rejects.
- **Alternatives considered**: one shared round file: the Lua and TypeScript tests would need a
  loader, for little gain.
- **If wrong**: the template changes again and the inline rounds age again.
- **Where**: the tests of the core, the language server, the web, and Neovim.
