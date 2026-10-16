---
status: auto-approved
spec-revision: 1
---

# Plan: Auth and login for basic security

**Goal:** Sign each browser in once with a generated access key, keep sessions on the server, close
every route to requests without a session, and give preview and mockup frames a secret in their path
instead.

**Architecture:** A new server module, `packages/server/src/sign-in/`, owns every rule of the
[sign-in](../decisions/sign-in.md) decision: the store owns `sign-in.json` and is the only writer of
the key and sessions; the session check is the only place that decides whether a request may pass;
the frame secret is the only place that knows the current secret, and its listeners restart the
Storybooks. The guard keeps its `Host` and `Origin` rules, and asks the frame secret instead of a
path pattern for `Origin: null`. The web UI learns it is signed out from one fetch wrapper and one
live-error probe, and shows the sign-in screen above everything else. See the
[spec's architecture](spec.md#architecture).

- **State and its owner**: `sign-in.json` is authoritative, written only by `SignInStore`, read once
  at start; the store keeps its content in memory and writes it on every change. One-time links and
  the frame secret live in memory only. The host token file is written by `main.ts` at start and
  removed at exit.
- **Resources**: each session has an `AbortController`, made by the store, aborted when the session
  ends; live streams of `/fate/live` take its signal. Storybooks are stopped through `Previews`
  only.
- **Sign-in off**: `createApp` without `signIn` checks no session; it still uses a frame secret.
  `startServer` and `devHandler` take `signIn: false` for tests and Uraeda's own Storybook fixture;
  no flag or environment variable reaches it.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A cookie for a session that ends between two requests of one page**: the second request gets
   401, and the stale cookie is cleared, never refreshed. Task 2.
2. **The key typed with spaces or a newline around it**, as a password manager or a paste can add:
   it is trimmed before hashing, and accepted. Task 1.
3. **A preview path whose secret is right but whose Storybook is gone**: 503 as today, not 404, so a
   restart in progress shows "starting" rather than a broken address. Task 3.
4. **Two sign-outs at once** (a tab and another device): the frame secret is replaced once per ended
   session, and Storybooks restart once for the replacements of one turn of the event loop; no
   listener throws on a session already gone. Task 3.
5. **A mockup path that is the frame secret alone** (`/r/<name>/mockups/<secret>/`): 404, never the
   repository's root listing or a redirect loop. Task 3.
6. **`to` of a one-time link pointing elsewhere** (`//evil.com`, `https://evil.com`): the redirect
   goes to `/` instead, never to another site. Task 4.
7. **`sign-in.json` written by a newer Uraeda** (`version` other than 1): refused like an unreadable
   file, never overwritten. Task 1.
8. **A request with both a frame secret path and a session cookie**: served, and the cookie is not
   forwarded to Storybook. Task 3.

## Global constraints

From the [sign-in](../decisions/sign-in.md) decision, word for word:

- Every request MUST carry a valid session, except: the built UI's files, the `/session` routes,
  `/open` and `/session/key` with the host token, and preview and mockup paths with the current
  frame secret.
- The server MUST have one access key: 32 random bytes, shown as `ura_` and 43 base64url characters.
  It MUST store only its SHA-256 hash, and MUST show the key only once, when it is made.
- The key, sessions, and their hashes MUST live in one file, `sign-in.json` in the data folder,
  written with mode `0600` and replaced atomically. They MUST NOT be stored anywhere else.
- A session MUST be a random token of at least 128 bits, stored as a hash, sent only in an
  `HttpOnly`, `SameSite=Lax` cookie, never in a URL or a response body. Over HTTPS the cookie MUST
  be `__Host-uraeda` with `Secure`.
- A session MUST end 30 days after its last use, when it is signed out, or when the key changes.
  Signing a session out MUST end its live streams.
- A failed sign-in MUST wait at least one second before its answer, and MUST be logged with the
  request's address, never with the key typed.
- Preview and mockup paths MUST carry the frame secret, 32 random bytes made at each start and
  replaced whenever a session ends. Only signed-in pages MAY receive it, through fate.
- A process the server runs, like a Storybook, MUST NOT receive Uraeda's cookie or an
  `Authorization` header.
- The server MUST NOT treat a request as signed in because of its address, its `Host`, or a header
  set by a proxy, like Tailscale's identity headers.
- Sign-in MUST NOT be turned off by a flag, an environment variable, or a setting. Only code MAY
  create an app without it, for tests and Uraeda's own Storybook fixture.

From the [stack](../decisions/stack.md) decision: the server MUST listen on 127.0.0.1 only, and MUST
reject a foreign `Host` and `Origin`, "except GET and HEAD requests and WebSocket upgrades under
`/r/<repository>/preview/<secret>/` and `/r/<repository>/mockups/<secret>/` with the current frame
secret, which MAY carry `Origin: null`". Preview answers keep `Access-Control-Allow-Origin: *` and
`Content-Security-Policy: sandbox allow-scripts allow-popups`.

Exact values from the spec:

- Cookie: `__Host-uraeda` over HTTPS, `uraeda` over HTTP; `HttpOnly`, `SameSite=Lax`, `Path=/`,
  `Max-Age=2592000`; `Secure` only with `__Host-uraeda`. A request counts as HTTPS when its `Host`
  is a listed host name.
- Session expiry: ended when `now − used` exceeds 30 days; `used` recorded at most once a day.
- One-time links: valid 5 minutes, used once, in memory.
- Texts: `Access key, shown once: <key>`;
  `Keep it in a password manager: every new device signs in with it.`;
  `New access key, shown once: <key>`; `Every device is signed out.`;
  `uraeda: failed sign-in from <address>`;
  `uraeda: cannot read <path>: <reason>. Fix it, or delete it to make a new access key and sign every device out.`;
  `uraeda: cannot write <path>: <reason>`;
  `uraeda: port <port> is used by an Uraeda server with another data folder.`;
  `uraeda: the server on port <port> refused the new key.`; 401 body
  `{ "error": "Sign in to Uraeda." }`; wrong key `{ "error": "This is not Uraeda's access key." }`;
  help line `--new-key               make a new access key and sign every device out`.
- UI texts: the heading "Sign in to Uraeda"; the text "Paste the access key Uraeda showed when it
  first started. On the machine that runs Uraeda, `uraeda --new-key` makes a new one and signs every
  device out."; the field "Access key"; the button "Sign in", "Signing in…" while waiting; the error
  "This is not Uraeda's access key."; the unreachable error "Could not reach the Uraeda server.";
  the menu items "Sign out" and "Sign out everywhere…"; the dialog "Sign out every device?", "Every
  browser signed in to Uraeda, this one included, will need the access key again.", buttons "Sign
  out everywhere" and "Cancel".

Preserved guarantees: the guard's `Host`, `Origin`, and `Sec-Fetch-Site` rules and their tests
([guard.test.ts](/packages/server/src/__tests__/guard.test.ts)); the proxy's sandbox, dropped
`Set-Cookie`, and forced `page=preview`
([proxy.test.ts](/packages/server/src/preview/__tests__/proxy.test.ts)); a second start never opens
the session cache (`main.ts`); unsaved text kept in the browser (UI behaviour decision).

## Code read

- [`guard.ts`](/packages/server/src/guard.ts): `guardCheck` and `PREVIEW_PATH`, shared with the
  proxy and `dev.ts`; `Origin: null` passes for reads under a preview base.
- [`app.ts`](/packages/server/src/app.ts): `createApp(AppOptions)`, the guard first, then the fate
  context, `hostedRoutes`, `fateRoutes` (live GETs handed to fate with `context.req.raw`), file,
  preview, attach, and `/open` routes, then the static UI with its `index.html` fallback.
- [`server.ts`](/packages/server/src/server.ts): `startServer` builds previews, sessions (agents),
  hosts, the sweep interval, and
  `upgrade: previewUpgrade({ check: guardCheck(options), previews })`.
- [`main.ts`](/packages/server/src/main.ts): takes the port before the data folder's cache; a taken
  port hands over through [`open-client.ts`](/packages/server/src/open-client.ts) to
  [`open.ts`](/packages/server/src/open.ts)'s `POST /open`; prints `Uraeda server on <address>` and
  opens the browser at `server.url`.
- [`options.ts`](/packages/server/src/options.ts) and [`env.ts`](/packages/server/src/env.ts): flags
  over environment; `HELP`.
- [`preview/proxy.ts`](/packages/server/src/preview/proxy.ts): `previewPath`, `forward` (passes
  every request header but hop-by-hop ones), `previewRoutes` (sandbox headers), `previewUpgrade`
  (guard, then `previews.state(base)`, `upgradeHead` without `Host` and `Origin`).
- [`preview/runner.ts`](/packages/server/src/preview/runner.ts): `Previews`, entries keyed by base,
  `URAEDA_PREVIEW_BASE` set at spawn, `stopRepository` by base prefix, `stopAll` closes for good.
- [`fate/preview.ts`](/packages/server/src/fate/preview.ts): `runnable` builds the base; `watch` and
  `changedRecords` keep the records read per base; [`live.ts`](/packages/server/src/live.ts)'s
  `livePreviews` sends their updates.
- [`fate/context.ts`](/packages/server/src/fate/context.ts): fate's `Context`, set in `app.ts`.
- [`files.ts`](/packages/server/src/files.ts): `/mockups/*` reads the file through the binding, with
  `sandbox allow-scripts`.
- [`dev.ts`](/packages/server/src/dev.ts): `SERVER_PATHS`, the paths Hono answers under `vp dev`;
  `devUpgrade` sends preview upgrades on; `devHandler` options thread to `startServer`.
- Tests: [`__tests__/helpers.ts`](/packages/server/src/__tests__/helpers.ts) (`testApp`,
  `testHosts`, temporary data folders, `app.request` in process),
  [`preview/__tests__/helpers.ts`](/packages/server/src/preview/__tests__/helpers.ts) and
  `proxy.test.ts` (a real port, the fake preview), `server.test.ts`, `dev.test.ts`, `open.test.ts`,
  `files.test.ts`.
- Web: [`App.tsx`](/packages/web/src/App.tsx) (`ServerErrorBoundary`, `InRepository`),
  [`clients.ts`](/packages/web/src/clients.ts) (`fateClients({ fetch, origin })`),
  [`RepositoryMenu.tsx`](/packages/web/src/RepositoryMenu.tsx) (`Menu`'s lists),
  [`RepositoryPages.tsx`](/packages/web/src/RepositoryPages.tsx) (`FirstRun`, a page without the
  shell), `attach/useAttach.ts` and `attach/chatImages.ts` (plain fetches),
  [`__tests__/helpers.tsx`](/packages/web/src/__tests__/helpers.tsx) (`serverFetch`, `renderPage`),
  `__browser__/helpers.tsx` (`show`, `checkLayout`, `checkAccessibility`, `atSize`),
  `vite.browser.config.ts` and `.storybook/fixture.ts` (`uraedaServer` options),
  `scripts/screenshots.ts` and its per-feature `*-shots.ts`.
- fate's client accepts `onLiveError`; a live `EventSource` cannot carry headers and closes for good
  on a 401.
- Validation: `nix develop -c vp run ready` (format, lint, types, Rust, TypeScript, WebKit at both
  sizes, specs check). Single files: `nix develop -c vp test <path>`.

## Constitution check

| Principle                                  | Complies | Notes                                                            |
| ------------------------------------------ | -------- | ---------------------------------------------------------------- |
| I. Humans stay in control                  | yes      | Builds the approved spec and its two decisions, nothing more     |
| II. Git and plain text first               | yes      | `sign-in.json` is machine state in the data folder               |
| III. Asynchronous by default               | yes      | Sessions survive restarts; workflow files are untouched          |
| IV. Review effort matches impact           | yes      | Auto-approved, as the spec's `plan-review: false` says           |
| V. Tools are optional                      | yes      | Only the web server changes; `ura` and editors do not            |
| VI. Code is checked and stays maintainable | yes      | Every scenario has a test; no dependency; limits kept, see below |

## Decisions

- [Sign-in](../decisions/sign-in.md): every task; its rules are the global constraints.
- [Stack](../decisions/stack.md): tasks 3 and 4, the guard's and the proxy's rules.
- [Preview](../decisions/preview.md): task 3, `URAEDA_PREVIEW_BASE` still gives the base.
- [Distribution](../decisions/distribution.md): task 4, `--new-key` is a flag; no `.env` reading.
- [Repositories](../decisions/repositories.md) and [agents](../decisions/agents.md): task 1,
  `sign-in.json` next to `repositories.json`, not in `runner.sqlite`.
- [UI layout](../decisions/ui-layout.md), [UI components](../decisions/ui-components.md),
  [UI behaviour](../decisions/ui-behaviour.md), [UI checks](../decisions/ui-checks.md): task 5.
- [Code quality](../decisions/code-quality.md): every task, functions under 100 lines, files under
  500, no new markers.

## Complexity tracking

| New abstraction                                | Why                                                                                    | Simpler alternative rejected                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `sign-in/` module, five files                  | One home per rule of the sign-in decision: store, check, routes, frames, links         | Rules spread in `app.ts`, `guard.ts`, `main.ts`: several homes for "who may pass" |
| `FrameSecret` with listeners                   | The proxy, the mockup route, the guard, and fate read it; Storybooks restart on change | A secret passed by value: stale after a sign-out                                  |
| `server-paths.ts`, `SERVER_PATHS` moved        | The session check and `vp dev` must agree on which paths are the server's              | A second pattern in the check: two lists that drift                               |
| `signedOut` store and `signedFetch` in the web | One place learns of a 401, for fate, uploads, and image deletion                       | A check in every caller                                                           |

No function or file grows past a limit. `main.ts`'s `main` grows by the key's lines and the one-time
link; if it nears 100 lines, its start goes to a function of its own.

## Review comments

- **C1** (sign-out items "will be part of the settings page"): carried out on the default branch, in
  the settings page draft, before this plan (commit `0cc7ec3`). The sign-out items stay in the
  repository menu until that feature moves them.

---

## Task 1: The sign-in store

**Files:**

- Create: `packages/server/src/sign-in/tokens.ts`, `packages/server/src/sign-in/store.ts`
- Test: `packages/server/src/sign-in/__tests__/store.test.ts`

**Interfaces:**

- Produces, in `tokens.ts`: `randomToken(bytes: number): string` (base64url);
  `hash(text: string): string` (SHA-256, base64url); `sameHash(a: string, b: string): boolean`
  (constant time, false on unequal lengths).
- Produces, in `store.ts`:
  - `SIGN_IN_FILE = "sign-in.json"`, `SESSION_DAYS = 30`.
  - `class SignInStore` with
    `static open(dataDir: string, now?: () => number): { key?: string; store: SignInStore }` (the
    key only when this call made it; throws `Error` with the exact "cannot read" or "cannot write"
    text, without `uraeda: `); `replaceKey(): string` (ends every session);
    `checkKey(text: string): boolean` (trims); `createSession(): string` (the cookie value
    `<id>.<secret>`);
    `findSession(cookie: string | undefined): { id: string; refreshed: boolean } | undefined` (ends
    an expired one; records `used` at most once a day, `refreshed` true then);
    `endSession(id: string): void`; `endAll(): void`; `sweep(): void`;
    `signal(id: string): AbortSignal`; `onEnded(listener: (id: string) => void): void`.

- [x] **Step 1: Write the failing tests**

Tests on a temporary data folder, the clock a variable the test moves:

- "makes the key at the first start, and stores only its hash" (US1.1): `open` returns a key
  matching `/^ura_[A-Za-z0-9_-]{43}$/`; the file holds `version: 1`, the key's hash, no key; its
  mode is `0o600`; a second `open` returns no key.
- "accepts the key, trimmed, and refuses another" (review focus 2): `checkKey(\`
  ${key}\n\`)`is true,`checkKey("ura_wrong")` false.
- "keeps a session across a reopen" (US1.5, SC-004): a session from one `open` is found by three
  more `open`s of the folder.
- "ends a session 30 days after its last use" (US1.6): created on 2026-10-01T10:00Z; found on
  2026-10-30T10:00Z, with `refreshed: true` and `used` written as that day; a session used on
  2026-10-01T10:00Z and checked on 2026-10-31T10:01Z is not found, and is gone from the file.
- "records a use at most once a day": two finds an hour apart write the file once.
- "ends one session, every session, and every session on a new key": `endSession`, `endAll`,
  `replaceKey` each remove sessions, abort their signals, and call `onEnded` once per session; the
  old key is refused after `replaceKey`.
- "the sweep ends every session unused for 30 days": one session of two ended, its signal aborted,
  `onEnded` called for it, and the file holding the other.
- "refuses a file it cannot read" (edge case, review focus 7): a file that is not JSON, and one with
  `version: 2`, throw
  `cannot read <path>: <reason>. Fix it, or delete it to make a new access key and sign every device out.`,
  and the file is unchanged.
- "refuses a data folder it cannot write" (edge case): a read-only folder throws
  `cannot write <path>: <reason>`.
- "never writes a session token": after `createSession`, the file holds the session's id and the
  hash of its secret, not the secret.

The break each test catches: a key stored in clear; a missing trim; sessions kept in memory only; an
off-by-one on 30 days, or `used` never updated; a write on every request; a sweep that leaves an
expired session; an ended session left streaming; a corrupt file overwritten with a new key; a token
written in clear.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/server/src/sign-in/__tests__/store.test.ts`
- Expected: FAIL, `Cannot find module '../store.ts'`.

- [x] **Step 3: Implement `tokens.ts` and `SignInStore`**

The file format is the spec's `SignInFile`. Writes go to `sign-in.json.<random>.tmp` with mode
`0o600`, then `rename`. Hashes are compared with `sameHash`. Session ids are 16 random bytes,
secrets 32. A session whose secret does not match its id is not found. `sweep` ends every expired
session.

- [x] **Step 4: Run all tests**

- Run: `nix develop -c vp run ready`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/server/src/sign-in specs/2026-10-16-basic-security/plan.md
git commit -m "feat(basic-security): the sign-in store"
```

## Task 2: The session check and the sign-in routes

**Files:**

- Create: `packages/server/src/sign-in/check.ts`, `packages/server/src/sign-in/routes.ts`,
  `packages/server/src/sign-in/links.ts`, `packages/server/src/server-paths.ts`
- Modify: `packages/server/src/app.ts` (`AppOptions.signIn`, the check after the guard, live GETs
  with the session's signal, `X-Frame-Options`), `packages/server/src/dev.ts` (`SERVER_PATHS` from
  `server-paths.ts`, with `session` and `sessions`), `packages/server/src/fate.ts`
  (`FateVariables.device`)
- Test: `packages/server/src/sign-in/__tests__/routes.test.ts`,
  `packages/server/src/sign-in/__tests__/closed.test.ts`, `packages/server/src/__tests__/helpers.ts`

**Interfaces:**

- Consumes: Task 1's `SignInStore`.
- Produces, in `links.ts`: `class OneTimeLinks` with `constructor(now?: () => number)`,
  `make(to: string): string` (the path `/session/<token>?to=<to>`),
  `use(token: string): string | undefined` (its `to`, once, within 5 minutes).
- Produces, in `server-paths.ts`: `SERVER_PATHS: RegExp`, as `dev.ts`'s today plus `session` and
  `sessions`.
- Produces, in `app.ts`: `AppOptions.signIn?: SignInOptions`, where `SignInOptions` (exported from
  `check.ts`) is
  `{ hostToken?: string; links: OneTimeLinks; log?: (line: string) => void; store: SignInStore; wait?: (ms: number) => Promise<void> }`.
  Without it, no session is checked.
- Produces, in `check.ts`:
  `sessionCheck(options: SignInOptions & { allowedHosts: Array<string>; frames?: { allows(path: string): boolean } })`,
  Hono middleware;
  `cookieName(host: string, allowedHosts: Array<string>): "__Host-uraeda" | "uraeda"`.
- Produces, in `check.ts` too: `type Device = { id: string; signal: AbortSignal }`, set as the Hono
  variable `device` (`FateVariables.device`), named apart from the agents' sessions;
  `setSessionCookie(context, allowedHosts, value)`, `clearSessionCookie(context, allowedHosts)`,
  `refused(context, allowedHosts)` (the 401), `address(context, allowedHosts)` (the address logged),
  and `withDevice(context): Request` (fate's live GET, aborted with the device's session too).
- Produces, in `routes.ts`:
  `signInRoutes(options: SignInOptions & { allowedHosts: Array<string> })`, mounted at `/`: `GET`,
  `POST`, `DELETE` `/session`, `DELETE /sessions`, `GET /session/:token`. `POST /session/key` is
  Task 4's: the check lets it through with the host token, else it needs a session like
  `DELETE /sessions`, so its route checks the host token itself.
- Produces, in `__tests__/helpers.ts`: `testApp`'s options `signIn`, `hostToken`, and `webRoot`, and
  its `signIn` (`TestSignIn`) with `signedIn()`; `signInCookie(app, key, host?)`.

- [x] **Step 1: Write the failing tests, and the helpers they use**

The helper: `testApp(repo, { signIn: true })` in `__tests__/helpers.ts` creates the app with a store
on its data folder, a fake clock, `wait` recording its delays, and `log` recording its lines, and
returns them with `signedIn(): Promise<string>`, a cookie header from `POST /session`.

- `routes.test.ts`:
  - "a request without a session gets 401 and no data" (US1.2): `POST /r/<name>/fate` → 401, body
    `{ "error": "Sign in to Uraeda." }`.
  - "the key signs in, with the cookie's attributes" (US1.3, US1.7): `POST /session` with the key on
    `Host: mac.tail1234.ts.net` (listed) → 204,
    `__Host-uraeda=…; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`; on
    `Host: 127.0.0.1:4310` → `uraeda=…`, without `Secure`; then `POST /r/<name>/fate` with it → 200.
  - "a wrong key waits a second, and is logged without the key" (US1.4): `wait` was called with
    1000, the answer is 401 `{ "error": "This is not Uraeda's access key." }`, and the log is
    `uraeda: failed sign-in from 100.101.102.103` for `X-Forwarded-For: 100.101.102.103` on the
    listed host; no logged line holds `ura_wrong`.
  - "a session refreshed after a day sets its cookie again" (US1.6).
  - "a cookie whose session ended gets 401, and is cleared" (edge case, review focus 1): sign out,
    then a request with the old cookie → 401 with `Max-Age=0`.
  - "signing out ends the session and its live stream" (US3.1): open `GET /r/<name>/fate/live` with
    the cookie, `DELETE /session` → 204, the stream's body ends, the cookie is cleared.
  - "signing out everywhere ends every session" (US3.3): two cookies, `DELETE /sessions` with one →
    both get 401.
  - "signing in again replaces the device's session" (edge case): `POST /session` with an old cookie
    → the old session is gone.
  - "a one-time link signs in once, within 5 minutes" (US4.1, US4.3):
    `GET /session/<token>?to=/r/todo/` → 303 to `/r/todo/` with the cookie; again → 303 without; a
    new link after 5 minutes and one second → 303 without.
  - "a one-time link never leaves the server" (review focus 6): `to` of `//evil.com` and
    `https://evil.com` → 303 to `/`.
  - "the session routes are never cached": every answer carries `Cache-Control: no-store`.
  - "Uraeda's pages refuse other sites' frames": `/r/<name>/fate` answers carry
    `X-Frame-Options: SAMEORIGIN`.
- `closed.test.ts` (SC-001, and the edge case on uploads): one row per route of `createApp`, method
  and path, each answering 401 without a session: the global and repository fate and live routes,
  `raw`, `mockups` without the secret, `images`, `chat-images` (GET and DELETE), `attach`,
  `inbox/note-image`, `open` without the host token, `DELETE /sessions`. And the open ones: `GET /`,
  `GET /r/<name>/` (the UI, with `webRoot` set to a folder holding `index.html`), `GET /session`
  (401 there means "not signed in", which the UI asks), `POST /session`.

The break each test catches: a route left out of the check; `Secure` missing over HTTPS or present
over HTTP; no delay, or the key in the log; a cookie refreshed for an ended session; a live stream
that keeps sending after sign-out; a one-time link usable twice or forever; an open redirect;
answers cached by a proxy; framing by another site.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/server/src/sign-in`
- Expected: FAIL, `Cannot find module '../sign-in/links.ts'`, which the test helpers import.

- [x] **Step 3: Implement the check, the routes, and the links, and wire them in `createApp`**

The check runs after the guard. A path that `SERVER_PATHS` does not match is the UI's: it passes. Of
the server's paths, the `/session` routes but `DELETE /sessions` and `POST /session/key` pass; a
frame path the frame secret allows passes (Task 3 gives it; until then none); `/open` and
`/session/key` pass with `Authorization: Bearer <hostToken>` when a host token is set. Every other
request needs the cookie named by `cookieName` to be a session `findSession` finds; a refreshed
session sets its cookie again. `context.set("device", { id, signal })`. `fateRoutes` hands live GETs
a request whose signal also aborts with the session's. Answers outside preview and mockup paths get
`X-Frame-Options: SAMEORIGIN`. The address logged is `X-Forwarded-For`'s first entry when the `Host`
is a listed host name, else the connection's, else `unknown`.

- [x] **Step 4: Run all tests**

- Run: `nix develop -c vp run ready`
- Expected: PASS: existing tests create the app without `signIn`.

- [x] **Step 5: Commit**

```bash
git add packages/server/src specs/2026-10-16-basic-security/plan.md
git commit -m "feat(basic-security): sessions on every route, and the sign-in routes"
```

## Task 3: The frame secret in preview and mockup paths

**Files:**

- Create: `packages/server/src/sign-in/frames.ts`
- Modify: `packages/server/src/guard.ts` (`PREVIEW_PATH` with the secret, `MOCKUP_PATH`, the
  `Origin: null` exception through `isFrame`), `packages/server/src/preview/proxy.ts` (the secret
  checked for reads and upgrades, `Cookie` and `Authorization` dropped, `Referrer-Policy`),
  `packages/server/src/preview/runner.ts` (`stopEach`), `packages/server/src/fate/preview.ts`
  (`runnable`'s base, `takeWatched`), `packages/server/src/fate/context.ts` (`frames`),
  `packages/server/src/live.ts` (`renewPreviews`), `packages/server/src/files.ts` (mockups under the
  secret, the redirect), `packages/server/src/app.ts`, `packages/server/src/server.ts`,
  `packages/server/src/dev.ts` (`devUpgrade`'s pattern, `devFrames`),
  `packages/web/vite.browser.config.ts` (the `frameSecret` command; its forwarding proxy moved to
  `packages/web/src/__browser__/forwarding-proxy.ts`), `packages/web/scripts/validate-storybook.ts`
  (the base from the `Preview` record), `skills/uraeda/assets/storybook/uraeda-preview.js` (its
  comment)
- Test: `packages/server/src/sign-in/__tests__/frames.test.ts`, and the existing `guard.test.ts`,
  `preview/__tests__/proxy.test.ts`, `preview/__tests__/helpers.ts`, `__tests__/preview.test.ts`,
  `__tests__/files.test.ts`, `__tests__/dev.test.ts`, `sign-in/__tests__/closed.test.ts`,
  `sign-in/__tests__/routes.test.ts`, and the web's `story-embed`, `story-chat`, and
  `storybook-page` browser tests moved to secret paths

**Interfaces:**

- Consumes: Task 1's `onEnded`; Task 2's `sessionCheck` `frames` option.
- Produces, in `frames.ts`: `class FrameSecret` with `constructor(make?: () => string)`,
  `current(): string`, `check(text: string): boolean` (constant time), `replace(): void` (the new
  secret at once), `onReplace(listener: () => void): void` (called once for the replacements of one
  turn of the event loop), `allows(path: string): boolean` (a preview or mockup path whose secret
  segment is the current one).
- Produces, in `guard.ts`: `PREVIEW_PATH = /^(\/r\/[^/]+\/preview\/([^/]+)\/[^/]+)(\/.*)?$/` (base,
  secret, rest); `MOCKUP_PATH = /^\/r\/[^/]+\/mockups\/([^/]+)\/(.+)$/`; `guardCheck` takes
  `isFrame?: (path: string) => boolean` in place of matching `PREVIEW_PATH` for `Origin: null`; a
  read with `Origin: null` on a path of either shape that `isFrame` refuses is `NOT_FOUND`, which
  `refusalStatus` answers with 404.
- Produces, in `runner.ts`: `Previews.stopEach(): void`, stopping every Storybook without closing
  the runner.
- Produces, in `fate/context.ts`: `Context.frames: FrameSecret`; in `app.ts`:
  `AppOptions.frames?: FrameSecret` (a new one by default); in `server.ts`: `Server.frames`; in
  `fate/preview.ts`: `takeWatched(previews: Previews): Array<Watched>`; in `dev.ts`:
  `devFrames(port: number): Promise<FrameSecret | undefined>`, for the browser tests' `frameSecret`
  command.
- Produces, in `live.ts`: `renewPreviews(previews: Previews): void`: the records read for every base
  are taken, every Storybook stopped, and their `Preview` and `Story` records sent, so pages read
  them again under the new base.

- [x] **Step 1: Write the failing tests, and move the existing ones to secret paths**

- `frames.test.ts`:
  - "another site's frame gets 404 for the old address" (US2.1):
    `GET /r/<name>/preview/main/iframe.html` with `Origin: null` → 404; with a wrong secret → 404;
    upgrades the same.
  - "a story's frame and socket load under the secret, without a cookie" (US2.2): `readStory`'s
    `frame` is `/r/<name>/preview/<secret>/<folder>/iframe.html?id=…&viewMode=story`; a GET there
    with `Origin: null` and no cookie → forwarded; the WebSocket opens.
  - "a mockup loads under the secret" (US2.3):
    `GET /r/<name>/mockups/<secret>/specs/<folder>/mockups/repeat.html` with `Origin: null` and no
    cookie → 200; signed in, `GET /r/<name>/mockups/specs/…/repeat.html` → 303 to the secret path;
    `GET /r/<name>/mockups/<secret>/` → 404 (review focus 5).
  - "Storybook never sees Uraeda's credentials" (US2.4, review focus 8): the fake preview records
    the headers it got: no `Cookie`, no `Authorization`, on a read and an upgrade; answers carry
    `Referrer-Policy: no-referrer`.
  - "a sign-out replaces the secret and restarts the Storybooks" (US2.5, edge case on a start in
    progress): a ready Storybook and a starting one; `replace()`; both are stopped, the fake's log
    shows a new start under the new base once a record is read again, the old base answers 404.
  - "a right secret on a gone Storybook is 503" (review focus 3).
  - "two sign-outs at once replace the secret twice, restart once, and nothing throws" (review focus
    4).
- SC-002, table-driven: preview and mockup paths × `GET`, `HEAD`, upgrade × with and without
  `Origin: null`, all without the secret → never 200 or 101.
- The existing tests read the base from the app's `frames.current()`; their expectations stay.

The break each test catches: the old pattern still accepted; a frame address without the secret; a
mockup that needs a cookie; credentials forwarded; a sign-out that leaves the old address working or
the Storybook on the old base; a 404 that hides a restart; a listener that throws.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/server/src/sign-in/__tests__/frames.test.ts`
- Expected: FAIL, `Cannot find module '../sign-in/frames.ts'`, which the test helpers import.

- [x] **Step 3: Implement**

`startServer` makes one `FrameSecret`, gives it to the app, the upgrade, and fate's context, and
calls `renewPreviews(previews)` once for the replacements of one turn of the event loop; `createApp`
calls `frames.replace()` on every `store.onEnded`, as it holds both. `previewUpgrade` refuses an
upgrade the frame secret does not allow with a 404, after the guard. The mockup route serves the
rest after the secret segment, and redirects any other mockup path, its session checked by Task 2's
check, with 303 to `/r/<name>/mockups/<secret>/<path>`.

- [x] **Step 4: Run all tests**

- Run: `nix develop -c vp run ready`
- Expected: PASS, the browser tests' stories included: their frame addresses come from fate.

- [x] **Step 5: Commit**

```bash
git add packages skills/uraeda/assets/storybook specs/2026-10-16-basic-security
git commit -m "feat(basic-security): the frame secret in preview and mockup paths"
```

## Task 4: The server's start, the host token, and a new key

**Files:**

- Create: `packages/server/src/sign-in/host.ts`
- Modify: `packages/server/src/server.ts` (`signIn?: false`, the store opened, `Server.key`,
  `Server.signInLink`, the store's sweep), `packages/server/src/main.ts`,
  `packages/server/src/options.ts` (`--new-key`, `HELP`), `packages/server/src/open.ts` (`signIn` in
  the answer), `packages/server/src/open-client.ts` (the host token, `unauthorized`),
  `packages/server/src/sign-in/routes.ts` (`POST /session/key`), `packages/server/src/dev.ts`
  (`signIn` option), `packages/web/vite.browser.config.ts`, `packages/web/.storybook/fixture.ts`,
  `packages/web/scripts/screenshots.ts` (`signIn: false`)
- Test: `packages/server/src/__tests__/server.test.ts`,
  `packages/server/src/__tests__/main.test.ts`, `packages/server/src/__tests__/open.test.ts`,
  `packages/server/src/__tests__/dev.test.ts`

**Interfaces:**

- Consumes: Tasks 1 to 3.
- Produces, in `host.ts`: `writeHostToken(dataDir: string, port: number): string`,
  `readHostToken(dataDir: string, port: number): string | undefined`,
  `removeHostToken(dataDir: string, port: number): void`; the file is `server-<port>.token`, `0600`.
- Produces, in `server.ts`: `startServer` options `hostToken?: string`, `signIn?: false`; `Server`
  gains `key?: string` (made by this start), `newKey(): string`, and
  `signInLink(to: string): string` (`to` itself without sign-in).
- Produces, in `open.ts`: `OpenAnswer = { signIn: string; uraeda: string; url: string }`.
- Produces, in `open-client.ts`: `HandOff` gains `{ kind: "unauthorized" }`;
  `handOff(port, request, token?)`;
  `newKeyOn(port: number, token: string): Promise<string | undefined>`.
- Produces, in `options.ts`: `Options.newKey: boolean`.
- Produces, in `dev.ts`: `devHandler`'s `signIn?: boolean`, true by default.

- [ ] **Step 1: Write the failing tests**

- "the first start prints the key once" (US1.1): `main` on a fresh data folder writes
  `Uraeda server on http://127.0.0.1:<port>`, `Access key, shown once: ura_…`, and
  `Keep it in a password manager: every new device signs in with it.`; a second run on the same
  folder prints no key (SC-003: the output holds the key once).
- "the start opens the browser through a one-time link" (US4.1): the faked launcher gets
  `http://127.0.0.1:<port>/session/<token>?to=/r/<name>/`; that link signs in once.
- "a second start hands over with the host token, and signs its browser in" (US4.2): the second
  `main` prints `Uraeda already runs at http://127.0.0.1:<port>/r/<name>/` and opens a one-time
  link.
- "/open without the host token is refused" (US4.4): 401, the list unchanged.
- "a second start with another data folder" (edge case): prints
  `uraeda: port <port> is used by an Uraeda server with another data folder.` and exits 1.
- "a start without a desktop makes no link" (edge case): `openBrowser` skipped, no link made.
- "a new key on a running server" (US3.4): `main --new-key` prints
  `New access key, shown once: ura_…` and `Every device is signed out.`, then the handover line; an
  earlier session gets 401, the old key is refused.
- "a new key without a server" (US3.5): prints the two lines, then starts.
- "a new key the server refuses" (error handling): a wrong token →
  `uraeda: the server on port <port> refused the new key.`, exit 1, the key unchanged.
- "a session survives three restarts" (SC-004): `startServer` three times on one data folder.
- "the help names --new-key": `HELP` holds the help line.
- "the sign-in file and the output never hold a session token" (SC-003): after a sign-in, a
  sign-out, and a new key.
- `dev.test.ts`: `devHandler` with `signIn: false` serves fate without a cookie; without the
  option, 401.

The break each test catches: a key printed at every start or never; a browser opened on a bare
address; an unauthenticated handoff; a confusing message for another data folder; a link made over
SSH; a new key that leaves sessions alive; a refused key reported as success; sessions lost at a
restart; a token in the file or the log.

- [ ] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test packages/server/src/__tests__/main.test.ts packages/server/src/__tests__/open.test.ts`
- Expected: FAIL, the first on the missing `Access key, shown once:` line.

- [ ] **Step 3: Implement**

`main.ts` computes the data folder before handing over, reads the host token, and sends it; on a
free port it writes the host token after taking the port, removes it on exit, and starts with it.
`--new-key` replaces the key through `newKeyOn` when a server answers, else through `Server.newKey`
after the start, unless this start just made the key. `POST /session/key` needs the host token,
replaces the key, ends every session, and answers `{ key }`. The store's sweep runs with the
previews' sweep.

- [ ] **Step 4: Run all tests**

- Run: `nix develop -c vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages specs/2026-10-16-basic-security/plan.md
git commit -m "feat(basic-security): the access key at the start, the host token, and a new key"
```

## Task 5: The sign-in screen and signing out

**Files:**

- Create: `packages/web/src/sign-in/SignInPage.tsx`, `packages/web/src/sign-in/signedOut.ts`,
  `packages/web/scripts/sign-in-shots.ts`
- Modify: `packages/web/src/App.tsx` (the gate above the boundary), `packages/web/src/clients.ts`
  (`signedFetch`, `onLiveError`), `packages/web/src/attach/useAttach.ts`,
  `packages/web/src/attach/chatImages.ts`, `packages/web/src/RepositoryMenu.tsx` (the sign-out list
  and its dialog), `packages/web/scripts/screenshots.ts`
- Test: `packages/web/src/__tests__/sign-in.test.tsx`, `packages/web/src/__tests__/helpers.tsx`
  (`serverFetch` with sign-in and a cookie jar), `packages/web/src/__browser__/sign-in.test.tsx`,
  `packages/web/src/__browser__/layout.test.tsx`

**Interfaces:**

- Consumes: Task 2's routes and 401s.
- Produces, in `signedOut.ts`: `markSignedOut(): void`, `useSignedOut(): boolean`,
  `signedFetch(fetch?: typeof globalThis.fetch): typeof globalThis.fetch` (marks signed out on a 401
  from any path but `/session`), `probeSession(fetch?): Promise<void>` (`GET /session`, marks on
  401).
- Produces, in `SignInPage.tsx`:
  `SignInPage({ fetch, onSignedIn }: { fetch?: typeof globalThis.fetch; onSignedIn?: () => void })`,
  `onSignedIn` reloading the page by default.

- [ ] **Step 1: Write the failing tests, and the helpers they use**

The helper: `serverFetch` takes `{ signIn: true }`, creates the app with a store on its data folder,
keeps the cookies its answers set, sends them back, and returns the key.

- `sign-in.test.tsx` (jsdom, through the real app in process):
  - "a browser without a session sees the sign-in screen" (US1.2): heading "Sign in to Uraeda", the
    paragraph's text, "Access key", "Sign in" disabled while empty; no repository's name shows.
  - "the key signs in, and the page shows" (US1.3): type the key, press "Sign in": "Signing in…",
    then `onSignedIn` called; the app rendered again shows the repository's page.
  - "a wrong key says so, and keeps the text" (US1.4): "This is not Uraeda's access key." under the
    field, the field still holds `ura_wrong`.
  - "an unreachable server says so" (error handling): "Could not reach the Uraeda server."
  - "Sign out ends this session" (US3.1): open the repository menu, "Sign out": the sign-in screen
    shows, and the server's next request with the old cookie gets 401.
  - "Sign out everywhere asks first" (US3.2, US3.3): "Sign out everywhere…" opens "Sign out every
    device?" with its text and two buttons; "Cancel" keeps the page; "Sign out everywhere" shows the
    sign-in screen, and a second device's fetch gets the sign-in screen at its next read.
  - "a live stream that closes on a sign-out elsewhere shows the sign-in screen" (US3.3): end every
    session on the server; the page shows the sign-in screen.
  - "unsaved text survives a sign-out" (edge case): type a comment, end the session, sign in again:
    the comment is restored with its notice.
  - "an upload without a session shows the sign-in screen" (edge case).
- `__browser__/sign-in.test.tsx` (WebKit, both sizes, light and dark): the page's fate requests
  answered with 401, as a server without a session does: the sign-in screen passes `checkLayout` and
  `checkAccessibility`, empty and with the error; the repository menu with its sign-out list, and
  the dialog, pass them too. `layout.test.tsx`'s header names the sign-in screen with the others.

The break each test catches: the app drawn before the sign-in; a page that never shows after a
sign-in; the field cleared on an error; the unreachable server shown as a wrong key; a sign-out that
leaves the session on the server; no confirmation, or one that cannot be cancelled; a silent live
failure; drafts lost; an upload's 401 shown as a failed upload.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/sign-in.test.tsx`
- Expected: FAIL, `Cannot find module '../sign-in/SignInPage.tsx'`.

- [ ] **Step 3: Implement**

The gate sits in `App` inside `Theme`, above `ServerErrorBoundary`: while `useSignedOut()` is true,
it shows `SignInPage`, a page like `FirstRun` without the shell, its column centred at both widths.
The field is Astryx's `TextInput` of type password with `autocomplete="current-password"`; Enter
submits. The repository menu gets a third `List`, `aria-label="Sign out"`; "Sign out everywhere…"
confirms through the app's `Confirm` host, a dialog on wide screens and a bottom sheet on narrow
ones, as the UI layout decision says. `fateClients` passes `signedFetch(fetch)` and an `onLiveError`
that calls `probeSession`.

- [ ] **Step 4: Run all tests**

- Run: `nix develop -c vp run ready`
- Expected: PASS

- [ ] **Step 5: Take the screenshots**

- Run: `nix develop -c vp run --filter uraeda-web screenshots 2026-10-16-basic-security sign-in`
- Expected: `specs/2026-10-16-basic-security/screenshots/` holds the sign-in screen (empty, with the
  error), the menu with its sign-out list, and the dialog, at 402 × 874 and 1440 × 900, light and
  dark, each checked against the [mockup](mockups/sign-in.html) and the UI decisions.

- [ ] **Step 6: Commit**

```bash
git add packages/web specs/2026-10-16-basic-security
git commit -m "feat(basic-security): the sign-in screen, and signing out"
```

## Task 6: Documentation

**Files:**

- Modify: `README.md` (signing in, `--new-key`, a public address), `.env.example` (the same, next to
  `URAEDA_ALLOWED_HOSTS`)

- [ ] **Step 1: Write the documentation**

The README says: the first start shows the access key once; each device pastes it once and stays
signed in while used every 30 days; `uraeda --new-key` on the host makes a new one and signs every
device out; a public address goes through Caddy or Tailscale Funnel on the same machine, its host
name in `--allowed-hosts`, with a minimal Caddyfile:
`uraeda.example.com { reverse_proxy 127.0.0.1:4310 }`.

- [ ] **Step 2: Run all tests**

- Run: `nix develop -c vp run ready`
- Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add README.md .env.example specs/2026-10-16-basic-security/plan.md
git commit -m "docs(basic-security): signing in, and reaching Uraeda from a public address"
```
