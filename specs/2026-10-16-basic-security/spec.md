---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: high
plan-review: false
---

# Spec: Auth and login for basic security

> [!IMPORTANT]
>
> Spec to review, about 25 minutes.
>
> - A new decision, [sign-in](../decisions/sign-in.md): one generated access key, sessions on the
>   server that end after 30 days without use, every route closed by default, and no switch to turn
>   it off.
> - Your answer to the previews question is read one way: one secret per session is impossible,
>   since a Storybook bakes its address in when it starts and serves every session. Instead, one
>   frame secret is shared by every session and replaced whenever a session ends, which restarts the
>   running Storybooks. Signing a device out still cuts off every preview address it had.
> - The [stack](../decisions/stack.md) decision changes: `Origin: null` reaches only preview and
>   mockup paths carrying that secret, and the hole the UI iteration flow left is closed.
> - The key is shown once, in the terminal at the first start: lost, it is replaced with
>   `uraeda --new-key` on the host, which signs every device out.
> - The host signs its browser in by itself: starting Uraeda opens the browser through a one-time
>   link, and a second start proves it runs on the host with a token file in the data folder.
> - This branch takes the UI iteration flow's code by merging `main` once that flow merges, before
>   the plan.
> - Risk tier `high`, a security change to every route. The plan does not wait for your review.

The human reaches Uraeda from a phone and a laptop, and one day from a public address. This feature
signs each browser in once with an access key the server generates, keeps devices signed in across
restarts, lets the human sign one device or every device out, and closes the hole the UI iteration
flow left in Storybook previews, where any website could read a running preview. See the
[proposal](proposal.md), [discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## User stories

### US1: Sign in with the access key (P1)

The first start makes an access key and shows it once in the terminal. A browser with no session
sees the sign-in screen, pastes the key once, and stays signed in, across restarts, while it is used
at least every 30 days.

Why this priority: it is the proposal's ask, and it protects every route on its own.

Acceptance scenarios:

1. **Given** a data folder with no `sign-in.json`, **When** the server starts, **Then** it prints
   `Access key, shown once: ura_` followed by 43 characters, then
   `Keep it in a password manager: every new device signs in with it.`, and `sign-in.json` holds the
   key's SHA-256 hash, not the key.
2. **Given** a phone with no session, **When** it opens `https://mac.tail1234.ts.net/r/todo/`,
   **Then** it shows the sign-in screen, and the server answers its `/r/todo/fate` request with 401
   and no repository data.
3. **Given** the sign-in screen at `/r/todo/`, **When** the human pastes the key and presses **Sign
   in**, **Then** the page `/r/todo/` shows, and the answer sets the cookie `__Host-uraeda` with
   `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and `Max-Age=2592000`.
4. **Given** the sign-in screen, **When** the human submits `ura_wrong`, **Then** the answer comes
   after at least one second, the screen shows "This is not Uraeda's access key." under the field,
   the field keeps its text, and the server prints `uraeda: failed sign-in from 100.101.102.103`,
   the address `tailscale serve` forwarded.
5. **Given** a phone signed in, **When** the server restarts, **Then** the phone's next request is
   signed in.
6. **Given** a session last used on 2026-10-01 at 10:00, **When** its device sends a request on
   2026-10-31 at 10:01, **Then** the server answers 401 and removes the session; **When** instead it
   sends one on 2026-10-30, **Then** it is signed in, and the session's last use becomes 2026-10-30.
7. **Given** a browser on `http://127.0.0.1:4310`, **When** it signs in, **Then** the cookie is
   `uraeda`, with `HttpOnly`, `SameSite=Lax`, `Path=/`, and no `Secure`.

### US2: Previews and mockups are closed to other websites (P1)

Preview and mockup frames load from addresses carrying the frame secret, which only a signed-in page
receives. Other websites, and old addresses, get a 404.

Why this priority: it closes the hole the stack decision accepted only until this feature.

Acceptance scenarios:

1. **Given** a running Storybook for `todo`'s `main` checkout, **When** a page on another website
   frames `/r/todo/preview/main/iframe.html` with `Origin: null`, **Then** the server answers 404.
2. **Given** a signed-in story view, **When** it shows a story, **Then** its frame loads
   `/r/todo/preview/<frame secret>/main/iframe.html?id=…&viewMode=story`, and Storybook's scripts,
   nested frame, and WebSocket load through that base without any cookie.
3. **Given** a signed-in mockup page, **When** it shows `specs/<folder>/mockups/repeat.html`,
   **Then** its frame loads `/r/todo/mockups/<frame secret>/specs/<folder>/mockups/repeat.html`.
4. **Given** a request under a preview path, **When** the proxy forwards it to Storybook, **Then**
   Storybook receives no `uraeda` or `__Host-uraeda` cookie and no `Authorization` header.
5. **Given** a running Storybook and two signed-in devices, **When** one signs out, **Then** the
   frame secret changes, the Storybook restarts under the new address, the other device's story view
   reloads its frame at the new address once it is ready, and the old address answers 404.

### US3: Sign out one device, or every device (P2)

The repository menu ends with **Sign out** and **Sign out everywhere…**. A lost phone is cut off
from the laptop, and a lost key is replaced on the host.

Why this priority: the session list exists for it, but signing in works without it.

Acceptance scenarios:

1. **Given** a signed-in laptop, **When** the human picks **Sign out** in the repository menu,
   **Then** the sign-in screen shows, the session is gone from `sign-in.json`, the cookie is
   cleared, and the session's live streams are closed.
2. **Given** a signed-in laptop and phone, **When** the human picks **Sign out everywhere…** on the
   laptop, **Then** a dialog asks "Sign out every device?", with "Every browser signed in to Uraeda,
   this one included, will need the access key again." and the buttons **Sign out everywhere** and
   **Cancel**.
3. **Given** that dialog, **When** the human presses **Sign out everywhere**, **Then** every session
   is removed, the laptop shows the sign-in screen, and the phone shows it at its next request or
   when its live stream closes.
4. **Given** a server running on port 4310, **When** the human runs `uraeda --new-key` on the host,
   **Then** it prints `New access key, shown once: ura_` and 43 characters, then
   `Every device is signed out.`, every session ends, and the old key is refused.
5. **Given** no server running, **When** the human runs `uraeda --new-key`, **Then** it makes the
   new key, prints the same two lines, and starts the server as usual.

### US4: The host signs its browser in by itself (P2)

Starting Uraeda on the host opens a browser already signed in, as today, and a second start does the
same.

Why this priority: it keeps the host's start unchanged, as the answer to signing in on this machine
asked, but sign-in works without it.

Acceptance scenarios:

1. **Given** a desktop session on the host and no browser session, **When** `uraeda` starts in
   `~/dev/todo`, **Then** the browser opens
   `http://127.0.0.1:4310/session/<one-time token>?to=/r/todo/`, and lands signed in on `/r/todo/`,
   with `/r/todo/` in the address bar.
2. **Given** a server already running, **When** `uraeda` runs again in `~/dev/todo`, **Then** it
   posts its folder to `/open` with the host token, and the browser it opens lands signed in the
   same way.
3. **Given** a one-time link already used, or made more than 5 minutes ago, **When** a browser opens
   it, **Then** it lands on the sign-in screen at its target page.
4. **Given** a running server, **When** a request posts to `/open` without the host token, **Then**
   the server answers 401 and adds no repository.

## Edge cases

- **Uploads and image deletions** (`/r/<repository>/attach`, `/r/<repository>/chat-images/<id>`)
  need a session like every route; a 401 shows the sign-in screen.
- **A text being written when the session ends**: the unsaved text stays in the browser, as the UI
  behaviour decision keeps it, and shows again after signing in. The mutation that met the 401 is
  not retried: the human sends it again.
- **A cookie whose session is gone** (signed out elsewhere, expired, new key): the server answers
  401 and clears the cookie.
- **Two tabs on one device**: signing out in one closes the other's live stream; the other shows the
  sign-in screen at its next request.
- **A frame secret replaced while a Storybook starts**: the start is stopped and begins again under
  the new address.
- **A mockup opened in its own tab**: its address carries the frame secret, so it loads; it stops
  loading once a session ends, and the page that linked it gives the new address.
- **`sign-in.json` unreadable or invalid**: the server does not start, and prints
  `uraeda: cannot read <path>: <reason>. Fix it, or delete it to make a new access key and sign every device out.`
- **The data folder not writable at the first start**: the server does not start, and prints
  `uraeda: cannot write <path>: <reason>`.
- **A second start with another data folder** finds no host token for the port: it prints
  `uraeda: port 4310 is used by an Uraeda server with another data folder.` and exits 1.
- **A start with no desktop** (over SSH): no browser opens and no one-time link is made; the human
  signs in with the key.
- **A request with a foreign `Host` or `Origin`** is refused by the guard before any session check,
  as today.
- **Signing in while signed in** makes a new session for the device and removes the one its cookie
  named.

## Success criteria

- **SC-001**: Every route of the app answers 401 without a session, except the exceptions of the
  sign-in decision, each checked by a row of one table-driven test.
- **SC-002**: No preview or mockup path answers without the current frame secret, for `GET`, `HEAD`,
  and WebSocket upgrades, with or without `Origin: null`.
- **SC-003**: After a sign-in, a sign-out, and a new key, neither `sign-in.json` nor the server's
  output holds a session token, and the key appears only in the line that showed it.
- **SC-004**: A device signed in once is still signed in after three restarts of the server.

## Architecture

Sign-in is a module of the server, `packages/server/src/sign-in/`, with one home for each rule of
the new [sign-in](../decisions/sign-in.md) decision, in front of every route. It follows the Lucia
reference's shape: a token `id.secret`, its hash stored, a sliding expiry
([auth libraries](discovery-01.md#auth-libraries)), without a dependency. Previews and mockups prove
themselves with a frame secret in their path, since sandboxed frames get no cookie
([cookies in sandboxed frames](discovery-01.md#cookies-in-sandboxed-frames)).

- **Main units**: a store of the key and sessions in `sign-in.json`; a session check, as Hono
  middleware and as a function the WebSocket upgrade calls; the `/session` routes; the frame secret;
  one-time links; the host token. In the web UI, the sign-in screen and the sign-out items.
- **Where the rules live**: what a valid session is, in the session check only; which routes need
  none, in one list next to it; the frame secret's check, in the frame secret, called by the proxy,
  its upgrade, and the mockup route; the cookie's attributes, in the `/session` routes only.
- **One secret, many sessions**: a Storybook bakes its base into its pages and its module URLs when
  it starts, and one Storybook serves every session. So the frame secret is one, in memory, made at
  each start and replaced whenever a session ends: signed out, expired, or by a new key. Its
  listeners restart the running Storybooks and publish the new addresses through fate's live views.
- **Tradeoffs**: signing a device out restarts the Storybooks, a few seconds of loading on the other
  devices. Restarting the server makes a new frame secret, which changes nothing, since Storybooks
  stop with the server. The key is never stored, so it cannot be shown again.
- **Improvements in passing**: the guard's `Origin: null` exception moves from a path pattern to the
  frame secret's check, and `/open` gets the same session layer as every route instead of none.

## Mockups

- [Sign-in](mockups/sign-in.html): the sign-in screen empty, signing in, and with a wrong key; the
  repository menu with the sign-out items, at both widths; the dialog of **Sign out everywhere…**;
  and the terminal at the first start and with `--new-key`.

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- This branch takes the UI iteration flow's code by merging `main` once that flow merges, before the
  plan is written.
- Uraeda has one owner and no accounts. Several users are a later feature, in the priorities.
- The key and sessions live in one file of the data folder, `0600`, replaced atomically, not in
  `runner.sqlite`.
- The cookie is `HttpOnly` and `SameSite=Lax`, `__Host-` with `Secure` over HTTPS, without the
  prefix over plain HTTP on 127.0.0.1.
- A failed sign-in waits a second and is logged; the key cannot be guessed, so there is no lockout.
- Signing out ends the session, its live streams, and the frame secret; a request whose session
  ended gets a 401, and the UI shows the sign-in screen, then the page asked for.
- The second start on the host proves it runs there by reading the data folder, and gets a one-time
  link for the browser it opens.
- The proxy removes Uraeda's cookie and `Authorization` before forwarding, previews and mockups
  answer with `Referrer-Policy: no-referrer`, and Uraeda's pages refuse to be framed by other sites.
- No flag or setting turns sign-in off; tests and fixtures create the app without it from code.

Settled while writing this spec:

- **Q6 is read one way**: the frame secret is one for every session, replaced whenever a session
  ends, since one secret per session cannot reach a Storybook that baked its base in at start
  ([discovery](discovery-01.md#previews-and-mockups)).
- Mockups get the frame secret too: their frames are sandboxed like previews', and get no cookie.
- The key is hashed with SHA-256, not Argon2: 256 random bits need no slow hash
  ([OWASP and NIST](discovery-01.md#owasp-and-nist)).
- A session's last use is recorded at most once a day, so a session ends between 30 and 31 days
  after its last use, and the file is written at most once a day per device.
- The host token is a random file, `server-<port>.token`, written `0600` in the data folder at each
  start and removed at stop. A process that can read it can already read `sign-in.json`.
- One-time links live in the server's memory, valid 5 minutes, used once: a restart drops them.
- `uraeda --new-key` is a flag of the server's command, `uraeda`, not of `ura`: the `ura` CLI never
  talks to the server.
- The sign-in screen is a React page of the UI, shown instead of the app when a fate read answers
  401, so it also works under `vp dev`, where Vite serves the page.
- `vp dev` signs in like the packaged server. The browser tests, the server tests, and Uraeda's own
  Storybook fixture create the app without sign-in, except the sign-in tests.
- The README and `.env.example` get a section on reaching Uraeda from a public address, through
  Caddy or Tailscale Funnel, with the host name in `--allowed-hosts`.
- Passkeys are added to **Next** and several users to **Later** in the priorities, as the answers
  asked.
- Mockups are a static HTML page: this branch has no active preview decision yet.

## Decisions

New, applied when this spec is approved:

- [Sign-in](../decisions/sign-in.md): one generated access key stored as a hash, sessions on the
  server ending after 30 days without use, every route closed except a short list, frames proved by
  a secret in their path, and no switch to turn it off.

Changed, applied when this spec is approved:

- [Stack](../decisions/stack.md): `Origin: null` reaches only preview and mockup paths carrying the
  frame secret, and preview paths become `/r/<repository>/preview/<secret>/<folder>/`. See its
  [proposed change](../decisions/stack.md#proposed-change-2026-10-16-basic-security).

Relied on:

- [Distribution](../decisions/distribution.md): `--new-key` is a flag, and the packaged server still
  reads no `.env`.
- [Repositories](../decisions/repositories.md) and [agents](../decisions/agents.md): `sign-in.json`
  sits in the data folder next to `repositories.json`, outside `runner.sqlite`, which stays a cache.
- [UI layout](../decisions/ui-layout.md): the sign-in screen is its own page at both widths, the
  menu is a popover or a bottom sheet, and the dialog a dialog or a bottom sheet.
- [UI components](../decisions/ui-components.md): Astryx's `TextInput`, `Button`, `List`, and
  dialog; no raw elements.
- [UI behaviour](../decisions/ui-behaviour.md): only the irreversible **Sign out everywhere** asks
  first; the error stays on screen until the next try; unsaved text survives a sign-out.
- [UI checks](../decisions/ui-checks.md): the sign-in screen joins the pages checked at both sizes
  and in both themes.
- [Code quality](../decisions/code-quality.md): the new module stays within the limits, and `app.ts`
  grows by one middleware.
- Preview, from the UI iteration flow: the Storybook still gets its base from `URAEDA_PREVIEW_BASE`,
  now with the secret in it.

## Constitution check

| Principle                                  | Complies | Notes                                                                       |
| ------------------------------------------ | -------- | --------------------------------------------------------------------------- |
| I. Humans stay in control                  | yes      | One new decision and one change, both applied only on approval              |
| II. Git and plain text first               | yes      | Sign-in state is machine state in the data folder, not workflow state       |
| III. Asynchronous by default               | yes      | Sessions survive restarts; nothing in the workflow depends on being online  |
| IV. Review effort matches impact           | yes      | Every question was asked with a recommendation; the rest is assumptions     |
| V. Tools are optional                      | yes      | Sign-in guards the web UI only; files, `ura`, and editors are unchanged     |
| VI. Code is checked and stays maintainable | yes      | Every scenario has a test; no new dependency; a new module, not a grown one |

## Risk tier

**High**: a security change in front of every route, with a new file of credentials in the data
folder.

## Details

### Data

`sign-in.json`, in the data folder, mode `0600`, written to a temporary file and renamed:

```ts
type SignInFile = {
  version: 1;
  key: string; // SHA-256 of the access key, base64url
  sessions: Array<{
    id: string; // 16 random bytes, base64url, public
    secret: string; // SHA-256 of the session's 32-byte secret, base64url
    created: string; // ISO 8601, UTC
    used: string; // ISO 8601, UTC, updated at most once a day
  }>;
};
```

- The access key is `ura_` and 32 random bytes in base64url, 43 characters. Checking it hashes the
  typed text and compares the hashes in constant time.
- The cookie holds `<id>.<secret>`, both base64url. Checking it finds the session by `id`, then
  compares the secret's hash in constant time. `Max-Age` is 30 days, and is set again each time
  `used` is updated. A request counts as HTTPS when its `Host` is a listed host name, as the guard
  already assumes for their origins; the cookie is then `__Host-uraeda` with `Secure`.
- The address logged for a failed sign-in is `X-Forwarded-For` when the request's `Host` is a listed
  host name, since only a local proxy can send those, and the socket's address otherwise.
- A session ends when `now − used` exceeds 30 days, checked at each request and by the server's
  existing sweep, which removes ended sessions from the file.
- The frame secret: 32 random bytes in base64url, in memory only. The global fate source gets an
  `Access` record, `{ frameSecret: string }`, read by the story and mockup views and updated live
  when it changes.
- One-time links: a map in memory from a 32-byte token to `{ expires, to }`, `to` a path on the
  server starting with `/`.
- The host token: `server-<port>.token` in the data folder, 32 random bytes in base64url, `0600`,
  written at start, removed at stop, sent by the second start as `Authorization: Bearer <token>`.

### Components

- **Sign-in store** (`packages/server/src/sign-in/store.ts`, new): reads and writes `sign-in.json`;
  `ensureKey()` makes the key at the first start and returns it once, `replaceKey()`,
  `checkKey(text)`, `createSession()`, `findSession(cookie, now)`, `touch(session, now)`,
  `endSession(id)`, `endAll()`. It emits `ended` for every session that ends. Takes the data folder
  and a clock.
- **Tokens** (`packages/server/src/sign-in/tokens.ts`, new): random tokens, SHA-256 hashes, and the
  constant-time comparison. Pure.
- **Session check** (`packages/server/src/sign-in/check.ts`, new): Hono middleware after the guard.
  It lets through the routes the decision lists, finds the session from the cookie, refreshes it,
  and sets it on the context; otherwise it answers 401 with `{ "error": "Sign in to Uraeda." }` and
  clears a stale cookie. It wraps `/fate/live` requests in a signal aborted when their session ends.
- **Sign-in routes** (`packages/server/src/sign-in/routes.ts`, new):
  - `POST /session` with `{ key }`: 204 and the cookie, or, after one second, 401 with
    `{ "error": "This is not Uraeda's access key." }` and a log line.
  - `DELETE /session`: ends this session, clears the cookie, 204.
  - `DELETE /sessions`: ends every session, clears the cookie, 204.
  - `GET /session/<token>?to=<path>`: uses a one-time link, sets the cookie, and redirects with 303
    to `to`; an unknown or expired token redirects to `to` without a cookie.
  - `POST /session/key` with the host token: replaces the key, ends every session, and answers
    `{ key }` with `Cache-Control: no-store`.
  - Every answer carries `Cache-Control: no-store`.
- **Frame secret** (`packages/server/src/sign-in/frames.ts`, new): `current()`, `check(text)`, and
  `replace()`, which notifies its listeners. Listens to the store's `ended`.
- **One-time links and host token** (`packages/server/src/sign-in/links.ts` and `host.ts`, new):
  `make(to)` and `use(token, now)`; `writeHostToken(port)`, `readHostToken(port)`,
  `removeHostToken(port)`.
- **Guard** ([`guard.ts`](/packages/server/src/guard.ts)): the `Origin: null` exception asks the
  frame secret instead of matching a path. `PREVIEW_PATH` becomes
  `/r/<repository>/preview/<secret>/<folder>/` and a mockup pattern joins it.
- **Preview proxy and runner** (`packages/server/src/preview/`): the base passed as
  `URAEDA_PREVIEW_BASE` carries the secret; the proxy checks it, for reads and in `previewUpgrade`,
  removes `Cookie` and `Authorization` before forwarding, and adds `Referrer-Policy: no-referrer`.
  On `replace()`, running Storybooks restart under the new base.
- **Files** ([`files.ts`](/packages/server/src/files.ts)): mockups move to
  `/r/<repository>/mockups/<secret>/<path>`, checked by the frame secret, with
  `Referrer-Policy: no-referrer`.
- **Server start** ([`main.ts`](/packages/server/src/main.ts),
  [`open.ts`](/packages/server/src/open.ts),
  [`open-client.ts`](/packages/server/src/open-client.ts),
  [`options.ts`](/packages/server/src/options.ts)): the first start prints the key; the start writes
  the host token and opens the browser through a one-time link; the handoff sends the host token,
  and `/open` answers a one-time link as its `url`; `--new-key` replaces the key, through
  `/session/key` when a server runs. The help gains
  `--new-key               make a new access key and sign every device out`.
- **Other pages refuse framing**: every answer outside preview and mockup paths carries
  `X-Frame-Options: SAMEORIGIN`.
- **`vp dev`** (`packages/server/src/dev.ts`): `SERVER_PATHS` gains `session` and `sessions`, and
  `devUpgrade` the new preview pattern.
- **Sign-in screen** (`packages/web/src/sign-in/SignInPage.tsx`, new): a full page like the first
  run's, without the sidebar: the heading "Sign in to Uraeda", the text "Paste the access key Uraeda
  showed when it first started. On the machine that runs Uraeda, `uraeda --new-key` makes a new one
  and signs every device out.", a password `TextInput` labelled "Access key" with
  `autocomplete="current-password"`, and the button **Sign in**, disabled while the field is empty
  and reading "Signing in…" while waiting. On success it reloads the current page.
- **Signed-out state** (`packages/web/src/sign-in/signedOut.ts`, new): set when a fate read or
  mutation fails with `UNAUTHORIZED`, or when fate's `onLiveError` fires and `GET /session`
  answers 401. `ServerErrorBoundary` and the shell render the sign-in screen while it is set.
- **Repository menu** (`packages/web/src/RepositoryMenu.tsx`): a third list group with **Sign out**
  and **Sign out everywhere…**, the second confirmed by the dialog of US3.
- **Frames** (`StoryEmbed.tsx`, `StorybookPage.tsx`, `MockupPage.tsx`, `routes.tsx`): addresses come
  from the `Access` record and the preview's base, never built from a path alone.
- **Documentation**: the README and `.env.example` explain the access key, `--new-key`, and a public
  address through Caddy or Tailscale Funnel.

### Error handling

- A wrong key: "This is not Uraeda's access key." under the field, until the next try.
- The server unreachable while signing in: the sign-in screen shows "Could not reach the Uraeda
  server." under the button, like the upload's error.
- A request without a valid session: 401 `{ "error": "Sign in to Uraeda." }`; the UI shows the
  sign-in screen and keeps unsaved text.
- An unreadable `sign-in.json`, an unwritable data folder, and a second start with another data
  folder: the messages of the edge cases, and the server does not start.
- `--new-key` refused by a running server (a wrong host token): it prints
  `uraeda: the server on port 4310 refused the new key.` and exits 1, and the key is unchanged.
- A Storybook that fails to restart after `replace()`: the story view shows the preview's existing
  error, as for any failed start.

### Testing

The server's integration tests call the app in process with `app.request`, on a temporary data
folder, with the clock set by the test, and read the cookie and status of each answer. The web UI's
tests render the app over that server, and the browser tests drive the sign-in screen and the menu
in WebKit at both sizes, through labels and visible text. Existing tests create the app without
sign-in; the sign-in tests create it with a key they made.

| What                                                       | Test                                                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| US1.1, unreadable file, unwritable folder                  | Server start tests on a temporary data folder, reading the output and the file         |
| US1.2 to US1.7, cookie gone, signing in again              | Sign-in route tests with a fake clock                                                  |
| US2.1 to US2.5, secret replaced during a start, mockup tab | Preview proxy, runner, and files tests with a fake Storybook                           |
| US3.1 to US3.3, two tabs                                   | Sign-in route tests, and browser tests of the menu and the dialog at both sizes        |
| US3.4, US3.5, refused new key                              | Server start tests, with and without a running server                                  |
| US4.1 to US4.4, other data folder, no desktop              | Server start and handoff tests, with the browser launcher faked                        |
| Uploads and deletions, foreign `Host` or `Origin`          | Rows of the SC-001 table                                                               |
| Unsaved text across a sign-out                             | Web UI test: write a comment, end the session, sign in, read the restored text         |
| Sign-in screen states                                      | Browser tests at 402 × 874 and 1440 × 900, light and dark, with axe-core               |
| SC-001                                                     | Table-driven test: one row per route of the app, without a session                     |
| SC-002                                                     | Table-driven test: preview and mockup paths, methods, and origins, without the secret  |
| SC-003                                                     | Test reading `sign-in.json` and the captured output after sign-in, sign-out, a new key |
| SC-004                                                     | Server start test restarting three times on one data folder                            |
