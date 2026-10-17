# Discovery, round 01: Storybook's full interface in Uraeda

## Summary

Uraeda's Storybook page, `/f/<folder>/storybook`, frames Storybook's own interface (its sidebar,
canvas, controls, and addon panels) in a frame sandboxed without `allow-same-origin`. It lists the
stories but renders none. Story embeds load one story frame without Storybook's interface, and they
work. The proposal asks for the full interface, and wonders whether basic security makes it simpler.

The cause is one Storybook setting. Since 10.6.2, Storybook's interface and its story frame address
their messages to their expected origin. A sandboxed frame's origin is `null`, so the browser drops
them. `security.insecureIframeMessaging` turns this pinning off. A throwaway experiment turned it on
behind a copy of Uraeda's proxy, in Chromium and WebKit. Stories rendered, controls filled and
updated the story, navigation, Actions, Interactions, and hot reload worked. Storybook added the
pinning against a malicious website that frames a running Storybook. Uraeda's preview paths now hold
the frame secret of basic security, and Storybook's own port refuses to be framed, so no other
website can reach that position. This is what basic security changes.

The interface's file writes are a second, separate topic: saving a story from its controls, creating
a story, the "+" dialog's file search, and opening a file in the editor. Uraeda's proxy turns them
off on purpose (R51 of the UI iteration flow), and the experiment confirmed that saving works once
the proxy lets them through. The proxy cannot tell Storybook's interface from a story's code, so
letting the interface write also lets every story write.

## How other products do it

### Storybook's own guidance

- The 10.6.2 migration notes say the interface now accepts messages only from its own story frames,
  and the story frame only from its own origin or a `localhost` interface. They name the threat:
  "prevents a malicious website from embedding your Storybook and exchanging messages with it". The
  advice is to compose a built Storybook, else to set `security.insecureIframeMessaging: true`, as
  "any website that embeds your Storybook can exchange messages with it. Avoid leaving it on for
  longer than strictly necessary"
  ([MIGRATION.md, "From version 10.6.1 to 10.6.2"](https://raw.githubusercontent.com/storybookjs/storybook/next/MIGRATION.md)).
- The advisory behind it,
  [GHSA-f2ph-cmg5-wxc8](https://github.com/storybookjs/storybook/security/advisories/GHSA-f2ph-cmg5-wxc8)
  (critical, 9.4), describes a website driving a running dev Storybook into changing story files.
  Its fixes: dev mode refuses to be framed by other sites
  (`Content-Security-Policy: frame-ancestors 'self' http://localhost:* …`, turned off by
  `security.insecureRemoteIframeEmbed`), messages pinned to their origin, and a narrower `highlight`
  event. They shipped in [10.6.2](https://github.com/storybookjs/storybook/releases/tag/v10.6.2),
  [PR #36726](https://github.com/storybookjs/storybook/pull/36726).
- The same release fixed
  [GHSA-px85-f4q5-jh77](https://github.com/storybookjs/storybook/security/advisories/GHSA-px85-f4q5-jh77)
  (high, 8.7): any client that can read the dev server's HTML gets its channel token. Storybook now
  binds to `127.0.0.1` by default, and saving from controls writes only serialized args and titles,
  never a `play` function.
- An earlier advisory,
  [GHSA-mjf5-7g4m-gx5w / CVE-2026-27148](https://github.com/storybookjs/storybook/security/advisories/GHSA-mjf5-7g4m-gx5w),
  let any website open the channel that creates and saves stories. Storybook answered with a token
  in the channel's address.

### Chromatic

- Chromatic frames only built Storybooks, each on its own subdomain,
  `https://<branch>--<appid>.chromatic.com`, apart from the app that frames it
  ([permalinks](https://www.chromatic.com/docs/permalinks),
  [canvas load failures](https://www.chromatic.com/docs/faq/storybook-chromatic-canvas-load-failure)).

### Hosts of untrusted UI

- Google serves user content from a separate sandbox domain, with a random subdomain per item. It
  calls `CSP: sandbox` alone "likely a sufficient solution" only when Spectre and renderer bugs are
  outside the threat model ([web.dev](https://web.dev/articles/securely-hosting-user-data)).
- GitHub serves raw user content from its own domain, to keep scripts off github.com
  ([GitHub's CSP journey](https://github.blog/engineering/githubs-csp-journey/)).
- The MCP Apps specification requires a host's sandbox to have another origin than the host
  ([MCP Apps, 2026-01-26](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)).
- CodeSandbox gives each sandbox its own domain, and VS Code each webview its own origin: seen only
  in search snippets, see [Not checked](#not-checked).

### What they have in common

- Untrusted UI runs on another origin than the app that frames it: a subdomain, or a sandbox without
  its own origin, as Uraeda does.
- A hosted Storybook is a built one. Nobody found frames a live dev Storybook in another app.
- Users of Storybook's interface expect what Storybook's own screen has: the sidebar and search, the
  canvas, controls, toolbar globals (backgrounds, viewport), addon panels, docs, hot reload, and the
  writes listed under [the channel's roles](#storybooks-server-channel-and-its-roles).

## Standards and libraries

### Storybook 10.6.2's iframe messaging

Read in the installed `storybook/dist/`, and checked by the experiment:

- The key is `security: { insecureIframeMessaging: true }` in `main.ts`, with no environment
  variable (`chunk-DY6-qCWl.d.ts`, lines 9376–9404). The manager's builder injects it as
  `INSECURE_IFRAME_MESSAGING` (`_node-chunks/builder-manager-7PMD5P2I.js`, line 1413), and
  `@storybook/builder-vite` writes it into `iframe.html` (`dist/index.js`, line 381).
- `PostMessageTransport` pins origins when `CONFIG_TYPE` is `DEVELOPMENT` and the flag is off
  (`channels/index.js`, line 104). The interface computes its story frame's origin from the frame's
  `src`, which gives Uraeda's address, never `null` (lines 184–194), so the browser drops every
  message to a sandboxed frame. It also refuses messages from a `null` origin (lines 223–238).
- A story frame whose own origin is `null` already accepts any message (lines 89–97). Only the
  interface's side fails: a gap in Storybook's handling of sandboxed origins (judgement).
- With the flag, the interface posts with `*` and accepts any sender (lines 213–215), not only its
  own story frames.

### Storybook's server channel and its roles

Read in `core-server/index.js`, lines 8651 and 8735–8790, and checked by the experiment:

- The channel is a WebSocket at `/storybook-server-channel?token=<token>&page=<page>`. The token is
  per process, and is written into both the interface's `index.html` and the story frame's
  `iframe.html`, so a story's code can read it.
- `page` is the role the client claims, `manager` or `preview`. Storybook trusts it as given. Only
  the `manager` role may send `SAVE_STORY_REQUEST`, `CREATE_NEW_STORYFILE_REQUEST`,
  `FILE_COMPONENT_SEARCH_REQUEST`, `GHOST_STORIES_REQUEST`, and `OPEN_IN_EDITOR_REQUEST`.
- `OPEN_IN_EDITOR_REQUEST` runs `launch-editor` on the machine running Storybook, for any file path
  it is given (`core-server/presets/common-preset.js`, line 1565).
- Saving a story stays inside the project's root since 10.6.2; a symlink in the project may still
  lead out, as the automated review of
  [PR #36726](https://github.com/storybookjs/storybook/pull/36726) noted without a fix.

### Sandboxed frames

- A frame with both `allow-scripts` and `allow-same-origin`, on the framing page's own origin, can
  remove its own sandbox: "no more secure than not using the sandbox attribute at all"
  ([MDN, iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)).
  Chromium warns about it in the console, as the experiment saw.
- A nested frame inherits its parent's sandbox
  ([HTML, sandboxing](https://html.spec.whatwg.org/multipage/browsers.html), read in part): the
  story frame inside Storybook's interface is `null` too.
- `credentialless` frames are not an isolation boundary, and Safari and Firefox lack them
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/Security/IFrame_credentialless),
  [caniuse](https://caniuse.com/mdn-html_elements_iframe_credentialless)).

## The code

### Important reads

- [`StorybookPage.tsx`](/packages/web/src/StorybookPage.tsx) frames the interface with
  `sandbox="allow-scripts allow-popups"`. Nothing in it needs to change for the interface to work.
- [`uraeda-preview.js`](/skills/uraeda/assets/storybook/uraeda-preview.js) wraps every project's
  `main.ts` and changes the config only when `URAEDA_PREVIEW_BASE` is set, so only a Storybook that
  Uraeda serves. It already sets `managerHead`, `previewHead`, and `viteFinal` there.
- [`proxy.ts`](/packages/server/src/preview/proxy.ts) replaces Storybook's
  `Content-Security-Policy`, its `frame-ancestors` included (R29), with
  `sandbox allow-scripts allow-popups`, drops `Origin` from upgrades, and sends every channel
  upgrade as `page=preview` (`upstreamSearch`, R51 of
  [the UI iteration flow](/specs/done/2026-10-15-ui-iteration.md)).
- R51's reason was that any website could read a story's page, and so its token, through Uraeda. The
  frame secret of [basic security](/specs/done/2026-10-16-basic-security.md) closed that: a preview
  path without the current secret is a 404 ([`frames.ts`](/packages/server/src/sign-in/frames.ts),
  [`guard.ts`](/packages/server/src/guard.ts)).
- [`preview.tsx`](/packages/web/.storybook/preview.tsx) takes the colour mode only from
  `window.parent`. In the full interface, a story's parent is Storybook's interface, so stories
  there follow the system's mode, as on Storybook's own screen.
- [`validate-storybook.ts`](/packages/web/scripts/validate-storybook.ts), run by hand, opens one
  story frame through Uraeda in WebKit. It does not open the interface, which is why the browser
  tests, on a fake Storybook that pins nothing, never caught the blank canvas.
- `git log` on these files: the proxy's channel rule came in `5626a9a`, the frame secret in
  `24a011c`.

### The proposal's path and existing actions

- "Open in Storybook" on an embed's missing story, the Storybook rows of a feature's page and of a
  session's column, and a story link inside a sentence all lead to the Storybook page. They work
  today and do not change.
- Embeds load `iframe.html` alone. The flag changes nothing there: their messages to Uraeda's page
  go through the pick script, not Storybook's channel.
- Signing out replaces the frame secret and restarts the Storybooks: an open Storybook page then
  reads its record again under the new address, as embeds do.
- Interactions shows its steps, but its step-by-step debugger reads "not available on composed
  Storybooks": it needs `window.parent` on the same origin (experiment; `preview/runtime.js`, lines
  17030–17041).

### Rules and their owners

- The sandbox of frames: [stack decision](/specs/decisions/stack.md), owned by `SANDBOX` in
  `StorybookPage.tsx`, `StoryFrames.tsx`, and `proxy.ts`.
- Which Storybook roles reach the channel: `upstreamSearch` in `proxy.ts` alone.
- How a project's Storybook is configured for Uraeda: `uraeda-preview.js` alone, for every project.

### Likely changes

- With the flag in the helper: `uraeda-preview.js` and its test, the validation script opening the
  interface and checking a story renders, the helper's header, and the record's US5 wording.
- With the flag in Uraeda's own `main.ts` only: `packages/web/.storybook/main.ts` instead of the
  helper.
- With file writes through the proxy: `upstreamSearch` in `proxy.ts`, its test, and the stack
  decision's consequence on what a story's code can do.
- With a separate origin for previews: a second listener in the server, the proxy, the guard, the
  sign-in decision's frame rules, the stack decision, and every frame's `src`.

## The proposal

### "It might be simpler now"

It is: basic security's frame secret removes the threat Storybook's flag guards against, and the
change is a setting, not a new design. See [worth it](#worth-it-and-feasibility).

### "All of Storybook's features"

The proposal's why asks for "all of storybooks features". The writes are the part that the frame
secret does not settle, and that a scope question has to: see
[file writes](#file-writes-from-the-interface).

### A change or a feature

Round 04's answer planned "a small look at it with the changes workflow", and the proposal says
"look at it as a change". It was started as a feature, with `discovery: high`.

## Worth it and feasibility

- **Cost**: a few lines in the helper, a test, and a validation step. No new dependency.
- **Gain**: Storybook's interface through Uraeda, from a phone or a laptop over the tailnet, where
  Storybook's own port, bound to 127.0.0.1, cannot be reached.
- **Outside behaviour, checked**: the experiment ran Uraeda's own Storybook 10.6.2 behind a copy of
  the proxy, sandboxed in the frame and by the header, in Chromium and WebKit. Off: the canvas stays
  on "Content is loading…", with "The target origin provided ('http://127.0.0.1:7100') does not
  match the recipient window's origin ('null')". On: stories render, controls update them, the
  sidebar navigates, a play function runs, Actions shows, and both a new story and a component edit
  show without a reload. A warm load takes about 2 s and 240 requests; a cold one 5 to 15 s.
- **Not checked**: the interface's layout on a phone's width, and docs pages, as Uraeda's Storybook
  has no docs entries.
- **Guards relaxed by the flag**: the interface accepts messages from any window that can reach it.
  Through Uraeda, only Uraeda's page, which frames it, and the stories it runs can. Other websites
  would need the frame secret, and Storybook's own port refuses to be framed. In plain words: a
  story's code could make Storybook's interface show another story or change its controls, which it
  can already do from inside its own frame.
- **Guards relaxed by file writes**: any story's code, including any package a story imports, could
  overwrite or create story files in the feature's worktree, and open any file of the machine in an
  editor on the machine running Uraeda.
- **Guards relaxed by dropping the sandbox**: any story's code, including any package it imports,
  could act as you in Uraeda: approve specs, answer rounds, start agents, read every repository.

## Approaches

### Rendering stories in the interface

| Option                                                                                               | Works through Uraeda | Cost         | What a story's code can do               |
| ---------------------------------------------------------------------------------------------------- | -------------------- | ------------ | ---------------------------------------- |
| A. Turn on `insecureIframeMessaging` when Uraeda serves the Storybook                                | Yes, checked         | A few lines  | Unchanged                                |
| B. Serve previews from a second origin, a second port, and frame them with `allow-same-origin` there | Yes, not checked     | A new server | Unchanged, but a second address to proxy |
| C. Drop the sandbox of the Storybook page's frame                                                    | Yes, checked         | A few lines  | Act as you in Uraeda                     |
| D. Keep the page as it is, list only                                                                 | No                   | None         | Unchanged                                |

B also needs the reverse proxy or `tailscale serve` to publish a second port, and Uraeda's cookie
reaches every port of the host
([basic security's follow-ups](/specs/done/2026-10-16-basic-security.md)).

### Where the flag is set

Only with A of [rendering stories](#rendering-stories-in-the-interface).

| Option                                                   | Projects covered              | Rule owners                 |
| -------------------------------------------------------- | ----------------------------- | --------------------------- |
| In `uraeda-preview.js`, only under `URAEDA_PREVIEW_BASE` | Every project Uraeda previews | One, the helper             |
| In Uraeda's own `.storybook/main.ts`                     | Uraeda only                   | Each project writes its own |

Both leave `storybook dev` on its own port unchanged.

### File writes from the interface

| Option                                                          | Save, create, "+" search | What a story's code can do                                     |
| --------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------- |
| Keep the channel as a preview's (today)                         | Fail, "Failed to save"   | Unchanged                                                      |
| Forward the channel's role as asked                             | Work, checked            | Write story files in the worktree, open an editor on the host  |
| Give the interface a secret of its own that stories cannot read | Work, not checked        | Unchanged, if the interface's HTML stays unreadable to stories |

The third needs the proxy to serve the interface's `index.html` to frame navigations only, since a
story can fetch any path under its base: new code, and a rule nobody has tested (judgement).

### Needs no choice

- **Embeds**: unchanged by every option.
- **Colour mode**: stories in the interface follow the system's mode, like Storybook's own screen;
  Uraeda's page sends no mode to the interface.
- **Interactions' debugger**: lost with A or B as long as the story frame is cross-origin; its steps
  still show.
- **Docs pages**: no project tested has them; Storybook renders them in the same story frame.
- **Older Storybooks**: before 10.6.2, nothing pins, and the unknown `security` key is ignored by
  Storybook's config loading (judgement, not checked on older versions).

## Not checked

- Storybook's security configuration page,
  `https://storybook.js.org/docs/api/main-config/main-config-security`, returns 404: the migration
  notes and the installed types were used instead.
- CodeSandbox's per-sandbox domains, VS Code's per-webview origins, and Claude artifacts' isolation:
  seen in search snippets and a third-party post only.
- Whether a symlink inside a project lets a saved story escape its root in 10.6.2.
- Storybook's interface on a phone's width through Uraeda.
