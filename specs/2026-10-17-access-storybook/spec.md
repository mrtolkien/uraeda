---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: high
plan-review: false
---

# Spec: Storybook's full interface in Uraeda

> [!IMPORTANT]
>
> Spec to review, about 8 minutes.
>
> - **A Storybook guard is relaxed, in every project Uraeda previews.** The skill's helper turns on
>   `security.insecureIframeMessaging` when Uraeda serves a Storybook. Storybook's interface then
>   accepts messages from any window that can reach it. Through Uraeda, those are only your own
>   pages and the stories it runs. In plain words, a story's code can make the interface show
>   another story or change its controls, nothing more. Storybook's own port, outside Uraeda, keeps
>   its defaults.
> - **Changed decision, [stack](../decisions/stack.md)**: a new rule keeps Storybook's file writes
>   off through Uraeda. Saving from controls, creating a story, and opening a file in an editor fail
>   with Storybook's own errors. Its consequences say what the interface can do.
> - **Risk tier `high`**: the change touches a security setting, though the code is a few lines. The
>   plan does not wait for your review.
> - **One check is left for the plan's first task**: that a Storybook older than 10.6.2 ignores the
>   setting. It is unverified. If it fails, the helper sets the setting only on 10.6.2 and later.

Uraeda's Storybook page frames Storybook's full interface for a checkout, but it renders no story,
since Storybook 10.6.2 pins its messages to an origin that Uraeda's sandboxed frame lacks. The
[proposal](proposal.md) asks for the full interface. The [discovery](discovery-01.md) found that one
Storybook setting fixes it, and that basic security's frame secret removes the threat that setting
guards against. The [clarifications](clarifications-01.md) chose that setting, set by the skill's
helper for every project, with file writes kept off.

## User stories

### US1: Use Storybook's interface through Uraeda (P1)

The human opens a checkout's Storybook page, from a feature's page, a session, or an embed's "Open
in Storybook", and uses Storybook as on its own screen: they pick stories, change their controls,
and watch the agent's edits arrive.

Why this priority: it is the feature; the page shows nothing useful without it.

Acceptance scenarios:

1. **Given** Uraeda's own Storybook running for a feature's worktree, **When** the human opens
   `/f/<folder>/storybook?path=/story/storyembed--ready`, **Then** Storybook's canvas shows the
   `Ready` story of `StoryEmbed.stories.tsx`, with its "Dragging the handle" story, and no "Content
   is loading…" over it.
2. **Given** that page, **When** the human picks "Removed" under "StoryEmbed" in Storybook's
   sidebar, **Then** the canvas shows "This variant was removed after your answer.", and the
   controls panel lists its `folder`, `removed`, and `story` args.
3. **Given** the `Removed` story shown, **When** the human turns its `removed` control off, **Then**
   the canvas shows "No story “Resizing” in packages/web/src/SidebarHandle.stories.tsx on this
   branch." without a reload, as the `Missing` story does.
4. **Given** that page open, **When** the agent adds an export to `StoryEmbed.stories.tsx` in the
   worktree, **Then** the sidebar lists it without a reload, and picking it renders it.
5. **Given** that page open, **When** the human signs out everywhere and signs in again, **Then**
   the page shows "Starting Storybook for this branch…", then Storybook's interface again, under the
   new frame secret, with stories rendering.

### US2: Every project's Storybook page works (P2)

A project that Uraeda previews, through the helper its `main.ts` already wraps, gets a working
Storybook page at its next Storybook start, with no change of its own.

Why this priority: the page exists for every project with a preview decision; Uraeda's own Storybook
is one of them.

Acceptance scenarios:

1. **Given** a Storybook config wrapped by `uraeda-preview.js`, **When** `URAEDA_PREVIEW_BASE` is
   `/r/uraeda/preview/s/main/`, **Then** the config it returns has
   `security.insecureIframeMessaging: true`.
2. **Given** a config with `security: { insecureRemoteIframeEmbed: true }`, **When**
   `URAEDA_PREVIEW_BASE` is set, **Then** the returned config's `security` keeps
   `insecureRemoteIframeEmbed: true` and adds `insecureIframeMessaging: true`.
3. **Given** the same config, **When** `URAEDA_PREVIEW_BASE` is unset, **Then** the helper returns
   the config unchanged, without `insecureIframeMessaging`.

## Edge cases

- **Saving a story from its controls**: Storybook shows "Failed to save story", and no file of the
  worktree changes: the proxy still sends Storybook's channel as a preview's.
- **Creating a story and the "+" dialog's search**: the search finds no component, and nothing is
  created, for the same reason.
- **Opening a file in the editor**: nothing opens on the machine running Uraeda.
- **A story's own code opening Storybook's channel as the interface**: the proxy sends it as a
  preview's too, so it writes nothing.
- **Embeds**: unchanged. They load one story frame alone, and their messages to Uraeda's page go
  through the pick script, as before.
- **Colour mode**: stories in the interface follow the system's colour mode, like Storybook's own
  screen; Uraeda sends its mode only to embeds.
- **Interactions' step-by-step debugger**: it reads "Debugger controls are not available on composed
  Storybooks", since the story frame shares no origin with the interface; the steps and their
  results still show.
- **A Storybook that is starting, failed, or missing a story**: the page's states do not change:
  "Starting Storybook for this branch…", "Storybook did not start: <last line>" with "Try again",
  and "No story “<export>” in <path> on this branch." with "Open in Storybook".
- **A Storybook older than 10.6.2**: it pins nothing, and is expected to ignore the setting
  (unverified, see the block).
- **`storybook dev` run by hand, on its own port**: the helper changes nothing without
  `URAEDA_PREVIEW_BASE`, so Storybook keeps its origin checks and its refusal to be framed.
- **A phone's width**: the interface uses Storybook's own narrow layout, inside the page's frame.

## Success criteria

- **SC-001**: In WebKit, through Uraeda's address, the Storybook page's canvas shows the `Ready`
  story's "Dragging the handle" within 30 seconds of a warm Storybook being ready.
- **SC-002**: A save from controls through Uraeda leaves every file of the worktree unchanged.
- **SC-003**: The helper sets the setting only when `URAEDA_PREVIEW_BASE` is set, and keeps every
  other key of the project's `security`.

## Architecture

The fix is one setting, in the one place that already adapts every project's Storybook to Uraeda:
the skill's helper, [`uraeda-preview.js`](/skills/uraeda/assets/storybook/uraeda-preview.js). It
already changes the config only when Uraeda runs the Storybook, which it knows from
`URAEDA_PREVIEW_BASE`. Under that variable, it now also sets `security.insecureIframeMessaging`, so
Storybook's interface and its story frame post their messages to `*` instead of to an origin that a
sandboxed frame never has ([iframe messaging](discovery-01.md#storybook-1062s-iframe-messaging),
[Q1 and Q1.A](clarifications-01.md#q1-how-should-the-storybook-page-render-stories)).

Nothing else moves. The page's frame stays sandboxed without `allow-same-origin`, the proxy keeps
its headers and its channel rule, and the guard keeps its frame secret. The channel rule, which
keeps file writes off, becomes a rule of the [stack](../decisions/stack.md) decision, so no later
feature turns it on to get "all of Storybook's features" without asking
([Q2](clarifications-01.md#q2-can-you-save-stories-and-create-them-from-storybooks-interface),
[the channel's roles](discovery-01.md#storybooks-server-channel-and-its-roles)).

Rules and their homes:

- Which settings a Storybook served by Uraeda gets: `uraedaPreview` in `uraeda-preview.js`, alone.
- Which channel role reaches Storybook: `upstreamSearch` in
  [`proxy.ts`](/packages/server/src/preview/proxy.ts), alone, unchanged.

The tradeoff: Storybook's interface trusts any window that reaches it, which through Uraeda means
Uraeda's own pages and the stories it runs, against a page that works with no new server, origin, or
proxy code ([worth it](discovery-01.md#worth-it-and-feasibility)).

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- **This stays a feature**, as it was started, with a short spec and plan.
- **Embeds do not change.**
- **Stories in the full interface follow the system's colour mode.**
- **The hand validation script also opens the Storybook page's interface** through Uraeda in WebKit,
  and checks a story renders in its canvas.
- **Older Storybooks need nothing**: the plan's first task checks that one ignores the setting.
- **The interface on a phone's width** is Storybook's own layout; the plan checks it, and anything
  broken there becomes a follow-up.

Settled while writing the spec:

- **The helper merges into the project's `security`** rather than replacing it, so a project's own
  security settings survive. A `security` written as a preset function is called first, as the
  helper already does for `managerHead`.
- **No mockup**: Uraeda's page does not change; the change is that Storybook's own interface renders
  inside it.
- **The helper's header comment** names the setting and why it is safe behind Uraeda, so a project
  reading its `main.ts` wrapper knows what it gets.
- **The UI iteration record's US5 line**, "renders none", stays as it is: a record is history, and
  this feature's own record will say what changed.

## Decisions

Changed:

- [Stack](../decisions/stack.md#proposed-change-2026-10-17-access-storybook): the preview rule adds
  that the proxy forwards Storybook's channel only as a preview's, so no frame can write files
  through Storybook; its consequences add what Storybook's interface can and cannot do through
  Uraeda.

Relied on:

- [Sign-in](../decisions/sign-in.md): the frame secret in preview paths is what keeps other websites
  away from the interface, now that it accepts any sender.
- [Preview](../decisions/preview.md): Uraeda's `main.ts` is wrapped by the helper, so Uraeda's own
  Storybook gets the setting with no change of its own.

## Constitution check

| Principle                                  | Check                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| I. Humans stay in control                  | The setting and the kept file rule were the human's picks; the rule becomes a decision. |
| II. Git and plain text first               | No new state; the setting lives in the helper's code.                                   |
| III. Asynchronous by default               | No workflow step changes.                                                               |
| IV. Review effort matches impact           | The relaxed guard is said as what a story's code can do, in the block.                  |
| V. Tools are optional                      | A project without Uraeda runs `storybook dev` unchanged.                                |
| VI. Code is checked and stays maintainable | Each scenario has a test; one home per rule; no file grows past its limits.             |

## Risk tier

`high`: it changes a security setting of every project Uraeda previews, though the code is a few
lines and no data changes.

## Details

### Data

None. The setting is part of the config object the helper returns to Storybook:
`security: { ...projectSecurity, insecureIframeMessaging: true }`, only under `URAEDA_PREVIEW_BASE`.

### Components

- **`uraeda-preview.js`**: under `URAEDA_PREVIEW_BASE`, the returned config also has `security`, the
  project's own `security` (its value, or what its preset function returns) with
  `insecureIframeMessaging: true`. Its JSDoc types gain `security` on `StorybookConfig` and on the
  return type. The header says: "Under Uraeda, it also turns on Storybook's
  `security.insecureIframeMessaging`: Uraeda shows Storybook's interface in a sandboxed frame, which
  has no origin of its own, and only Uraeda's pages, which hold the preview path's secret, can reach
  it."
- **`StorybookPage.tsx`**: unchanged. Its header comment's "in one frame sandboxed without
  `allow-same-origin`" stays true.
- **`proxy.ts`**: unchanged. `upstreamSearch`'s comment links the stack decision's rule.
- **`validate-storybook.ts`**: after its embed checks, it opens the Storybook page's interface,
  `<base>?path=/story/storyembed--ready`, through Uraeda in WebKit, and checks that the canvas's
  story frame shows "Dragging the handle", printing
  `PASS the Storybook page's canvas shows the Ready story`.

### Error handling

No new failure. Storybook's own errors stay as Storybook shows them: "Failed to save story" for a
save, an empty search for "+". A Storybook that fails to start shows the page's existing states.

### Testing

The helper's behaviour is covered by its table-driven Vitest test, `storybook-preview.test.ts`, one
row per config and variable. The real Storybook in a real browser is checked by the hand validation
script, as for embeds: `vp test` runs a fake Storybook that pins no origin.

| Scenario, edge case, or criterion               | Test                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| US1.1, SC-001                                   | `validate-storybook.ts`: the page's canvas shows "Dragging the handle", in WebKit        |
| US1.2, US1.3, US1.4                             | `validate-storybook.ts`: pick `Removed`, turn `removed` off, add an export and see it    |
| US1.5                                           | Existing: `frames.test.ts`, "a sign-out replaces the secret and restarts the Storybooks" |
| US2.1, US2.2, US2.3, SC-003                     | `storybook-preview.test.ts`: rows for set, merged, preset function, and unset            |
| Saving, creating, a story's own channel, SC-002 | Existing: `proxy.test.ts` sends every channel upgrade as `page=preview`                  |
| Embeds, colour mode                             | Existing: the embed and `storybook-mode` tests, unchanged                                |
| A Storybook older than 10.6.2                   | Plan's first task: start one with the setting, by hand, and record the result            |
| A phone's width                                 | Plan's check: the page at 402 px in WebKit, by hand                                      |
| Interactions' debugger, starting states         | Existing behaviour, unchanged: no new test                                               |
