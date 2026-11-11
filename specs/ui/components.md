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
- A thing of several facts: `Card`; a choice among such things: `SelectableCard`.
- A theme to choose, drawn in its own colours: `ThemeSample`, the one component that draws a theme's
  colours rather than the tokens'.
- Columns: `Table`; nesting: `Tree` with `treeRows`; a part that folds: `Collapsible`; an order the
  human sets: `DragOrder`; nothing to show: `Empty`, which says why and what to do.

Text, [`app/ui/text/`](/app/ui/text/) (gallery [Text](/app/gallery/text/)):

- Every field: `TextField`, one line or many, with Vim when the setting is on; a message to an
  agent: `Composer`, with `attached`, the number of images or files, so they send without words; a
  field that picks: `PickerField`; a save's state: `SaveStatus` with `saving`.

Documents, [`app/ui/document/`](/app/ui/document/) (gallery [Documents](/app/gallery/document/)):

- A workflow file's tree: `Document`; an agent's reply as it streams: `Reply`. Neither reads
  Markdown in TSX.
- A file's diff, or a commit's files: `Diff`, over the server's unified patch, scrolling inside
  itself.

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
  `sent`, and its `refusal` names the way out, under that control, never in a toast.
- **A list has one cursor**, which is its selection: `j` `k`, `Home` `G`, `Enter`, the pointer too.
  It returns `false` at its ends, so the frame's keys move on. Keep it in the visit, with
  `usePane().remember`.
- **A long list's row keeps one structure.** Native Shell reuses a row's views for any other row: a
  row whose kind changes its words, icon, or colour is cheap, one that swaps its views is made again
  at every bind. A reply that grows is the list's last row, which the list follows; never its
  footer.
- **One main action per view**, a `Button` of `variant="main"`; the rest are tubes. An action that
  starts work is a button or `Ctrl+Enter`, never Enter in a field.
- **A key is declared where it acts**, by `registerKey` or a `Button`'s `keys`, and shown by `Kbd`:
  a key that means two things where both are on throws as the view is made.
- **A time reads in the server's time zone**, whatever the device's: `serverTime(at)` from
  `app/store` writes it as "15:08" today, "Tue 15:08" this week, "12 Nov 15:08" this year, and
  `serverClock(at)` gives its parts. Never `Date`'s hours, which are the device's.
- **Every state has its words**: `Empty` for nothing, `Spinner` with what it waits for, `Banner` for
  what is wrong and the way out.
- **Missing a component?** Add it to `app/ui/`, with its page in the gallery, before a screen uses
  it: a component drawn in a screen is a second copy to keep right.
