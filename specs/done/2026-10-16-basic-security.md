---
kind: feature
finished: 2026-10-16
pull-request: https://github.com/mrtolkien/uraeda/pull/22
---

# Record: Auth and login for basic security

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-16, finished on
> 2026-10-16, in [its pull request](https://github.com/mrtolkien/uraeda/pull/22). Its full files are
> in git: `git log -- specs/2026-10-16-basic-security/`.

## What and why

The human wanted to use Uraeda remotely, from a phone and a laptop, with "basic security": a single
user, easy to sign in from several places, with a key that stays stable across restarts, "simple
_but_ secure enough to start running uraeda on a public, internet-accessible server". Until then the
server's only protection was its `Host` and `Origin` checks and the tailnet. It also had to close
the hole the UI iteration flow left open on purpose: any website could read a running Storybook
preview by sending `Origin: null` from a sandboxed frame.

## Behaviour

- **One access key (US1).** The first start makes a key, `ura_` and 32 random bytes in base64url,
  and prints `Access key, shown once: <key>` and
  `Keep it in a password manager: every new device signs in with it.` after its `Uraeda server on …`
  line. Only its SHA-256 hash is stored, in `sign-in.json` in the data folder, mode `0600`, replaced
  atomically. The key typed is trimmed. A first start that fails removes the file it made, so the
  next start shows a key; a file that cannot be read, or written by another version, stops the start
  with
  `uraeda: cannot read <path>: <reason>. Fix it, or delete it to make a new access key and sign every device out.`
- **Sign-in screen.** A browser without a session sees "Sign in to Uraeda", a password field "Access
  key", and "Sign in" (disabled while empty, "Signing in…" while waiting), in a page without the
  sidebar at both widths. A wrong key answers after at least one second, shows "This is not Uraeda's
  access key." under the field, keeps the text, and is logged as
  `uraeda: failed sign-in from <address>`, never with the key; any other failure shows "Could not
  reach the Uraeda server.". A sign-in reloads the page.
- **Sessions.** A session is `<id>.<secret>` (16 and 32 random bytes), its secret stored as a hash,
  sent only in an `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=2592000` cookie: `__Host-uraeda`
  with `Secure` when the `Host` is exactly a listed host name, else `uraeda`. It ends 30 days after
  its last use (recorded at most once a day), on sign-out, or on a new key; signing in again
  replaces the device's session. Sessions survive restarts. Several servers on one data folder share
  `sign-in.json`, which each reloads when it changed, so a new key or a sign-out on one reaches the
  others.
- **Every route closed.** Every server route answers 401 `{ "error": "Sign in to Uraeda." }` without
  a session, and clears a stale cookie, except: the built UI's files, the `/session` routes, `/open`
  and `POST /session/key` with the host token, and preview and mockup paths with the frame secret. A
  test fails when a route of the app is missing from `SERVER_PATHS`. Answers outside previews and
  mockups carry `X-Frame-Options: SAMEORIGIN`; the `/session` routes `Cache-Control: no-store`;
  `POST /session` takes at most 4 KB.
- **Previews and mockups (US2).** Preview paths are `/r/<repository>/preview/<secret>/<folder>/`,
  given to signed-in pages through fate's `Preview` and `Story` records; mockups are served under
  `/r/<repository>/mockups/<secret>/`, and a signed-in request for a mockup without the secret is
  redirected there with 303. The secret is 32 random bytes in memory, made at each start, replaced
  whenever sessions end (once per turn of the event loop), which stops the Storybooks and makes open
  pages read their records again under the new base. A wrong secret is a 404, a right secret on a
  stopped Storybook a 503. `Origin: null` passes the guard only on paths with the right secret. The
  proxy drops the whole `Cookie` and `Authorization` headers, and preview and mockup answers carry
  `Referrer-Policy: no-referrer`. The mockup route serves only files with a `mockups` folder in
  their path; other HTML links open through `/raw/`. The Storybook process record holds no secret.
- **Signing out (US3).** The repository menu ends with "Sign out" and "Sign out everywhere…", which
  asks "Sign out every device?" ("Every browser signed in to Uraeda, this one included, will need
  the access key again.", "Sign out everywhere" and "Cancel"). Signing out ends the session and its
  live streams; other tabs and devices learn it from a 401 or their live stream closing, through
  `GET /session`. Unsaved text survives. `uraeda --new-key` on the host prints
  `New access key, shown once: <key>` and `Every device is signed out.`, through the running server
  with its host token, or at the start; a refusal prints
  `uraeda: the server on port <port> refused the new key.`
- **The host signs its browser in (US4).** Each start writes `server-<port>.token` (`0600`) in the
  data folder and removes it at exit. When a browser can open, the start, or a second start handing
  over through `/open` with that token, opens a `0600` page in the data folder that leads to a
  one-time link `/session/<token>?to=<page>`, valid 5 minutes, used once, in memory; the page is
  removed once used, expired, or at stop. A link's target must stay on the server. `/open` makes
  links only for the host token, and without it answers 401; a second start then prints
  `uraeda: port <port> is used by an Uraeda server with another data folder.` No flag or variable
  turns sign-in off; tests and Uraeda's own Storybook fixture create the app without it from code.
  `vp dev` signs in like the packaged server, and prints the key its start made.

## Design

A server module, [`packages/server/src/sign-in/`](/packages/server/src/sign-in/), holds one home for
each rule of the [sign-in](../decisions/sign-in.md) decision, after the guard in
[`app.ts`](/packages/server/src/app.ts):

- [`store.ts`](/packages/server/src/sign-in/store.ts): the only writer of `sign-in.json`, the key's
  hash and the sessions, with an abort signal per session and `onEnded` listeners.
- [`check.ts`](/packages/server/src/sign-in/check.ts): the session check, the only place that
  decides whether a request passes, the cookie's attributes, and the logged address.
- [`routes.ts`](/packages/server/src/sign-in/routes.ts): `GET`, `POST`, `DELETE /session`,
  `DELETE /sessions`, `GET /session/:token`, `POST /session/key`.
- [`frames.ts`](/packages/server/src/sign-in/frames.ts): the frame secret, read by the guard, the
  proxy and its upgrades, the mockup route, and fate's preview records.
- [`links.ts`](/packages/server/src/sign-in/links.ts) and
  [`host.ts`](/packages/server/src/sign-in/host.ts): one-time links and their pages, and the host
  token.
- [`server-paths.ts`](/packages/server/src/server-paths.ts): the server's paths, shared by the check
  and `vp dev`.
- [`main.ts`](/packages/server/src/main.ts), [`server.ts`](/packages/server/src/server.ts),
  [`open.ts`](/packages/server/src/open.ts),
  [`open-client.ts`](/packages/server/src/open-client.ts): the start, the handoff, and `--new-key`.
- In the web UI, [`sign-in/`](/packages/web/src/sign-in/): `signedOut.ts` (one fetch wrapper and a
  live-error probe set the signed-out state), `SignInPage.tsx`, `SignOutList.tsx`, and
  `useSignOut.ts`, shown by a gate in [`App.tsx`](/packages/web/src/App.tsx) above everything else.

## Questions

### Round 01

#### Q1: What do you sign in with?

**Answer:** A, a key Uraeda generates, shown once and stored as a hash, "as it seems simple", with
passkeys added to **Next** in the priorities.

#### Q1.A: How does a phone get signed in?

**Answer:** B, paste the key only: "Let's keep this as simple as possible for the moment."

#### Q2: How long does a device stay signed in, and how is it signed out?

**Answer:** A, sessions stored as hashes, ending after 30 days without use, with "Sign out" and
"Sign out everywhere".

#### Q3: Does a browser on this machine sign in too?

**Answer:** A, yes, everywhere, the start opening the browser through a one-time link.

#### Q4: Does your tailnet sign you in?

**Answer:** A, no: the key is the sign-in.

#### Q5: How does a public server reach Uraeda?

**Answer:** A, through a proxy on the same machine that ends TLS: "This is more of a hypothetical,
so reverse proxy is ok."

#### Q6: How do previews and mockups prove they come from you?

**Answer:** A, a secret per session in the path. The spec read it as one secret shared by every
session and replaced whenever one ends, since one Storybook bakes its address in at start and serves
every session.

#### Notes

- **One owner, no accounts**: several users go to **Later** in the priorities.

## Decisions

- [Sign-in](../decisions/sign-in.md), new: one generated access key, sessions on the server, every
  route closed but a short list, frames proved by a secret in their path, no switch to turn it off.
- [Stack](../decisions/stack.md), changed: `Origin: null` reaches only preview and mockup paths
  carrying the frame secret, and preview paths hold it.

## Changes after approval

- The spec review's only comment asked for the sign-out items to move to the settings page later:
  noted in that draft, the items stay in the repository menu meanwhile.
- No `Access` fate record: preview addresses come from the existing records, and mockups from a 303
  redirect to the secret path (R3).
- `Origin: null` on a frame's path without the secret is a 404 from the guard, not a 403 (R13).
- A one-time link is made only when a browser opens, and reached through a `0600` page in the data
  folder rather than on the opener's command line (R18, R27).
- The mockup route serves only files of a `mockups` folder; other HTML links open as text (R28).
- `sign-in.json` is reloaded when another server changed it (R30), and a failed first start removes
  the key it made (R31).
- `vp dev` prints the key its start made (R19); `--new-key` prints one key, after the server's
  address (R20).

## Follow-ups

- Two servers on one data folder writing `sign-in.json` in the same instant can lose one write: no
  lock serializes their read-modify-write (R30).
- `uraeda --new-key` cannot reach a `vp dev` server, which writes no host token.
- The address logged for a failed sign-in is the first `X-Forwarded-For` entry, which a client can
  choose behind a proxy that appends.
- The `uraeda` cookie on `http://127.0.0.1` is sent to every port of the machine: cookies are not
  separated by port.
- `packages/server/src/__tests__/sessions.test.ts` and `runner/__tests__/sessions.test.ts` time out
  in an `afterAll` hook under the full run's load, before this feature too; they pass alone.
