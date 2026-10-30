# Inbox

- Formatted markdown files look like shit in the multi line editor since there are line jumps a bit
  randomly -> we need to remove the single line jumps that are there just for formatting from the
  multiline inputs in raw markdown, OR use a monospace font AND give the multi-line text edit enough
  width to show all lines (no wrapping)
- `e` for expand, not p, in priorities/inbox
- [amend-latest]
  [Single-commands in sessions should also be ellipsed](notes/single-commands-in-sessions-should-also-be/note.md)
- [decisions-needs] Need a bit more left/right padding on mobile and slightly smaller text (same as
  discord messages on mobile)
- [decisions-needs]
  [New note on mobile has the keyboard hiding the note. Closing the keyboard and opening it again works.](notes/new-note-on-mobile-has-the-keyboard-hiding-the/note.md)
- [decisions-needs] Sticky questions headers should use the glass style when they overlay content
- [decisions-needs]
  [Decisions are not super readable, text is a bit too big. The pane should be a bit bigger to accomodate the title while prose stays in a centered column at the standard size.](notes/decisions-are-not-super-readable-text-is-a-bit-too/note.md)
- [decisions-needs]
  [The "replaced behaviour" block looks weird in the specs. Needs a review together with decisions changes.](notes/the-replaced-behaviour-block-looks-weird-in-the/note.md)
- [performance-pass]
  [The two columns here look out of place (clarifications), put them back one by one.](notes/the-two-columns-here-look-out-of-place/note.md)
- [The home columns are not centered on a wide screen](notes/the-home-columns-are-not-centered-on-a-wide-screen/note.md)
- [performance-pass] http://127.0.0.1:4310/r/uraeda/f/2026-10-29-performance-pass/spec.md -> the
  mockups didn't work at all locally
- [performance-pass] Any targeted comments on a spec should gray out approval. Approval means the
  written spec is good and needs no changes. A general comment is ok (for example to give pointers
  for the implementation)

## Bugfix

- Review ura check to be less annoying, it fails all the time for no good reason. Or at least remove
  it from vp run ready
  - [agent] [help-keybindings] A proposal started from a priority links `specs/PRIORITIES.md` from
    its own folder, a link `ura check` reports broken, so `vp run ready` fails on every such branch
    (`NewEntries.tsx`'s `insertion`)

## To test

- See if we can integrate Claude Design
