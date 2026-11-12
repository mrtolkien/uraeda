# Components

"Make those two the SAME component." The [UI components](../decisions/ui-components.md) decision
holds the rule: a kind of information is drawn by one shared component everywhere. The library is
[`app/ui/`](/app/ui/); a screen imports from each folder's `index.ts`, as an extension's page does
from [`app/ui/index.ts`](/app/ui/index.ts). Every component is in the gallery, in its states, in
both themes: `hidden-display just gallery` runs it, `just gallery-shots [word]` pictures it. Look
there before drawing anything.

## Which component for what

The frame, [`app/ui/layout/`](/app/ui/layout/) ([panes](panes.md), gallery group Panes):

- A screen's parts: `definePane` and `definePlace`; in a pane, `usePane` and `PaneScroll`. The shell
  draws the pane's frame, its tab, the rail, the status line, and the phone's bars.

Surfaces, [`app/ui/surfaces/`](/app/ui/surfaces/) (gallery [Surfaces](/app/gallery/surfaces/)):

- A height of its own: `Surface` (`recessed`, `standard`, `raised`, `overlay`; `glass` over what
  scrolls). The only one that draws a shadow, glass, or a glow.
- A titled group inside a pane: `Pane` with `height="raised"`; a field's ground: `Well`.
- Over the page: `Dialog` (a sheet on a phone), `Sheet`, `Popover`, `Overlay` (`corner` for what
  leaves the page usable), `Toasts` with `Toast`, `Tooltip`.

Controls, [`app/ui/controls/`](/app/ui/controls/) (gallery [Controls](/app/gallery/controls/)):

- Words: `Text` (`tone`, `size`, `font`), `Heading`, `Link`, `Kbd` for a key, `Icon` (Lucide's
  names, and `claude`, `openai`, `pi`).
- Actions: `Button` (`main` for the view's one main action, a tube otherwise, `danger`),
  `IconButton`, `Menu` as a last resort.
- Choices: `Switch`, `Checkbox`, `Radio`, `Segmented` (two to five), `Select` (more), and
  `NumberInput`, each with `hint` and `refusal`.
- States: `Badge`, `StatusDot`, `Banner`, `Spinner` (with its words), `Progress`, `Tabs` inside a
  pane, `Breadcrumbs`, `Divider`.

Lists, [`app/ui/lists/`](/app/ui/lists/) (gallery [Lists](/app/gallery/lists/)):

- Rows of one fact: `List`, or `VirtualList` past a screen of rows, each row a `Line`; the cursor is
  `createCursor`, its keys `listKeys`.
- A value the server keeps, in a form or the settings: `FieldRow` in `FieldRows`, its icon, name,
  help, source, control, and refusal under it, on one cursor whose Enter does the row's act.
- A thing of several facts: `Card`; a choice among such things: `SelectableCard`.
- A theme to choose, drawn in its own colours: `ThemeSample`, the one component that draws a theme's
  colours rather than the tokens'.
- Columns: `Table`; nesting: `Tree` with `treeRows`; a part that folds: `Collapsible`; an order the
  human sets: `DragOrder`; nothing to show: `Empty`, which says why and what to do.

Text, [`app/ui/text/`](/app/ui/text/) (gallery [Text](/app/gallery/text/)):

- Every field: `TextField`, one line or many, with Vim when the setting is on; a message to an
  agent: `Composer`, with `attached`, the number of images or files, so they send without words; a
  field that picks: `PickerField`; a save's state: `SaveStatus` with `saving`.
- A field's text while it is not saved: `unsavedText`, kept on the device as it is typed, with its
  `save` (a field over a saved text: a file, a note, a setting) and its `send` (a field that starts
  from nothing: a message, a new note, a commit's message).

Documents, [`app/ui/document/`](/app/ui/document/) (gallery [Documents](/app/gallery/document/)):

- A workflow file's tree: `Document`; an agent's reply as it streams: `Reply`. Neither reads
  Markdown in TSX.
- A file's diff, or a commit's files: `Diff`, over the server's unified patch, scrolling inside
  itself. A patch Native Shell cannot read shows as its text, under a line that says why.

Keys, [`app/ui/keys/`](/app/ui/keys/) (gallery [Keys](/app/gallery/keys/)):

- Every shortcut: `registerKey`, in the scope of the pane it is drawn in; a find: `KeyPicker`.

## Rules that keep screens one app

- **Read the server through the store only**: `record`, `list`, `text`, and `call`, as
  [`app/store/README.md`](/app/store/README.md) says; never a record's value kept in a component.
- **Read the tokens only.** A colour, a size, a gap, a glow come from `tokens`, through the
  components: never a hex value, never a raw `View` with a border or a shadow of its own.
- **A screen is panes.** A pane draws its content only, at the width its stack gives it
  (`props.width`), and never draws its own frame, title, tab bar, or side column.
- **Several facts about one thing make a `Card`**: a title a person would say, its state, its times,
  in the order things happened. Never a row of grey words, never an id in a title.
- **A control moves at once; its refusal sits under it.** A value the server keeps goes through
  `sent`, and a whole the server keeps of several fields, as a job, through `patched`, whose changes
  are queued patches each applied on what the one before wrote; its `refusal` names the way out,
  under that control, never in a toast.
- **A list has one cursor**, which is its selection: `j` `k`, `g g` `G` (`Home` `End`), `Enter`, the
  pointer too, all from `listKeys` (which `List`, `VirtualList`, and `Tree` call): never a list's
  own `j` `k`. It returns `false` at its ends, so the frame's keys move on. Keep it in the visit,
  with `usePane().remember`. While the list's keys work, its pane focused, a list with no cursor
  puts it on its first row, so the human sees where the keys go before pressing one.
- **A list marks three things, with the library's looks only** (design language, "Three marks on a
  list"): the cursor is `selected` on a `Row` or a `Card`, a fill and a bar that `Bar` lights while
  the keys work there and leaves unlit in a pane at rest; what is open now is `current` on a `Line`
  or a `Card`, its words in the accent; a choice made is `picked` on a `ThemeSample` or `selected`
  on a `SelectableCard`, its edge in the accent. Never colour a title, light an edge, or hide the
  cursor while the pane is at rest, by hand.
- **A title gets the width first.** `Line` and `Card` keep a state, a count, or a time beside the
  title while both fit on one line, and move it to the end of a second line when they do not; on a
  narrow window a card's state and time are a head line over its title. Never give a title a fixed
  share of a row, or put its state in a column that squeezes it: a word that breaks in the middle is
  that bug.
- **A long list's row keeps one structure.** Native Shell reuses a row's views for any other row: a
  row whose kind changes its words, icon, or colour is cheap, one that swaps its views is made again
  at every bind. A reply that grows is the list's last row, which the list follows; never its
  footer.
- **A word typed is never lost.** A field's text is `unsavedText`, and it reaches the server only
  through its `save` or its `send`, which take the text, and what is attached, as they are when the
  human asks. The field stays theirs while the server answers: once saved, what they typed meanwhile
  stays, unsaved, over the text saved; a text sent leaves the field at once, and a refusal puts it
  back before what was typed since. Both answer `{ ok }`, so what follows a refusal stops: a round
  is not submitted while its notes are not saved. Never read a field's text after an `await`, and
  never `discard()` after one: `discard` is the human's own "drop my text". A field closes only once
  it holds nothing unsaved (`dirty()`).
- **One main action per view**, a `Button` of `variant="main"`; the rest are tubes. An action that
  starts work is a button or `Ctrl+Enter`, never Enter in a field.
- **A key is declared where it acts**, by `registerKey` or a `Button`'s `keys`, and shown by `Kbd`:
  a key that means two things where both are on throws as the view is made. A key that works on some
  rows only says so with `when`, and keeps its `hint`: the status line names it only where its
  `when` holds, and hides a hint it cannot hold whole.
- **A time reads in the server's time zone**, whatever the device's: `serverTime(at)` from
  `app/store` writes it as "15:08" today, "Tue 15:08" this week, "12 Nov 15:08" this year;
  `serverDay(at)` writes a day, "12 Nov", "12 Nov 2025", a `YYYY-MM-DD` date as it is written;
  `serverDaysAgo(at)` counts the days since; `serverClock(at)` gives its parts. The zone comes with
  the server's `welcome`, before any record. Never `Date`'s hours, days, or `toLocale…`, which are
  the device's, and never a format of a screen's own.
- **Every state has its words**: `Empty` for nothing, `Spinner` with what it waits for, `Banner` for
  what is wrong with the page and the way out, `Refusal` under a control the server turned down.
- **An empty state says three things**, in one voice (ruling R309): its `title`, what is not here,
  short, with no full stop, "No sessions yet", "Nothing waits on you", "Nothing in Now"; its
  `words`, why, naming the cause, then what brings one, in sentences; its `action`, the one thing to
  do, with its key where it has one. Never "Nothing here yet.", which names neither.
- **A refusal says what was refused, why, and the way out**: `Refusal`, or a control's `refusal`
  prop, which draws one, under the control the hand was on, in the server's words, "Not moved: the
  proposal is in a section that is no longer there." Never a danger `Banner` for a refused action,
  never a toast, and never in place of an empty state's words (`Empty`'s `refusal` sits under its
  action). A `Banner` is for the page: what cannot be read, what an agent holds; its title is a
  title, with no full stop.
- **A pane's header is one row of controls**: its search or jump, its order, its filters. In a
  narrow pane (`usePane().width()`), a `Button` there is `compact`, its key and icon, its label in
  its tip. A control the row cannot hold goes into a `Menu` at its end, never onto a second row.
- **Missing a component?** Add it to `app/ui/`, with its page in the gallery, before a screen uses
  it: a component drawn in a screen is a second copy to keep right.
