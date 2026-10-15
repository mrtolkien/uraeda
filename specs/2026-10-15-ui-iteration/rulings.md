# Rulings: UI iteration flow

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: A story is matched by its import path and export name

- **Decision**: the runner finds the index entry whose `importPath`, joined to the decision's
  `preview-folder`, is the link's file, and whose `exportName` is the link's export. Its `id` is the
  story's.
- **Rationale**: the spec matches "whose id ends with `--` and the export's id", and Storybook
  builds that end from the export's name. `index.json` v5 records the name itself, `exportName`
  (Storybook 10.6.2's index, seen in the spike), so the runner reads it instead of rebuilding
  Storybook's id rule in TypeScript. A renamed title still matches, as the spec wants.
- **Alternatives considered**: a copy of Storybook's `sanitize` and `storyNameFromExport`, to build
  the id's end: a second home for Storybook's rule, which drifts when Storybook changes it.
- **If wrong**: a Storybook whose index lacks `exportName` shows every story as missing; matching on
  the id's end is one function in `preview/index.ts`, with its table-driven test.
- **Where**: task 4, `packages/server/src/preview/index.ts`.

## R2: An inline story link names its story, and the page finds its id

- **Decision**: a story link inside a sentence or a list item links to
  `/f/<folder>/storybook?story=<path>%23<export>` (`/storybook?story=…` for the main checkout). The
  Storybook page reads the `Story` record and replaces the address with `?path=/story/<id>`.
- **Rationale**: only the running Storybook knows a story's id. Asking for it while drawing a spec
  would start a Storybook for every inline link, since a read is a view.
- **Alternatives considered**: a `Story` read per inline link, which starts Storybook on a spec's
  first view even when nothing is embedded.
- **If wrong**: the page's first address differs from the spec's `?path=` form for a moment; the
  link could carry the id once known, in `Spans.tsx`.
- **Where**: tasks 7 and 8, `stories.tsx` and `StorybookPage.tsx`.

## R3: An agent's link is checked through a `StoryHref` record

- **Decision**: the transcript asks fate for a `StoryHref` record, by the link's `href`, which the
  server reads with the binding's `storyLink`. It is neither live nor a view.
- **Rationale**: the spec puts the rule in the core, through `storyLink(href)`, but the web UI
  reaches the binding only through the server. A record per link keeps the rule in one place, and
  does not start Storybook for a link that is not a story.
- **Alternatives considered**: the rule copied into the transcript, against the stack decision; the
  server reading every link of an agent's markdown, a markdown parser in the server.
- **If wrong**: one small request per link of an agent's messages; the lookups could be batched per
  message.
- **Where**: tasks 6 and 11.

## R4: Uraeda's Storybook sends fate's requests as GETs

- **Decision**: in Uraeda's own Storybook only, the preview's fate client sends each request as
  `GET …/fate?request=<JSON>`, and a Vite middleware of `.storybook/` turns it back into the POST
  the server in Storybook expects, without `Origin` and `Sec-Fetch-Site`.
- **Rationale**: the stack decision lets the proxy forward only GET and HEAD requests and upgrades,
  and fate's queries are POSTs: embedded in Uraeda, a story would show no data, against the preview
  decision's "stories get their data only from the server, through fate" (review focus 1). The
  server in Storybook is the fixture's, so nothing of the user's repository is reachable.
- **Alternatives considered**: forwarding POSTs, which the stack decision forbids; a fate transport
  over the forwarded WebSocket, more code for the same result.
- **If wrong**: a request larger than Node's 16 KB header limit fails; the validation script shows
  it, and the WebSocket transport replaces the GET.
- **Where**: task 12, `packages/web/.storybook/fateOverGet.ts` and `preview.tsx`.

## R5: The preview folder is checked by its form only

- **Decision**: `ura check` refuses a `preview-folder` that is absolute or holds a `..` part, and
  accepts `.`, without checking that the folder exists.
- **Rationale**: a Rails project's mockups Storybook in `storybook/` is set up in a commit after its
  decision is approved: a check of the folder's existence would fail the approval's commit.
- **Alternatives considered**: a check that the folder exists in the checkout.
- **If wrong**: a typo in the folder shows as "Storybook did not start: …" in the embed, not in
  `ura check`.
- **Where**: task 2, `crates/core/src/files/preview.rs`.

## R6: The preview fields' problems have no line

- **Decision**: the preview fields' problems, missing field included, carry no line.
- **Rationale**: US6.4 fixes the output as
  `specs/decisions/preview.md: "preview-command" has no {port}`, without the `:<line>` other
  frontmatter problems print.
- **Alternatives considered**: the field's line, as for other frontmatter values, which changes the
  spec's text.
- **If wrong**: the editor's diagnostic lands on the file's first line; adding the line is one
  argument in `field_problems`, and the test's expected text.
- **Where**: task 2.

## R7: A feature without a worktree follows the main checkout's decision

- **Decision**: a feature with no worktree embeds its story links when the main checkout has an
  active preview decision, and its embed then reads "This feature has no worktree, so its stories
  cannot run here."
- **Rationale**: without a checkout, there is no copy of the decision to read, and the spec's text
  for this case needs an embed to show in.
- **Alternatives considered**: plain links for such a feature, which never shows the spec's text. A
  feature whose worktree git still lists, but whose folder was deleted, has no decision to read: its
  links show plain.
- **If wrong**: one condition in `featureRecord`.
- **Where**: task 6.

## R8: An HTML mockup from the root is read by its last two parts

- **Decision**: in `## Mockups`, a link whose resolved path ends in `mockups/<file>.html` is a
  mockup at `mockups/<file>.html`, whether written relative or from the root.
- **Rationale**: the spec asks for links from the root to be recognised, and `items()` does not know
  the spec's folder; its own mockups are the only HTML mockups a spec links.
- **Alternatives considered**: passing the folder to `items()`, which changes every caller, the
  language server's included.
- **If wrong**: a link to another feature's mockup opens this feature's page of that name; passing
  the folder fixes it.
- **Where**: task 1, `crates/core/src/files/spec.rs`.

## R9: A comment on a variant joins the answer's comment

- **Decision**: a comment on a variant is saved at once after the answer's saved comment, on a line
  of its own, with the letters as picked; the comment field's unsaved text stays unsaved.
- **Rationale**: the spec appends it to the answer "as a line of its own", and the core writes an
  answer as its letters, then its comment. Saving the field's unsaved text with it would save text
  the human did not send.
- **Alternatives considered**: appending to the field's text, unsaved, as in a session: the human
  could leave the round with the comment unsent.
- **If wrong**: with no comment yet, the line follows the letters on the answer's line; a leading
  line break in the core's answer writer would move it below.
- **Where**: task 10, `packages/web/src/useAnswer.ts`.

## R10: Pick and Comment show only where a comment can go

- **Decision**: "Pick an element" and "Comment" show in a spec, plan, or assessment under review, an
  unanswered round, and a session. An approved spec, a proposal, a draft, and an answered round show
  the story, "Open in Storybook", and the widths.
- **Rationale**: those files have no review file nor answer to write a comment to; a button that
  cannot save would lose the human's text.
- **Alternatives considered**: a comment to the session from any page, which the spec does not ask.
- **If wrong**: one condition in `StoryEmbed`.
- **Where**: task 9.

## R11: The change flow's reference gets the line when it merges

- **Decision**: "link the stories written or changed, alone on a line, in the messages that report
  them" goes into `implementation.md` now. `references/change.md` is only on the
  `2026-10-15-add-bugfixing` branch: whichever of the two features merges second adds the line to
  it.
- **Rationale**: editing a file that is not on `main` would create it on this branch, and conflict.
- **Alternatives considered**: the line in `bug.md`, a different flow.
- **If wrong**: agents on the change flow do not link their stories until the line is added.
- **Where**: task 13.

## R12: SC-006 runs WebKit through a forwarding proxy

- **Decision**: the SC-006 test opens a second WebKit context whose proxy is a small forwarding
  proxy of the test, so `uraeda.test` reaches the test server without DNS. The browser config lists
  `uraeda.test`, and gives `devHandler` `http://uraeda.test:<port>` as an allowed origin.
- **Rationale**: WebKit has no host mapping, unlike Chromium's `--host-resolver-rules`, which the
  spike used. The guard accepts `https://` and a listed host as an origin, and the test page is
  served over HTTP.
- **Alternatives considered**: Chromium for this test only, which leaves WebKit, the UI checks
  decision's browser, unchecked.
- **If wrong**: the test fails to start its context; the validation script still checks the same
  path by hand.
- **Where**: task 7, `packages/web/vite.browser.config.ts`.

## R13: A missing file's empty version has no stories

- **Decision**: task 1 also changes `packages/server/src/fate/sources.ts`: `missingFile`, the record
  of a file its feature does not have, gives its empty version `stories: []`.
- **Rationale**: `VersionView` gains `stories`, and the server builds this one empty version by
  hand, typed by the binding's declarations: without the field, `vp check` fails to type it. The
  plan's files for task 1 missed it.
- **Alternatives considered**: making `stories` optional in the core, which every reader of a
  version would then have to default.
- **If wrong**: nothing for the user: a missing file draws no story either way.
- **Where**: task 1, `packages/server/src/fate/sources.ts`.

## R14: The helper moves only Storybook's two live sockets

- **Decision**: the WebSocket patch of `uraeda-preview.js` moves Storybook's channel
  (`/storybook-server-channel`) and Vite's hot reload socket (the `vite-hmr` protocol) to the page's
  host and port, and leaves every other socket as the story opened it. `packages/web/tsconfig.json`
  gets `allowJs`, so the tests, and task 12's `main.ts`, type the helper from its JSDoc.
- **Rationale**: the spec points "both live sockets" at the page's own address; the plan's "every
  socket" would also send a story's own socket to an outside service, such as
  `wss://api.example.com`, to Uraeda's host. Without `allowJs`, TypeScript refuses to import the
  helper (`TS7016`), and the plan's files for task 3 missed it.
- **Alternatives considered**: moving every socket, as the plan said; a `.d.ts` next to the helper,
  a second home for its types.
- **If wrong**: a socket Storybook adds later, under another path, stays on Storybook's port; the
  patch is one function of the helper, with its test.
- **Where**: task 3, `skills/uraeda/assets/storybook/uraeda-preview.js`,
  `packages/web/tsconfig.json`.

## R15: The runner writes the last line when the command cannot

- **Decision**: a `preview-folder` missing from the checkout is failed at once, with "Storybook did
  not start: <folder> is not a folder of this checkout.", without running the command. A process
  that printed nothing ends with "The command exited with code <code>." or "The command was stopped
  by <signal>.", after "Storybook did not start: ".
- **Rationale**: [R5](#r5-the-preview-folder-is-checked-by-its-form-only) leaves the folder's
  existence to the runner, and Node reports a missing working folder as `spawn sh ENOENT`, which
  names neither the folder nor the cause. The spec's sentence needs a last line, and a silent
  process has none.
- **Alternatives considered**: the spawn error as it comes; an empty line after the colon.
- **If wrong**: the embed's sentence differs; each line is one string in `preview/runner.ts`, with
  its test.
- **Where**: task 4, `packages/server/src/preview/runner.ts`.

## R16: A starting Storybook is read every 500 ms, whatever its reads do

- **Decision**: `readIndex` rejects with `Storybook's index could not be read.` only on a 200 that
  is not an index; a refused connection or another status is "not yet". The runner's tick, every 500
  ms, checks the 2 minutes first, and starts a read only when none is pending. The fake's `hang`
  mode holds every request for the index open.
- **Rationale**: Storybook may hold `index.json` open while it builds its index: a 2-minute check
  made after each read would wait forever on a read that never ends.
- **Alternatives considered**: a timeout per read, which adds a second delay to tune; checking the
  time only when a read ends, which a held request defeats.
- **If wrong**: a Storybook whose index answers a non-200 for good shows the 2-minute failure
  instead of its own; the status could fail it in `readIndex`.
- **Where**: task 4, `packages/server/src/preview/index.ts` and `runner.ts`.

## R17: The runner's test helpers read the decision through the binding

- **Decision**: the runner's tests build a checkout with `storyCheckout`, asynchronous, which reads
  the worktree's decision through the binding's `preview`, as the server will. `previewStarts` also
  returns each start's `pid`, which the plan's SC-005 test reads. The fake's command ends in
  `&& true`, so its shell waits for it, and only a signal to the process group stops the fake.
- **Rationale**: a command copied into the test would not prove the decision the core reads runs;
  the plan's test reads `pid`; and with a shell that `exec`s a lone command, killing the shell alone
  would pass the SC-005 test.
- **Alternatives considered**: the plan's synchronous `storyCheckout`, building the command by hand.
- **If wrong**: nothing for the user: test helpers only.
- **Where**: task 4, `packages/server/src/preview/__tests__/helpers.ts`,
  `packages/binding/test-utils.ts`.

## R18: The helper refuses only webpack

- **Decision**: `uraeda-preview.js` stops Storybook only on a webpack signal: a framework among
  `@storybook/nextjs`, `@storybook/angular`, and `@storybook/ember`, or named `*-webpack5`, or a
  `core.builder` other than `@storybook/builder-vite`. Its `webpackFinal` throws the same
  `uraeda-preview.js needs Storybook's Vite builder.`, as a backstop. Names are matched with `\`
  made `/`, for Windows paths.
- **Rationale**: the spec stops a Storybook "on another builder than Vite"; the plan's
  `@storybook/*-vite` also refused Vite frameworks named otherwise, such as `@storybook/sveltekit`
  and community ones (`storybook-solidjs-vite`, `@analogjs/storybook-angular`). Storybook calls
  `webpackFinal` only under webpack, so a webpack framework the list misses still stops.
- **Alternatives considered**: the plan's `@storybook/*-vite` rule; a list of Vite frameworks, which
  would miss community ones.
- **If wrong**: a webpack framework off the list stops at `webpackFinal` instead of at once; a
  builder neither Vite nor webpack, such as Rsbuild, starts and fails in the frame. The list is one
  constant of the helper, with its tests.
- **Where**: task 3, `skills/uraeda/assets/storybook/uraeda-preview.js`.

## R19: A stopped runner fails every view, and starts nothing

- **Decision**: once `stopAll` ran, `view` and `restart` return
  `{ state: "failed", error: "Storybook is not running for this branch." }`, record nothing, and
  start no process; `state` stays undefined.
- **Rationale**: a request that reaches the server while it stops would otherwise start a Storybook
  that nothing stops. `view` and `restart` return a `PreviewState`, so a failed state keeps their
  type, and the spec's own sentence for a Storybook that does not run says why, with no new text.
- **Alternatives considered**: returning undefined, which widens both signatures for every caller; a
  new sentence for a stopping server, which the spec does not have.
- **If wrong**: a request racing the server's stop sees "Storybook is not running for this branch."
  instead of "Starting Storybook for this branch…", and the next server starts it.
- **Where**: task 4's review, `packages/server/src/preview/runner.ts`.

## R20: The proxy forwards what a browser sends, and closes the rest

- **Decision**: the proxy reads a preview's base from the request's path as Hono and Node's `URL`
  normalize it, `..` resolved and percent-encoding kept, and the runner's base must be that same
  string. It drops hop-by-hop headers both ways, and Storybook's `Content-Security-Policy`. A
  forwarded socket closes both sides when either ends. An upgrade on a preview's path with nothing
  ready is closed with a 503 and the spec's sentence; any other upgrade, outside a preview's path,
  with a 404. The path alone, `/r/<name>/preview/<folder>`, redirects with a 301.
- **Rationale**: the guard and the proxy read one normalized path, so `/r/x/preview/../fate` is
  never a preview's. A socket left half open kept the server from closing, as Node's HTTP sockets
  allow half-open connections and a live socket has no use for one. The 503 says why, as the proxy's
  HTTP answer does.
- **Alternatives considered**: a 404 for every refused upgrade, as the plan said, which hides that
  Storybook is not running; Hono's decoded `param("name")` as the base, which differs from the path
  the browser and `URAEDA_PREVIEW_BASE` hold for a name with spaces.
- **If wrong**: a repository or folder whose name needs encoding gets 503 until task 6 builds bases
  with `encodeURIComponent`; the rule is `previewPath` in `preview/proxy.ts`.
- **Where**: task 5, `packages/server/src/preview/proxy.ts`.

## R21: The proxy's tests reach the runner and sockets directly

- **Decision**: `dev.ts` exports `devPreviews(port)`, the runner of the server `vp dev` started on a
  port, which the dev test views a checkout through, as fate's story records will in task 6.
  `socketOpens` sends a raw HTTP upgrade instead of Node's `WebSocket`, whose DOM type takes no
  headers. The fake preview sends `Content-Security-Policy: frame-ancestors 'none'` with each story
  page, so the test sees the proxy replace it, and gets a `hang-later` mode for the runner's index
  timeout. `createApp`'s `previews` is required: the server's and the UI's test helpers create and
  stop one.
- **Rationale**: nothing views a checkout through HTTP before task 6; a header the fake never sends
  cannot prove it is replaced; and a required runner cannot be forgotten by a caller.
- **Alternatives considered**: mocking `Previews.state` in the dev test, which proves less; casting
  undici's init through the DOM type.
- **If wrong**: nothing for the user: tests and one test-only export.
- **Where**: task 5, `packages/server/src/dev.ts`, `packages/server/src/preview/__tests__/`,
  `fixtures/preview/serve.mjs`, `packages/web/src/__tests__/helpers.tsx`.

## R22: A live update of a story never starts its Storybook

- **Decision**: `livePreviews` builds the runner whose `onChange` sends the live updates, on the bus
  of the repository that read each base; the server, and the server's and the UI's test helpers, all
  use it. A live update is not a view: only a page's read starts a stopped Storybook or keeps one
  running. When a base's Storybook stops, after 30 minutes without a view or with its worktree, its
  watched records are forgotten and sent no update; a page's next read watches them again. A
  restart's stop keeps them, so the start's "starting" and "ready" reach the stories open on it.
- **Rationale**: the spec counts a query as a view, and an embed on screen asks again every 5
  minutes, so a page in view keeps its Storybook running; SC-005 stops one after 30 minutes without
  a view. fate reads a record again for each live update it sends, through the read a page uses,
  which views: an update at the stop would start the Storybook again for a page merely subscribed,
  forever. A runner built in one place cannot be created without its live updates.
- **Alternatives considered**: an update at the stop, read as a view, which restarts every Storybook
  a forgotten tab subscribed to; a read that does not view for live updates, which fate cannot tell
  apart from a page's.
- **If wrong**: the read of a running Storybook's own update, at its ready or its failure, still
  counts as a view, which can keep it up to 2 minutes past the 30 after a page's last read; telling
  live reads apart needs a flag in the live endpoint's context, read in `fate/preview.ts`.
- **Where**: task 6 and its review's fix, `packages/server/src/live.ts` and
  `packages/server/src/fate/preview.ts`.

## R23: A ready Storybook whose index cannot be read fails its stories

- **Decision**: a `Story` whose Storybook is ready, but whose index fails or does not answer within
  5 seconds, is `failed` with "Storybook's index could not be read.", and "Try again" restarts it. A
  `Preview`'s `base` is set only when ready, as a story's `frame` is. The record types live in
  `fate/preview.ts`, with their reads, so `views.ts` keeps room below its 500 lines.
- **Rationale**: the spec has this sentence for an index that cannot be read, and neither `ready`
  nor `missing` would be true; a frame or Storybook page under a base that serves nothing yet would
  show the proxy's 503.
- **Alternatives considered**: `starting` until the index answers, which waits with no end once the
  runner already called it ready; `missing`, which tells the human the story is gone.
- **If wrong**: a slow index shows the failure for one read; the next read after "Try again" shows
  the story. One branch in `readStory`.
- **Where**: task 6, `packages/server/src/fate/preview.ts`.

## R24: A Storybook's exit stops its group, and its output's close fails it

- **Decision**: when a Storybook's process exits, the runner kills its process group at once; the
  output of what the group held closes with it, and the failure follows, with the last line read. An
  upgrade under a preview's path that is not a WebSocket GET is closed with a 404, as an upgrade
  outside one is ([R20](#r20-the-proxy-forwards-what-a-browser-sends-and-closes-the-rest)), whatever
  its `Origin`. The fake preview's `child` mode starts a child that keeps its output open.
- **Rationale**: the spec fails a Storybook "as soon as its process exits". At `exit`, the last
  lines the process wrote may still wait in its output, which the failure's sentence needs; once the
  group is killed, nothing in it holds the output open, so the close follows without a timer. The
  stack rule forwards only WebSocket upgrades, which the guard alone checks only for a frame's
  `Origin: null`.
- **Alternatives considered**: failing at `exit` with the lines read so far, which loses the last
  line at random; a 405 for a non-GET upgrade, which says nothing a refused upgrade needs.
- **If wrong**: a process that left its group and kept the output open still delays the failure; a
  timer after `exit` in `#watch` of `preview/runner.ts` would bound it.
- **Where**: task 5's revision 3, `packages/server/src/preview/runner.ts` and `proxy.ts`,
  `fixtures/preview/serve.mjs`.

## R25: A story added or removed while its Storybook runs shows at the next ask

- **Decision**: a story's own change between `missing` and `ready`, an export added to or removed
  from its file while its Storybook runs, is not sent live: its embed shows it at its next read,
  which the embed asks for every 5 minutes, or a reload.
- **Rationale**: the runner's changes are its Storybook's states; a story's presence is read from
  the index at each read, and watching the index for each base would poll it the whole time a
  Storybook runs. The frame itself reloads its story through Storybook's hot reload.
- **Alternatives considered**: polling each ready Storybook's index for live updates, a second timer
  per base for a rare change.
- **If wrong**: an export written while its page is open shows missing for up to 5 minutes; an index
  poll in the runner calling `onChange` would send it.
- **Where**: task 6's review's fix, `packages/server/src/fate/preview.ts`.

## R26: A draft's record carries its stories

- **Decision**: task 7 also changes `packages/server/src/fate/views.ts`: the `Draft` record's data
  view gains `stories`, which the core's `DraftView` already holds, so the editor's preview and a
  task view's draft embed their story links.
- **Rationale**: the plan's task 7 reads `stories` from the draft, but fate sends only the fields a
  data view lists, and the server's draft view, written before story links, lists none.
- **Alternatives considered**: drafts without embeds, against the spec's "every workflow file the UI
  draws".
- **If wrong**: nothing for the user: one field more in each draft's answer.
- **Where**: task 7, `packages/server/src/fate/views.ts`.

## R27: The fake preview opens Storybook's channel, and the tests post to its frames

- **Decision**: the fake preview's story script opens a WebSocket at `storybook-server-channel`,
  beside its page, and shows "Channel open" once it answers, which SC-006's test reads. The browser
  commands gain `frameRun(title, script)`, which runs a script in a frame as its story would, and
  `frameReload(title)`, which task 9 reuses. `frameAttribute` reads the mode on `html`, where the
  fake sets it. The forwarding proxy of [R12](#r12-sc-006-runs-webkit-through-a-forwarding-proxy)
  also forwards upgrades sent in absolute form, which WebKit sends for sockets.
- **Rationale**: the plan's SC-006 test reads "Channel open", which no fake page showed; a malformed
  `size` can only come from a frame's own window, which the embed checks; and WebKit proxies `ws://`
  without `CONNECT`.
- **Alternatives considered**: a second fake page for the channel, which the embed never frames; a
  test-only message source, which the embed must refuse.
- **If wrong**: nothing for the user: test code only.
- **Where**: task 7, `fixtures/preview/serve.mjs`, `fixtures/preview/feature/`,
  `packages/web/vite.browser.config.ts`.

## R28: Whether a checkout has a preview is read once per provider

- **Decision**: `usePreviewOn(folder)` lives in `data.ts`, with the other records' reads, and reads
  the feature's record, or the workspace's for `main`, from the cache when there. `StoriesProvider`
  reads it once and puts it in `StoryContext` as `preview`, which `useStoryAt` and `Spans` read.
  `MAIN_CHECKOUT`, `main`, is exported by `data.ts`.
- **Rationale**: each paragraph and link of a page asking for the flag would subscribe to the same
  record once per block; and the hook reads records, as `data.ts`'s others do.
- **Alternatives considered**: `usePreviewOn` in `stories.tsx`, as the plan placed it, which would
  hold the only record read outside `data.ts`.
- **If wrong**: task 8 imports it from `data.ts` instead; one line.
- **Where**: task 7, `packages/web/src/data.ts` and `packages/web/src/stories.tsx`.
