# Discovery, round 01: Auth and login for basic security

## Summary

Self-hosted, single-user developer tools sign their owner in with one of three credentials: a long
random token (VS Code's `serve-web`, Jupyter), a password stored as a hash (Jupyter, code-server,
Syncthing, Portainer), or, rarely, passkeys (Authelia). Each then gives the browser a long-lived
session cookie, from one week (VS Code, Syncthing) to a month (Open WebUI, Authelia). They differ
most on three points: whether sessions live on the server, which allows logging one device out; how
they slow down guessing; and how the owner recovers a lost secret, which always assumes a shell on
the host. Most of them tell users not to expose them to the internet without TLS and a proxy.

The [proposal](proposal.md) asks for one user, signed in from several devices, with a key that
survives restarts, simple but safe on a public server, and it must close the hole the UI iteration
flow left in Storybook previews. Today the server has no notion of a user: it checks the `Host` and
`Origin` headers, and whoever passes can commit, run agents, add any repository, and run its preview
command. Preview frames are sandboxed without `allow-same-origin`, and Chromium and Firefox send
them no `SameSite=Lax` or `Strict` cookie, so a login cookie alone cannot protect previews: they
need a secret in their path.

The code this feature changes is on the UI iteration branch, `2026-10-15-ui-iteration`, which is not
merged yet: every code reference below is to that branch, unless it says otherwise.

## How other products do it

### Jupyter Server

- A token is on by default, sent as `?token=`, an `Authorization: token` header, or through the
  login form. Once checked, the server sets a cookie and the token is no longer needed
  ([security docs](https://jupyter-server.readthedocs.io/en/latest/operators/security.html)).
- The token is regenerated at every start, `hexlify(os.urandom(24))`, unless `JUPYTER_TOKEN` or
  `JUPYTER_TOKEN_FILE` gives one, and it is compared with `==`
  ([identity.py](https://github.com/jupyter-server/jupyter_server/blob/main/jupyter_server/auth/identity.py)).
- `jupyter server password` writes an Argon2id hash to the config; setting a password turns the
  token off. Running it again is the documented recovery, and it logs every session out after a
  restart
  ([public server docs](https://jupyter-server.readthedocs.io/en/latest/operators/public-server.html)).
- The cookie secret is generated on first start and persisted to a file, and the password hash is
  part of the signing key, so changing the password invalidates every cookie
  ([full config](https://jupyter-server.readthedocs.io/en/latest/other/full-config.html),
  identity.py). Logout only clears the cookie: nothing is revoked on the server.
- `allow_remote_access=False` answers 403 to a non-local `Host`, against DNS rebinding (full
  config). No login rate limit is documented or found in the source.
- Pitfalls: a token in the URL leaks. CVE-2026-86049 logged the token from a `Referer` header on
  errors ([OSV](https://osv.dev/vulnerability/CVE-2026-86049)). A cookie secret kept in a runtime
  folder cleared at logoff logs users out at every reboot
  ([notebook#2562](https://github.com/jupyter/notebook/issues/2562)).

### code-server

- First run writes `~/.config/code-server/config.yaml` with a random password, in plain text;
  `hashed-password` (Argon2) takes precedence. Changing or recovering it means editing the file and
  restarting ([FAQ](https://coder.com/docs/code-server/FAQ)).
- Logins are limited to "two per minute plus an additional twelve per hour"
  ([guide](https://coder.com/docs/code-server/guide)), with one limiter for the whole process, not
  per address, so an attacker can lock the owner out
  ([login.ts](https://github.com/coder/code-server/blob/main/src/node/routes/login.ts)).
- The cookie holds a hash of the password: anyone who reads the config can forge it. It is a
  browser-session cookie, `SameSite=Lax`, with no session on the server: logout clears the local
  cookie only, and only a password change logs every device out
  ([util.ts](https://github.com/coder/code-server/blob/main/src/node/util.ts)). Logging out leaves
  other tabs working ([#6360](https://github.com/coder/code-server/issues/6360)).
- WebSockets check `Origin` against `Host`, with `--trusted-origins` for others (http.ts).
- The guide warns: "Never expose code-server directly to the internet without some form of
  authentication and encryption", and recommends an SSH forward, then Caddy or NGINX with Let's
  Encrypt, and points to oauth2-proxy, Pomerium, or Cloudflare Access for SSO (guide).

### VS Code `serve-web`

- One connection token, persisted in a `serve-web-token` file, so it survives restarts, and printed
  as a `?tkn=` URL
  ([serve_web.rs](https://github.com/microsoft/vscode/blob/main/cli/src/commands/serve_web.rs),
  [serverConnectionToken.ts](https://github.com/microsoft/vscode/blob/main/src/vs/server/node/serverConnectionToken.ts),
  mode 0600).
- The server swaps the URL's token for a `vscode-tkn` cookie, `SameSite=Lax`, one week, renewed at
  each page load, and redirects to remove the token from the address bar
  ([webClientServer.ts](https://github.com/microsoft/vscode/blob/main/src/vs/server/node/webClientServer.ts)).
- No password, no rate limit, no logout: one shared bearer token, for "a single user"
  ([VS Code Server](https://code.visualstudio.com/docs/remote/vscode-server)).

### Syncthing

- The GUI has a user and a bcrypt password hash, and a separate API key for scripts
  ([config](https://docs.syncthing.net/users/config.html),
  [REST](https://docs.syncthing.net/dev/rest.html)).
- Sessions are stored on the server, so they survive restarts and logout ends them. The cookie is a
  browser-session cookie unless "stay logged in" is checked, which lasts `sessionCookieDurationS`,
  one week by default
  ([tokenmanager.go](https://github.com/syncthing/syncthing/blob/main/lib/api/tokenmanager.go)).
- Brute force only meets a random 100 to 200 ms delay, with no lockout (api_auth.go).
- Recovery: stop it and run `syncthing generate --gui-user --gui-password`
  ([FAQ](https://docs.syncthing.net/users/faq.html)). The GUI listens on 127.0.0.1; remote access
  wants a password, HTTPS, and a firewall or an SSH forward.

### Home Assistant

- Multi-user, with salted password hashes. Each sign-in creates a refresh token for that device;
  deleting it signs the device out, and unused ones expire after 90 days. Changing the password
  offers to sign out every other session
  ([authentication](https://www.home-assistant.io/docs/authentication/)).
- Long-lived access tokens last 10 years, for scripts
  ([auth API](https://developers.home-assistant.io/docs/auth_api/)).
- An address is banned after a set number of failed logins, in `ip_bans.yaml`, forever; behind a
  proxy it needs `use_x_forwarded_for` and `trusted_proxies`
  ([http](https://www.home-assistant.io/integrations/http/)).
- "Trusted networks" skip the password
  ([providers](https://www.home-assistant.io/docs/authentication/providers/)). Recovery is a command
  on the host ([locked out](https://www.home-assistant.io/docs/locked_out/)).

### Grafana, Portainer, ttyd, Open WebUI

- Grafana: sessions end after 7 days unused or 30 days in all, the session token rotates every 10
  minutes, and sessions can be revoked from the UI. Logins are blocked 5 minutes per user or per
  address after too many failures. Recovery is `grafana cli admin reset-admin-password`
  ([authentication](https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/),
  [CLI](https://grafana.com/docs/grafana/latest/cli/)).
- Portainer: a 12-character minimum, and a setup token printed in the logs guards the first setup
  ([setup](https://docs.portainer.io/start/install-ce/server/setup)).
- ttyd: basic auth with `-c user:pass`, the WebSocket proving it in its first message, no rate limit
  ([ttyd](https://github.com/tsl0922/ttyd)).
- Open WebUI: its secret key is generated and persisted to a file; recreating the container without
  it logs everyone out, so the docs recommend setting one. Sessions last 4 weeks
  ([environment](https://docs.openwebui.com/reference/env-configuration)).

### Vite and Storybook dev servers

- Vite's CVE-2025-24010 combined `Access-Control-Allow-Origin: *`, a WebSocket that did not check
  `Origin`, and no `Host` check. The fix added `server.allowedHosts`, a token on the WebSocket, and
  a stricter CORS default
  ([advisory](https://github.com/vitejs/vite/security/advisories/GHSA-vg6x-rcgg-rjx6)).
- Storybook's CVE-2026-27148: its WebSocket did not check `Origin`, and its create and save story
  handlers allow persistent XSS, and code execution in some setups. "Any unauthenticated attacker
  can send WebSocket messages to it directly" when the dev server is public
  ([advisory](https://github.com/storybookjs/storybook/security/advisories/GHSA-mjf5-7g4m-gx5w)).

### Delegating sign-in to a proxy

- `tailscale serve` adds `Tailscale-User-Login`, `-Name`, and `-Profile-Pic` for requests from
  user-owned devices, removes copies sent by clients, and adds none for Funnel requests or tagged
  devices. The backend must listen on localhost only, or anyone reaching it can forge them
  ([Serve](https://tailscale.com/kb/1312/serve),
  [serve.go](https://github.com/tailscale/tailscale/blob/main/ipn/ipnlocal/serve.go)).
- Tailscale Funnel makes a node public on ports 443, 8443, or 10000, with TLS ended on the device,
  `*.ts.net` names only, and no identity: the app must sign users in itself
  ([Funnel](https://tailscale.com/kb/1223/funnel)).
- Cloudflare Tunnel and Access put an identity provider in front, and the origin checks the
  `Cf-Access-Jwt-Assertion` JWT
  ([validating](https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/)).
  oauth2-proxy, Authelia, and Caddy's `forward_auth` do the same on one's own server
  ([oauth2-proxy](https://oauth2-proxy.github.io/oauth2-proxy/configuration/overview),
  [Authelia regulation](https://www.authelia.com/configuration/security/regulation/),
  [forward_auth](https://caddyserver.com/docs/caddyfile/directives/forward_auth)).

### What they have in common

- **One secret that survives restarts**: a persisted token file or a hashed password.
- **A long session per device**, so each device signs in once: one week to a month.
- **Recovery from the host's shell**: a command that sets a new password or token. Every product
  assumes the owner can reach the host.
- **Logging out**: one device, and every device. Real only where sessions live on the server
  (Syncthing, Home Assistant, Grafana); elsewhere through changing the secret.
- **Something against guessing**: from nothing (Jupyter, VS Code) to a delay (Syncthing) to a
  lockout (Grafana, Home Assistant), the lockout handing attackers a way to lock the owner out.
- **`Host` and `Origin` checks** against DNS rebinding and cross-site WebSocket hijacking.
- **A token for scripts**, separate from the browser session (Syncthing, Home Assistant, Grafana).
- **Signing a new device in from a signed-in one** was not seen in these products: Uraeda's question
  about phones is open, in [new devices](#signing-in-a-new-device).

## Standards and libraries

### OWASP and NIST

- Session identifiers need at least 128 bits when generated by the application; the server may store
  an id with a SHA-256 of the secret, compared in constant time. Sessions need an idle and an
  absolute timeout enforced on the server, a new identifier at login, and server-side invalidation
  at logout. Session identifiers belong in cookies, never in URLs, which leak through logs, history,
  and `Referer`
  ([Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)).
- Passwords: at least 15 characters without a second factor, no composition rules, generic error
  messages, failures counted per account, with backoff
  ([Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)).
  Argon2id with 19 MiB, 2 passes, 1 lane
  ([Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)).
- CSRF: `Sec-Fetch-Site` first, `Origin` as the fallback; "Missing headers and `Origin: null` are
  not evidence of a same-origin request"; the login form needs protection too
  ([CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)).
- WebSockets: check `Origin` on every handshake, close sockets when the session ends
  ([WebSocket](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)).
- NIST SP 800-63B rev 4: at most 100 consecutive failures per account; at the lowest assurance
  level, AAL1, reauthentication at most every 30 days. Cookies SHALL be `Secure`, SHOULD be
  `HttpOnly`, `__Host-`, `SameSite`. It also says session secrets "SHOULD NOT be persistent across
  application restarts", which pulls against the proposal's stable key: the proposal's key is a
  credential, not a session secret, but persisted sessions are the same tension
  ([800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html)). Judgement: a single-owner developer
  tool signed in for weeks sits at AAL1.

### Cookies in sandboxed frames

- A cookie lasts at most 400 days; `__Host-` requires `Secure`, `Path=/`, and no `Domain`
  ([RFC 6265bis](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis),
  [Chrome](https://developer.chrome.com/blog/cookie-max-age-expires)). `Secure` cookies work over
  plain HTTP only on `localhost`, per
  [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).
- Tested in this round with Playwright's Chromium and WebKit, and Firefox 157, on a page that set
  `Lax`, `Strict`, and `None` cookies and framed itself with `sandbox="allow-scripts"`:
  - The frame's own document request carries the `Lax` and `Strict` cookies in all three.
  - Everything the frame loads afterwards (scripts, `fetch`, a nested frame, the WebSocket) carries
    only the `None` cookie in Chromium, no cookie in Firefox, and `Lax` and `Strict` in WebKit.
- Chrome documents it: without `allow-same-origin`, "all requests from the sandboxed page" are
  cross-site
  ([Privacy Sandbox](https://privacysandbox.google.com/blog/sandbox-allow-same-site-none-cookies)).
  RFC 6265bis says the opposite, which only WebKit follows.
- The UI iteration flow's own spike found the same: "Sandboxed frames send no cookie"
  (`specs/2026-10-15-ui-iteration/discovery-03.md`, on its branch).
- So a preview's Storybook, its nested `iframe.html`, and its Vite socket reach Uraeda without the
  session cookie. A `SameSite=None` cookie is no fix: Firefox still sends nothing, and `None`
  reopens CSRF. Previews need a secret in their path. The same holds for mockups, also served with
  `sandbox allow-scripts` ([files.ts](/packages/server/src/files.ts)).

### Passkeys

- WebAuthn needs a secure context, and the relying party ID must be the page's domain or a
  registrable suffix of it: IP addresses cannot be one
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialCreationOptions); the
  IP rule seen only in a
  [mailing list thread](https://lists.w3.org/Archives/Public/public-webauthn/2020Jan/0033.html)).
  `ts.net` is on the [Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat), so
  a tailnet name works.
- A passkey is bound to its domain: moving from a `*.ts.net` name to one's own domain orphans every
  passkey. Synced passkeys and a phone's cross-device sign-in reach several devices
  ([passkeys.dev](https://passkeys.dev/docs/reference/terms/)).
- `@simplewebauthn/server` 14.0.3 is the usual Node library; a passkey flow needs challenges, stored
  credentials, and a recovery path that is not a passkey
  ([SimpleWebAuthn](https://simplewebauthn.dev/docs/advanced/passkeys)).

### Hono 4.13.13 and Node 24

- Hono ships `hono/cookie` (signed cookies with `__Host-` prefixes), `csrf`, `secureHeaders`,
  `basicAuth`, `bearerAuth`, and `jwt`: none is used yet, and none adds a dependency. Its cookie
  serializer throws on a `maxAge` over 400 days, and on a `__Host-` cookie without `secure`
  (`hono/dist/utils/cookie.js`).
- Hono's `csrf()` checks only form content types, so fate's JSON posts pass it unchecked
  ([csrf](https://hono.dev/docs/middleware/builtin/csrf)): Uraeda's own guard is stricter.
- `secureHeaders()` sets `Cross-Origin-Resource-Policy: same-origin`, which would likely block a
  sandboxed frame's subresources (not tested), and `Referrer-Policy: no-referrer`.
- Basic auth cannot log out, and the browser resends the password on every request.
- The preview's WebSocket upgrades reach `previewUpgrade` directly from Node's `upgrade` event,
  outside Hono's middleware (`main.ts`, `server.ts`), so any check must also run there.
- Node 24.7 added `crypto.argon2`; with OWASP's settings it took about 22 ms here. `crypto.scrypt`
  needs `maxmem` raised for OWASP's settings. `timingSafeEqual` throws on unequal lengths
  ([crypto](https://raw.githubusercontent.com/nodejs/node/v24.x/doc/api/crypto.md)).

### Auth libraries

- Lucia was deprecated in March 2025 and replaced by a single reference file: a token `id.secret` of
  32 random bytes, SHA-256 of the secret stored, sliding 10-day expiry, `HttpOnly; Secure; Lax`
  cookie, and writes refused unless `Sec-Fetch-Site` is `same-origin`
  ([auth_session.ts](https://raw.githubusercontent.com/lucia-auth/lucia/refs/heads/main/code/auth_session.ts)).
- better-auth 1.7 mounts on Hono, with user, session, account, and verification tables
  ([Hono integration](https://www.better-auth.com/docs/integrations/hono),
  [database](https://www.better-auth.com/docs/concepts/database)). Judgement: built for many users,
  far more than one owner needs.

### Running on a public server

- `tailscale serve` sets `X-Forwarded-For` and `X-Forwarded-Proto: https`, overwriting what clients
  send (serve.go). Caddy's `reverse_proxy` keeps `Host`, sets `X-Forwarded-*`, ignores clients'
  copies unless trusted, and proxies WebSockets
  ([reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)).
- Behind any proxy on the same machine, every connection comes from 127.0.0.1: a limit per address
  needs the forwarded address, trusted only from the proxy, or it becomes one global limit.
- NGINX sends the upstream's address as `Host` by default, so `Host: 127.0.0.1` does not prove a
  request is local (judgement, from NGINX's `proxy_set_header` default, not read this round).

## The code

### Important reads

- [`main.ts`](/packages/server/src/main.ts): listens on `127.0.0.1`, hard-coded, on 4310 by default;
  a second start that finds the port taken posts `{folder}` to `/open` on the running server
  ([open-client.ts](/packages/server/src/open-client.ts)), with no `Origin`; the start opens a
  browser unless `--no-open`.
- [`guard.ts`](/packages/server/src/guard.ts): the only protection today. It rejects a `Host` other
  than `127.0.0.1`, `localhost`, or a listed host; an `Origin` other than its own or
  `https://<listed host>`; and writes with a cross-site `Sec-Fetch-Site`. On the UI iteration branch
  it also lets `Origin: null` read `/r/<repository>/preview/<folder>/`. A request with neither
  header passes, like `curl`.
- `app.ts` (UI iteration branch): every route sits behind the guard: global and per-repository fate
  with its live SSE stream, `/raw`, `/mockups`, `/images`, `/chat-images`, `/attach`, `/preview`,
  `/open`, and the built UI. fate mutations commit, start and steer agents
  (`claude -p --permission-mode auto`), add any folder as a repository, and start a preview.
- `preview/proxy.ts` (UI iteration branch): forwards GET, HEAD, and WebSocket upgrades to the
  Storybook, adds `Access-Control-Allow-Origin: *` and a `sandbox` CSP, drops `Set-Cookie` from
  answers, removes `Origin` from upgrades, and forces `page=preview` on Storybook's channel. It
  forwards every request header, so a session cookie would reach Storybook today.
- `fate/preview.ts` (UI iteration branch): the frame address `/r/<name>/preview/<folder>/` reaches
  the UI only through fate. Reading a story view starts the Storybook.
- `packages/web/src/clients.ts` and fate's client: posts to the same origin, and live views open an
  `EventSource` with `withCredentials: true`, so a cookie flows with no change. Nothing in the UI
  handles a 401, and there is no login page.
- `packages/web/.storybook/` (UI iteration branch): Uraeda's own Storybook runs a nested server on
  the fixture, whose fate client sends its posts as GETs from sandboxed frames, with no cookies
  (rulings R4 and R47 of the UI iteration flow).
- [`env.ts`](/packages/server/src/env.ts) and [`options.ts`](/packages/server/src/options.ts):
  `URAEDA_PORT`, `URAEDA_ALLOWED_HOSTS`, `URAEDA_REPO`, `URAEDA_DATA_DIR`, and flags; the packaged
  server reads no `.env` ([distribution](../decisions/distribution.md)).
- The data folder, `~/.local/share/uraeda` by default: `repositories.json` (the core's only),
  `runner.sqlite` (a cache, whose loss must cost only sessions, per
  [agents](../decisions/agents.md)), `images/` written `0700` and `0600`
  ([images.ts](/packages/server/src/runner/images.ts)), and `storybooks/`.
- The `ura` CLI and the Neovim plugin never speak HTTP: no client besides the browser, the second
  start's `/open`, and tests.
- Recent history: `f690b83` forced Storybook's channel to `page=preview` after finding that a frame
  on any website could read the story page's `wsToken` through the proxy and write story files;
  `c4d3d99` added the `Sec-Fetch-Site` rule.

### The proposal's path and existing actions

1. The human opens Uraeda on a phone, through `tailscale serve` or a public address: today the page
   loads, and every action works for anyone who reaches it.
2. With sign-in, the page must load a sign-in screen instead, and every route but the sign-in, the
   built UI's assets, and the preview paths with their secret must refuse a request without a
   session.
3. Existing actions that meet it:
   - **The start that opens a browser** lands on the sign-in screen unless it signs the browser in.
   - **A second start** hands its folder to `/open`, which must keep working from the same host.
   - **Live views** hold an SSE stream: logging out or a session ending must close it.
   - **Images, raw files, and mockups** are fetched by the UI, or opened in a new tab; mockups are
     framed with `sandbox="allow-scripts"` and, like previews, get no cookie.
   - **Preview frames and their WebSocket** get no cookie; the frame address must carry a secret,
     and the proxy must not forward Uraeda's cookie to Storybook.
   - **A link from elsewhere** (a pull request, a notification) to Uraeda is a cross-site top-level
     navigation: a `Strict` cookie would show the sign-in screen, a `Lax` one would not.
   - **The development servers** (`vp dev`, Uraeda's own Storybook, tests calling `app.request`) run
     the same app.
   - **Restarting the server** must not sign devices out, per the proposal.

### Other features in flight

- The UI iteration flow (`2026-10-15-ui-iteration`) adds the preview proxy, the guard's
  `Origin: null` exception, and the stack decision rules this feature must change. Its branch and
  `main` conflict in 18 files today; its finish step will resolve them.

### Rules and their owners

- **Who may reach the server**: the [stack decision](../decisions/stack.md) ("MUST listen on
  127.0.0.1 only", the `Host` and `Origin` rules, the preview exception), owned in code by
  `guard.ts`, with the preview's copy of the check in `preview/proxy.ts`'s `previewUpgrade` and the
  path pattern shared with `dev.ts`.
- **Where settings come from**: [distribution](../decisions/distribution.md), flags and environment
  only for the packaged server, owned by `env.ts` and `options.ts`.
- **What lives in the data folder**: [repositories](../decisions/repositories.md) and
  [agents](../decisions/agents.md); the folder's path is computed by the core.

### Likely changes

Under every option:

- `guard.ts`, `app.ts`, `server.ts`, `main.ts`: a session check for every route but sign-in and the
  UI's assets, also in the upgrade path.
- A new server module for the credential and the sessions, and a file in the data folder.
- `preview/proxy.ts`, `fate/preview.ts`, `files.ts`, `dev.ts`: the secret in preview and mockup
  paths, and Uraeda's cookie removed before forwarding.
- `open.ts` and `open-client.ts`: the second start proves it runs on the host.
- `packages/web`: a sign-in screen, a 401 handler that returns to it, and logging out.
- `packages/web/.storybook/` and test helpers: the nested and test servers sign in, or run without
  sign-in from code only.
- The stack decision, and a new decision for sign-in; `.env.example` and the README for remote use.

Depending on the options: a `--host` flag and TLS settings in `options.ts` (public server, option
B); a dependency for passkeys or QR codes; a devices page in the UI.

## The proposal

### Starting from the UI iteration branch

The proposal asks to start from the UI iteration branch. That branch is not merged, and merging it
into this one now brings 18 conflicting files with `main`, which its own finish step will resolve.
This round investigated the UI iteration branch's code.

### "Secure enough for a public server" against "MUST listen on 127.0.0.1 only"

The stack decision forbids listening on another address, and derives the accepted origins from the
listed hosts with `https://`. A public server is reachable either through a proxy on the same
machine, which keeps the rule, or by listening on a public address, which changes it.

### "The people they allow"

The proposal's agent-written part says "the human, or the people they allow", and the human's part
says "a single user for the moment". Read as: one owner, signed in on several devices, no accounts.

### "The key should be stable"

A key that survives restarts is a credential the human keeps. NIST asks session secrets not to
survive restarts, and the proposal wants devices to stay signed in across them: the sessions must be
stored, not only the key.

### Signing in on the host itself

The proposal does not say whether a browser on the same machine signs in. Exempting `127.0.0.1`
cannot rely on the socket's address, since every proxy connects from there, nor on `Host`, which a
misconfigured proxy rewrites and which other local users can send.

## Approaches

### The credential

What the human proves to sign in. Criteria: the proposal (simple, stable, several devices, safe in
public), [the constitution](../CONSTITUTION.md)'s simplicity, dependencies, recovery. Knowledge:
[products](#what-they-have-in-common), [OWASP and NIST](#owasp-and-nist), [passkeys](#passkeys).

- **A generated access key**: 256 random bits, created at first start, kept as a hash in the data
  folder, pasted once per device. Guessing is impossible, so no lockout is needed; nothing to
  choose. Shown once, so losing it means making a new one on the host, like VS Code's token but
  hashed.
- **A password the human chooses**, hashed with Node's Argon2id, set by a command on the host. Easy
  to type on a phone, but guessable: it needs a minimum length and a limit on failures, and the
  limit lets an attacker lock the owner out.
- **Passkeys**, with a key or one-time link to register the first device and recover. The strongest,
  and phishing-proof, but a dependency, two ceremonies, a stored credential list, and no passkey on
  `127.0.0.1` or across a change of host name.
- **No long-lived secret**: each device is signed in by a one-time link, from a signed-in device or
  from the host. Nothing to leak, but a lost or expired set of devices needs the host's shell.
- **Delegating to a proxy** (Tailscale identity, Cloudflare Access, oauth2-proxy): no credential
  code, but it does nothing for a direct public server, and a forged header is a full bypass when
  the proxy is not the only way in. Covered in [the tailnet](#the-tailnet).

### Signing in a new device

How a phone gets a session. Only with the key or password of [the credential](#the-credential).

- **Type or paste the credential**, from a password manager: works everywhere, painful to type a
  43-character key on a phone.
- **A one-time sign-in link from a signed-in device**, shown as a link and a QR code, single use,
  valid a few minutes: a phone scans the laptop's screen. Needs a QR code encoder: a dependency or a
  small module.
- **A one-time sign-in link from the host**, printed by a command: works with no signed-in device,
  needs the host's shell.

### Sessions

How long a device stays signed in, and how it is signed out. Knowledge:
[products](#what-they-have-in-common), [OWASP and NIST](#owasp-and-nist).

- **Stored on the server**, one per device, as a hash in the data folder, ending after a period
  without use: each device can be signed out, and survives restarts.
- **The same, with a page listing devices**, each with its last use and a sign-out button, like
  Grafana and Home Assistant.
- **A signed cookie with no server state**, like Jupyter: no file, but no single-device sign-out,
  and signing everything out means a new key.

### This machine

Whether a browser on the host must sign in. Knowledge:
[signing in on the host](#signing-in-on-the-host-itself).

- **Sign in everywhere**, with the start opening the browser through a one-time link, so the host
  feels unchanged.
- **Trust requests whose `Host` is `127.0.0.1` or `localhost`**: no change locally, but any local
  process or other user of the machine, and any proxy rewriting `Host`, gets in.

### The tailnet

Whether Tailscale's identity signs a device in. Knowledge:
[delegating sign-in](#delegating-sign-in-to-a-proxy).

- **No**: the tailnet is a network, the key is the sign-in.
- **Yes**: a request from `tailscale serve` with `Tailscale-User-Login` equal to a configured login
  is signed in. Safe only while nothing else on the host proxies to Uraeda: a Caddy in front would
  pass a forged header.

### Reaching it from the internet

How a public server reaches Uraeda. Knowledge:
[running on a public server](#running-on-a-public-server),
[the stack rule](#secure-enough-for-a-public-server-against-must-listen-on-127001-only).

- **A proxy on the same machine** (Caddy, NGINX, Tailscale Funnel) ends TLS and forwards to
  127.0.0.1, with its host name listed: the stack rule stays, documentation only.
- **A `--host` flag with Uraeda's own TLS**, from a certificate and key: one process, but
  certificate renewal is the human's.
- **A `--host` flag over plain HTTP**: the key and cookies travel in clear text. Not viable on the
  internet.

### Previews and mockups

How sandboxed frames prove they come from a signed-in page. Knowledge:
[cookies in sandboxed frames](#cookies-in-sandboxed-frames).

- **A secret per session in the path**, `/r/<repository>/preview/<secret>/<folder>/`, given by fate
  to the signed-in page and ending with its session.
- **A secret per server start**, the proposal's draft: one secret for every session, changing at
  restarts, surviving sign-outs.
- **A separate origin** for previews, another port or host name, signed in through its own cookie:
  the cleanest isolation, but a second listed host with Tailscale and a public proxy.

### Needs no choice

- **A token for scripts**: no client but the browser and the second start speaks HTTP, so none is
  needed now.
- **Cross-site request forgery**: the guard already refuses writes with a foreign `Origin` or
  `Sec-Fetch-Site`, the sign-in form included.
- **Clickjacking**: Uraeda's own pages can refuse to be framed by others.
- **Accessibility and languages**: the sign-in screen is one form, in the UI's existing language and
  components.
- **Turning it off**: the stack decision's guard stays under any option; a way to run without
  sign-in is only for in-process test servers.

## Not checked

- Real Safari with tracking prevention, and Firefox in strict mode, for sandboxed frames' cookies.
- Chrome with third-party cookies blocked, and the `allow-same-site-none-cookies` sandbox token.
- Cookies over real HTTPS on a `*.ts.net` name: the tests ran on `localhost`.
- Whether `Cross-Origin-Resource-Policy: same-origin` blocks a sandboxed frame's subresources.
- How Storybook's dev server reacts to an extra path segment before its base.
- The WebAuthn specification's own wording on IP addresses, and better-auth's passkey plugin.
- Tornado's default cookie lifetime for Jupyter, Home Assistant's default failure threshold, and
  NGINX's `proxy_set_header` default.
- Auth.js.
