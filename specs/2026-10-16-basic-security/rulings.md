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
