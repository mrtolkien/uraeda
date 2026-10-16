# Rulings: Auth and login for basic security

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Round 01's discovery file reformatted, words unchanged

- **Decision**: `discovery-01.md` is run through the project's formatter once, in the plan's commit.
  A word diff shows no change: only line breaks move.
- **Rationale**: it was committed before this worktree had its dependencies, so the formatter never
  ran, and `vp check` fails on it, which fails every task's validation.
- **Alternatives considered**: leaving it, and every `vp run ready` failing; excluding it from the
  formatter, a configuration change for one file.
- **If wrong**: a round is a record; reverting the commit's change to it restores its line breaks.
- **Where**: `specs/2026-10-16-basic-security/discovery-01.md`

## R2: The spec's link to the stack decision's proposed change points to its rules

- **Decision**: the spec's link to `stack.md#proposed-change-2026-10-16-basic-security` points to
  `stack.md#rules`, in the plan's commit.
- **Rationale**: applying the decision removed the section, as the approval step says, and the link
  then failed `specs:check`. The rules are where the change now reads.
- **Alternatives considered**: no link, losing the way to the new rules.
- **If wrong**: a link only; the spec's words are unchanged.
- **Where**: `spec.md`, **Decisions**

## R3: Frame addresses come from the existing records and a redirect, not an `Access` record

- **Decision**: no `Access` fate record. Preview addresses already reach the UI in `Preview.base`
  and `Story.frame`, which the server builds with the secret. Mockups keep their address without the
  secret in the UI: a signed-in request for `/r/<name>/mockups/<path>`, the frame's own navigation,
  which carries the `Lax` cookie in every browser tested, is redirected with 303 to
  `/r/<name>/mockups/<secret>/<path>`, where the frame's own requests resolve.
- **Rationale**: the spec's details named an `Access` record so mockup addresses could carry the
  secret. The redirect gives the same addresses with no new view, no generated client change, and no
  change to `MockupPage`, `routes.tsx`, or links in documents. Only a signed-in page gets the
  redirect, so only it learns the secret, as the decision requires.
- **Alternatives considered**: the `Access` record, read by every view that frames or links a
  mockup.
- **If wrong**: an `Access` record can be added later; the server's rule does not change.
- **Where**: task 3, `files.ts`

## R4: The whole `Cookie` header is dropped before Storybook

- **Decision**: the proxy removes the `Cookie` and `Authorization` headers entirely from reads and
  upgrades, not only Uraeda's cookie.
- **Rationale**: Storybook never gets a cookie of its own on Uraeda's origin, since the proxy
  already drops its `Set-Cookie`, so every cookie on the request is Uraeda's.
- **Alternatives considered**: parsing the header to remove one cookie.
- **If wrong**: a Storybook addon relying on a cookie would not get it; none does today.
- **Where**: task 3, `preview/proxy.ts`

## R5: Signing in reloads the page

- **Decision**: once `POST /session` answers 204, the sign-in screen reloads the page.
- **Rationale**: fate's clients hold the failed reads; a reload starts them over, with the page the
  human asked for, as the spec says.
- **Alternatives considered**: resetting each fate client's cache, which fate does not expose.
- **If wrong**: a second of loading after a sign-in.
- **Where**: task 5, `SignInPage.tsx`

## R6: A missing module fails with "Cannot find module"

- **Decision**: the plan's expected failures for a module not written yet read
  `Cannot find module '<path>'`, in tasks 1, 2, 3, and 5.
- **Rationale**: it is the message the test runner gives for a missing import, seen in task 1's
  first run, not `Failed to load url`. The failure's cause is the same.
- **Alternatives considered**: leaving the plan's wording, which no run would match.
- **If wrong**: a wording only; each step still expects its test to fail on the missing module.
- **Where**: `plan.md`, the **Expected** line of each task's step 2

## R7: The signed-in session is the Hono variable `device`

- **Decision**: the session check sets `device`, `{ id, signal }`, on the request's context, typed
  as `FateVariables.device`, not `session` as the plan named it.
- **Rationale**: the server already calls the agents' chats sessions: `Sessions`, the `sessions`
  option, and `fate.sessions` on the same context. A second `session` beside them reads as one of
  those.
- **Alternatives considered**: `session`, as planned; `signIn`, already the option's name.
- **If wrong**: a rename in `check.ts`, `routes.ts`, `fate.ts`, and `app.ts`.
- **Where**: task 2, `sign-in/check.ts`; `plan.md`, task 2's interfaces

## R8: `POST /session/key` passes the check only with the host token

- **Decision**: of the `/session` routes, the check lets every one through without a session but
  `/session/key`, which passes with the host token, and otherwise needs a session like
  `DELETE /sessions`. Task 4's route still checks the host token itself.
- **Rationale**: the sign-in decision opens `/session/key` with the host token only. Opening every
  `/session` route, as the plan's step 3 read, would leave Task 4's route the only guard of the key.
- **Alternatives considered**: every `/session/*` path open, and the route alone checking the token.
- **If wrong**: a signed-in browser gets the route's own refusal rather than the check's 401.
- **Where**: task 2, `sign-in/check.ts`; `plan.md`, task 2's step 3

## R9: A request counts as HTTPS when its `Host` is exactly a listed host name

- **Decision**: the cookie is `__Host-uraeda` with `Secure`, and `X-Forwarded-For` is believed, only
  when the `Host` header equals a listed host name, without a port. A listed name with the server's
  port, which the guard accepts, gets `uraeda` and the connection's address.
- **Rationale**: `tailscale serve` and a proxy ending HTTPS on 443 send the bare name. A name with
  the server's port comes from a plain HTTP path, where a `Secure` cookie would never be sent back.
- **Alternatives considered**: comparing the host name without its port, which would set a cookie
  the browser drops over HTTP.
- **If wrong**: a proxy ending HTTPS on another port gets a cookie without `Secure`, still
  `HttpOnly` and `SameSite=Lax`.
- **Where**: task 2, `cookieName` and `address` in `sign-in/check.ts`

## R10: Task 2's tests first fail on the helpers' missing import

- **Decision**: task 2's expected failure reads `Cannot find module '../sign-in/links.ts'`.
- **Rationale**: both test files import the test helpers, which import `links.ts` before either test
  reaches `routes.ts`. The cause is the same: the module is not written yet.
- **Alternatives considered**: ordering the imports so `routes.ts` fails first, for the wording
  only.
- **If wrong**: a wording only.
- **Where**: `plan.md`, task 2's step 2

## R11: Task 3's tests first fail on the helpers' missing import

- **Decision**: task 3's expected failure reads `Cannot find module '../sign-in/frames.ts'`.
- **Rationale**: the test helpers give every test app its frame secret, so they import `frames.ts`
  before `frames.test.ts` does, as in R10.
- **Alternatives considered**: none: the cause is the same, the module not written yet.
- **If wrong**: a wording only.
- **Where**: `plan.md`, task 3's step 2

## R12: The replacements of one turn restart the Storybooks once

- **Decision**: `FrameSecret.replace()` makes the new secret at once, every time, and tells its
  listeners once, in a microtask, for every replacement made in the same turn of the event loop.
  `endAll` with five sessions replaces the secret five times, and `renewPreviews` runs once.
- **Rationale**: the store calls `onEnded` once per ended session, synchronously. Restarting the
  Storybooks once per call would start and stop them five times for one "sign out everywhere". The
  old secret is still refused as soon as a session ends.
- **Alternatives considered**: one replacement per batch, which leaves the old secret valid until
  the microtask runs; a listener call per replacement, as the plan's review focus 4 read.
- **If wrong**: two sign-outs in two requests still restart twice, as before; nothing else changes.
- **Where**: task 3, `sign-in/frames.ts`; `plan.md`, review focus 4 and task 3

## R13: `Origin: null` on a frame's path without the secret is a 404 from the guard

- **Decision**: a read or a WebSocket GET with `Origin: null` on a path shaped like a preview's or a
  mockup's whose secret `isFrame` refuses is refused by the guard with 404, `Not found`. Every other
  refusal stays a 403.
- **Rationale**: the spec's US2.1 asks 404 for the old address with `Origin: null`, and the guard
  runs before every route; letting `Origin: null` through to the routes for any such path would
  widen the stack decision's exception, which names the current frame secret.
- **Alternatives considered**: a 403 there, against US2.1; the guard's exception on the path's shape
  alone, leaving the secret to the routes.
- **If wrong**: the status of a refusal only; no such request is ever served.
- **Where**: task 3, `guard.ts` and `preview/proxy.ts`

## R14: `createApp` replaces the frame secret as sessions end

- **Decision**: `createApp`, given `signIn`, registers `frames.replace()` on the store's `onEnded`;
  `startServer` registers `renewPreviews` on the frame secret's replacements.
- **Rationale**: `createApp` holds both the store and the frame secret; `startServer` gets no store
  until task 4, and every app with sign-in, tests included, then replaces the secret the same way.
- **Alternatives considered**: `startServer` wiring both, as the plan's step 3 read, which task 3
  cannot do without task 4's store.
- **If wrong**: the registration moves; the behaviour is the same.
- **Where**: task 3, `app.ts` and `server.ts`; `plan.md`, task 3's step 3

## R15: The browser tests read the frame secret through a command

- **Decision**: the browser tests build their expected frame addresses with a `frameSecret` command,
  which reads the test server's secret through `devFrames`. The config's forwarding proxy moves to
  `src/__browser__/forwarding-proxy.ts`, so the config stays under 500 lines.
- **Rationale**: the tests compare frame addresses to the ones they expect, as before; only the
  secret is new, and only the server knows it.
- **Alternatives considered**: matching any secret with a pattern, which no longer checks the
  address holds the server's secret; the base the fake Storybook logs, which is the server's own
  value.
- **If wrong**: test code only.
- **Where**: task 3, `packages/web/vite.browser.config.ts` and the story browser tests

## R16: Existing start tests follow the host token and sign-in

- **Decision**: "a second start hands its repository to the running server" runs its second start on
  the same data folder; "a second start during the first's start waits for it" waits for the host
  token file instead of the bound port, and sends the token; "SIGHUP stops the server and its
  Storybooks" signs in with the printed key before reading the `Preview` record. The `/open` answers
  in `open.test.ts` gain `signIn`; the server, dev, and preview tests that read routes without a
  cookie start with `signIn: false`.
- **Rationale**: the spec makes a second start with another data folder an error, and closes every
  route without a session. Each test keeps what it checked: the handover, a request while the server
  starts, the Storybooks stopped with the server.
- **Alternatives considered**: a way to start `main.ts` without sign-in, which the sign-in decision
  forbids.
- **If wrong**: test code only.
- **Where**: task 4, `__tests__/main.test.ts`, `open.test.ts`, `server.test.ts`, `dev.test.ts`,
  `preview/__tests__/helpers.ts`

## R17: The help line for `--new-key` is aligned with the other options

- **Decision**: `HELP` writes `--new-key` followed by 16 spaces, so its text starts in the same
  column as every other option's; the spec's and plan's line has 15.
- **Rationale**: one space less shifts the line left of its neighbours, which reads as a typo in
  `uraeda --help`. The words are the spec's.
- **Alternatives considered**: 15 spaces, as written, and a misaligned help.
- **If wrong**: one space in `options.ts` and its test.
- **Where**: task 4, `options.ts`

## R18: A one-time link is made only when a browser opens, a second start's too

- **Decision**: `browserOpens()` gives `openBrowser`'s decision before anything is opened. The first
  start makes its link only when it is true; a second start sends `signIn: true` in its `/open`
  request only then, and `/open` makes a link only when asked, answering the page itself otherwise.
- **Rationale**: the spec's edge case says a start with no desktop makes no one-time link. The
  server makes a second start's link, so it must be told whether a browser will open.
- **Alternatives considered**: `/open` always making a link, left to expire unused over SSH or with
  `--no-open`; `openBrowser` taking a function, which covers the first start only.
- **If wrong**: a link made and never used expires in 5 minutes; the field can be dropped.
- **Where**: task 4, `browser.ts`, `open.ts`, `main.ts`

## R19: `vp dev` prints the access key its start made

- **Decision**: `devHandler`, with sign-in on, prints the two lines of a key its start made, as
  `uraeda` does.
- **Rationale**: `vp dev` on a fresh data folder makes the key; without the lines, no one could sign
  in to it, and it has no host token for `--new-key`.
- **Alternatives considered**: printing nothing, and asking developers to start `uraeda` once first.
- **If wrong**: a few lines in `dev.ts`.
- **Where**: task 4, `dev.ts`

## R20: `--new-key` shows one key, after the server's address

- **Decision**: without a server, `--new-key` prints `Uraeda server on <address>`, then the two
  lines of the new key, as the first start prints its key. When that start made the key, it is the
  new key: no second one is made, and the new-key lines show it. A second start with no host token
  for the port is refused like a wrong token.
- **Rationale**: the spec's US3.5 asks the same two lines and a start as usual; the mockup's first
  start prints the address first. One key made per command keeps SC-003's "the key appears only in
  the line that showed it".
- **Alternatives considered**: the first start's lines and the new key's, two keys in one output.
- **If wrong**: the order of two writes in `main.ts`.
- **Where**: task 4, `main.ts`

## R21: `POST /session/key` refuses with 401 and keeps the cookie

- **Decision**: without the host token, the route answers 401 `{ "error": "Sign in to Uraeda." }`,
  `no-store`, and does not clear a session cookie the request carried.
- **Rationale**: R8 lets a signed-in request reach the route; refusing it the new key must not sign
  that browser out. The body is the spec's 401 text; no new text is needed.
- **Alternatives considered**: 403 with a new text; the check's `refused`, which clears the cookie.
- **If wrong**: a status and a body in `routes.ts`.
- **Where**: task 4, `sign-in/routes.ts`

## R22: The app's plain requests go through `signedFetch` in `useServerFetch`

- **Decision**: `useServerFetch` wraps the `fetch` it gives in `signedFetch`, so uploads, image
  deletions, and the inbox's note with an image all show the sign-in screen on a 401. `useAttach.ts`
  and `chatImages.ts` are unchanged.
- **Rationale**: every plain request of the app already takes its `fetch` from that hook; wrapping
  it once covers the inbox's upload too, which the plan's list of files missed.
- **Alternatives considered**: `signedFetch` in each of `useAttach.ts`, `chatImages.ts`, and
  `NoteImage.tsx`, three places that must not drift.
- **If wrong**: a request that needs a 401 of its own would bypass the hook; none does.
- **Where**: task 5, `attach/ServerFetch.tsx`; `plan.md`, task 5's files and step 3

## R23: The web tests sign in through `signInServer`, whose browsers keep their cookies

- **Decision**: the web test helper `signInServer(repo)` gives a server with sign-in, its key, a
  browser's `fetch`, and `device(from?)` for another browser, or another tab of `from`. Its options
  come from `testSignIn` in `uraeda-server/testing`. happy-dom's `Response` and `Request` drop
  `Set-Cookie` and `Cookie`, as a browser's do for page scripts: the helper's `Response` keeps
  `Set-Cookie`, and sets `Cookie` on the request once made.
- **Rationale**: `serverFetch` takes positional arguments and returns a bare `fetch`; the tests need
  the key, two devices on one server, and two tabs with one cookie. Without the header workaround,
  no cookie reaches the server in process.
- **Alternatives considered**: `serverFetch(..., { signIn: true })` returning a `fetch` with the key
  attached; the server on a real port, whose `Request` happy-dom builds too.
- **If wrong**: test code only.
- **Where**: task 5, `__tests__/helpers.tsx`, `packages/server/src/testing.ts`; `plan.md`, task 5's
  step 1

## R24: Task 5's tests first fail on the import of the sign-in page from `App`

- **Decision**: task 5's expected failure reads
  `Failed to resolve import "./sign-in/SignInPage.tsx" from "packages/web/src/App.tsx"`.
- **Rationale**: the tests render `App`, which imports the page; Vite's transform reports a missing
  import of a module it transforms that way, not as `Cannot find module`. The cause is the same, as
  in R6.
- **Alternatives considered**: none: the wording is the runner's.
- **If wrong**: a wording only.
- **Where**: `plan.md`, task 5's step 2

## R25: Signing out has a hook and a list of its own, and the menu's rows a component

- **Decision**: `sign-in/useSignOut.ts` holds `useSignOut` and `useSignOutEverywhere`, with the
  confirmation's texts, and `sign-in/SignOutList.tsx` the menu's third list. `Menu`'s repository row
  moves to `RepositoryRow`. A sign-out the server refuses or never gets shows its error in the
  menu's banner: "Sign out" in the open menu, "Sign out everywhere" in the menu opened again.
- **Rationale**: `Menu` was at the 100-line limit and `MenuTrigger` near it: the new items had to go
  elsewhere, as extract, don't grow says. Errors stay on screen, as the UI behaviour decision asks.
- **Alternatives considered**: the items and the dialog in `RepositoryMenu.tsx`, past the limit; a
  failed sign-out leaving no trace.
- **If wrong**: the files move; the behaviour does not.
- **Where**: task 5, `RepositoryMenu.tsx`, `sign-in/`; `plan.md`, task 5's files and interfaces

## R26: The screenshots of sign-in include "Signing in…", and are taken by naming `sign-in`

- **Decision**: `sign-in-shots.ts` takes five views, `sign-in`, `sign-in-signing`, `sign-in-error`,
  `sign-in-menu`, and `sign-in-confirm`; naming `sign-in` after the folder takes all five.
- **Rationale**: the mockup shows the screen while it signs in; the plan's command names one view.
- **Alternatives considered**: four views, as the plan's step 5 listed; one view per command.
- **If wrong**: one more image set to look at.
- **Where**: task 5, `scripts/sign-in-shots.ts`, `scripts/screenshots.ts`; `plan.md`, task 5's step
  5

## R27: The browser opens a page in the data folder that leads to the one-time link

- **Decision**: a start, and a second start, give the browser launcher the `file://` address of a
  page in `sign-in-links/<port>/`, in the data folder, never the link itself. The page, mode `0600`
  in a `0700` folder and named by the token's hash, redirects to
  `http://127.0.0.1:<port>/session/<token>?to=…` at once, with a link to click as a fallback. The
  server removes it once its link is used or expires, as it stops, and at exit. US4.1's browser
  "opens `http://127.0.0.1:4310/session/<one-time token>?to=/r/todo/`" through that page: what the
  human sees, the page signed in with `/r/todo/` in the address bar, is unchanged.
- **Rationale**: the launcher's command line, `xdg-open <url>` or `open <url>`, is readable by every
  user of the machine through `/proc` or `ps`, which would let another local user sign in within 5
  minutes. Jupyter opens its token links the same way.
- **Alternatives considered**: passing the link on the command line, as the spec's scenario reads;
  sending it to the launcher on its standard input, which neither `xdg-open` nor `open` reads.
- **If wrong**: a browser that does not follow a local page's redirect shows the page's link to
  click.
- **Where**: `packages/server/src/sign-in/links.ts`, `main.ts`, `server.ts`; `spec.md`, US4.1 and
  US4.2

## R28: The mockup route serves only the files of a `mockups` folder

- **Decision**: under `/r/<name>/mockups/<secret>/`, the server serves a path only when one of its
  folders is named `mockups`, like `specs/<folder>/mockups/repeat.html` or
  `specs/<folder>/mockups/assets/app.css`, with no empty, `.`, or `..` segment once decoded; any
  other path is 404. An HTML file outside a `mockups` folder is no longer served through the mockup
  route: the UI links it as text, through `/raw/`, as other files.
- **Rationale**: the frame secret is shared by every frame, and a mockup's own scripts can read
  their address. With it, the route served every tracked file of the repository, which only a
  signed-in page should read; mockups live in a feature's `mockups/` folder.
- **Alternatives considered**: only `specs/<folder>/mockups/`, which would refuse the example's
  mockups under `skills/`; serving any `.html` file, which still serves a project's own HTML pages.
- **If wrong**: an HTML page outside a `mockups` folder opens as text instead of rendered.
- **Where**: `packages/server/src/files.ts`, `packages/web/src/routes.tsx`, `pathLink`

## R29: A test keeps every route of the app among the server's paths

- **Decision**: the session check still lets a path outside `SERVER_PATHS` through as the built
  UI's, and a test lists every route of a signed-in app, but the UI's catch-all `/*` and the
  middleware on it, and fails when one is outside `SERVER_PATHS`, naming `server-paths.ts`. The
  decision's "every new route is closed by default" holds through that test.
- **Rationale**: `vp dev` sends only `SERVER_PATHS` to the server and lets Vite serve the rest, so
  the server cannot tell the UI's files from everything else by order alone: serving the UI's files
  before the check, and closing the rest, would need a second list of the UI's paths, which the
  client's routes already are. One list, checked against the app's own routes, is the simpler way.
- **Alternatives considered**: the built UI's files served before the session check, and every other
  path closed; the check closing every path but a list of the UI's routes.
- **If wrong**: a route added to the app outside `SERVER_PATHS` fails the test, and is never shipped
  open.
- **Where**: `packages/server/src/sign-in/__tests__/closed.test.ts`, `server-paths.ts`

## R30: The sign-in file stays the truth for every server on its data folder

- **Decision**: before checking the key or a session, and before each change, the sign-in store
  reads `sign-in.json` again when its inode, size, or modification time changed since it last read
  or wrote it, and writes each change over what it just read. Sessions gone from the file end in
  this server too: their streams close and its frame secret is replaced. A file that became
  unreadable, or was deleted, while the server runs refuses every sign-in and session, is reported
  once on the server's error output, and is never written over: a sign-in and a new key fail until
  it can be read again.
- **Rationale**: two servers on two ports can share one data folder, as the README's `--port 4311`
  shows. With the file read once, a new key on one left the other accepting the old key and its
  sessions, and the other's next write put the old key's hash back.
- **Alternatives considered**: a lock file per data folder, refusing a second server; watching the
  file, which still leaves a window before the event arrives.
- **If wrong**: without a lock, two servers writing in the same millisecond may lose one of the two
  writes, and a device signs in again.
- **Where**: `packages/server/src/sign-in/store.ts`, `store.test.ts`

## R31: A first start that fails removes the sign-in file it made

- **Decision**: when the start that made the access key fails after writing `sign-in.json`, as with
  a `--repo` that is not a git repository, it removes the file before it exits, so the next start
  makes a key and shows it. A start that found the file never removes it.
- **Rationale**: the store opens first, so a file it cannot read stops the start before anything
  else, but the key is printed only once the server runs: a failed first start left a key no one had
  seen, and US1.1's first start printed none.
- **Alternatives considered**: opening the store after the hosts, which lets a start with an
  unreadable file do work before it is refused; printing the key before the start can fail, for a
  server that then does not run.
- **If wrong**: a failed first start leaves no file, as before it ran.
- **Where**: `packages/server/src/server.ts`, `main.test.ts`
