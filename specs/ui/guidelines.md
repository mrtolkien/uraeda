# Guidelines

What established books, articles, and design systems say about a good interface, distilled into
rules an agent can check. The other guides here hold the human's own rulings for Uraeda; this one
holds the outside rules they rest on, and fills the gaps between them. Where the two disagree, the
guides win until the human rules, and the disagreement is listed at the end with the ruling.

## The bar is great

An interface that works is the floor, not the goal. Aim for a UI a demanding user would choose over
the tools they know: as fast as Linear or Superhuman from the keyboard, as calm to read as a good
book, as obvious to tap as a well-made iPhone app. When a view falls short, change it boldly: rework
the layout, the control, or the flow rather than nudging a margin, then check the result by using it
and by looking at it at each width. Measure the rules below; argue a choice with a source or a
comparable product, never with habit. What only the human can decide is proposed, with the
recommendation and its cost.

Great is also Uraeda's own: a terminal, after LazyVim and modern Linux desktops, not a generic iOS
or shadcn UI ([Its own look](README.md#its-own-look)). These rules come from products that look
nothing like it, and applying them is arbitration, not copying. Keep the need each rule names, a
line one reads, a target one hits, a state one sees, and find the terminal's way to meet it. Drop
neither silently: a rule that would make a view generic, or a look that would fail a need, is
proposed to the human.

## How to use it in a review

- Read the guide for the view's job first ([Reading](reading.md), [Keyboard](keyboard.md),
  [Surfaces](surfaces.md), [the phone](phone.md)), then walk this file's sections over the view.
- Each rule has a check: a number to measure, or a test to run in a browser's devtools. Run it,
  rather than judging by eye.
- A finding names the rule and its source, so the fix can be argued with the source, not with taste.
- Check the view as each [persona](personas.md) would use it: the section "Per persona" says which
  rules weigh most for each.

## Hierarchy and layout

**Show what matters first, by weight and colour before size.** A heavier weight or the primary text
colour against the secondary one ranks text without making the page shout. Check: in a screenshot
blurred to 5 px, the first thing the eye lands on is the pane's lead or primary action. [Refactoring
UI][refactoring-ui]

**Emphasize by de-emphasizing.** When something does not stand out, quiet what competes with it
rather than making it louder. Check: a pane has one element at the top of its hierarchy; if two
compete, one steps down. [Refactoring UI][refactoring-ui]

**Group by proximity: room inside a group is smaller than room between groups.** The eye reads
elements that sit close as one thing. Check: the gap between two groups is at least twice the gap
inside one. [Laws of UX, proximity][laws-of-ux-proximity]

**Space from a short scale, never a number of its own.** A scale of a few steps keeps edges aligned
and rhythm even. Check: no `px` value in a view's styles that is not a theme token. [Refactoring
UI][refactoring-ui], as [Space and motion](space-and-motion.md) asks.

**Separate with room or a background before a border.** Too many borders make a page busy. Check:
inside a pane, rows are set apart by room or the selection's tint, and a border marks only a pane or
a control. [Refactoring UI, 7 practical tips][refactoring-ui-7-practical-tips]

**Let a page be scanned before it is read.** People scan headings, the first words of lines, and
bold leads before reading. Check: each pane's first line, read alone, says what the pane is about.
[NN/g, F-shaped reading][nn-g-f-shaped-reading], [Krug, Don't Make Me
Think][krug-don-t-make-me-think]

**Reflow to 320 px without scrolling sideways.** Content that needs two scroll directions is lost at
narrow widths and at 400% zoom. Check: at 320 CSS px wide, `document.documentElement.scrollWidth`
equals `clientWidth`; a table or code may scroll inside its own box. [WCAG 2.2, 1.4.10
Reflow][wcag-2-2-1-4-10-reflow]

## Typography and reading

**Lines of prose hold 45 to 90 characters.** Longer lines lose the eye on the way back; shorter ones
break phrases. Check: count the characters of a full line of a pane's prose. [Butterick, line
length][butterick-line-length]

**Line spacing is 120 to 145% of the font size.** Tighter lines blur together, looser ones fall
apart. Check: computed `line-height` divided by `font-size` lies in 1.2 to 1.45. [Butterick, line
spacing][butterick-line-spacing]

**Body text is 15 to 25 px on a screen.** Check: the computed `font-size` of prose at every width.
[Butterick, summary of key rules][butterick-summary-of-key-rules]

**Text can be enlarged to 200% without losing content.** Some people read only with large text.
Check: at 200% browser zoom, no text is cut, overlaps, or hides behind a fixed bar. [Apple HIG,
accessibility][apple-hig-accessibility], [WCAG 2.2, 1.4.4][wcag-2-2-1-4-4]

**Text survives wider spacing.** People override letter, word, and line spacing to read. Check: set
`line-height: 1.5`, `letter-spacing: 0.12em`, `word-spacing: 0.16em`, and paragraph spacing `2em` on
the page; nothing is clipped or overlaps. [WCAG 2.2, 1.4.12 Text
spacing][wcag-2-2-1-4-12-text-spacing]

**Monospace for code and tool chrome, a proportional face for prose.** A proportional face reads
faster in running text. Check: a paragraph meant to be read is not in the UI font. [Butterick,
monospaced fonts][butterick-monospaced-fonts]

## Color and contrast

**Text reaches 4.5:1 against its background, large text 3:1.** Check: devtools' contrast picker on
every text colour, the secondary one included, over every surface it sits on, glass and tints too.
[WCAG 2.2, 1.4.3][wcag-2-2-1-4-3]

**Controls, borders that identify them, and focus rings reach 3:1.** A field whose border fades into
the page does not look writable. Check: the contrast of each control's edge and of the focus ring
against what is beside them. [WCAG 2.2, 1.4.11 Non-text contrast][wcag-2-2-1-4-11-non-text-contrast]

**Colour is never the only signal.** Red and green, or a tint alone, fail for colour-blind readers
and in bright light. Check: in a greyscale screenshot, every state (added, removed, selected,
needs-you) is still told apart by an icon, a sign, a weight, or a border. [WCAG 2.2, 1.4.1 Use of
color][wcag-2-2-1-4-1-use-of-color]

**Grey text never sits on a coloured background.** Grey loses contrast and looks dirty over colour;
use the background's own hue, lighter or darker. Check: text on a tint uses a colour derived from
that tint. [Refactoring UI, 7 practical tips][refactoring-ui-7-practical-tips]

## Affordance and targets

**What can be pressed looks pressable, before any hover.** On touch there is no hover, and a mouse
user scans before moving. Check: in a still screenshot, every control can be told from text. [NN/g,
heuristic 6, recognition rather than recall][nn-g-heuristics]

**A pointer target is 24 × 24 CSS px at least, on every width.** Smaller targets are missed by
anyone with a tremor or a trackpad. Check: `getBoundingClientRect()` of each control, or a 24 px
circle centred on a smaller one touches no other target. [WCAG 2.2, 2.5.8 Target
size][wcag-2-2-2-5-8-target-size]

**A touch target is 44 × 44 pt on iOS, 48 × 48 dp on Android.** A thumb covers about 9 mm. Check: on
the phone, each control's box, its padding included, is 44 px at least. [Apple HIG,
accessibility][apple-hig-accessibility], [Android, touch target size][android-touch-target-size]

**Spacing between targets counts as much as their size.** Apple suggests about 12 pt around a
control with a bezel and 24 pt around one without; Android 8 dp between targets. Check: two
neighbouring tap targets on the phone have room between them, or a tap on their shared edge is
unambiguous. [Apple HIG, accessibility][apple-hig-accessibility]

**Big and near for what is used often.** Time to hit a target grows with distance and shrinks with
size, and screen edges and corners are the easiest to hit with a mouse. Check: the primary action of
a step is the largest control of its pane and sits where the eye ends. [Laws of UX, Fitts's
law][laws-of-ux-fitts-s-law]

**An icon alone is understood only when it is universal.** Most icons need a word. Check: show the
icon to someone who has not seen the app, or ask whether its meaning is as settled as a magnifier
for search; if not, it gets a label or a tooltip, and always an accessible name. [NN/g, icon
usability][nn-g-icon-usability]

## Feedback and state

**Every control has its states drawn: rest, hover, focus, pressed, disabled, selected.** Material
draws them as a layer over the control (hover 8%, focus and pressed 10%). Check: walk one control
through each state; each looks different, and focus differs from hover. [Material 3,
states][material-3-states]

**Show the system's status, within a second.** Under 0.1 s feels instant, under 1 s keeps the flow,
past 10 s loses attention. Check: throttle the network to Slow 3G; every action shows a change
within 100 ms, and anything over 1 s shows that it runs. [NN/g, response
times][nn-g-response-times], [heuristic 1][nn-g-heuristics]

**A status message is announced without moving the focus.** A screen reader hears a toast only if it
sits in a live region. Check: toasts and inline results are in an element with `role="status"` or
`aria-live="polite"`, errors `role="alert"`. [WCAG 2.2, 4.1.3 Status
messages][wcag-2-2-4-1-3-status-messages], [Inclusive Components,
notifications][inclusive-components-notifications]

**An error says what happened and how to fix it, next to its cause.** Check: the message names the
thing, the cause in plain words, and a next step, and sits by the field or row it concerns. [NN/g,
error messages][nn-g-error-messages]

**Prefer undo to a question.** A confirmation asked every time is clicked through without reading.
Check: only what cannot be undone asks first; the rest offers undo. [NN/g, confirmation
dialogs][nn-g-confirmation-dialogs]

**An empty state says what would be here, and how to add it.** A blank space reads as broken. Check:
every list and pane has a drawn state with no items. [NN/g, empty states][nn-g-empty-states]

## Keyboard and focus

**Everything works from the keyboard, with no timing.** Check: unplug the mouse and finish each
flow; no step needs a pointer, a hover, or a key held for a time. [WCAG 2.2, 2.1.1
Keyboard][wcag-2-2-2-1-1-keyboard]

**The focus is always visible.** Check: press Tab and the page's own movement keys from the top of
each page; at every step the focused element shows a ring or a mark of 3:1 contrast, 2 px thick
around it or more. [WCAG 2.2, 2.4.7][wcag-2-2-2-4-7], [2.4.13 Focus
appearance][2-4-13-focus-appearance]

**The focus is never hidden by a sticky bar, a toast, or a sheet.** Check: move the selection to the
last row of a long list; it scrolls fully clear of the status line, the toasts, and the bottom bar
(`scroll-padding` set to their height). [WCAG 2.2, 2.4.11 Focus not
obscured][wcag-2-2-2-4-11-focus-not-obscured]

**Focus order follows reading order, and comes back where it left.** Check: closing a layer returns
the focus to what opened it; Tab after a page loads starts at the page's main content. [WCAG 2.2,
2.4.3 Focus order][wcag-2-2-2-4-3-focus-order], [ARIA APG, keyboard
interface][aria-apg-keyboard-interface]

**Single-letter shortcuts can be turned off or remapped.** Speech input types letters that fire
them. Check: the setting exists and the leader still opens by a chord. [WCAG 2.2,
2.1.4][wcag-2-2-2-1-4]

**A widget takes the keys its pattern expects.** Arrows move inside a menu, a radio group, a tab
list; Tab leaves it; Escape closes it. Check: compare with the widget's pattern in the APG. [ARIA
APG, patterns][aria-apg-patterns], [Inclusive Components, menus][inclusive-components-menus]

**Shortcuts are learned where the action is.** A command palette lists actions by name and shows
each one's key beside it, so a mouse user learns the key by using the menu. Check: every command in
the leader menu, a picker, or a button's tooltip shows its key. [Superhuman, command
palette][superhuman-command-palette]

**Keys follow the habits users bring.** Vim users expect `j` `k` to move, `gg` `G` to jump, `/` to
search, `Escape` to leave, and LazyVim users `Space` as a leader with groups that show what follows.
Check: a key that a Vim user would read one way never does another. [LazyVim,
keymaps][lazyvim-keymaps], [Laws of UX, Jakob's law][laws-of-ux-jakob-s-law]

## Pointer

**Hover adds, never hides.** Hover can brighten and preview; what it shows is reachable by focus and
tap too, and stays while the pointer moves onto it. Check: everything shown on hover also shows on
focus, can be dismissed with Escape, and does not vanish when the pointer moves over it. [WCAG 2.2,
1.4.13 Content on hover or focus][wcag-2-2-1-4-13-content-on-hover-or-focus]

**A press acts on release, and can be cancelled by moving off.** Check: press a button, drag off it,
release: nothing happens. [WCAG 2.2, 2.5.2 Pointer
cancellation][wcag-2-2-2-5-2-pointer-cancellation]

**A drag has a way without dragging.** Check: every reorder by drag also works by keys and by a tap.
[WCAG 2.2, 2.5.7 Dragging movements][wcag-2-2-2-5-7-dragging-movements]

**A tooltip names an icon-only control, after a short delay.** Check: hovering an icon-only button
shows its name and key within about a second; the tooltip holds no action. [NN/g,
tooltips][nn-g-tooltips]

## Touch and the phone

**Nothing important sits under the rounded corners, the notch, or the home indicator.** Check: the
page sets `viewport-fit=cover` in its viewport meta, and every bar pads by
`env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` (34 pt at the bottom of an iPhone 13);
in a screenshot of the home-screen app, no tile's corner or text is clipped by the screen's curve.
[WebKit, designing for iPhone X][webkit-designing-for-iphone-x], [MDN, env()][mdn-env], [Apple HIG,
layout][apple-hig-layout]

**Design for the home-screen app, not only the browser tab.** Opened from the home screen, the page
has no browser toolbar, so no Back button and no address bar. Check: in `display-mode: standalone`,
every page has its own way back, and the status bar's area at the top is padded. [MDN,
display-mode][mdn-display-mode]

**The field being typed in stays above the keyboard.** iOS Safari does not shrink the layout
viewport when the keyboard opens, so a bar fixed to the bottom ends up behind it. Check: on an
iPhone, focus each field near the screen's bottom; it and its send button stay in view, positioned
from `window.visualViewport`'s `height` and `offsetTop`, updated on its `resize` and `scroll`. [MDN,
VisualViewport][mdn-visualviewport]

**Fields use 16 px text or larger on iOS.** Safari zooms the page into a field whose text is
smaller, and does not zoom back. Check: the computed `font-size` of every input and editor on the
phone is 16 px at least.

**Heights use the dynamic viewport.** `100vh` on iOS is the height with the toolbars hidden, so a
full-height page runs under them. Check: full-height layouts use `100dvh` or `100svh`. [MDN,
viewport units][mdn-viewport-units]

**The thumb reaches the bottom of the screen best.** Check: the step's primary action and the page's
companions sit in the bottom third on the phone, never only in the top bar. [Laws of UX, Fitts's
law][laws-of-ux-fitts-s-law]

**Scrolling inside a sheet does not scroll the page under it.** Check: scroll a sheet past its end;
the page behind stays still (`overscroll-behavior: contain`). [MDN,
overscroll-behavior][mdn-overscroll-behavior]

## Motion

**Motion shows where something went, and nothing else.** Check: each animation moves, opens, or
closes something the human can follow; none loops or pulses. [Material 3, easing and
duration][material-3-easing-and-duration]

**Short and eased: about 100 to 200 ms for small changes, 250 to 400 ms for a panel or sheet.**
Material's scale runs short (50 to 200 ms), medium (250 to 400 ms), and long (450 to 600 ms). Check:
the `transition-duration` of each animation, against how far it moves. [Material 3, easing and
duration][material-3-easing-and-duration]

**Reduced motion turns movement off.** Check: emulate `prefers-reduced-motion: reduce` in devtools;
everything still works, and nothing slides, scrolls smoothly, or zooms. [WCAG 2.2,
2.3.3][wcag-2-2-2-3-3], [MDN, prefers-reduced-motion][mdn-prefers-reduced-motion]

**Nothing shifts under the pointer.** A layout that moves as it loads makes people press the wrong
thing. Check: the Performance panel's layout shifts after the first draw stay at zero for a page
read in place. [web.dev, CLS][web-dev-cls]

## Forms and text input

**Every field has a visible label; a placeholder is no label.** A placeholder vanishes on typing and
reads as filled. Check: each field keeps a label, or a pane title that names it, while it holds
text. [NN/g, placeholders][nn-g-placeholders]

**Typed text is never lost.** Check: type in a field, then navigate, reload, and press Back; the
text is still there, or a question came first. [NN/g, heuristic 3, user control and
freedom][nn-g-heuristics]

**Errors are found before the send, and said in words.** Check: a refused value marks its field and
says why, with `aria-invalid` and `aria-describedby` on it. [WCAG 2.2, 3.3.1 Error
identification][wcag-2-2-3-3-1-error-identification]

**Fields ask for the right keyboard.** Check: `inputmode`, `autocapitalize`, `autocorrect`, and
`enterkeyhint` fit each field on the phone, for example no autocapitalization in a slug, and
`enterkeyhint="send"` in a composer. [MDN, enterkeyhint][mdn-enterkeyhint]

## Copy

**Labels say what happens.** A button is a verb and its object, "Commit 3 files", not "OK". Check:
read each button out of context; it still says what it does. [NN/g, UI copy][nn-g-ui-copy]

**Use the human's words, not the system's.** Check: no internal id, error code, or library term in
text a persona reads, unless it is the thing itself, like a branch name. [NN/g, heuristic 2, match
the real world][nn-g-heuristics]

**Omit needless words.** Half the words on a page can usually go. Check: remove each sentence of
instructions; if nothing is lost, it stays removed. [Krug, Don't Make Me
Think][krug-don-t-make-me-think]

## Consistency

**One thing, one look, one word, one key.** Check: the same action has the same label, icon, and key
on every page. [NN/g, heuristic 4, consistency and standards][nn-g-heuristics], [WCAG 2.2, 3.2.4
Consistent identification][wcag-2-2-3-2-4-consistent-identification]

**Follow the platform where the user already knows it.** Users spend most of their time in other
apps. Check: system gestures (edge swipe, pull to refresh, Cmd shortcuts the browser owns) are left
alone. [Laws of UX, Jakob's law][laws-of-ux-jakob-s-law]

**Fewer choices, sooner.** Time to decide grows with the number of options. Check: a step shows one
primary action; long lists of actions go behind a search or a group. [Laws of UX, Hick's
law][laws-of-ux-hick-s-law]

**Polish is not decoration.** A good-looking interface is judged easier to use, which also hides its
problems in a quick test. Check: test a flow by doing it, not by looking at it. [Laws of UX,
aesthetic-usability effect][laws-of-ux-aesthetic-usability-effect]

## Performance perceived

**Answer within 400 ms.** Below it, the human and the system keep each other's pace. Check: the
Performance panel's interaction to next paint is under 200 ms, and a view's content draws within 400
ms of a key or a click. [Laws of UX, Doherty threshold][laws-of-ux-doherty-threshold], [web.dev,
INP][web-dev-inp]

**Show the result first, write behind it.** An optimistic update makes a write feel instant. Check:
with the network throttled, a move or an edit shows at once, and a refusal puts it back with a
reason. [NN/g, response times][nn-g-response-times]

**Waiting shows its shape.** For 1 to 10 s, a skeleton of the coming layout beats a spinner; past 10
s, a progress indicator with what runs. Check: a slow load shows where its content will be, and
nothing jumps when it arrives. [NN/g, skeleton screens][nn-g-skeleton-screens], [progress
indicators][progress-indicators]

## Per persona

- **Tolki, the keyboard on a desktop**: keyboard and focus first, all of it; focus never hidden;
  keys learned where the action is; one key, one meaning; answers within 400 ms.
- **Lolly, the mouse on a desktop**: what can be pressed looks pressable; 24 px targets at least,
  bigger for primary actions; icons with words or tooltips; labels that say what happens; the
  human's words, no Vim or git jargon; empty states that say what to do; prefer undo to questions.
- **T3, an iPhone 13 from the home screen**: safe areas and rounded corners; a way back without the
  browser's; the field above the keyboard, at 16 px; 44 pt targets with room between them; actions
  in the thumb's reach; dynamic viewport heights; sheets that do not scroll the page.

## Where this differed from our guides

The human ruled on each, on 2026-11-05; the guides now say so.

1. **Lines longer than 90 characters.** 90 is the limit, kept by drawing prose through `Prose` and
   its measure rather than view by view; a wider page's extra room is for code and tables. The
   detail dialog's text now reads at the measure ([Reading](reading.md#line-length)).
2. **Borders everywhere.** Inside a pane, a border is a control's, and panes nest two levels deep at
   most ([Look and feel](look-and-feel.md#shapes)).
3. **Rows of short prose in the UI's monospace font.** What is written, in a field, is monospace;
   what is read, a session's messages included, is in the reading font; a list's rows stay in the UI
   font, scanned rather than read ([Reading](reading.md#three-fonts-three-jobs)).
4. **Icon-only controls.** The phone's bottom bar's tiles carry a small word under their icon
   ([the phone](phone.md#the-bottom-bar)).
5. **Empty sections disappear.** Only ongoing status panes do; what the human makes, the inbox and
   the priorities, is always there
   ([Look and feel](look-and-feel.md#every-element-earns-its-place)).
6. **Hover moves the selection.** Only a moving pointer does ([Keyboard](keyboard.md#selection)).
7. **The undo toast lasts 5 seconds.** It pauses while hovered or focused
   ([Surfaces](surfaces.md#undo)).
8. **Tabs with no room between them.** Left to a tap test on a 375 px phone, as long as the result
   is convenient and keeps the glassy terminal look ([the phone](phone.md#the-frame)).
9. **Desktop targets smaller than 24 px.** 24 px high at least, padding included, the hit area
   growing where the text stays dense
   ([Look and feel](look-and-feel.md#what-can-be-pressed-looks-pressable)).

[refactoring-ui]: https://www.refactoringui.com/
[laws-of-ux-proximity]: https://lawsofux.com/law-of-proximity/
[refactoring-ui-7-practical-tips]:
  https://medium.com/refactoring-ui/7-practical-tips-for-cheating-at-design-40c736799886
[nn-g-f-shaped-reading]: https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/
[krug-don-t-make-me-think]: https://sensible.com/dont-make-me-think/
[wcag-2-2-1-4-10-reflow]: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
[butterick-line-length]: https://practicaltypography.com/line-length.html
[butterick-line-spacing]: https://practicaltypography.com/line-spacing.html
[butterick-summary-of-key-rules]: https://practicaltypography.com/summary-of-key-rules.html
[apple-hig-accessibility]:
  https://developer.apple.com/design/human-interface-guidelines/accessibility
[wcag-2-2-1-4-4]: https://www.w3.org/TR/WCAG22/#resize-text
[wcag-2-2-1-4-12-text-spacing]: https://www.w3.org/TR/WCAG22/#text-spacing
[butterick-monospaced-fonts]: https://practicaltypography.com/monospaced-fonts.html
[wcag-2-2-1-4-3]: https://www.w3.org/TR/WCAG22/#contrast-minimum
[wcag-2-2-1-4-11-non-text-contrast]: https://www.w3.org/TR/WCAG22/#non-text-contrast
[wcag-2-2-1-4-1-use-of-color]: https://www.w3.org/TR/WCAG22/#use-of-color
[nn-g-heuristics]: https://www.nngroup.com/articles/ten-usability-heuristics/
[wcag-2-2-2-5-8-target-size]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
[android-touch-target-size]: https://support.google.com/accessibility/android/answer/7101858
[laws-of-ux-fitts-s-law]: https://lawsofux.com/fittss-law/
[nn-g-icon-usability]: https://www.nngroup.com/articles/icon-usability/
[material-3-states]: https://m3.material.io/foundations/interaction/states/overview
[nn-g-response-times]: https://www.nngroup.com/articles/response-times-3-important-limits/
[wcag-2-2-4-1-3-status-messages]: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
[inclusive-components-notifications]: https://inclusive-components.design/notifications/
[nn-g-error-messages]: https://www.nngroup.com/articles/error-message-guidelines/
[nn-g-confirmation-dialogs]: https://www.nngroup.com/articles/confirmation-dialog/
[nn-g-empty-states]: https://www.nngroup.com/articles/empty-state-interface-design/
[wcag-2-2-2-1-1-keyboard]: https://www.w3.org/TR/WCAG22/#keyboard
[wcag-2-2-2-4-7]: https://www.w3.org/TR/WCAG22/#focus-visible
[2-4-13-focus-appearance]: https://www.w3.org/TR/WCAG22/#focus-appearance
[wcag-2-2-2-4-11-focus-not-obscured]:
  https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
[wcag-2-2-2-4-3-focus-order]: https://www.w3.org/TR/WCAG22/#focus-order
[aria-apg-keyboard-interface]: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
[wcag-2-2-2-1-4]: https://www.w3.org/TR/WCAG22/#character-key-shortcuts
[aria-apg-patterns]: https://www.w3.org/WAI/ARIA/apg/patterns/
[inclusive-components-menus]: https://inclusive-components.design/menus-menu-buttons/
[superhuman-command-palette]: https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/
[lazyvim-keymaps]: https://www.lazyvim.org/keymaps
[laws-of-ux-jakob-s-law]: https://lawsofux.com/jakobs-law/
[wcag-2-2-1-4-13-content-on-hover-or-focus]: https://www.w3.org/TR/WCAG22/#content-on-hover-or-focus
[wcag-2-2-2-5-2-pointer-cancellation]: https://www.w3.org/TR/WCAG22/#pointer-cancellation
[wcag-2-2-2-5-7-dragging-movements]: https://www.w3.org/TR/WCAG22/#dragging-movements
[nn-g-tooltips]: https://www.nngroup.com/articles/tooltip-guidelines/
[webkit-designing-for-iphone-x]: https://webkit.org/blog/7929/designing-websites-for-iphone-x/
[mdn-env]: https://developer.mozilla.org/en-US/docs/Web/CSS/env
[apple-hig-layout]: https://developer.apple.com/design/human-interface-guidelines/layout
[mdn-display-mode]: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/display-mode
[mdn-visualviewport]: https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
[mdn-viewport-units]:
  https://developer.mozilla.org/en-US/docs/Web/CSS/length#viewport-percentage_lengths
[mdn-overscroll-behavior]: https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior
[material-3-easing-and-duration]:
  https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
[wcag-2-2-2-3-3]: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
[mdn-prefers-reduced-motion]:
  https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
[web-dev-cls]: https://web.dev/articles/cls
[nn-g-placeholders]: https://www.nngroup.com/articles/form-design-placeholders/
[wcag-2-2-3-3-1-error-identification]: https://www.w3.org/TR/WCAG22/#error-identification
[mdn-enterkeyhint]: https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/enterkeyhint
[nn-g-ui-copy]: https://www.nngroup.com/articles/ui-copy/
[wcag-2-2-3-2-4-consistent-identification]: https://www.w3.org/TR/WCAG22/#consistent-identification
[laws-of-ux-hick-s-law]: https://lawsofux.com/hicks-law/
[laws-of-ux-aesthetic-usability-effect]: https://lawsofux.com/aesthetic-usability-effect/
[laws-of-ux-doherty-threshold]: https://lawsofux.com/doherty-threshold/
[web-dev-inp]: https://web.dev/articles/inp
[nn-g-skeleton-screens]: https://www.nngroup.com/articles/skeleton-screens/
[progress-indicators]: https://www.nngroup.com/articles/progress-indicators/
