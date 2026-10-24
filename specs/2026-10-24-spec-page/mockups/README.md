# Mockup: the spec and plan pages in the terminal look

The [spec](../spec.md)'s layout mockup, as the [preview decision](/specs/decisions/preview.md)
allows: a clickable HTML page of the design round 01 picked. [`spec.html`](spec.html) loads its
styles, script, and data from [`spec/`](spec/). The round's prototype, with every option of each
question, is in git history, at the commit of round 01.

## What it draws

- **Two real specs**, as Uraeda's core read them: the layout-look spec as it waited for review, with
  one new decision and two changed ones, and the questions page's spec with its data model. Their
  data in [`spec/specs.js`](spec/specs.js) is generated from the core's view, not written by hand.
- **A real plan**: the questions page's, half built, in [`spec/plan.js`](spec/plan.js).
- **Live mockups**: the two features' own HTML mockups, copied into [`embeds/`](embeds/), at the
  widths their specs name. In the app, a story draws in the same frame.
- **The shell** as shipped, and the questions page's right column: one width, its tabs on top.
- **The session** is a made-up exchange. Asking puts the selected lines in its composer.

## How to look at it

The bar on top picks the page, the scheme, the frame's width (1440, your 1205 half screen, 960, or
390 for the phone), and the revision. Revision 2 marks four parts as changed since your review;
which parts changed is made up, to show the marks.

Tap any block to select it, then "Comment" or "Ask the agent". Comments gather in the Review tab.

## The stories

The built pages have their stories in Uraeda's own Storybook, drawn by the real components over
Uraeda's real server and the fixture's features, as the
[preview decision](/specs/decisions/preview.md) asks. The feature's Storybook page lists them:

- **Spec page**, in [`SpecPage.stories.tsx`](/packages/web/src/SpecPage.stories.tsx): `Waiting`, the
  spec at revision 2 with "Since your review" and its column; `Approved`, the same spec approved,
  without Review; `ReviewTab`, the column's Review tab; `SessionAsked`, the Session tab after "Ask
  the agent" on a rule of Task storage, its quote in the composer; and `DataModel`, the data model
  on its own page.
- **Plan page**, in [`PlanPage.stories.tsx`](/packages/web/src/PlanPage.stories.tsx): `AutoApproved`
  and `Waiting`, the questions page's plan in panes.
- **Decision card**, in
  [`DecisionCard.stories.tsx`](/packages/web/src/spec/DecisionCard.stories.tsx): `Change`, Task
  storage's ledger, and `New`, Repeating tasks.

Their files are the fixtures [`spec-page`](/fixtures/spec-page/) and
[`plan-page`](/fixtures/plan-page/), which the sample builders' `addSpecPages`
([`samples/features.ts`](/packages/web/samples/features.ts)) commits as features of Storybook's
repository, the screenshots', and the sandbox's sample project (`vp run sandbox`). The
[screenshots](../screenshots/) show the same views, at a phone's and a desktop's size, in Latte and
Mocha.

## What the HTML mockup is not

- Not built with Astryx, and not shipping code.
- It loads JetBrains Mono and Inter from Google Fonts; the app bundles them.
- Checked in WebKit only, at 1440, 1205, and 402 px, in Mocha.
