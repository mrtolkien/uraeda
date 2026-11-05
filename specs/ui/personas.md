# Personas

The humans the UI is built for, each a way of using it end to end. A view is finished when each of
them can do everything in it their own way. A persona walkthrough picks one of them and plays it
through the app's main flows, staying in character: what the persona cannot do their way is the
finding.

## Tolki: the keyboard, on a desktop

- **Never touches the mouse.** Every view, every action, and every step of a flow is reachable and
  readable from the keyboard alone. A step that needs the mouse, or a long run of Tab, is a bug.
- **Values efficiency and coherence**: one key means one thing everywhere, and a key learned on one
  page works the same on the next. Remembering an Uraeda shortcut should be simple: few keys,
  mnemonic, and shown where they apply.
- **Uses LazyVim every day**, and expects its habits: `j` `k` to move, `Space` as the leader, `g` to
  go, `Escape` to leave, Vim's keys in text fields. See [Keyboard](keyboard.md).

## Lolly: the mouse, on a desktop

- **Clicks through the UI**, and uses the keyboard only to type text.
- **Never uses a terminal or an IDE**: nothing assumes they know git's, Vim's, or a shell's words or
  habits. A key shown as a hint is never the only way: each has a button.
- **Needs clear buttons**: what can be clicked looks clickable, its label says what it does, and it
  is large enough to hit without aiming. See [Look and feel](look-and-feel.md).

## T3: an iPhone 13, from the home screen

- **Phone first**: an iPhone 13, 390 × 844, with the app added to the home screen and opened full
  screen, so the screen's large rounded corners at the bottom and the home indicator cut into the
  page. Nothing sits under them. See [the phone](phone.md).
- **Text input stays in view**: a field being typed in is never hidden by the keyboard, a bar, or a
  sheet, and what was typed is never lost to a scroll.
- **Buttons are simple and clear**: large enough for a thumb, spaced apart, with icons that say what
  they do, and one obvious action per step.
