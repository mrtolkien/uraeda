# Discovery, round 01: UI iteration flow

## Summary

Visual iteration with an agent has three parts in established products:

- **Before code, choosing a direction.** Several variants side by side, one picked. Products differ
  on what a variant is: a hosted prototype (Claude Design, Stitch, Replit), an image (gstack), a
  hand-written HTML page (superpowers), or code in the real repository (Cursor's best-of-n).
- **After code, targeted fixes.** The human points at the running UI, an element or an area, and
  says what is wrong. The agent gets the element's context and a screenshot, and edits the code. v0,
  Lovable, Bolt, Cursor, Devin, Figma Make, and Builder all do it.
- **A place where the UI runs in known states.** Component workbenches (Storybook, Ladle, Rails
  previews, Phoenix Storybook, SwiftUI and Compose previews) and whole-app fixture modes (Django's
  `testserver`, MSW, seeded databases) give named, fixed states that humans open and agents
  screenshot.

Almost every product keeps the feedback and the picks in a hosted service. Only a Spec Kit community
extension commits its visual sign-off to the repository. The main complaint everywhere is drift
between the picked mockup and the code that follows it. Design-system grounding is the usual answer:
the mockup uses the project's real components.

The proposal asks for the visual part: mockups in the page, A/B/C picks between visual variants,
real interfaces rather than HTML, and a stable mock environment, for every stack, coupled with the
questions or the spec. Its "why" is about the other end: agent code that is "mostly good" but needs
"a lot of small, targeted fixes, and visual feedback".

Today, Uraeda has static HTML mockups in specs, served in a sandboxed frame, with comments landing
on the spec's line. Questions take only option letters. Screenshots are committed under
`screenshots/` for this repository only, and shown nowhere. A fixed-state environment exists only
inside the browser tests and the screenshots script. No user project has any of it.

## How other products do it

### Claude Design

- **Variants** come from a chat request, "Show me 2–3 alternative layouts", with no dedicated
  feature
  ([get started](https://support.claude.com/en/articles/14604416-get-started-with-claude-design)).
  Claude Code's artifacts document a "Compare alternatives" pattern: "four distinctly different
  layouts … as a grid with a one-line tradeoff under each"
  ([artifacts](https://code.claude.com/docs/en/artifacts)).
- **Interactive prototypes**, multi-screen, but an artifact is one self-contained page under a
  strict CSP, with no backend ([artifacts](https://code.claude.com/docs/en/artifacts)).
- **Comments on the canvas**: "Click a specific part of the canvas and request a targeted change." A
  known issue says comments "can occasionally disappear before Claude reads them"
  ([get started](https://support.claude.com/en/articles/14604416-get-started-with-claude-design)).
- **Keyboard**: a comment mode operable with Tab, Return, Escape, and F6 between areas
  ([accessibility](https://support.claude.com/en/articles/17457950)). It is the only product with a
  documented keyboard way to place a comment.
- **Stored on claude.ai**, handed to Claude Code as a bundle of files, chat, and a README
  ([tutorial](https://academy.claude.com/tutorials/using-claude-design-for-prototypes-and-ux)).
  `/design-sync` uploads a repository's React design system so designs use its real components, and
  can take hours on a large repository ([commands](https://code.claude.com/docs/en/commands)).

### v0 and Vercel comments

- **Design Mode** works on the live preview: click an element, edit its style in a panel, or
  describe a structural change, and v0 "attaches a screenshot of the selected element
  automatically". Edits stay pending until Apply, which makes a new version
  ([design mode](https://v0.app/docs/design-mode)). No variants feature is documented.
- **The repository is the source of truth**: changes go to a working branch with a preview, and
  Publish opens a pull request ([GitHub](https://v0.app/docs/github)).
- **Vercel Toolbar comments** pin to any deployment, with screenshots and threads
  ([comments](https://vercel.com/docs/comments/using-comments)). The `vercel comments` CLI lists,
  replies to, and resolves them in JSON, "for scripts and agents", but cannot create them
  ([CLI](https://vercel.com/docs/cli/comments),
  [changelog](https://vercel.com/changelog/manage-vercel-toolbar-comments-from-the-cli)). They stay
  hosted.

### Lovable

- **Four modes on the running preview**, each with a key: select elements (several with Cmd+click),
  edit text inline, draw an annotation sent as a screenshot, and comments "pinned to the element you
  clicked" ([preview toolbar](https://docs.lovable.dev/features/preview-toolbar.md)).
- **Hosted**, synced to one GitHub branch; an existing repository cannot be imported
  ([git sync](https://docs.lovable.dev/integrations/git-sync-overview.md)).

### Figma Make

- **"Annotate for agent"**: mark areas, describe the change, and the agent "applies your changes
  across all selected elements in the code". Edits are staged until applied
  ([blog](https://figma.com/blog/properties-panel-and-annotations-now-in-figma-make)).
- **On local code** (closed beta, Mac only): the repository holds a `.figma/make/` folder with
  `setup`, `install`, `dev`, and `verify` scripts. Make runs the project's own dev server, shows
  "the live, local version of the interface", and saves "each prompt that changes code" as a local
  commit ([help](https://help.figma.com/hc/en-us/articles/40775535020695),
  [blog](https://www.figma.com/blog/figma-make-now-on-your-local-code/)). It is the closest to a
  per-project preview contract.
- **Comment pins** on the Figma canvas anchor to coordinates on a top-level frame and detach when
  nested layers move (community, Figma staff answers:
  [forum](https://forum.figma.com/suggest-a-feature-11/keep-comments-pinned-to-design-elements-including-nested-17753/index14.html)).

### Google Stitch

- **Variants in parallel** through an "Agent manager", and requests like "give me three different
  menu options"; screens connect into a playable prototype. `DESIGN.md` exports the design rules as
  markdown for agents
  ([blog](https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-ai-ui-design/)).
  Hosted; the result is a prototype, not the project's app.

### Cursor and Devin

- **Cursor's Design Mode** works on the running app: click to select, Shift+drag an area, draw on a
  frozen frame. The agent gets the element's xpath, component, computed styles, props, and a
  screenshot, edits the code, and the app reloads
  ([design mode](https://cursor.com/docs/agent/design-mode)).
- **`/best-of-n`** runs one task with several models, each in its own git worktree, and "compares
  runs only"; the human applies one ([worktrees](https://cursor.com/docs/configuration/worktrees)).
  These are variants as code in the real repository, without a visual board.
- **Devin Desktop** proxies the local dev server, and "Send element" puts the clicked element in the
  prompt ([previews](https://docs.devin.ai/desktop/previews.md)).

### Replit, Onlook, Magic Patterns, and Bolt

- **Replit Canvas** puts a suggestion in a new frame next to the original. Applying it makes the
  "Agent rewrite the app's code to match", a regeneration where drift can happen
  ([canvas](https://docs.replit.com/build/design-with-canvas.md)).
- **Onlook** instruments the code "to map elements to their place in code", and offers branches to
  experiment; Next.js and Tailwind only ([repository](https://github.com/onlook-dev/onlook)).
- **Magic Patterns** has "Controls" to "compare intentional variants", inline comments on elements,
  and two-way GitHub sync
  ([features](https://www.magicpatterns.com/docs/documentation/features/overview)).
- **Bolt** batches visual edits, each marked on its element, until "Save changes". Its select tool
  walks the element tree with the arrow keys once an element is hovered
  ([visual edits](https://support.bolt.new/building/visual-edits.md)).

### Builder.io Fusion and Subframe

- **Builder Fusion** connects an existing repository and a design-system repository, and delivers
  every change as a pull request ([key concepts](https://www.builder.io/c/docs/key-concepts-fusion),
  [projects](https://www.builder.io/c/docs/fusion-projects-from-repositories)).
- **Subframe** generates code "deterministically from your designs"; keeping code and design in step
  is a re-sync, or a prompt to "update the existing page to match"
  ([exporting](https://docs.subframe.com/concepts/exporting-pages)).

### Superpowers' visual companion

Read in the repository at `skills/brainstorming/`
([visual-companion.md](https://github.com/obra/superpowers/blob/main/skills/brainstorming/visual-companion.md)).

- **Offered only when seeing helps**: "would the user understand this better by seeing it than
  reading it?" A question about a UI topic is not automatically a visual question.
- **A local server** shows the newest HTML file the agent writes. Fragments are wrapped in a frame
  with classes for A/B/C options, cards, side-by-side splits, and wireframe blocks. Two to four
  options per screen; files are never reused (`layout-v2.html`).
- **Clicks go back as JSON lines** in a `state/events` file the agent reads on its next turn. "The
  terminal message is the primary feedback."
- **Not committed**: files go to a gitignored `.superpowers/brainstorm/` folder.
- **Hand-written HTML**, "not pixel-perfect", and the options are `div`s with no keyboard access.

### gstack's design shotgun

- **3 to 8 variants as images**, with an anti-sameness test: "if someone could swap the headline
  text between two variants without noticing, they're too similar."
- **A local board** for ratings, a comment per variant, remixes ("layout from A, colors from B"),
  and Submit, which writes `feedback.json`. The approved one is saved in `approved.json` under
  `~/.gstack/`, outside the repository, then turned into HTML by another skill
  ([SKILL.md](https://github.com/garrytan/gstack/blob/main/design-shotgun/SKILL.md)).

### Spec Kit's wireframe extension

- A community extension, unverified, generates SVG wireframes into `specs/<feature>/wireframes/`,
  committed. Sign-off writes their paths into `spec.md` under `## UI Mockup`. After implementation,
  a hook takes screenshots to compare with them
  ([repository](https://github.com/TortoiseWolfe/spec-kit-extension-wireframe)). It is the only tool
  found that keeps the visual sign-off in git. Spec Kit itself and OpenSpec have nothing for UI.

### Component workbenches

Every stack has a way to render a piece of UI in a named, fixed state:

- **Storybook 10** (React, Vue, Svelte, Angular, Web Components, and others): a story "captures the
  rendered state of a UI component"; play functions script interactions; MSW mocks the network; the
  Vitest addon turns stories into tests ([stories](https://storybook.js.org/docs/writing-stories),
  [play](https://storybook.js.org/docs/writing-stories/play-function),
  [Vitest addon](https://storybook.js.org/docs/writing-tests/integrations/vitest-addon)). Its MCP
  addon, in preview, lists stories, previews them in the agent's chat, and runs their tests
  ([MCP](https://storybook.js.org/docs/ai/mcp/overview)). No server-rendered stack is supported
  ([frameworks](https://storybook.js.org/docs/get-started/frameworks)). Community sentiment: stories
  drift when components change, and it is "a net drain" without everyone's buy-in
  ([Atomic Object](https://spin.atomicobject.com/using-storybook-reconsider/)).
- **Ladle** (React, Vite) lists every story with its file in `meta.json`, and marks
  `data-storyloaded` for screenshots ([meta](https://ladle.dev/docs/meta)). **Histoire** (Vue,
  React, Svelte) calls each state a "variant" ([guide](https://histoire.dev/guide/)). **React
  Cosmos** calls them fixtures ([docs](https://reactcosmos.org/docs)).
- **Playwright 1.62** moved component testing to `*.story.*` files and a gallery page of "a few
  dozen lines" served by the project's own dev server, said to be framework-agnostic
  ([components](https://playwright.dev/docs/test-components),
  [release notes](https://playwright.dev/docs/release-notes)).
- **Server-rendered and native stacks**: Rails ViewComponent previews at
  `/rails/view_components/<component>/<preview>`
  ([previews](https://viewcomponent.org/guide/previews.html)) and Lookbook on top
  ([Lookbook](https://lookbook.build/guide)); Phoenix Storybook with page and example stories
  ([docs](https://phoenix-storybook.hexdocs.pm/PhoenixStorybook.Story.html)); Django's pattern
  library with YAML contexts ([docs](https://torchbox.github.io/django-pattern-library/)); Flutter's
  Widgetbook ([docs](https://docs.widgetbook.io/)); SwiftUI `#Preview` with `PreviewModifier` for
  shared mock data
  ([Apple](https://developer.apple.com/tutorials/data/documentation/swiftui/previews-in-xcode.json));
  Compose `@Preview` with sample-data providers, no network, and screenshot tests in alpha
  ([previews](https://developer.android.com/develop/ui/compose/tooling/previews),
  [screenshots](https://developer.android.com/studio/preview/compose-screenshot-testing)).

### Whole-app mock environments

- **Django's `testserver <fixtures>`** starts the dev server on a throwaway database loaded with
  fixtures; what the human does while browsing touches no real data
  ([django-admin](https://docs.djangoproject.com/en/stable/ref/django-admin/)).
- **Rails seeds** should be idempotent, and `db:seed:replant` reloads them
  ([guide](https://guides.rubyonrails.org/active_record_migrations.html)).
- **MSW** mocks the network in the browser and in Node, "fully environment-, framework- and
  tool-agnostic", with the same handlers in development, tests, Storybook, and "live demos". The
  worker must be started before the app renders ([docs](https://mswjs.io/docs/),
  [browser](https://mswjs.io/docs/integrations/browser)). It does not cover server-rendered pages
  (judgement).
- **Docker Compose** orders a seed service before the app with `depends_on` conditions
  ([startup order](https://docs.docker.com/compose/how-tos/startup-order/)).
- No authoritative write-up of a general "demo mode" pattern was found.

### Visual review tools

- **Chromatic** compares a pull request with its merge base, side by side, with comment threads per
  snapshot and a "UI Review" status check ([review](https://www.chromatic.com/docs/review)). Its
  diff inspector has overlay, split, strobe, and a spotlight
  ([diff inspector](https://www.chromatic.com/docs/diff-inspector)).
- **Argos** has split and single views, a changes overlay, an ARIA-tree view, keyboard shortcuts,
  and pinned markdown comments; it takes "any pipeline that produces screenshots"
  ([review a build](https://argos-ci.com/docs/learn/review-workflow/review-a-build),
  [docs](https://argos-ci.com/docs)).
- **Percy** approves or requests changes per snapshot
  ([basics](https://www.browserstack.com/docs/percy/overview/visual-testing-basics)). **Lost Pixel**
  shows before and after for designers to approve ([docs](https://docs.lost-pixel.com/user-docs)).

These review screens work without any pixel comparison: they show images side by side and collect
comments (judgement).

### What they have in common

1. **Pointing at the running UI**, not a picture: v0, Lovable, Bolt, Cursor, Devin, Figma Make,
   Onlook, Builder. The agent gets the element's context and a screenshot.
2. **A batch of small edits applied as one change**: v0's Apply, Bolt's Save changes, Figma Make's
   staged edits.
3. **Drawing or selecting an area**, not only an element: Lovable, Cursor, Figma Make.
4. **Comments pinned to an element or a spot, routed to the agent explicitly**: Lovable's send,
   Claude's "Send to Claude", Vercel's CLI for agents.
5. **Variants side by side**, two to four, distinctly different, with a short tradeoff each: Claude
   Design, Stitch, Replit, Magic Patterns, superpowers, gstack.
6. **Mixing variants**: gstack's remix, "layout from A, colors from B".
7. **The project's real components** as the fix for drift: `/design-sync`, Figma Code Connect,
   Builder's design-system repository, Storybook's MCP.
8. **Named fixed states** that the same code feeds to development, tests, review, and docs: stories,
   previews, fixtures, seeds.
9. **A ready signal before a screenshot**, and frozen time, network, and randomness.
10. **Review screens** with side by side, overlay, or toggle, and approve or request changes per
    screen.
11. **Feedback kept in a hosted service**, almost always.

### Known complaints and pitfalls

- **Drift between the mockup and the code** (community): the Claude Design to Claude Code hand-off
  means "resyncing every change by hand"
  ([Reddit mirror](https://reddit.sentinel-team.org/posts/1ujbm0s/snapshots/2026-07-03T03%3A00%3A16.73148Z)).
  Replit and Subframe confirm it in their own docs: the code is rewritten or re-synced to match.
  Uraeda's records show it too: "Commit button stays secondary where the mockup drew it primary"
  ([text inputs](/specs/done/2026-10-14-text-inputs.md)), and paths that "wrap rather than end in an
  ellipsis as the mockup showed" ([multi-repo server](/specs/done/2026-10-13-multi-repo-server.md)).
- **Pins detaching or lost**: Figma's coordinate pins; Claude Design's disappearing comments (both
  above).
- **Variants that all look alike**, and a generic "AI look" (community:
  [The Neuron](https://www.theneuron.ai/newsletter/anthropic-s-claude-design-launched-and-reddit-has-thoughts/)).
  gstack writes an explicit test against it.
- **Cost**: every variant is a generation; Lovable, Bolt, v0, and Figma charge on apply (their docs
  above), and "two to three full prompts can use up weekly Pro limits" for Claude Design (community,
  The Neuron above).
- **Edits that look saved but are not**: v0's design edits reset on refresh until applied
  (community:
  [Vercel forum](https://community.vercel.com/t/how-to-save-and-persist-edits-in-v0-design-mode/36625)).

## Standards and libraries

### Agents driving a browser

- **Playwright MCP** works from accessibility snapshots by default; its README recommends the
  Playwright CLI with skills for coding agents, for fewer tokens
  ([playwright-mcp](https://github.com/microsoft/playwright-mcp)). The CLI opens pages, clicks by
  reference, saves and loads state, and takes screenshots
  ([CLI](https://playwright.dev/docs/getting-started-cli)). It ships with Playwright since 1.62;
  this repository pins 1.63 ([`packages/web/package.json`](/packages/web/package.json)).
- **Chrome DevTools MCP** takes snapshots and screenshots in Chrome only
  ([README](https://github.com/ChromeDevTools/chrome-devtools-mcp)).
- **Claude Code's `--chrome`** drives the user's Chrome, can save screenshots, and needs a direct
  Anthropic plan ([docs](https://code.claude.com/docs/en/chrome)). The runner here starts Claude
  Code in print mode ([agents](/specs/decisions/agents.md)), so a browser the human watches is not
  part of a run (judgement).

### Mapping an element to its code

- **code-inspector-plugin** opens an element's source from a click, for Vite, webpack, and other
  bundlers, with React, Vue, Svelte, Solid, and Astro
  ([README](https://github.com/zh-lx/code-inspector)). **react-grab** copies an element with its
  component stack and source locations, in development only
  ([README](https://github.com/aidenybai/react-grab)).
- **React 19 removed `_debugSource`** ([PR 28265](https://github.com/facebook/react/pull/28265)),
  which broke click-to-component and LocatorJS
  ([issue 32574](https://github.com/facebook/react/issues/32574)); DevTools now derives sources from
  component stacks ([PR 28351](https://github.com/facebook/react/pull/28351)). `captureOwnerStack()`
  exists in development only ([react.dev](https://react.dev/reference/react/captureOwnerStack)).
- **Nothing equivalent was found for Rails, Django, or Phoenix**: an element-to-code link is
  stack-specific.

### Accessibility of picking and pinning

- **Picking among variants** is a radio group: arrow keys move and select, and each option needs a
  name, with `aria-describedby` for its details
  ([APG radio](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)). A thumbnail alone fails people who
  cannot see it.
- **Dragging** an area or a slider needs a single-pointer alternative, and keyboard support alone
  does not meet it
  ([WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)).
- **Screenshots** are complex images: a short alt and a longer description, ideally visible
  ([W3C](https://www.w3.org/WAI/tutorials/images/complex/)).
- **No product documents a keyboard-only way to pick among variants**; Claude Design alone documents
  keyboard comments.

### Fixed time, network, and data

- **Playwright's clock**: `setFixedTime` fixes `Date.now()` while timers run
  ([clock](https://playwright.dev/docs/clock)). Its network mocking fulfils routes, and replays HAR
  recordings, strict on URL, method, and body ([mock](https://playwright.dev/docs/mock)).
- **Faker** needs a seed and a reference date for stable data, and only within one version
  ([usage](https://fakerjs.dev/guide/usage.html)).
- **Uraeda's core** reads `URA_TODAY` for its date ([`today.rs`](/crates/core/src/today.rs)).

## The code

### Important reads

- **Mockups are HTML only.** The core lists a feature's mockups by the `.html` suffix
  ([`workspace.rs`](/crates/core/src/workspace.rs), around line 836), and the spec's `## Mockups`
  section by links starting with `mockups/` ([`spec.rs`](/crates/core/src/files/spec.rs), lines
  140–165). A link from the repository root is not recognised, a known follow-up
  ([code quality in the skill](/specs/done/2026-10-14-code-quality-in-the-skill.md)).
- **Mockups are served as text, sandboxed.** [`files.ts`](/packages/server/src/files.ts), lines
  79–90, reads through the core's `read_raw`, which accepts UTF-8 only
  ([`api/files.rs`](/crates/core/src/api/files.rs)), with
  `content-security-policy: sandbox allow-scripts`. PNG and WebP mockups return a 404, which the
  image attachments feature left out ([record](/specs/done/2026-10-13-image-attachments.md)). In the
  sandbox's opaque origin, module scripts and fetches to the server send `Origin: null`, which the
  guard refuses ([`guard.ts`](/packages/server/src/guard.ts)), so a mockup cannot load modules from
  the repository (judgement from the code, not tested).
- **The mockup page** ([`MockupPage.tsx`](/packages/web/src/MockupPage.tsx)) shows one mockup in an
  iframe. Its Comment lands on the spec's line that links it, or as "Mockup <name>: …": no spot in
  the mockup. [`ReviewMockups.tsx`](/packages/web/src/ReviewMockups.tsx) puts a button per mockup at
  the top of the spec's review.
- **Questions take letters only.** The core keeps `options: Vec<char>`
  ([`clarifications.rs`](/crates/core/src/files/clarifications.rs), lines 12–23, 121–127). The view
  draws each option as a raw `<button aria-pressed>` with its text, its pros and cons, and any other
  blocks under it ([`Question.tsx`](/packages/web/src/Question.tsx), lines 155–202). An image under
  an option is drawn, small and static, since a tap picks the option; an HTML link inside it would
  put a link in a button, a known follow-up
  ([UI improvements](/specs/done/2026-10-12-ui-improvements.md)).
- **Images in workflow files** come from the core's document tree, served from `/images/` for PNG,
  JPEG, GIF, and WebP only; SVG is refused ([`images.rs`](/crates/core/src/images.rs)). Raw HTML in
  a file is shown as code, never rendered ([`Blocks.tsx`](/packages/web/src/Blocks.tsx)).
- **Screenshots exist, unseen.** [`scripts/screenshots.ts`](/packages/web/scripts/screenshots.ts)
  serves the UI with Vite over a fresh copy of [`fixtures/repo`](/fixtures/repo/), on the fake
  agent, and shoots named views at 402 × 874 and 1440 × 900, light and dark, into
  `specs/<folder>/screenshots/`. Nothing in the UI lists that folder.
- **A fixed environment exists only inside tests.** The browser tests run the server inside Vite on
  a copy of the fixture repository per test, with a scripted fake agent
  ([`vite.browser.config.ts`](/packages/web/vite.browser.config.ts),
  [`fake.ts`](/packages/server/src/runner/fake.ts)). `vp run dev` serves the developer's real
  repository with the real agent ([`dev.ts`](/packages/server/scripts/dev.ts)). The browser tests
  and the screenshots script do not set `URA_TODAY`, and commit dates, hence hashes, change on every
  run.
- **Astryx 0.6.8** ships about 110 components, a hosted Storybook, and a CLI whose `template --cdn`
  writes a no-build HTML page loading Astryx from esm.sh, with the neutral theme, not Uraeda's
  (`@astryxdesign/core` and `@astryxdesign/cli` READMEs). No Storybook, Ladle, or Histoire is in the
  repository.
- **The example's mockup**,
  [`repeat.html`](/skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/mockups/repeat.html),
  is a static page of three frozen states in its own palette, at one width: the kind of mockup the
  proposal criticises.
- **Sizes in the way** ([code quality](/specs/decisions/code-quality.md): 500 lines a file, 100 a
  function): `Question` is about 90 lines, `RoundPage` 97, `ReviewPage` 99, `SettledPoints` about
  100, and `FeaturePage` is already marked. `api.rs` sits at its 859-line baseline. A visual option
  or a screenshot review grows these first.

### The proposal's path and existing actions

- **An agent proposes visual variants.** Today it can only write text options, or HTML mockups
  linked from a spec. Nothing shows variants side by side, and the skill's spec step says "The
  questions are over. Decide the design" ([spec.md](/skills/uraeda/references/spec.md), red flags).
- **The human picks one.** Today a pick is an option letter in a round; the letter flow, the
  follow-ups, and `ura answer` work for any question, visual or not.
- **The human comments on a variant or on the built UI.** Today a comment on a mockup lands on the
  spec's line; a comment on the built UI is a pull request comment, outside the repository.
- **The agent builds the picked variant.** Today it rebuilds from the HTML mockup, where drift
  happens.
- **Existing actions that meet the feature:**
  - **Changes requested on a spec** can already ask for options: the spec step starts a new round.
  - **The finish step** deletes the folder with its `mockups/`, `images/`, and `screenshots/`
    ([finish.md](/skills/uraeda/references/finish.md)); a record links no image
    ([attachments](/specs/decisions/attachments.md)).
  - **Committing a human's file** deletes the images of its folder that no file links to
    ([attachments](/specs/decisions/attachments.md)): an unpicked variant's images, if linked from
    nowhere after the answer, would go.
  - **Answering a question with "B and C: …"** already combines options, which is how a remix ("A's
    layout, B's colours") would be written.

### Overlaps with features in flight

- **Add a bugfixing/low impact change flow** (branch `2026-10-15-add-bugfixing`, spec approved, 2 of
  11 tasks built). A change is a proposal, optional rounds, code, and a pull request, in one
  session. Its rounds have no discovery file. A new view is a reason to upgrade to a feature, and a
  change's screenshots stand for mockups. It applied a change to
  [UI checks](/specs/decisions/ui-checks.md) on its branch: a UI test may guard "the expected
  behaviour stated in a change's proposal", and screenshots go in "the feature's or the change's
  folder". Its `ura check` will refuse any file in a change's folder outside `proposal.md`,
  `clarifications-NN.md`, `rulings.md`, `images/`, and `screenshots/`: whatever this feature adds to
  a change's folder must join that list.
- **Inbox** (branch `2026-10-15-add-scratchpad`, spec approved): captures notes, with screenshots,
  and triages them into drafts or changes. It touches the sidebar and the questions view, and relies
  on the same four UI decisions.
- **Look and feel pass** ([draft](/specs/drafts/look-and-feel.md), first in Now): a list of visual
  fixes to the web UI, "almost ONLY about UI". It is the first real user of a visual iteration flow,
  and works on the same views.

### Rules and their owners

- **Which files a folder holds**: the core's `FileKind` and `ura check`
  ([`workspace.rs`](/crates/core/src/workspace.rs),
  [`check/mod.rs`](/crates/core/src/check/mod.rs)). An unknown file in a feature's folder is skipped
  silently today.
- **What a question and an option are**: the skill's
  [conventions](/skills/uraeda/references/conventions.md) and
  [discovery.md](/skills/uraeda/references/discovery.md), parsed by the core's `clarifications.rs`.
- **What a mockup is**: the skill's [spec.md](/skills/uraeda/references/spec.md#mockups), listed by
  the core's `workspace.rs` and `spec.rs`.
- **Screenshots**: this repository's [UI checks](/specs/decisions/ui-checks.md) decision, taken by
  `screenshots.ts`. The skill has no rule on screenshots for other projects.
- **Images in git**: the [attachments](/specs/decisions/attachments.md) decision, encoded by the
  core only. Screenshots are written as raw PNG by `screenshots.ts`, outside that rule.
- **A browser runner**: the skill's
  [code quality](/skills/uraeda/references/code-quality.md#uis-verified-end-to-end) says "A UI story
  is only done when it works in a browser, through the real app", and adding a runner is a question
  for the human. The skill has no notion of a fixed environment, beyond the plan's test helpers
  ("rendering the app, seeding the store, setting the clock").

### Likely changes

Under every option:

- [`skills/uraeda/`](/skills/uraeda/): the rules for visual work, in
  [spec.md](/skills/uraeda/references/spec.md),
  [discovery.md](/skills/uraeda/references/discovery.md),
  [implementation.md](/skills/uraeda/references/implementation.md),
  [conventions.md](/skills/uraeda/references/conventions.md), and the change flow's `change.md`; the
  templates and the example, whose `repeat.html` is replaced.
- [`crates/core`](/crates/core/): the files a folder may hold, and images under `mockups/` or
  `screenshots/`.
- [`packages/server/src/files.ts`](/packages/server/src/files.ts): serving images from those
  folders.
- [`packages/web`](/packages/web/): the view that shows variants or screenshots, after splitting
  `Question`, `RoundPage`, or `ReviewPage`.

Depending on the options:

- **A preview environment for this repository** (see
  [Uraeda's own](#uraedas-own-preview-environment)): a `vp run` task over the fixtures and the fake
  agent, with fixed dates, shared with `screenshots.ts` and the browser tests.
- **A preview environment for every project** (see
  [every project](#a-preview-environment-in-every-project)): a new step in
  [projects.md](/skills/uraeda/references/projects.md) and a decision template, like the
  code-quality one.
- **A screenshot review** (see [feedback on the built UI](#feedback-on-the-built-ui)): a review file
  kind and its view, and the step table.
- **A new kind of item** (see [the shape](#the-shape-of-the-feature)): a folder, a branch prefix, a
  step table, as the change flow adds.
- **Decisions**: [attachments](/specs/decisions/attachments.md),
  [UI checks](/specs/decisions/ui-checks.md), and, if Uraeda runs a project's app,
  [stack](/specs/decisions/stack.md).

## The proposal

### A dedicated flow, or abilities shared by every flow

The proposal says "a dedicated UI flow", then "can be coupled with the clarifications step, or with
specs". The first reads as a new kind of item, like a change; the second as abilities that the
existing steps use. Products are split the same way: Stitch and Claude Design are separate places,
Cursor and v0 work inside the normal loop.

### The "why" is after the code, the "what" before it

The "what" is about variants and mockups, chosen before code. The "why" is about code that is
"mostly good" and needs "small, targeted fixes": feedback on the built UI. Both are covered by
products, by different tools. The proposal does not say whether both are in scope.

### HTML mockups are what the proposal criticises, and what the skill shows

"HTML-only mockups end up pretty far from the actual results." The skill already allows "a small
component in the project's own stack" as a mockup
([spec.md](/skills/uraeda/references/spec.md#mockups)), but its example is a static HTML page, and
the UI can only show HTML. Real components need the project's build and a place to run them: the
mock environment the proposal asks for.

### "A stable, fixed mock environment" for every stack

No single tool covers every stack: workbenches are per stack, MSW covers only browser requests,
native previews do not run in a browser. What a workflow can require is a contract: a command, a set
of named states, fixed data and time. Who writes it, and when, is not in the proposal.

### Interactions in a git file

"A focus on showing interactions": a screenshot is still, and a running app is not a file. Showing
an interaction asynchronously means either a live app the human opens, or a recording, or a series
of screenshots. Uraeda's server only serves files today, and its security rules allow only its own
origin ([stack](/specs/decisions/stack.md)).

### The spec decides the design

The spec step forbids listing options for the human to pick during review. A/B/C picks belong in a
round of questions, before the spec, which the proposal's "coupled with the clarifications step"
fits. "With specs to show what's planned" then means the spec's mockups are real UI.

### Not overfitting to Uraeda

The proposal's notes ask for a flow for every repository, and, separately, for Uraeda's own needs,
where Astryx may be used directly. Every rule of the skill must work for any stack; Uraeda's own
choices go in its decisions.

## Approaches

Criteria come from the proposal (real interfaces, A/B/C picks, any stack, stable environment, small
targeted fixes), the constitution ([II](/specs/CONSTITUTION.md#ii-git-and-plain-text-first): state
in git; [III](/specs/CONSTITUTION.md#iii-asynchronous-by-default): every step a commit;
[V](/specs/CONSTITUTION.md#v-tools-are-optional): works without the tools), and the active decisions
([attachments](/specs/decisions/attachments.md), [UI checks](/specs/decisions/ui-checks.md),
[UI layout](/specs/decisions/ui-layout.md), [stack](/specs/decisions/stack.md),
[agents](/specs/decisions/agents.md)).

### The shape of the feature

Whether visual iteration is a new kind of item or abilities shared by features and changes. See
[a dedicated flow](#a-dedicated-flow-or-abilities-shared-by-every-flow) and
[the why](#the-why-is-after-the-code-the-what-before-it).

| Option                                                                                     | Before code | After code | New concepts                       | Size   |
| ------------------------------------------------------------------------------------------ | ----------- | ---------- | ---------------------------------- | ------ |
| A. Abilities shared by features and changes: visual questions, and a review of screenshots | yes         | yes        | A visual option, a review file     | Large  |
| B. A third kind of item, a "UI iteration", looping variants, pick, build, review           | yes         | yes        | A kind, folder, branch, step table | Larger |
| C. Visual questions only; feedback on the built UI stays on the pull request               | yes         | no         | A visual option                    | Medium |

### What a variant is made of

How close a variant is to the result. See
[HTML mockups](#html-mockups-are-what-the-proposal-criticises-and-what-the-skill-shows) and
[drift](#known-complaints-and-pitfalls).

| Option                                                                                                       | Fidelity              | Any stack                           | Agent cost          | Needs                 |
| ------------------------------------------------------------------------------------------------------------ | --------------------- | ----------------------------------- | ------------------- | --------------------- |
| A. Real code in the project's components, shown in the preview environment, with screenshots committed       | The result itself     | Yes, through the project's contract | Highest             | A preview environment |
| B. Standalone HTML pages, as today, using the project's CSS or a CDN build of its components when one exists | Close for some stacks | Yes                                 | Low                 | Nothing               |
| C. Generated images, as gstack does                                                                          | A picture             | Yes                                 | Low, an image model | An image model        |

### Variant code after the pick

Only with option A of [what a variant is made of](#what-a-variant-is-made-of). What happens to the
code of the picked and unpicked variants.

| Option                                                                                                | Drift | Test-first                                   | Branch history           |
| ----------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------- | ------------------------ |
| A. The picked variant's code stays as the starting point; the plan adds its tests before wiring it in | None  | Tests come before wiring, not before drawing | Unpicked code deleted    |
| B. All variant code is deleted; the implementation rebuilds from the screenshots                      | Some  | Unchanged                                    | Variants only in history |

### A preview environment in every project

What the skill asks of a project for real states. See [workbenches](#component-workbenches) and
[whole-app environments](#whole-app-mock-environments).

| Option                                                                                                              | Real pages | Any stack                 | Setup                    | Upkeep                      |
| ------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------- | ------------------------ | --------------------------- |
| A. A project decision naming one command that starts the real app on fixed data and time, with named states at URLs | Yes        | Yes                       | A seed, a flag, a script | Seeds follow the data model |
| B. A component workbench per stack (Storybook, Lookbook, Phoenix Storybook, previews)                               | Components | Per stack, not everywhere | A tool and stories       | Stories drift (community)   |
| C. Nothing upfront; the agent records how it reached each state (steps, HAR, clock) for each feature                | Yes        | Yes                       | None                     | Recordings break            |

### Uraeda's own preview environment

What this repository uses. See [important reads](#important-reads).

| Option                                                                                                                          | Real pages | Reuses                                          | New dependency |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------- | -------------- |
| A. A `vp run preview` task: the server and UI over a fresh fixture repository, the fake agent, fixed dates, named states by URL | Yes        | `fixtureRepo`, the fake agent, `screenshots.ts` | None           |
| B. Storybook or Ladle, with stories of Astryx-built components                                                                  | Components | Nothing                                         | Yes            |
| C. Both                                                                                                                         | Both       | Both                                            | Yes            |

### Seeing interactions

How the human sees behaviour, not only a still. See
[interactions in a git file](#interactions-in-a-git-file).

| Option                                                                                                                 | Asynchronous            | Security                                                      | Weight in git |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------- | ------------- |
| A. Screenshots of each step of an interaction, plus a link to the live state in the preview environment the human runs | Yes, the stills         | No change                                                     | Images        |
| B. Uraeda's server runs the project's preview command and embeds it in the page                                        | Live only while running | A stack decision change: another origin, running project code | None          |
| C. Recordings, video or animated images, committed                                                                     | Yes                     | No change                                                     | Heavy         |

### Where the human picks

Where variants are shown and chosen. See [the spec decides](#the-spec-decides-the-design) and
[superpowers](#superpowers-visual-companion).

| Option                                                                                                            | In git | Without the UI     | New mechanics          |
| ----------------------------------------------------------------------------------------------------------------- | ------ | ------------------ | ---------------------- |
| A. A question in a round, each option showing its variant's screenshots; the UI draws them large and side by side | Yes    | Images in markdown | A visual option view   |
| B. A new file kind for variants, with its own step and view                                                       | Yes    | Yes                | A kind, a step, a view |
| C. A live board like superpowers', clicks written to a local file                                                 | No     | No                 | A server               |

### Feedback on the built UI

Where the human's targeted fixes go, after code. See [visual review tools](#visual-review-tools).

| Option                                                                                                                                              | Human gates | In git | Batch of fixes |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ | -------------- |
| A. A review of the screenshots in the web UI, at the pull request: comments go to a review file, which sends the branch back like changes requested | None new    | Yes    | Yes            |
| B. A new gate before the pull request: every UI work waits for a screenshot review                                                                  | One more    | Yes    | Yes            |
| C. Pull request comments only, as today                                                                                                             | None new    | No     | Yes            |

### Pinning feedback

How precisely a comment points. See [accessibility](#accessibility-of-picking-and-pinning) and
[mapping](#mapping-an-element-to-its-code).

| Option                                                                                           | Precision            | Any stack     | Keyboard                             |
| ------------------------------------------------------------------------------------------------ | -------------------- | ------------- | ------------------------------------ |
| A. A numbered spot or area on a screenshot, with a whole-screenshot comment as the keyboard path | A spot               | Yes           | Through the whole-screenshot comment |
| B. Picking an element in the live app, mapped to its code                                        | An element, its file | No, per stack | None documented anywhere             |
| C. A comment on the whole screenshot                                                             | A screen             | Yes           | Yes                                  |

### Storing images

Where variant screenshots and review screenshots live. See
[rules and their owners](#rules-and-their-owners).

| Option                                                                                                | Principle II                               | Decisions                        |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------- |
| A. WebP in git, in the folder's `mockups/` and `screenshots/`, encoded by the core, deleted at finish | An exception, justified as for attachments | Attachments and UI checks change |
| B. Outside git, in Uraeda's data folder                                                               | Breaks: state not recoverable              | A new one                        |

### Needs no choice

- **Pointing at the running UI** (what they have in common, 1): with A or C of
  [pinning](#pinning-feedback), the spot is on a screenshot of the running app; an element picker is
  option B there.
- **A batch of fixes** (2): a review file collects every comment, and the agent fixes them in one
  run, as review files work today.
- **Areas** (3): part of option A of [pinning](#pinning-feedback).
- **Comments routed to the agent** (4): a committed review file is the routing.
- **Two to four distinct variants** (5): a rule of the skill, like gstack's anti-sameness test.
- **Mixing variants** (6): an answer like "A, with C's colours" already says it.
- **Real components** (7) and **named states** (8): options of
  [what a variant is made of](#what-a-variant-is-made-of) and the preview environment.
- **A ready signal, frozen time and data** (9): part of the preview environment's contract.
- **Side-by-side review** (10): part of [where the human picks](#where-the-human-picks).
- **Hosted feedback** (11): ruled out by principles II and III.
- **Parallel variants**: one feature has one session ([agents](/specs/decisions/agents.md)); its
  agent may use its own sub-agents, which the session reports.

## Not checked

- Widgetbook's current docs (a 404) and its cloud review; SwiftUI preview requirements by Xcode
  version; Compose screenshot tests through the newer test suites.
- Storybook's `sb.mock`, its visual tests addon, and the review behind its MCP `review-create`.
- The Playwright HTML report's slider view, seen only in secondary sources.
- Codex's in-app browser: the official post returned 403; seen only in secondary reporting.
- code-inspector-plugin's internals, react-grab's source resolution, and React DevTools' "open in
  editor" (#35240).
- Figma's Code Connect docs page (a 404), Magic Patterns' Controls page (a 404), Stitch beyond its
  blog post, Subframe's variants page, Builder's branches page, and Lovable's comments page on
  re-anchoring.
- Tempo Labs, Polymet, Uizard, and Galileo: no official docs found.
- Native mobile mock environments, Phoenix and Ecto seeds, and font rendering across systems.
- Hacker News threads on Claude Design; Reddit only through one mirror.
