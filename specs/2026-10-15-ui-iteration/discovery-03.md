# Discovery, round 03: UI iteration flow

## Why this round

Task 5 of the [plan](plan.md) built the preview proxy and the guard's exception, as the
[stack](/specs/decisions/stack.md) decision's rules say:

- GET and HEAD requests and WebSocket upgrades under `/r/<repository>/preview/` accept
  `Origin: null`;
- every forwarded response carries `Access-Control-Allow-Origin: *`.

Its review found that these two rules together let any website the human visits read a running
preview, and talk to Storybook's channel. The fix changes a rule of an active decision and the
spec's preview paths, so the implementation stopped after task 6.

## Summary

- **Any page can produce `Origin: null`.** A frame sandboxed to `allow-scripts`, from `srcdoc` or a
  `data:` address, sends it on every request, wherever its page comes from. A page on any site can
  embed such a frame, so the exception does not tell Uraeda's frames from anyone else's.
- **What such a page can then do**, while a Storybook runs, which is up to 30 minutes after its last
  view:
  - read the project's source code, which Vite serves to any request that reaches it;
  - open Storybook's channel, whose `Origin` the proxy removes.
- **The addresses are guessable.** Uraeda's port defaults to 4310, `main` is a fixed folder name,
  and a repository's name is its folder's name.
- **Vite closed this same hole in January 2025**, as CVE-2025-24010: websites could read a dev
  server's responses, and hijack its live socket. The proxy reopens it in front of Vite.
- **Nothing else about the build changes.** The proxy and the guard otherwise hold: writes, other
  routes, and other hosts were all refused in the review's attempts.

## How other products do it

### Vite

- Before 6.0.9 and 5.4.12, "malicious websites" could send requests to a running dev server and read
  the responses, even one "only run on the local machine". The causes were a permissive default CORS
  setting, no `Origin` check on the live socket, and no `Host` check
  ([GHSA-vg6x-rcgg-rjx6](https://github.com/vitejs/vite/security/advisories/GHSA-vg6x-rcgg-rjx6)).
- The fix restricted CORS by default, and checks a token on the live socket's connections. The
  advisory warns that opting out of that check carries security risks.

### Jupyter Server

- Token authentication is on by default, because "access to the Jupyter Server means access to
  running arbitrary code". The token can be given "in a URL parameter", after which a cookie keeps
  the session ([security](https://jupyter-server.readthedocs.io/en/latest/operators/security.html)).

### Claude artifacts and MCP Apps

- Both run generated UI on an origin other than the host's
  ([discovery 02](discovery-02.md#running-untrusted-ui-next-to-a-host)). Its own origin keeps their
  generated UI from reaching the host's data. It does not keep other websites from reaching it,
  which those services handle with authentication.

### What they have in common

A server that hands out code or a live channel to a browser checks more than an origin: a secret the
legitimate page holds, as a token in the address, a cookie, or a socket token.

## Standards and libraries

### Origins and sandboxed frames

- A document in a frame sandboxed without `allow-same-origin` has an opaque origin, serialised as
  `null`, which "always fails the same-origin policy"
  ([MDN iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)).
- Any page can create one, so `Origin: null` says nothing about who made the request (judgement,
  confirmed by the review's attempt with a `srcdoc` frame).
- Sandboxed frames send no cookie in the spike's tests
  ([discovery 02](discovery-02.md#storybook-10)), so a cookie cannot carry a secret into the frames.

## The code

### Important reads

- [`guard.ts`](/packages/server/src/guard.ts) lets requests and upgrades under
  `/r/<repository>/preview/` through with `Origin: null`.
- [`preview/proxy.ts`](/packages/server/src/preview/proxy.ts):
  - adds `Access-Control-Allow-Origin: *` to every forwarded response;
  - removes `Origin` from upgrades, since Storybook's channel refuses `null`.
- [`preview/runner.ts`](/packages/server/src/preview/runner.ts) gives each Storybook its base path
  through `URAEDA_PREVIEW_BASE`.
- [`fate/preview.ts`](/packages/server/src/fate/preview.ts) builds every story's address. The web UI
  gets addresses only from there. fate's requests come from Uraeda's own page, and other websites
  cannot read their answers.

### The proposal's path and existing actions

- **A story is embedded**: the frame loads its address from fate, then its scripts and sockets under
  the same path. With a secret in the path, nothing else changes for it.
- **Uraeda restarts**: today every Storybook stops with it, and starts again on the next view, at
  the same path. With a secret, the path changes, and pages ask fate for it again.

### The review's other findings

None of these needs a decision; they are fixed with the answer:

- An upgrade counts as a read whatever its method. Only a GET with `Upgrade: websocket` should.
- `Set-Cookie` and `Clear-Site-Data` from Storybook reach Uraeda's own origin. Both should be
  dropped.
- Headers named in `Connection` are forwarded. They should be removed.
- The guard's pattern covers `/r/<repository>/preview/` without a folder. It should require one, and
  share its pattern with the proxy.
- The proxy's own 503, 301, and 405 answers lack the CORS and sandbox headers.
- A Storybook that dies while a child keeps its output open is noticed only when the output closes.
  It should be marked failed on `exit`.

### Likely changes

- With option A of [keeping other websites out](#keeping-other-websites-out-of-previews):
  - [`runner.ts`](/packages/server/src/preview/runner.ts) and
    [`fate/preview.ts`](/packages/server/src/fate/preview.ts): the secret in every base;
  - [`guard.ts`](/packages/server/src/guard.ts) and
    [`proxy.ts`](/packages/server/src/preview/proxy.ts): one shared pattern holding the secret;
  - the stack decision's rule, the spec's addresses, and the tests that name them.
- With option B: the guard reads `Referer` on preview paths.

## The proposal

### "It's ok to change the Origin rule to be a bit more lax"

The spec's review accepted a laxer `Origin` rule, "we will implement basic security soon enough".
The decision's consequences say "Anyone who reaches the server reaches the previews it runs". That
is the tailnet. The review found a wider reach: any website open in the human's browser, on the
computer that runs Uraeda, or on a phone using it through Tailscale.

## Approaches

Criteria: the stack decision's purpose, that "a web page the user visits must not reach" the server
([stack](/specs/decisions/stack.md#why)); the spec's remote embeds; hot reload; and the change to
the spec's addresses.

### Keeping other websites out of previews

| Option                                                                                                               | Other websites                                                  | Hot reload                     | Changes                                         |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------ | ----------------------------------------------- |
| A. A random secret, made when the server starts, in every preview path: `/r/<repository>/preview/<secret>/<folder>/` | Locked out: the path cannot be guessed                          | Kept                           | The stack rule's path, and the spec's addresses |
| B. Preview reads need a `Referer` from Uraeda's own address                                                          | Out of reads, not of the live sockets, which carry no `Referer` | Kept only if sockets stay open | The stack rule                                  |
| C. Keep the rules as approved, until basic security                                                                  | Can read code and use the channel                               | Kept                           | None                                            |

### Needs no choice

- **The review's other findings**: within the approved rules, fixed with the answer.

## Not checked

- Whether Storybook 10.6's channel can write files when reached this way: the review stopped at
  opening it.
