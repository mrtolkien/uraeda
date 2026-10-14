---
verdict: changes-requested
commit: a4e272b
---

# Review: Spec, Text inputs and comments

## C1: Lines 186–188, under "US6: Text areas as tall as their text (P3)"

> Every multi-line field grows the same way: two rows when empty or short, then one row per line of
> text as it wraps at the field's width, and no empty row ahead. Past half the window, it scrolls.
> The editor grows without that limit.

I don't like growing fields, it's always iffy as it changes the page layout.

I'd rather have a fixed number of lines, depending on the type of input:

- Big for proposals and note
- ~7 lines for comments anywhere
- Generally a fixed field height adapted to the content that it will hold. Better be a bit bigger
  than too small.
