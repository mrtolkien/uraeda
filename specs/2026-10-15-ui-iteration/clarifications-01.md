---
status: awaiting-human
---

# Clarifications, round 01: UI iteration flow

> [!IMPORTANT]
>
> 9 questions on visual iteration, about 40 minutes.
>
> - **A gap in the proposal.** Its "what" is choosing between variants before the code. Its "why" is
>   the small fixes after the code. The first question decides whether the feature covers both, and
>   whether it is a new kind of item or something features and changes both use.
> - **Three questions work together**: what a variant is made of, the preview environment every
>   project needs for it, and how you see interactions. Real code needs a place to run, and a
>   running app is not a file in git.
> - **Choices that last beyond this feature:**
>   - a preview environment that the skill asks of every project, as a new project decision;
>   - Uraeda's own preview environment;
>   - storing screenshots in git, which changes the attachments and UI checks decisions.
> - **The main pitfall** in every product studied is drift between the picked mockup and the code
>   built after it. What happens to a variant's code after your pick is the question that answers
>   it.
> - **15 points are settled without you**, at the end. Check these first: where unpicked variants
>   go, the spec's mockups, and how the feature works in a change.

## Context

The [proposal](proposal.md) asks for a visual flow:

- small mockups in the page;
- A/B/C picks between visual variants;
- real interfaces rather than HTML mockups;
- a stable mock environment;
- coupled with the questions or the spec.

It must work for every repository using Uraeda, whatever its stack, and for Uraeda itself, where
Astryx may be used directly. It builds on the change flow being built on the
`2026-10-15-add-bugfixing` branch.

What exists today:

- **Mockups** are static HTML pages in a spec's `mockups/` folder. They are shown in a sandboxed
  frame by [`MockupPage.tsx`](/packages/web/src/MockupPage.tsx), and a comment lands on the spec's
  line. Images cannot be mockups: the server serves text only.
- **Questions** take option letters. An image under an option is drawn small and static
  ([`Question.tsx`](/packages/web/src/Question.tsx)).
- **Screenshots** are taken for this repository only, by
  [`screenshots.ts`](/packages/web/scripts/screenshots.ts), on a fixture repository and a fake
  agent. They are committed under `screenshots/`, and shown nowhere.
- **No fixed environment** exists for a human to open. `vp run dev` serves your real repository with
  the real agent. No user project has anything similar.

Elsewhere, three things recur:

- **Variants side by side**, two to four, before code: Claude Design, Stitch, Replit, superpowers'
  visual companion, gstack.
- **Pointing at the running UI** to fix it, after code: v0, Lovable, Bolt, Cursor, Figma Make.
- **Named fixed states** where the UI runs: Storybook and its equivalents in every stack, Django's
  `testserver`, MSW.

Feedback is almost always kept by a hosted service. The main complaint is drift: the picked mockup
is rebuilt as code, and the two differ. Uraeda's own records show it twice.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: What does the feature cover, and in what shape?

The proposal says "a dedicated UI flow", then "coupled with the clarifications step, or with specs".
Its "why" is code that is "mostly good" but needs "small, targeted fixes, and visual feedback".
Cursor and v0 put visual work inside the normal loop. Stitch and Claude Design are separate places.
More in [discovery](discovery-01.md#the-shape-of-the-feature).

Why it matters: it sets the feature's size, and whether the fixes after the code, the stated "why",
are in it.

- **A (recommended). Build two abilities that features and changes both use. Before the code, a
  visual question in a round of questions, whose options are variants. After the code, a review of
  the agent's screenshots of the built UI, with your comments on them.**
  - [pro] covers both the proposal's "what" and its "why". No new kind of item to learn: a change
    with a visual question is still a change.
  - [con] the larger of the scopes that fit into existing flows. Two new views to build.
  - Why recommended: the small fixes after the code are why you wrote the proposal, and both halves
    reuse rounds and review files that exist.
- **B. A third kind of item, a "UI iteration", next to features and changes. Its own folder, branch
  prefix, and step table loop through variants, a pick, the code, and a screenshot review, until you
  approve.**
  - [pro] a dedicated place, as the proposal's first sentence says.
  - [con] a second new kind of item while the change flow is still being built. UI work inside a
    feature would not get it.
- **C. Only visual questions, before the code. Feedback on the built UI stays on the pull request,
  as today.**
  - [pro] the smallest scope.
  - [con] leaves out the small fixes the proposal's "why" names.

**Answer:**

### Q1.A: Where and how do you comment on the built UI?

Only if you picked A or B in Q1.

- **Review tools** like Chromatic, Argos, and Percy show screenshots side by side, with comments and
  approve or request changes per screen.
- **Agent tools** like Cursor, v0, and Lovable pick an element in the running app and send its code
  location to the agent. That mapping is stack-specific: a bundler plugin for JavaScript, nothing
  found for Rails, Django, or Phoenix. React 19 broke the older tools.
- **Accessibility:** no product documents a keyboard way to place a pin. Dragging an area needs a
  single-click alternative (WCAG 2.5.7).

More in [discovery](discovery-01.md#feedback-on-the-built-ui) and
[pinning](discovery-01.md#pinning-feedback).

Why it matters: it decides how precise your fixes can be, and whether the screenshot review adds a
wait before every UI pull request.

C can come on top of A or B.

- **A (recommended). In a screenshot review in the web UI, at the pull request. Each comment is
  pinned to a numbered spot or area of one screenshot, or to the whole screenshot from the keyboard.
  Submitting writes a review file that sends the branch back to the agent, like changes requested.**
  - [pro] precise enough for small fixes, on any stack. Kept in git, and no new wait: the pull
    request is already a gate.
  - [con] a spot on a picture, not an element: the agent finds the code itself.
  - Why recommended: it fits every stack, and the review happens where you already review.
- **B. The same review, as a new gate before the pull request opens: every UI change waits for it.**
  - [pro] fixes land before the pull request, so its diff is final.
  - [con] one more wait on every UI change, even one with nothing to fix.
- **C. In the running preview app, by picking an element whose code location goes to the agent,
  built for Uraeda's React stack first.**
  - [pro] the most precise: the agent gets the element's component and file.
  - [con] one integration per stack, and no keyboard path in any product studied.

**Answer:**

## Q2: What is a variant made of?

The proposal finds HTML mockups "far from the actual results". Two of Uraeda's records show
implementations that differ from their mockups. Most products rebuild a picked mockup as code, which
is where drift comes from. The fix they converge on is to use the project's real components.

Real code needs a place to run: that is the preview environment of Q3. How you see interactions is
Q5. More in [discovery](discovery-01.md#what-a-variant-is-made-of).

Why it matters: it decides how close a pick is to the result, and how much each variant costs the
agent.

- **A (recommended). Real code in the project's own components, run in its preview environment. The
  agent commits screenshots of each variant at both widths, and the link to its live state. A
  project without a preview environment falls back to B.**
  - [pro] what you pick is what gets built. Works for any stack that has a preview environment.
  - [con] the most agent time per variant, and it needs a preview environment.
  - Why recommended: it answers the proposal's main complaint, and the fallback keeps every project
    working.
- **B. Standalone HTML pages, as today, using the project's stylesheet, or a no-build page of its
  components when one exists, like Astryx's CDN template.**
  - [pro] cheap, and needs nothing from the project.
  - [con] still a copy of the UI, not the UI. Astryx's CDN page uses its neutral theme, not
    Uraeda's.
- **C. Generated images, as gstack does.**
  - [pro] fast, and good for exploring a look.
  - [con] a picture, the furthest from the result, and it needs an image model.

**Answer:**

### Q2.A: What happens to the variants' code after your pick?

Only if you picked A in Q2. Cursor's best-of-n keeps each variant as code in a worktree and applies
the one picked. Every product that rebuilds from a picture drifts. More in
[discovery](discovery-01.md#variant-code-after-the-pick).

Why it matters: it decides whether the code built after the spec starts from what you picked.

- **A (recommended). The picked variant's code stays on the branch as the starting point. The plan
  adds its tests before wiring it into the app, and the unpicked variants' code is deleted in the
  commit that reads your answer.**
  - [pro] no drift: the picked code is the code that ships.
  - [con] some code exists before the spec, and its tests come before the wiring, not before the
    drawing.
  - Why recommended: drift is the main pitfall, and the tests still come before the behaviour
    reaches users.
- **B. All variant code is deleted after the pick. The implementation rebuilds from the
  screenshots.**
  - [pro] the implementation stays fully test-first.
  - [con] the rebuild is where drift comes from.

**Answer:**

## Q3: What does the skill ask of every project, for real states?

There is no tool for every stack:

- Workbenches are per stack: Storybook covers JavaScript, Lookbook covers Rails, Phoenix has its own
  Storybook, and native apps have previews.
- MSW covers only requests made in the browser.
- Django's `testserver` and Rails seeds start the real app on fixed data.
- Figma Make on local code asks a repository for a folder of `setup`, `dev`, and `verify` scripts.

What a workflow can require is a contract. A project without a browser runner already gets a
question, from the skill's code-quality rules. More in
[discovery](discovery-01.md#a-preview-environment-in-every-project).

Why it matters: it becomes a new project decision, written in every repository using Uraeda, and it
is what makes Q2's real variants possible.

- **A (recommended). A project decision, "preview", proposed at setup like the code-quality one. It
  names one command that starts the real app on fixed data, a fixed date, and no outside services,
  and lists named states reachable at a URL. The agent adds states as features need them.**
  - [pro] real pages on any stack. Agents and humans open the same states.
  - [con] the project must write a seed and a fixed mode, and keep the seed in step with its data.
  - Why recommended: it is the only shape that works on every stack with real pages, and Uraeda
    already has most of it in its tests.
- **B. A component workbench per stack, such as Storybook, Lookbook, or SwiftUI previews, named in
  the project's decision.**
  - [pro] mature tools, with stories as fixed states.
  - [con] components rather than pages, none for some stacks, and stories drift when components
    change.
- **C. Nothing upfront. For each feature, the agent records how it reached each state, with its
  steps, network recordings, and clock.**
  - [pro] no setup.
  - [con] recordings break when the UI or the API changes, and every feature pays again.

**Answer:**

## Q4: Where do you pick between variants?

Superpowers' visual companion and gstack's board are local pages whose clicks are written to a file
outside git. Every hosted tool keeps the pick in its service. Uraeda's rounds already take letters,
combinations like "A, with C's colours", and follow-ups. The spec step forbids leaving options for
the spec's review. More in [discovery](discovery-01.md#where-the-human-picks).

Why it matters: it decides whether picks are kept in git and readable without Uraeda's tools, as
principles II and V require.

- **A (recommended). In a question of a round of questions. Each option shows its variant's
  screenshots, at both widths, and links its live state. The web UI draws visual options large and
  side by side on wide screens, stacked on a phone, and you pick by letter as for any question.**
  - [pro] in git, readable on GitHub, and answered like every other question, with comments and
    combinations.
  - [con] the questions view needs a new layout for visual options, and its functions are near their
    size limits.
  - Why recommended: it reuses the answer mechanics, and keeps picks in git.
- **B. A new file kind for variants, with its own step and its own view.**
  - [pro] a page designed only for comparing.
  - [con] a second way to answer, beside rounds.
- **C. A live board like superpowers', with the clicks written to a local file.**
  - [pro] fast within a chat.
  - [con] nothing in git, and it does not work asynchronously.

**Answer:**

## Q5: How do you see interactions, not only a still?

The proposal asks to show "interactions and true interfaces". A screenshot is still, and a running
app is not a file. Uraeda's server only serves files, and its security rules allow only its own
origin ([stack](/specs/decisions/stack.md)). With A in Q2 or A in Q3, each state has a URL in the
preview environment. More in [discovery](discovery-01.md#seeing-interactions).

Why it matters: it decides whether Uraeda runs your projects' apps, which changes the stack
decision.

- **A (recommended). The agent commits a screenshot of each step of an interaction, such as the menu
  closed, open, and the choice made. Each variant links its live state in the preview environment,
  which you start yourself to try it.**
  - [pro] readable asynchronously, and no change to Uraeda's security.
  - [con] trying it live means starting the preview environment yourself.
  - Why recommended: it keeps the stills asynchronous and the live app one command away, without
    Uraeda running project code.
- **B. Uraeda's server runs the project's preview command and embeds the app in the page.**
  - [pro] live in one click, inside the UI.
  - [con] Uraeda runs each project's code and embeds another origin: a stack decision change, and a
    process to manage per project.
- **C. Recordings, as videos or animated images, committed beside the screenshots.**
  - [pro] the motion itself, asynchronously.
  - [con] heavy files in git, and nothing to click.

**Answer:**

## Q6: What preview environment does Uraeda itself use?

The browser tests and the screenshots script already serve the UI on a fresh copy of
[`fixtures/repo`](/fixtures/repo/), with a scripted fake agent. Neither sets a fixed date, and
commit hashes change on every run. Astryx ships a hosted Storybook, and the repository has none.
With A in Q3, this is Uraeda's own "preview" decision. More in
[discovery](discovery-01.md#uraedas-own-preview-environment).

Why it matters: it is where Uraeda's variants run, and what the look-and-feel pass would use first.

- **A (recommended). A `vp run preview` task: the server and the UI over a fresh fixture repository,
  on the fake agent, with a fixed date and fixed commit dates, and named states at URLs, such as a
  round waiting, a session working, or a spec in review. The screenshots script and the browser
  tests use the same states.**
  - [pro] the real app, its real pages, and no new dependency. One set of states for previews,
    screenshots, and tests.
  - [con] a fixture repository to grow for each new state.
  - Why recommended: most of it exists, and it shows pages, not parts.
- **B. Storybook or Ladle, with stories of components built with Astryx.**
  - [pro] each component in isolation, with controls.
  - [con] a new dependency, and components rather than pages.
- **C. Both.**
  - [pro] pages and components.
  - [con] two sets of states to keep up.

**Answer:**

## Q7: Where do variant and review screenshots live?

Images you attach are committed as WebP, encoded by the core, and deleted with their folder at
finish. That is the exception to plain text that the [attachments](/specs/decisions/attachments.md)
decision justifies. This repository's screenshots are committed as PNG under `screenshots/`, by the
[UI checks](/specs/decisions/ui-checks.md) decision, which applies only here. More in
[discovery](discovery-01.md#storing-images).

Why it matters: it changes two decisions, and puts agent-made images in every project's git history.

- **A (recommended). In git, as WebP encoded by the core: variants in the folder's `mockups/`,
  review screenshots in its `screenshots/`. Both are deleted with the folder at finish. The
  attachments and UI checks decisions change to say so, for every project.**
  - [pro] the round and the review stay readable from the repository alone. One image format and one
    encoder.
  - [con] images in git history, a few hundred kilobytes per feature.
  - Why recommended: principles II and III need the pick and its evidence in git, and the
    attachments decision already accepts that cost.
- **B. Outside git, in Uraeda's data folder.**
  - [pro] a light repository.
  - [con] a round's options are unreadable from the repository, against principles II and III.

**Answer:**

## Settled without the human

- **When a question is visual**: only when you would understand it better by seeing it than reading
  it, as superpowers' test says. A question about a UI topic often stays text. Visual direction is
  already yours to decide, from [discovery.md](/skills/uraeda/references/discovery.md). See
  [discovery](discovery-01.md#superpowers-visual-companion).
- **Variants**: two to four, distinctly different, with gstack's test: if two could swap their text
  unnoticed, they are too alike. Each has a one-line tradeoff, and the recommended one comes first,
  as A. See [discovery](discovery-01.md#gstacks-design-shotgun).
- **Widths and themes**: each variant is shown at the widths and themes the project's decisions
  name: for Uraeda, 402 × 874 and 1440 × 900, light and dark.
- **Mixing variants**: an answer like "A, with C's colours" says it, as answers already can. No new
  mechanics.
- **Unpicked variants' screenshots**: they stay with the round, which is never edited, as its
  record. They leave with the folder at finish.
- **The spec's mockups**: with A in Q2, they are screenshots of the picked variant's states, and
  HTML stays for projects without a preview environment. The spec still decides the design. Choosing
  happens in a round, and spec feedback that asks for options starts one, as today. See
  [discovery](discovery-01.md#the-spec-decides-the-design).
- **Changes**: a change's round can hold a visual question, and a change's screenshots get the same
  review. A change's folder may also hold `mockups/`. "A new view is an upgrade" stays.
- **Introducing the preview environment**: with A in Q3, setup proposes the decision, and a
  discovery round on UI work asks for it once when a project lacks it, as for code quality. A "no"
  is recorded, with a date to revisit.
- **One session makes the variants**: a feature has one session, under the
  [agents](/specs/decisions/agents.md) decision. Its agent may use its own sub-agents, which the
  session reports.
- **No pixel comparisons**: the review shows images side by side, never a computed difference, under
  [UI checks](/specs/decisions/ui-checks.md).
- **Accessibility**:
  - visual options stay buttons picked by letter, from the keyboard;
  - each screenshot's alt text names its variant, state, width, and theme;
  - a spot or area always has the whole-screenshot comment as its keyboard path
    ([WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)).
- **Uraeda's variants**: with A in Q2, they are built with Astryx in the app's own code, under the
  [UI components](/specs/decisions/ui-components.md) decision.
- **Fixed runs for Uraeda**: the preview environment and the screenshots script set `URA_TODAY` and
  fixed commit dates, so states and their screenshots repeat.
- **Superpowers' companion is not reused**: it keeps nothing in git, and its options have no
  keyboard access. See [discovery](discovery-01.md#superpowers-visual-companion).
- **The change flow** is used as its spec describes. The parts of this feature that touch changes
  are built after it merges.

**Notes:**
