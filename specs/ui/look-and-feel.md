# Look and feel

The [UI look](../decisions/ui-look.md) decision sets the terminal look: monospace, Catppuccin,
square corners, and panes titled in their border. This guide is about what the human checks element
by element: whether it earns its place, and whether it shows what it does.

## Every element earns its place

Ask of each mark, word, and control: "What does it convey? Is it clickable?" If neither, it goes.

- **No decorative status.** An "idle" mark, a pulse on a running session, a dot that says nothing:
  removed. "I want it gone everywhere."
- **No menu for one action, no `…` for the sake of it.** "Remove the `...` completely, it's
  pointless." Actions sit on the row's bar, among the page's keys, or on the page that owns them
  ("rename will be only on the feature page"). A `…` menu is the last resort, and never inside a
  card or a pane: a page's header may hold one, as a session's and a feature's do.
- **No second copy.** What the sidebar or the page already shows is not shown again beside it: the
  ongoing work in home's "Priorities now", the settings and the navigation in the phone's sidebar
  when the top tabs hold them, a Review tab repeating the page's end.
- **No guidance prose and no summary of the obvious.** A page's subtitle, an intro line, a field
  nobody needs: "Remove the slop." A review's verdict says whether the human approves; a separate
  summary field said nothing more.
- **Icons where the icon is clear.** A row's draft, a link, or a running feature shows as its icon,
  not as a word after the text: "the icons are enough". Every icon-only control keeps a label for
  screen readers.
- **Empty sections disappear.** A pane with nothing to show, like Sessions when none runs, is not
  drawn.

## What can be pressed looks pressable

- **A card brightens as a whole on hover**, so the whole card reads as one target.
- **A button looks like a button**: a filled square, in a colour apart from the page, like the
  next-step chevron and the running session's mark, in the accent with the agent's own icon. A
  button that only shows on hover is no button.
- **Two targets look like two**: a card and the button inside it never highlight together, since
  they lead to different places.
- **A link looks like a link**: a running line of the priorities links to its feature, and shows it.
- **A field looks writable**: the composer has a border.
- **A selected element is unmistakable**, the same way on every page (see
  [Keyboard](keyboard.md#selection)), and a mode, like moving a row, changes the row's border and
  its bar's hints where it acts.

## Shapes

- **Square, everywhere.** "NO ROUNDED CORNERS": cards, buttons, bars, sheets, and the composer's
  buttons are rectangles. A rounded corner is a bug.
- **1 px borders.** Thicker borders were tried and reverted: "1px everywhere." A double border marks
  a live window.
- **Icons on one axis**: the rail's icons are 20 px, aligned on one vertical axis whatever their row
  holds; a card's and a row's icons are the small and medium sizes, aligned within their column.
- **Separators only between sections**, at the same place every time; inside a section, room or a
  card's own border separates its rows.

## Colours

- **The accent** (mauve) is what can be pressed: the primary button, the next-step mark, the
  selection.
- **Orange** is what needs the human: the Needs-you border, a pane asking for attention.
- **Teal** marks sub-agents, apart from red, which reads as wrong.
- **Green** is the repository's mark and what was added; **red** what was removed or is wrong.
- **Text stays the text's colour.** The secondary colour is for what reads second, never for the
  row's own text.

## Glass

The look is a terminal's, with frosted glass for what floats over the page, as modern Linux desktops
draw their panels with transparency and blur. The phone's floating bars, a row's actions and a
page's bottom bar, and the leader menu on wide screens, are frosted glass (`layout/glass.ts`):
square, in a warm amber tint of their own over two thirds of the page's own colour, blurred, so the
page under them shows its shapes and colours but none of its words, and the glass's text reads over
any page ("the leader menu over text is hard to read"), with a bright rim on the edge that faces the
page. A new floating surface uses those styles, never a second glass. Not the gradients of early
2010s mobile interfaces: "just a bit square… extremely blurred". Glass marks what floats over the
page; it is not a background for panes. Nothing on glass is a filled block, not even the main
action: an action stands out by its icon in the accent.
