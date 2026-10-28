---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Leader key/shortcut map

## What

We're adding keyboard navigation for the _whole_ application.

On _desktop_, it's important that:

- The whole application can be navigated with the keyboard
- Shortcuts are easy to discover

There will be two levels of shorcuts:

- Page shortcuts: those can directly use letters like hjkl, oai, ... They are used to interact with
  the center colum, right sidebar, an active modal, ... Anything is fair game
  - Outside of the standard vim keys written above, keys should use mnemonics and be easy to
    remember: `n` for something new, `f` for files, `g` for `go` as a prefix (`gh` for go home for
    example)
- Global shortcuts: anywhere in the app, when we're not editing text, space acts as a leader key
  - Take heavy inspiration from the leader menu of Lazyvim/Helix/emacs for the _behaviour_
  - There can be top-level entries for the most used features (create inbox entry, go to global
    home, go to priorities, ...), but also nested menus (`np` for `new` then `priority`?)
  - Some of the options can open pickers, that should behave roughly like the lazyvim picker
  - Make multiple mockups for the look: I'm down for anything from down-right overlay, bottom
    overlay, modal, ... Also it should appear only after 500ms or stg, so fast usage does not flash
    the menu

We can use the statusbar at the bottom to show the most important shortcuts

It's important to design a good, robust, extensible system, and not hardcode stuff. This way we'll
be able to implement things like shortcut maps, shortcuts search, a dynamic statusbar, ...

## Why

I like keyboard navigation
