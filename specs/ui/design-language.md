# Design language

The look of the Native Shell app: **a terminal, lit**. It keeps the terminal's grid, its square
corners, and its titled panes. It adds depth, glass, and light, and gives each of them one meaning.
The [UI look](../decisions/ui-look.md) and [UI components](../decisions/ui-components.md) decisions
bind; this guide says how they look. A
[browser mockup](../2026-11-10-nsh-migration/mockups/design-language.html) shows it, and its values
were tuned there, over four rounds with the human. A browser is not the real renderer: eight samples
then drew it on GTK, in both themes, and the values below are the ones that passed there. They are
the tokens, in [`app/ui/tokens/`](/app/ui/tokens/). The samples are gone: the
[gallery](/app/gallery/) draws every component with them, and `just gallery-shots` takes its
pictures. Where GTK cannot draw a rule as written, the rule says so, with the ruling that holds the
nearest look.

## The idea

Four things make the look, and each does one job:

- **Depth says what is above what.** Every surface has a height, and a height fixes its fill, its
  edge, its shadow, and whether it is glass. Nothing else draws a shadow.
- **Glass says "this floats over something you can still feel".** It is never a background for
  reading.
- **Light says "the keys go here".** Only the focused pane emits light, as a window's border does on
  a desktop. A light with no meaning is a bug.
- **Motion says "something just changed".** A light moves when a state changes, and at no other
  time.

What stays from the terminal: monospace by default, a grid of cells, square corners, 1 px lines, and
keys written out where they act.

## Heights

Four heights. A component picks one, and takes everything else from it. Light falls from above, so a
surface that stands up catches it on its top edge, and one that sinks is shaded under its top edge.
The difference is kept small: a hint of depth, never a bevel. Values are Catppuccin Mocha's, the
default dark theme; every theme maps its own.

| Height     | What sits there                                     | Fill                | Top edge             | Shadow                       | Glass |
| ---------- | --------------------------------------------------- | ------------------- | -------------------- | ---------------------------- | ----- |
| `recessed` | A field, a code block, a diff, the composer         | `well`, `#181825`   | 1 px of shade inside | None                         | No    |
| `standard` | A pane, the page's own content                      | `page`, `#1e1e2e`   | None: it is flat     | None                         | No    |
| `raised`   | A card, a selected row's bar, a bar that stays      | `raised`, `#2a2b3e` | 1 px of light inside | None                         | [^1]  |
| `overlay`  | A menu, a picker, a dialog, a sheet, a toast, a tip | Glass               | A bright rim         | Soft and deep, `0 22px 50px` | Yes   |

[^1]:
    A raised surface is glass only when content scrolls under it: the status line, a header once
    stuck, the phone's bars. A card in the page's flow is opaque.

- **No hard shadow, and no bevel.** A hard, unblurred shadow under raised surfaces was tried, and
  looked wrong, worst of all under small keys. A well shaded on two sides looked too deep.
- **Three strengths exist**, as the token `height.depth`: `tone` is the fills alone; `lips`, the
  default, adds the 1 px of shade or light; `soft` adds soft shadows.
- **Every edge is `rule`, `#70748b`**: the dimmest line that still reaches 3:1 against every surface
  it borders, a raised card first, as the UI look decision asks of a border. A line that only
  separates rows inside a pane is dimmer still: `rule-quiet`.
- **Under them all is the backdrop**, `backdrop`, `#11111b`: the darkest colour on screen. Panes sit
  on it with a gap, as tiled windows on a desktop: 8 px on a wide window, 4 px on a narrow one, 2 px
  on a phone. The gap is the same everywhere.
- **The backdrop is not flat.** It holds a still, soft wash of the theme's two accents, at 11% at
  most, with a fine grain. It gives glass something to bend, and the app a room to sit in. It never
  moves.
- **A height inside another keeps its own recipe.** A field in a dialog is still a well: its fill is
  the dialog's own, darkened by the same step. Panes nest two levels deep at most, as today.
- **Behind an overlay that takes the focus, the page dims** by 20% in the dark theme, and 10% in the
  light one. It is not blurred: only glass blurs, and only its own box.

## Panes, titles, and light

- **Every line is 1 px, and square.** Corners are never rounded, at any height, on any platform
  where Uraeda draws the surface itself. Everything that inspired this look rounds its corners: not
  rounding them is what makes it Uraeda's.
- **A pane's border goes around its title.** The title sits at the pane's top left, with its top 14
  px above the pane's top edge, and the border steps up and over it, as a folder's tab:
  `Sessions · 3`. The title is inside the pane's outline, on the pane's own fill, with its text in
  the pane's role colour. It takes no row from the pane's content.
- **Two other places for the title were tried.** In the border's line, the focus's glow ran through
  its letters. As a tab inside the pane, it cost every pane a row.
- **At rest, nothing glows.**
- **Only the focused pane emits light.** Its border, title included, becomes a gradient of two
  stops, `light.focus` to `light.focus-2`, at 45°: mauve `#cba6f7` to blue `#89b4fa` by default. A
  glow of the same colours follows the same outline, 18 px wide, at 42%. Its title fills with
  `light.focus`, with dark text, as the status line's mode block does. Nothing else marks the focus:
  bright corner brackets were tried, and their hard white fought the gradient.
- **The light glides.** When the focus moves, the light fades out of one pane and into the next over
  300 ms. The content answers at once: only the light takes its time.
- **`needs-you` is a colour, not a lamp.** A pane that waits on the human has its title in orange,
  and no light. Orange already shows on home and in the sidebar, and a second lamp would say "the
  keys go here" about a pane they do not go to. Focused, its title fills with orange, and its border
  is the focus's.
- **The editing mode colours the focused field.** With Vim on, the focused field's edge and its
  caret, and the two ends of the status line, take the mode's colour: normal the accent, insert
  green, visual the second accent, replace red.
- **Text never glows, and is never blurred.** Light belongs to edges and to the main button.
- **A selected row** has a 2 px bar of `light.focus` on its left edge, a fill one step up, and no
  glow round it: a list of glowing rows would shout. Only its bar is lit, by 8 px at 60%, in a dark
  theme.
- **Three marks on a list, and no other** (ruling R307). The cursor, where the keys go, is the
  selected row above: a card takes the same fill and bar, and its edge stays `rule`. In a pane at
  rest the cursor keeps its fill, and its bar is `rule`, unlit, since only the focused pane emits
  light. What is open now, the place shown or the item read beside the list, is "current": its icon
  and words in the accent, bold, with no bar and no fill, as the phone's tabs mark theirs. A choice
  made, a picked theme or option card, has its edge in the accent and a tick where it has room: it
  is not a cursor, and draws no bar.
- **A focused list shows its cursor before any key**: on its first row, unless the visit left it on
  another. A pointer user sees a quiet bar there; a keyboard user sees where `j` starts.

## Motion means a change of state

Nothing moves on its own. A light or a surface moves when something just changed, once, and then
rests.

- **A running pane has a steady line**: its top edge is drawn in `light.running`, with a short glow.
  It does not travel.
- **A run starting draws its line** from left to right, in 700 ms. **A run ending turns the line
  green**, then fades it over 1.2 s.
- **A running line may breathe**, between full and half strength over 6 s. It is off by default: the
  token `light.running.motion` is `steady`, `breathe`, or `off`.
- **The caret leaves a trail when it jumps.** A move of more than one cell draws a thin wedge of the
  mode's colour from where the caret was to where it is, which closes on the caret in 480 ms. A move
  of one cell, as typing makes, draws none.
- **A press moves a button down** by 1 px and puts its light out, at once. It comes back in 90 ms.
- **In, 180 ms, slowing down; out, 120 ms, speeding up.** Curves `(0.05, 0.7, 0.1, 1)` in and
  `(0.3, 0, 0.8, 0.15)` out. An overlay rises 8 px and fades in, with no scale and no bounce.
- **What moves existing content glides for about 200 ms**, as
  [space and motion](space-and-motion.md) says. That rule stays.
- **One thing may move without a change**: the view's one main action, below.
- **With reduced motion on**, nothing travels or breathes: lights switch, and overlays only fade.

## Buttons and keys

There are few buttons, so each can be a small object. None has a hard shadow or a white edge: both
were tried, and looked heavy.

- **The main action is a lamp**: filled with the accent, a little lighter at its top, with a glow
  under it. Under the pointer or the focus the glow widens. Pressed, it darkens and its glow goes.
- **A view's one main action breathes**: its glow swells and settles over 6 s. At most one button
  per view does, and none inside an overlay.
- **Every other button is a tube**: dark glass with a thin edge. Under the pointer or the focus its
  edge takes the accent and light fills it. A dangerous one is a red tube, lit a little even at
  rest.
- **A key is a chip**: the key in the accent, bold, on a small dark block tinted with the accent,
  with no border and no shadow. The block is dark so the letter reads on any surface. A row's
  actions are a chip and a word, `m move`, with no frame. Under the pointer the chip brightens;
  pressed, it dims.
- **On glass, nothing is a filled block**: buttons on an overlay are tubes.
- **Two tokens hold the variants** the mockup shows side by side. `key.look` is `chip`, the default,
  `glow`, a lit letter with no block, or `cap`, a flat keycap. `button.main.look` is `lamp`, the
  default, `glow`, a flat block of light, or `tube`, a neon sign whose letters glow.

## Glass

Glass is drawn by a shader that reads what is behind it. The recipe comes from open implementations
of Apple's glass, listed under [where it comes from](#where-it-comes-from).

| Part          | Dark theme                                                               | Light theme          |
| ------------- | ------------------------------------------------------------------------ | -------------------- |
| Frost         | A blur 14 px across, taken once from a quarter-size copy of the backdrop | The same             |
| Tint          | `glass-tint` at 62%, the well's colour warmed, up to 92% when bright     | The raised fill, 72% |
| Colour kept   | Saturation raised by 80%, brightness lowered by 8%                       | Saturation by 50%    |
| The bent edge | In a band of 12 to 22 px inside each edge, the backdrop is pulled inward | The same             |
| Colour fringe | Red, green, and blue bent by 100%, 97.5%, and 95% of that pull           | The same             |
| Rim           | 1 px, white at 60% at the top left and bottom right corners, 7% between  | White, 100% and 35%  |
| Light inside  | A white line under the top edge, and a shade above the bottom edge       | The same, lighter    |
| Grain         | 5% of what is there, lighter and darker, so a blur never shows bands     | 1.5%                 |

- **What makes it glass, not a grey panel**, in this order: the backdrop bends at the edge while the
  middle stays still; the rim is bright at two opposite corners and dim between; colour survives the
  tint; and the edge is sharper than the frosted middle: it keeps 35% of the frost, and is pulled
  inward by 1.6 times the band's width at most.
- **The frost is 14 px across**: a Gaussian blur whose deviation is 7 px. At a deviation of 14 px
  the glass showed no shape of what is behind it, and read as fog.
- **The grain is an overlay**: it lightens and darkens what is there by its share. Added as a fixed
  amount, 5% drew sandpaper on dark glass, and 3.5% drew speckle on light glass.
- **Square corners need care.** A lens that follows the box's edges tears along each corner's
  diagonal, and lights whole edges evenly, like an old bevel. So the pull's direction comes from a
  box with rounded corners, twice the band wide, while the shape stays square. The rim's brightness
  comes from where a point is on the box, not from its edge's direction.
- **Glass is dark enough to read on.** Contrast comes before the effect: the tint is the well's
  colour, darker than a pane, and what is behind is dimmed a little.
- **Glass shows shapes and colours, never words.** If a word behind it can be read, the frost is too
  weak. If the text on it falls under 4.5:1 over the busiest page, the tint is too thin: the tint
  thickens where the backdrop is bright, by 30% of the whole at most, and where it is dark in a
  light theme, by 20%. Measured on the samples' pixels, the dimmest text on glass reaches 4.7:1 in
  both themes.
- **Long prose never sits on glass**, and a pane is never glass.
- **A platform's own glass replaces this recipe** where it has one, as on iOS. The height stays the
  same: only what draws it changes.
- **Glass costs frames.** At most three glass surfaces are on screen at once, and one of them may be
  an overlay. The frost is taken once and shared. When a frame runs late, the fringe goes first,
  then the bent edge: the rim, the tint, and the grain cost nothing.
- **On GTK each glass takes its own picture** of what is behind it, at full size, each time that
  changes: there is no shared copy, and no smaller one. The frost is one pass of 64 taps, turned at
  each pixel so their gaps make no ghost (ruling R129). A bar over a transcript that scrolls fast
  cost 0.3 to 1 ms a frame, in software. Over the gallery's transcript of 20,000 messages, flung 900
  points a frame, the frames pass 8.3 ms at the 99th percentile in software, with the bar and
  without it: the rows and the painting cost, not the glass (ruling R239).
- **What moves by itself stays away from glass.** Glass draws again whenever what is behind it
  changes: a breathing glow under a bar would make the bar draw a frame for each of its own. A pane
  clips what it holds, so a main action's glow stays inside its pane.

## Type

- **Monospace is the default voice**, in the font the human picked for each role. Long prose keeps
  its reading font and its measure, as [Reading](reading.md) says.
- **Hierarchy comes from colour and weight before size.** Headings take their level's role colour.
  Sizes stay on a short scale of four steps, 13, 15, 18, and 22 px: the reading size, 15 px
  monospace on a 24 px line; one step under, 13 px, for what reads second; one and two steps over,
  18 and 22 px, for titles. Long prose is one step over the reading size, 18 px on a 28 px line.
- **Heights follow the line.** A row is a line with 2 px over and under it, 28 px. The status line
  is 30 px high, a button 32 px, a key's block 22 px, and a pane's title 26 px.
- **A glyph before a word, in one of six hues.** An item's kind shows as its icon in its kind's
  colour, from a small fixed set, as file icons are in LazyVim. Never one colour per item.
- **Box-drawing is part of the alphabet**: `─ │ ┌ ┐ · » ➜` for separators and trails. Never as
  decoration with nothing to separate.

## The status line and the menus

- **The status line is glass at `raised`**, with a solid block at each end in the mode's colour,
  dark text on it: the mode at the left, the place at the right. Between them, counts and hints sit
  on the glass, each hint with its key.
- **The leader menu and the key map are overlays**, with each key as a chip, a `➜`, then its action,
  in columns three cells apart. A group shows `+` before its name.
- **An overlay's title sits on a small plate on its top edge**, so it reads over any page.
- **A toast is an overlay with its icon and title on its edge**, stacked from the top, the most
  important first.

## The light theme

Glow needs darkness. In the light theme, light becomes ink:

- A focused edge is the same gradient, at full strength, with no outer glow. In its place sits a
  soft shadow tinted with `light.focus`, at 24%.
- The backdrop is the darkest of the light colours, and its wash is 5% at most.
- A key's block is the lightest thing around it, the accent at 10% over white, where a dark theme's
  is the accent at 20% over the backdrop: the letter reaches 4.5:1 on both, and under the pointer.
  In a theme where it would not, the block takes less of the accent, a hundredth at a time.
- The accents and the faint ink are the theme's own darkened ones, as the shipped Latte has them:
  the mockup's teal, orange, and faint ink fell under 4.5:1 on a plain surface, and so on glass.

## Roles this adds to a theme

A theme's file names them as its other roles: `backdrop`, `backdrop-wash-1`, `backdrop-wash-2`,
`well`, `rule-quiet`, `lip`, `shade`, `glass-tint`, `glass-rim`, `light-focus`, `light-focus-2`,
`light-running`. A theme that leaves one out inherits it, as any other role.

Three roles a theme already had are the language's: `page` is the standard height's fill, `raised`
the raised one's, and `rule` every edge. `mode-normal`, `mode-insert`, `mode-visual`, and
`mode-replace` are the editing mode's colours. In the tokens, `tokens.role` holds every role under
its file's name in camel case, `tokens.role.ruleQuiet`.

Every shipped theme has them: the two defaults by hand, the others mixed from their own colours, by
one rule. A test measures each shipped theme against the contrast floors at every height, text over
glass included, on what the tokens mix from its roles.

## What this changes in the other guides

- [Look and feel](look-and-feel.md), "Shapes": a pane's border goes around its title, where the
  title sat in the border's line. A double border no longer marks a live window: the focus's light
  does.
- [Look and feel](look-and-feel.md), "What can be pressed looks pressable": a row's action loses its
  1 px frame, and becomes a chip and a word. The main button glows.
- [Look and feel](look-and-feel.md), "Every element earns its place": "no pulse on a running
  session" stands. A running pane's line is steady, and the one thing that breathes is a view's main
  action.
- [Look and feel](look-and-feel.md), "Glass": the amber tint becomes the theme's `glass-tint`, glass
  bends its edge, and the status line joins what is glass.
- [Space and motion](space-and-motion.md), "Room": panes gain a gap over the backdrop.

## Open choices, each one token

The build takes each as written here, and the human changes any of them with one token:

1. A running pane's line: `light.running.motion`, `steady` by default, `breathe`, or `off`.
2. The backdrop's wash and the gap between panes: `backdrop.wash` and `pane.gap`.
3. The mode's colour on the focused field and the status line's ends: `light.mode`.
4. The main action's breathing: `button.main.motion`, `breathe` by default, or `steady`.
5. The caret's trail: `caret.trail`, on by default.
6. A pane's title: `pane.title`, `wrap` by default, `tab`, or `border`.
7. How deep heights look: `height.depth`, `lips` by default, `soft`, or `tone`.
8. A key's look: `key.look`, `chip` by default, `glow`, or `cap`.
9. The main button's look: `button.main.look`, `lamp` by default, `glow`, or `tube`.
10. Square corners at every height, with no exception: no token, it is the look.

## Where it comes from

Studied on 2026-11-10, from each project's source and documentation.

| From                     | Taken                                                                                         | Left                                           |
| ------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| LazyVim                  | One mode colour at both ends of the status line, glyphs in few hues, a key beside each action | Rounded floats, powerline separators           |
| Zed                      | A named set of heights, each fixing fill, edge, and shadow; quiet borders at rest             | Rounded corners, a flat window                 |
| Hyprland                 | Focus as light: a gradient border and a coloured shadow that fade as the focus moves; gaps    | A border that rotates for ever, strong dimming |
| Linux desktop setups     | Heavy blur with grain under thin edges; exits faster than entrances; a room behind the panes  | Pill bars, one colour per module               |
| A terminal cursor shader | The caret's trail: a wedge from the old place to the new, closing in half a second            | Fire colours, a trail on every move            |
| Open glass shaders       | The lens: a bent band at the edge, a colour fringe, a rim lit at two corners                  | Rounded lenses, seven taps for the fringe      |

The glass recipe was read from these, each a place to look before writing the shader:
[Kyant's AndroidLiquidGlass](https://github.com/Kyant0/AndroidLiquidGlass/blob/kmp/backdrop/src/commonMain/kotlin/com/kyant/backdrop/internal/Shaders.kt),
the smallest complete model;
[Hyprland's acrylic finish](https://github.com/hyprwm/Hyprland/blob/main/src/render/shaders/glsl/acrylicfinish.frag);
[liquid-glass-studio](https://github.com/iyinchao/liquid-glass-studio/blob/main/src/shaders-wgsl/fragment-main.wgsl),
in WGSL; and [kube.io's write-up](https://kube.io/blog/liquid-glass-css-svg) for the browser. None
of them draws a square panel: the care for corners above is this guide's, and the glass shader,
[`glass.wgsl.ts`](/app/ui/surfaces/glass.wgsl.ts), draws it on GTK.
