# Reading

The human spends most of their time in Uraeda reading: proposals, rounds of questions, specs, plans,
and an agent's sessions. Reading comfort comes before density, before cleverness, and before showing
everything at once.

## Two fonts, two jobs

- **The reading font**, proportional, for prose: a document's paragraphs and lists, a question's
  context, an option's sentence, a settled point, an edge case, a comment's text. Drawn through
  `Prose` (`proseStyles.reading`, `proseStyles.doc`) or `Blocks`, never by hand.
- **The UI font**, monospace, for everything that is the tool rather than the text: titles in pane
  borders, labels, buttons, keys, ids, counts, rows of lists, the status line.

A block of prose set in the UI font is a bug: it happened to a spec's "What you approve", its
tradeoffs, and its scenarios, drawn with `Text type="inherit"`, and they read badly until they went
through `Prose`. If a sentence is meant to be read, it is in the reading font. The one exception is
text edited as its markdown source, like a proposal file's in its editor, which is in the code font
on purpose: its marks are what the human edits.

## Line length

- **The target is about 80 characters of prose a line**: "Let's target 80 characters per line
  actually for prose." A line much longer reads badly: 96 characters in a round's Goal was "a bit
  too long".
- **Prose's measure is about 80 characters**: `--size-reading-measure`, 60 of the reading font's
  "0", which hold about 80 of its letters and spaces. It is set in the reading size, not in `ch`,
  since `ch` would be measured in the font of whatever element reads it.
- **A pane of prose is as wide as its prose**: a reading page's pane (`Page`'s `isReading`: the
  round, the spec, the plan, a document, the data model) is at most `--size-reading-pane`, the
  measure and the pane's own padding and border, so its text fills it and never stops short of the
  border: a pane's text and its border end together. A table inside it scrolls inside it; a live
  window, a mockup or a story, grows past it into the empty room beside it, up to its own size. The
  draft editor's panes hold monospace text and stay 95 of the UI's characters (`isWriting`).
- **A single pane is centred** on a wide screen, at its maximum width; two panes side by side share
  the page's width, each up to its maximum. "A _single_ pane should not be too big, but for two
  panes they should be able to use the available space." "The single-panes should be CENTERED."
- A question's card, split into the question and its answers, is as wide as two panes and the gap
  between them; a card of one column is as wide as one pane.
- Columns of rows are **400 px at least**, 500 px for the priorities' cards. "400 IS THE MINIMUM."

These widths are tokens of the theme, of `Page`, or of `Prose`'s styles, never numbers in a view: a
page does not set the reading size, line, or measure itself, which the lint test of `Prose.tsx`
checks.

## Hierarchy

A block of prose with no hierarchy is hard to read, however short. Make what matters read first:

- **A lead.** A pane whose first sentence says what it is about, like a round's Goal and Scope, sets
  that sentence on a line of its own, heavier, the rest under it in the secondary colour (`Blocks`'
  `hasLead`). A spec's "You approve…" is its pane's lead, a size up.
- **A verdict is a lead, not a badge.** "With changes" is the first line of the round's summary, in
  its colour, its sentence under it. A badge in the middle of a sentence breaks it.
- **A label leads its item.** An item that starts "New decision:" or "Risk tier `medium`:" shows the
  label heavier, then the rest. Bold that starts an item, as the files write it, already does this.
- **A claim, then its reasons.** A settled point's first sentence is its bullet; each further
  sentence is a bullet under it.
- **A situation, then what happens.** An edge case reads "what → then": the situation in bold, then
  an arrow before each outcome, under it.
- **Don't over-parse.** Structure comes from what the file already writes, its bold leads, colons,
  sentences, and lists, not from guessing at meaning. "Make it better and more readable, while
  staying simple (don't over-parse stuff)."

## Air

Prose meant to be read for a while gets air: lines at 1.4 (`--text-reading-line`), one height for
all prose, within print's 1.2 to 1.45 for body text: 1.65, 1.55, then 1.5 read as "too spaced", and
1.4 "is good"; `isAiry` panes get more room between paragraphs, not taller lines), more room between
paragraphs than between a list's items, and room around tables and panes. Inline code never makes
its line taller than the others. "It's a big block, pretty compact, with no hierarchy" is the
complaint to avoid. Air is not emptiness: a pane ends right after its last line, with only the
pane's own room under it (see [Space and motion](space-and-motion.md)).

**One rhythm for all prose.** A document's blocks and every markdown text, an agent's message and a
thought included, share the theme's `--prose-*` tokens through `Prose.tsx`'s `proseRhythm`: the same
room between paragraphs, before and after a list, and between items, and the same bullet, in the
secondary colour, its text a list room in. Astryx's markdown lists take it from the theme's
`markdown` rule. "Bullet points should look the same everywhere."

## Lists

- **The browser's own markers**, on the first line's baseline, close to their text: a disc on wide
  screens, a dash on the phone hanging in the page's margin, a quarter of an em before its text.
  Markers that float at the bottom of a line or far from their text are a bug.
- A typed item's sign, `+`, `−`, `★`, `?`, is its marker, in its colour.
- A selectable item keeps the list's edge: its selection bar sits in the marker's gap, not in front
  of its text.
- A row of a list of things, like a proposal or a note, holds **two or three lines at most**, then
  an ellipsis; its sub-line is smaller and indented, "like with bullet points".

## Tables

- A table stays inside what holds it, a pane or a card: it scrolls sideways inside it rather than
  reach past its border. Its row lines run to the holder's border, and its first column's text lines
  up with the holder's text.
- A table has room above and below it, as a block among others, never touching the text.
- No empty row between rows: a row's comments get a row of their own only when there are some.
- A question whose context, example, or options hold a table, a mockup, or a story keeps one column,
  so the wide content has the card's whole width. A card holding a mockup or a story takes the
  page's whole column, so its live window shows nearer its own size, the card's border around it,
  while its text stays a single card's width, about 80 characters a line, centred: "The mockup
  itself should be bigger than the pane… The text should stay 80 characters wide".

## Not in text

- **No badges or pills inside reading text.** "Random pills/words at the start of lines" made the
  priorities harder to read; the "Cost" pills of a spec's tradeoffs, the "High" tag of its edge
  cases, and the "With changes" badge all went. Use an icon, a colour, or the text's own order
  instead. Pills stay for metadata at a pane's foot, such as a spec's time, risk tier, and
  constitution checks, and for ids, such as a criterion's.
- **No grey for text that matters.** A row's text is the normal text colour; the secondary colour is
  for what reads after it. A focused or selected element never changes the background behind text so
  that it gets harder to read.
- **No guidance prose.** A page's subtitle explaining what the page is, a line restating the title,
  or a hint telling the human to click: "Remove the slop. This is also a global UI decision." A
  placeholder or a field's help is judged case by case: a new one says what the field's label does
  not, or it is not written.
