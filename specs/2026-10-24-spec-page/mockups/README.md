# Prototype: the spec and plan pages in the terminal look

A throwaway prototype for round 01's questions, as the
[preview decision](/specs/decisions/preview.md) allows: [`spec.html`](spec.html), with its styles,
script, and data in [`spec/`](spec/). It is deleted when the spec is approved.

## What it draws

- **Two real specs**, as Uraeda's core read them: the layout-look spec as it waited for review, with
  one new decision and two changed ones, and the questions page's spec with its data model. Their
  data in [`spec/specs.js`](spec/specs.js) is generated from the core's view, not written by hand.
- **A real plan**: the questions page's, half built, in [`spec/plan.js`](spec/plan.js).
- **Live mockups**: the two features' own HTML mockups, copied into [`embeds/`](embeds/), stand in
  for stories, at the widths their specs name.
- **The shell** as shipped, and the right column of the questions page's spec: one width, its tabs
  on top.
- **The session** is a made-up exchange. Asking puts the selected lines in its composer.

## How to look at it

The bar on top picks the page, the scheme, the frame's width (1440, your 1205 half screen, 960, or
390 for the phone), and each question's options:

- **Decisions**: the ledger, before and after, or today's cards.
- **Frames**: a live window, device bezels, or a browser window.
- **Plan**: progress first, or the file's order.
- **Revision**: revision 2 marks four parts as changed since your review. Which parts changed is
  made up, to show the marks.

Tap any block to select it, then "Comment" or "Ask the agent". Comments gather in the Review tab.

## What it is not

- Not built with Astryx, and not shipping code.
- It loads JetBrains Mono and Inter from Google Fonts; the app bundles them.
- Checked in WebKit only, at 1440, 1205, and 402 px, in Mocha.
