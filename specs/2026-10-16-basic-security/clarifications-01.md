---
status: awaiting-human
---

# Clarifications, round 01: Auth and login for basic security

> [!IMPORTANT]
>
> 7 questions on signing in, sessions, and previews, about 25 minutes.
>
> - What you sign in with lasts beyond this feature: a generated key, a password, or passkeys. How a
>   phone gets signed in follows from it.
> - Two choices change the stack decision: how previews prove they come from you, since sandboxed
>   frames get no cookie in Chromium or Firefox, and whether a public server goes through a proxy or
>   Uraeda listens on a public address itself.
> - Two shortcuts are weighed and not recommended: skipping sign-in on this machine, and trusting
>   Tailscale's identity.
> - The proposal asks to start from the UI iteration branch: this round read its code, and the
>   branch takes it once that flow merges, since merging it now brings 18 conflicting files.
> - Nine points are settled without you, at the end.

## Context

The [proposal](proposal.md) asks that only you reach Uraeda, from your phone and your laptop, signed
in once per device with a key that survives restarts, simple but safe on a public server. It must
also close the hole the UI iteration flow left in Storybook previews: any website open in your
browser can read a running preview, since the guard lets `Origin: null` read preview paths.

Today the server has no sign-in. It listens on 127.0.0.1 and refuses a foreign `Host` or `Origin`
([guard.ts](/packages/server/src/guard.ts)); whoever passes can commit, start agents, add any
folder as a repository, and run its preview command. You reach it through `tailscale serve`, so the
tailnet is its only protection.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: What do you sign in with?

VS Code's `serve-web` uses one generated token kept in a file; Jupyter, code-server, and Syncthing
use a password stored as a hash; passkeys appear only in proxies like Authelia. Every product
recovers a lost secret with a command on the host. How a phone signs in is Q1.A. More in
[discovery](discovery-01.md#the-credential).

Why it matters: it decides what you keep in your password manager, whether guessing is a risk the
server must slow down, and how you recover.

- **A (recommended). A key Uraeda generates on its first start, 256 random bits shown once and
  stored only as a hash in its data folder. You paste it once per device; a command on the host
  makes a new one, which signs every device out.**
  - [pro] it cannot be guessed, so failed attempts need no lockout an attacker could use against
    you; nothing to choose; no dependency.
  - [con] 43 characters to paste: fine from a password manager, painful to type on a phone without
    one. Lost, it is replaced, not shown again.
  - Why recommended: it is the "stable key" the proposal asks for, and the only option where safety
    on a public server does not depend on a limit on failures.
- **B. A password you choose, at least 15 characters, set and reset by a command on the host,
  stored as an Argon2id hash (built into Node 24).**
  - [pro] easy to remember and type anywhere.
  - [con] guessable: the server needs a limit on failures, and any such limit lets an attacker on
    the internet keep you out for its duration.
- **C. Passkeys: each device registers one, the first through a one-time link printed on the host,
  with that link as the recovery.**
  - [pro] the strongest and phishing-proof, unlocked by your phone's or laptop's biometrics.
  - [con] the `@simplewebauthn` dependency, two ceremonies and a list of stored credentials; no
    passkey on `http://127.0.0.1`; changing the host name (another tailnet, your own domain)
    orphans every passkey.
- **D. No lasting secret: every device is signed in by a one-time link, from a signed-in device or
  printed on the host.**
  - [pro] nothing to leak or store.
  - [con] when every device is signed out, only the host's shell gets you back in.

**Answer:**

### Q1.A: How does a phone get signed in?

Only if you picked A or B in Q1. None of the products compared signs a device in from another; they
all expect the secret to be typed or pasted. More in
[discovery](discovery-01.md#signing-in-a-new-device).

These options combine: C can come on top of A or B.

- **A (recommended). Paste the key, or scan a QR code that a signed-in device shows on request: a
  one-time sign-in link, valid five minutes, used once.**
  - [pro] a phone signs in by pointing its camera at the laptop.
  - [con] a QR code encoder: a small module written in the project, or a dependency like `qrcode`.
  - Why recommended: it removes the one painful step of option A in Q1, typing a long key on a
    phone.
- **B. Paste the key only, from a password manager.**
  - [pro] nothing more to build.
  - [con] a phone without the password manager has to have the key typed.
- **C. Also a command on the host that prints a one-time sign-in link.**
  - [pro] signs a device in with no other device at hand, without changing the key.
  - [con] one more command to build and document.

**Answer:**

## Q2: How long does a device stay signed in, and how is it signed out?

Syncthing, Home Assistant, and Grafana keep sessions on the server, so one device can be signed
out; Jupyter and code-server only clear the cookie, and signing everything out means changing the
secret. Sessions last one week (VS Code, Syncthing) to a month (Open WebUI); NIST's lowest level
asks to sign in again at least every 30 days. More in [discovery](discovery-01.md#sessions).

Why it matters: it decides how often you sign in again on each device, and what you can do if a
device is lost.

- **A (recommended). Sessions are stored as hashes in the data folder, survive restarts, and end
  after 30 days without use. The UI has "Sign out" for this device and "Sign out everywhere".**
  - [pro] a device used every week never signs in again; a lost device is cut off with one click.
  - [con] a file of sessions in the data folder, written on sign-in and at most once a day per
    device.
  - Why recommended: it meets "easy to log in from multiple places" with the smallest UI that still
    handles a lost phone.
- **B. As A, plus a page listing devices, with their browser, last use, and a sign-out button
  each.**
  - [pro] sign out the lost phone and only it.
  - [con] a new page, for a single user who has two or three devices.
- **C. A signed cookie valid 30 days, with no sessions on the server.**
  - [pro] no session file.
  - [con] no way to sign one device out: a lost phone stays in until the key changes.

If 30 days does not suit you, give another duration in your answer.

**Answer:**

## Q3: Does a browser on this machine sign in too?

Every proxy, `tailscale serve` and Caddy included, connects to Uraeda from 127.0.0.1, so a local
request cannot be told apart by its address; the `Host` header can be sent by any local process or
another user of the machine, and NGINX rewrites it to the upstream's address by default. More in
[discovery](discovery-01.md#this-machine).

- **A (recommended). Yes, everywhere. Starting Uraeda opens the browser with a one-time sign-in
  link, and starting it again signs a new browser in the same way, so the host feels unchanged.**
  - [pro] one rule, with nothing a proxy's configuration can break.
  - [con] a browser on the host that was not opened by Uraeda, after its session ends, needs the
    key or a new start.
  - Why recommended: the exemption is exactly the kind of hole a proxy's default turns into a
    public bypass.
- **B. No: a request whose `Host` is `127.0.0.1` or `localhost` is signed in.**
  - [pro] nothing changes on the host.
  - [con] other users of the machine, any local process, and a proxy forwarding `Host: 127.0.0.1`
    get full access.

**Answer:**

## Q4: Does your tailnet sign you in?

`tailscale serve` adds a `Tailscale-User-Login` header to requests from your devices and removes
copies sent by clients; Funnel requests have none. A proxy other than `serve` on the same machine,
like Caddy for a public address, would pass a forged header straight through. More in
[discovery](discovery-01.md#the-tailnet).

- **A (recommended). No: the tailnet is a network, and the key or password is the sign-in.**
  - [pro] one way in, the same on the tailnet and in public.
  - [con] each tailnet device signs in once, as in Q1.A.
  - Why recommended: the header is safe only as long as nothing but `serve` ever proxies to Uraeda,
    a condition nothing would check once you add a public address.
- **B. Yes: a request with `Tailscale-User-Login` equal to a login you configure is signed in.**
  - [pro] no sign-in at all from your tailnet.
  - [con] a full bypass the day another proxy forwards to Uraeda on the same machine.

**Answer:**

## Q5: How does a public server reach Uraeda?

The stack decision says the server "MUST listen on 127.0.0.1 only". Every product compared tells
users to put TLS and a proxy in front rather than expose itself; Tailscale Funnel does it with no
extra software, but only on `*.ts.net` names. More in
[discovery](discovery-01.md#reaching-it-from-the-internet).

Why it matters: a public address without TLS sends the key and cookies in clear text, and choosing B
changes the stack decision.

- **A (recommended). Through a proxy on the same machine (Caddy, NGINX, or Tailscale Funnel) that
  ends TLS and forwards to 127.0.0.1, with its host name in `--allowed-hosts`. Uraeda only
  documents it.**
  - [pro] no TLS code in Uraeda; certificates renew on their own with Caddy or Funnel; the stack
    rule stays.
  - [con] a second program to run on a public server.
  - Why recommended: it is what code-server, Home Assistant, and Syncthing recommend, and it keeps
    the server's surface as it is.
- **B. A `--host` flag to listen on a public address, with Uraeda's own TLS from a certificate and
  a key given as flags.**
  - [pro] one process.
  - [con] you renew certificates yourself; TLS settings to maintain in Uraeda; the stack rule
    changes.

**Answer:**

## Q6: How do previews and mockups prove they come from you?

Previews and mockups run in frames sandboxed without `allow-same-origin`. In this round's tests,
Chromium and Firefox send such a frame's scripts, nested frame, and WebSocket no `Lax` or `Strict`
cookie, so the sign-in cookie cannot protect them: their address must carry a secret, as Vite's
socket token and Jupyter's URL token do. The address reaches the UI only through fate, which other
websites cannot read. More in [discovery](discovery-01.md#previews-and-mockups).

Why it matters: it closes the hole the UI iteration flow left open, and replaces the stack
decision's `Origin: null` exception with a rule on the secret.

- **A (recommended). A secret per session in the path, `/r/<repository>/preview/<secret>/<folder>/`
  and the same for mockups, ending when that session ends.**
  - [pro] signing a device out also cuts off its previews; a leaked address dies with its session.
  - [con] a lookup from the secret to its session on each preview request.
  - Why recommended: a preview is as private as the session that opened it, with little more code
    than B.
- **B. One secret per server start, shared by every session, as the proposal's draft suggests.**
  - [pro] the simplest.
  - [con] it survives signing out, and every open preview breaks at a restart.
- **C. Previews on a separate origin, another port or host name, with its own cookie.**
  - [pro] the browser itself isolates previews from Uraeda.
  - [con] a second host name to list in Tailscale and in a public proxy, and a second sign-in flow.

**Answer:**

## Settled without the human

- **Starting from the UI iteration branch**: this round read that branch's code. Merging it now
  brings 18 files in conflict with `main`, which its own finish step resolves, so this branch takes
  its code by merging `main` once the UI iteration flow merges, before the plan is written. See
  [discovery](discovery-01.md#starting-from-the-ui-iteration-branch).
- **One owner, no accounts**: "the people they allow" means your devices, not other people, since
  you asked for a single user. See [discovery](discovery-01.md#the-people-they-allow).
- **Where it is stored**: one file in the data folder, written `0600` and replaced atomically like
  `repositories.json`, holding the credential's hash and, with A in Q2, the sessions' hashes. Not
  in `runner.sqlite`, which is a cache, and no new folder. See
  [discovery](discovery-01.md#important-reads).
- **The cookie**: `HttpOnly`, `SameSite=Lax`, and `__Host-` with `Secure` over HTTPS. `Lax` rather
  than `Strict`, so a link to Uraeda from a pull request or a notification opens signed in; the
  guard already refuses cross-site writes. Over plain HTTP on 127.0.0.1, where browsers refuse
  `Secure`, the cookie drops the prefix. See
  [discovery](discovery-01.md#cookies-in-sandboxed-frames).
- **Failed sign-ins**: each one waits a second before answering, and is logged. With A in Q1 no
  lockout, since the key cannot be guessed; with B, a limit of a few attempts a minute per address,
  read from the proxy's forwarded address only when the request comes from 127.0.0.1. See
  [discovery](discovery-01.md#owasp-and-nist).
- **What signing out ends**: the session on the server, its live update streams, and, with A in
  Q6, its preview secret and Storybook sockets. A request whose session ended gets a 401, and the
  UI shows the sign-in screen, then returns to the page you were on. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The second start on the host**: it reads the data folder, so it proves it runs on the host to
  the running server when handing over its folder, and, with A in Q3, gets a one-time sign-in link
  for the browser it opens. See [discovery](discovery-01.md#important-reads).
- **Storybook never sees Uraeda's credentials**: the preview proxy removes Uraeda's cookie and
  `Authorization` before forwarding, answers with `Referrer-Policy: no-referrer` so the path's
  secret does not leak, and Uraeda's own pages refuse to be framed by other sites. See
  [discovery](discovery-01.md#hono-41313-and-node-24).
- **No switch to turn sign-in off**: the packaged server always requires it. Test servers, `vp dev`,
  and Uraeda's own Storybook fixture create the app without sign-in from code, never from a flag or
  a setting. The rules go into a new decision on sign-in, and the stack decision's `Host`,
  `Origin`, and preview rules are amended, both approved with the spec. See
  [discovery](discovery-01.md#rules-and-their-owners).

**Notes:**
