---
kind: feature
finished: 2026-10-16
pull-request: https://github.com/mrtolkien/uraeda/pull/21
---

# Record: UI iteration flow

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-15, finished on
> 2026-10-16, in [its pull request](https://github.com/mrtolkien/uraeda/pull/21). Its full files are
> in git: `git log -- specs/2026-10-15-ui-iteration/`.

## What and why

Agent-written code is often mostly right, but its UI needs many small, targeted fixes and visual
feedback, and HTML mockups end up "far from the actual results". The human wanted a visual way to
iterate: real, interactive mockups that "PROPERLY show how the feature will BEHAVE", shown inside
the spec, A/B/C picks between visual variants, and precise comments, for every repository using
Uraeda whatever its stack, and for Uraeda itself. Mockups became Storybook stories in the project's
own code, which Uraeda runs and embeds live, so the picked variant is the code that ships.

## Behaviour

- **Stories embedded live (US1).** A link to a stories file with `#Export`, alone in its paragraph,
  in any workflow file the UI draws, shows the story running where it is linked, from the checkout's
  Storybook; inside a sentence or a list item, or without `#Export`, it is a link. Without an active
  preview decision in the checkout, a story link is a plain link to the file. The first read of a
  checkout's story starts its Storybook ("Starting Storybook for this branch…"), with the decision's
  command run in its `preview-folder`, `{port}` a free port of 127.0.0.1, and `URAEDA_PREVIEW_BASE`
  set to `/r/<repository>/preview/<folder>/` (`main` for the main checkout). One Storybook runs per
  checkout, shared by every page. On wide screens, "Both" shows the 402 px frame unscaled beside the
  1440 px frame scaled to the space left, or the phone alone when the box is too narrow for both;
  "Phone" and "Desktop" show one. On a phone, the phone frame alone, as wide as the page, with icon
  buttons. A frame's height comes from the story's `size` message, else 560 px, and is capped at 900
  px. Stories follow Uraeda's colour mode, also after a reload. The states read "Storybook did not
  start: <last line>" or "…within 2 minutes." with "Try again", "No story “<export>” in <path> on
  this branch." with "Open in Storybook", and "This feature has no worktree, so its stories cannot
  run here."
- **Lifetime.** A read of a story or of the Storybook page is a view; an embed or page on screen
  asks again every 5 minutes. A Storybook stops after 30 minutes without a view, with its worktree,
  and with the server, its whole process group; a live update is never a view, so a forgotten tab
  does not keep one running. The server stops on SIGHUP too, and kills at its next start the
  Storybooks a crashed server left, recorded in the data folder. A story added or removed while its
  Storybook runs shows at the next ask.
- **Comments on a live story (US2).** "Pick an element" and "Comment" show only where a comment can
  go: a spec, plan, or assessment under review, an unanswered round, and a session. In pick mode,
  the project's pick script outlines the element under the pointer, clicks no longer reach the
  story, and Escape stops it; a Storybook without the script offers "Comment" only. A comment reads
  `Story <file>#<export>`, then `, <phone or desktop>, <role> “<name>”` for a picked element (the
  width only while both show, the role alone when the element has no name), then `: ` and the text.
  In a spec, it goes to the review, on the embed's line. The form outlives the story's state and
  keeps its element and text through a reload. In a review's Mockups, a story's button scrolls to
  its embed, else opens the Storybook page, or the stories file without a preview decision.
- **Variants in a round (US3).** An option's stories show under its button, in its row, never inside
  it, and options stay stacked at every width; a story nested in an option's quote or list moves out
  with its block. A comment on a variant, or on a story of the question's context, is saved at once
  after the answer's saved comment, on a line of its own, and also added after its unsaved text. In
  an answered round, a story gone from the branch reads "This variant was removed after your
  answer.", and its stories take no comment. The skill keeps the picked export and deletes the
  others in the spec's commit, and the plan starts from its component.
- **Stories in the chat (US4).** A story link alone in an agent's message shows the story, once the
  message ends, from the feature's worktree or from the main checkout for a chat; inside a sentence
  it opens the Storybook page. A comment there goes into the composer, unsent. The session's column
  and the feature's page list "Storybook" when the checkout has a preview decision.
- **The Storybook page (US5).** `/f/<folder>/storybook`, and `/storybook` for the main checkout,
  frames Storybook's own interface as tall as the window, at `?path=/story/<id>`, or at
  `?story=<path>#<export>`, which it turns into the id. Through Uraeda, it shows Storybook's list of
  stories but renders none: Storybook's dev mode pins its messages to an origin the sandboxed frame
  lacks. Without a preview decision, it reads "Nothing here.".
- **Every project with a UI (US6).** Setup proposes `specs/decisions/preview.md`: the project's own
  Storybook on its Vite builder, or a mockups Storybook in React with Astryx in `storybook/`,
  reading `specs/*/mockups/*.stories.tsx` and `specs/changes/*/mockups/*.stories.tsx`; a UI
  discovery round asks once when it is missing. Its `main.ts` is wrapped by the skill's
  `uraeda-preview.js`, which stops a webpack Storybook, and its preview loads `uraeda-pick.js`.
  `ura check` requires both fields or neither, a `preview-folder` of `.` or a relative path without
  `..`, and a `preview-command` holding `{port}`, with problems that carry no line. A change's
  folder may hold `mockups/`. Before linking a story, the agent sets the worktree up and checks each
  story renders; it links the stories it wrote or changed alone in their paragraph in its messages.
- **Uraeda's own Storybook (US7).** `packages/web/.storybook/` lists `src/**/*.stories.tsx`, with
  Uraeda's theme, its colour mode from the embedding page, and the pick script. Uraeda's real server
  runs inside Storybook over a fresh `fixtures/repo` dated 2026-10-16, on the fake agent; its fate
  client sends requests as GETs, turned back into POSTs for the fixture's endpoint only, opens its
  live stream without credentials, and that server's repository list is locked. `vp run ready`
  builds it with `storybook:build`; a type error in a story fails `ts:check`.
- **Security.** Only GET and HEAD requests and WebSocket upgrades under `/r/<repository>/preview/`
  accept `Origin: null`; every write and every other route refuses it. Until basic security, any
  website open in the human's browser can read a running preview's code through Uraeda. Storybook's
  channel is opened only as a preview, so it cannot write files: through Uraeda, saving from
  controls, creating a story, and opening a file in the editor are lost.

## Design

A planned view is a set of stories in a Storybook, which the project has or gets, and which Uraeda
runs per checkout and forwards under its own address. Each frame is sandboxed without
`allow-same-origin`, so a story's code runs as `null`, which the guard refuses everywhere but on
reads under its preview path. The core decides which links are stories; the server owns the
processes and the traffic; the web UI owns the frames.

- **The core**: story links and embeds in [`files/stories.rs`](/crates/core/src/files/stories.rs),
  carried by every file's version ([`view/version.rs`](/crates/core/src/view/version.rs)), every
  draft, and every `SpanLink`; the preview decision's fields in
  [`files/preview.rs`](/crates/core/src/files/preview.rs), checked by `ura check` and read by
  [`api/preview.rs`](/crates/core/src/api/preview.rs).
- **The preview runner**, [`preview/runner.ts`](/packages/server/src/preview/runner.ts): one
  Storybook per base path, started, polled through `index.json`, failed, and stopped as a process
  group; [`preview/groups.ts`](/packages/server/src/preview/groups.ts) records the groups to kill
  after a crash; [`preview/index.ts`](/packages/server/src/preview/index.ts) matches a link to an
  index entry by its import path and export name.
- **The preview proxy**, [`preview/proxy.ts`](/packages/server/src/preview/proxy.ts): reads and
  WebSocket upgrades only, without the path and `Origin`, the channel as `page=preview`, Vite's
  socket with its full path, hop-by-hop and `Connection`-named headers removed, `Set-Cookie` and
  `Clear-Site-Data` dropped, `Access-Control-Allow-Origin: *` and
  `Content-Security-Policy: sandbox allow-scripts allow-popups` on every answer, 503 when nothing
  runs. The [guard](/packages/server/src/guard.ts) shares its path pattern.
- **fate**: the `Story`, `Preview`, and `StoryHref` records and their reads in
  [`fate/preview.ts`](/packages/server/src/fate/preview.ts), live through
  [`live.ts`](/packages/server/src/live.ts)'s `livePreviews`.
- **The web UI**: [`StoryEmbed.tsx`](/packages/web/src/StoryEmbed.tsx) with its frames
  ([`StoryFrames.tsx`](/packages/web/src/StoryFrames.tsx)), pick mode and form
  ([`StoryPick.tsx`](/packages/web/src/StoryPick.tsx)), and comment text
  ([`storyComment.ts`](/packages/web/src/storyComment.ts)); `StoryContext` in
  [`stories.tsx`](/packages/web/src/stories.tsx), filled by each page, read by `Blocks`, `Spans`,
  `Question`, and the transcript's [`AgentStories.tsx`](/packages/web/src/AgentStories.tsx);
  [`StorybookPage.tsx`](/packages/web/src/StorybookPage.tsx).
- **The skill's Storybook files**:
  [`uraeda-preview.js`](/skills/uraeda/assets/storybook/uraeda-preview.js) sets Vite's `base`, the
  two script tags, and both live sockets under the path, and
  [`uraeda-pick.js`](/skills/uraeda/assets/storybook/uraeda-pick.js) reports ready, size, and picks;
  the [preview decision's template](/skills/uraeda/assets/templates/specs/decisions/preview.md).
- **Uraeda's Storybook**: [`main.ts`](/packages/web/.storybook/main.ts),
  [`preview.tsx`](/packages/web/.storybook/preview.tsx), the server over the fixture in
  [`fixture.ts`](/packages/web/.storybook/fixture.ts), and fate over GET in
  [`fateOverGet.ts`](/packages/web/.storybook/fateOverGet.ts); the embed's states in
  [`StoryEmbed.stories.tsx`](/packages/web/src/StoryEmbed.stories.tsx); a validation script,
  [`validate-storybook.ts`](/packages/web/scripts/validate-storybook.ts), run by hand.
- **Tests** share one fake Storybook, [`fixtures/preview/serve.mjs`](/fixtures/preview/serve.mjs),
  and one feature, `2026-10-20-sidebar-resize`.

## Questions

### Round 01

#### Q1: What does the feature cover, and in what shape?

**Answer:** A: two abilities features and changes both use; and mockups "AS PART OF THE SPECS", to
validate behaviour and UX before the code, not always with a question.

#### Q1.A: Where and how do you comment on the built UI?

**Answer:** A, but "I AM NOT LOOKING FOR SCREENSHOTS": "REAL, INTERACTIVE MOCKUPS that PROPERLY show
how the feature will BEHAVE".

#### Q2: What is a variant made of?

**Answer:** A: real code in the project's components; and, if that is too hard in a project's
language, mockups built with Astryx in Uraeda.

#### Q2.A: What happens to the variants' code after your pick?

**Answer:** A: the picked variant's code stays as the starting point, the others are deleted.

#### Q3: What does the skill ask of every project, for real states?

**Answer:** A, as an optional decision for projects with a UI only; Storybook or its equivalents
were welcome if better.

#### Q4: Where do you pick between variants?

**Answer:** A: in a question of a round, picked by letter.

#### Q5: How do you see interactions, not only a still?

**Answer:** B: Uraeda's server runs the project's preview and embeds it in the page.

#### Q6: What preview environment does Uraeda itself use?

**Answer:** B: Storybook, "a good, mature platform for this step".

#### Q7: Where do variant and review screenshots live?

**Answer:** A: in git, as WebP; with live stories, no screenshots were added in the end.

### Round 02

#### Q1: When does Uraeda render Astryx mockups itself?

**Answer:** A, but "why not use Storybook too for non-storybook stacks? We could make mocks in React
anyways": other stacks get a mockups Storybook in React with Astryx.

#### Q2: How precisely do you comment on a live mockup?

**Answer:** A: a pick mode, from a script in the project's Storybook, with a comment on the whole
story as the keyboard path.

#### Notes

- **After the code**: there is no post-pull-request flow; fixes go through the session, so the
  review of the built UI was dropped.
- **Stories are previews, not tests**: a Next entry reviews moving the UI tests to Storybook's test
  format.

### Round 03

#### Q1: How do previews stay out of other websites' reach?

**Answer:** C: keep the rules as approved until basic security, "Create a draft for the security
task and include this".

### Round 04

#### Q1: How does Storybook's full interface work inside Uraeda?

**Answer:** C: "Let's drop it for the moment, and add it as a "now" feature in priorities. We'll
take a small look at it with the changes workflow."

## Decisions

- [Preview](../decisions/preview.md), new: Uraeda's mockups and UI states are Storybook stories in
  `packages/web/src`, fed by its real server over the fixture repository, pinned, telemetry off,
  built by `vp run ready`; its frontmatter names the folder and command.
- [Stack](../decisions/stack.md), changed: the server may run a project's preview command and
  forward its reads and upgrades under `/r/<repository>/preview/<folder>/`, those paths accepting
  `Origin: null`, and the UI shows them only in sandboxed frames; then, after round 03, its
  consequence names any website open in the human's browser as able to read the previews until basic
  security.

## Changes after approval

- Revision 3 (round 03): the previews stay open to other websites until basic security, and the
  proxy's narrower edges from its first review join the details.
- Revision 4 (round 04): US5's page shows Storybook's list of stories only, until a change (R58).
- Uraeda's Storybook sends fate's requests as GETs, turned back into POSTs inside Storybook's dev
  server for the fixture's endpoint only, opens fate's live stream without credentials, and its
  server's repository list is locked (R4, R41, R47).
- The proxy sets no `frame-ancestors`, unlike the spec's details: it blocked Storybook's own story
  frame (R29).
- Storybook's channel is forwarded only as a preview's, so no website can write files through it
  (R51).
- A live update never starts or keeps a Storybook running (R22); a story added or removed while it
  runs shows at the next ask (R25).
- A Mockups button scrolls to its embed, else opens the Storybook page, or the stories file without
  a decision (R33).
- "Both" shows the phone alone where both widths do not fit (R35).
- An element picked without an accessible name is named by its role alone (R38).
- Options with stories stack at every width, and a story nested in an option leaves its button
  (R40).
- A change's folder may hold `mockups/`, and the mockups Storybook also reads
  `specs/changes/*/mockups/*.stories.tsx` (R49).
- The claude-usage record's links to deleted screenshots, fixed here, were fixed the same way on
  `main` meanwhile (R50).
- The agent sets a worktree up before linking its stories; the server runs no setup (R53).
- A reported story link is alone in its paragraph, not on a line (R54).
- A story's frame is at most 900 px tall (R55).
- A story's comment form outlives its story's state, and keeps its element (R56).
- The example's stories keep the approved spec's path, `src/tasks/RepeatMenu.stories.tsx`, and its
  plan starts from them (R57).

## Follow-ups

- Now: Storybook's full interface inside Uraeda, as a change, with
  `security.insecureIframeMessaging` under `URAEDA_PREVIEW_BASE`.
- Basic security: close the previews to other websites (a random secret in each preview path was
  considered), and strip `Cookie` and `Authorization` from forwarded requests once it adds a
  session.
- `ura clean` is noticed by the 60 s sweep, not at once.
- `stopAll` can wait on a process that left its group.
- The 2-minute runner test runs on a frozen clock.
- Each `Story` read fetches the whole `index.json`.
- Export names are limited to ASCII identifiers, as documented.
- The Mockups scroll may stop holding before a cold Storybook grows the embeds above.
- Duplicated small decisions: the sandbox string, the starting texts, `MAIN` and `MAIN_CHECKOUT`,
  the Storybook page's URL built on both sides, and the test helpers `WAIT` and `alive`.
- fate's re-read of a runner update counts as a view, up to about 2 minutes past the 30.
- The Storybook page re-measures only on `childList` changes.
- The agent's paragraph drops Astryx's paragraph theme hook.
- Switching Phone and Desktop reloads a frame.
- The narrow screen's bleed assumes the page's inset.
- Skill nits: the helper's header says import where `projects.md` says copy; "`ura init` does it"
  wording; `change.md` does not link visual questions; discovery and spec sessions are not told to
  link stories in messages; `AGENTS.md`'s layout omits `assets/storybook/`; `conventions.md` says
  "file and line" though preview problems have no line.
- `structure.rs`'s baselines for `api.rs` and `document.rs` could be lowered.
- Review moving the UI tests to Storybook's test format (Next).
