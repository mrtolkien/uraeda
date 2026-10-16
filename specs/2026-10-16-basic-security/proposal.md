---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Auth and login for basic security

## What (human written)

I want to be able to use uraeda remotely, from my phone, laptop, ...

Right now I access it through Tailscale and that was enough security for the early prototype, but we
should add some basic security.

We only need to support a single user for the moment, but it's important to be able to easily login
from multiple places. The key should be stable and not change on server restarts.

Keep it simple _but_ it should be secure enough to start running uraeda on a public,
internet-accessible server.

You should also directly start working from the ui-iteration branch, it's almost done and includes
features that relate to security and access.

## What (agent written)

Auth and login for basic security: only the human, or the people they allow, can reach Uraeda's
server and what it runs, from this computer or through Tailscale.

It must close the hole the UI iteration flow leaves open in its Storybook previews, accepted until
this feature lands:

- **The hole.** The stack decision lets requests with `Origin: null` read the preview paths,
  `/r/<repository>/preview/<folder>/`. Every forwarded answer carries
  `Access-Control-Allow-Origin: *`, and the proxy removes `Origin` from WebSocket upgrades, since
  Storybook's channel refuses `null`.
- **Who can use it.** Any web page can send `Origin: null` by creating a sandboxed frame. So, while
  a Storybook runs (up to 30 minutes after its last view), any website open in the human's browser
  can read the project's source code through Uraeda. It can also open Storybook's live channel, as a
  story's page only: the proxy forces its `page=preview`, so it cannot write files. The addresses
  are guessable: Uraeda's port defaults to 4310, `main` is a fixed folder, and a repository's name
  is its folder's name.
- **The same hole, elsewhere.** Vite closed it in January 2025, as CVE-2025-24010
  (https://github.com/vitejs/vite/security/advisories/GHSA-vg6x-rcgg-rjx6): websites could read a
  dev server's responses and hijack its live socket.
- **The fix considered.** A random secret, made when the server starts, in every preview path:
  `/r/<repository>/preview/<secret>/<folder>/`. Uraeda's page gets addresses only from fate, which
  other websites cannot read, as Vite's socket token and Jupyter's URL token do. A login could make
  the secret per session instead.

## Why

Uraeda's server commits to git and starts agents, and now runs and forwards project processes. A web
page the human visits must not reach it, as the stack decision says, and anyone else on the tailnet
should need to log in.

## Notes

- Found by the review of the UI iteration flow's preview proxy, in its round 03 of questions
  (`specs/2026-10-15-ui-iteration/discovery-03.md`, on its branch, then in its record).
