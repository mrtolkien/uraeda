---
discovery: medium # low, medium, or high: how far the agent researches before asking
---

# Uraeda light, step 1: the pages of `ura serve`

## What

`ura serve` draws a small web UI, from the `ura` binary alone: nothing fetched from outside, plain
JavaScript and CSS embedded in it, fast on a phone.

- **What waits on me**, across repositories and worktrees.
- **A round**: one card per question, the recommended answer marked, one pick or several, a
  follow-up shown only when its condition is met, a note, each pick written into the round's file at
  once.
- **A review**: the rendered spec or plan, what changed since my last review, a comment on a passage
  by a tap or a selection, approve or request changes.
- **Mockups in both**: any mockup the phone can reach over Tailscale, a file of the feature or an
  address, drawn in place, with a comment about it or about an element picked in it.
- It writes files and never commits: the next agent step commits them.

## Notes

- The mockup to start from, with its README and cost estimate:
  `~/.local/share/uraeda/research/2026-11-14-uraeda-light/spikes/ura-serve/`.
- What two personas hit in it, to fix: `spikes/lolly/ura-serve/walkthrough.md` and
  `spikes/phone/ura-serve/walkthrough.md`. The Next button hides while reading or typing; the A, B,
  C tabs of a prototype read as the answer; confirmations speak of files and commits; a picked
  element was named wrongly once.
- The answer and review logic exists in `crates/core/src/actions/`; diagrams are drawn in Rust
  already.
- A local page that writes files needs a token in its address and an Origin check.
- Not decided: whether Submit wakes the agent's session itself or I say "continue"; one service for
  every repository or one per worktree; whether the pages follow `specs/ui/` and embed its fonts.
- Runs beside today's server until step 3.
