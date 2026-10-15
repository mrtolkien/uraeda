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
- **Alternatives considered**: plain links for such a feature, which never shows the spec's text.
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
