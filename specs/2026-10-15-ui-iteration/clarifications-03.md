---
status: answered
---

# Clarifications, round 03: UI iteration flow

> [!NOTE]
>
> Answered on 2026-10-15.
>
> - **A hole in the approved stack rule.** While a Storybook runs, any website open in your browser
>   can read the project's code through Uraeda, and use Storybook's live channel. It is the same
>   hole Vite closed in 2025.
> - **The recommended fix changes the stack decision's preview path** and the spec's addresses. It
>   adds a random secret that other websites cannot guess.
> - **Tasks 1 to 6 are built.** Task 5 built the proxy and the guard. The rest waits for your
>   answer.
> - **One point is settled without you**: the review's other findings are fixed with your answer.

## Context

The spec's review accepted a laxer `Origin` rule, so that stories work through Tailscale. The
[stack](/specs/decisions/stack.md) decision now lets requests with `Origin: null` read preview
paths, and the proxy marks their answers readable by anyone.

Task 5's review found that any web page can send `Origin: null`: it only has to create a sandboxed
frame. So a page on any site, open in your browser while a Storybook runs, can:

- read the project's source files through `/r/<repository>/preview/main/`, which is guessable;
- open Storybook's live channel.

Vite fixed this same hole in 2025 (CVE-2025-24010). The full investigation is in
[discovery](discovery-03.md).

## Q1: How do previews stay out of other websites' reach?

Vite now checks a token on its live socket. Jupyter puts a token in the address. Uraeda's page gets
every story's address from fate, which other websites cannot read. So a secret in the address
reaches only Uraeda's own frames. Sandboxed frames send no cookies, so a cookie cannot carry it.
More in [discovery](discovery-03.md#keeping-other-websites-out-of-previews).

Why it matters: it decides whether a website can read your code and use Storybook's channel. The fix
changes a rule you approved.

- **A (recommended). A random secret, made each time Uraeda's server starts, in every preview path:
  `/r/<repository>/preview/<secret>/<folder>/`. The guard's `Origin: null` exception applies only
  under a path holding the secret. The spec's addresses and the stack decision's rule change to that
  path.**
  - [pro] other websites cannot guess the path. Hot reload, remote embeds, and the full Storybook
    keep working.
  - [con] a link to a story stops working when Uraeda restarts, since the secret changes. Embeds and
    rows ask fate again, so only a link copied by hand breaks.
  - Why recommended: it closes the hole the same way Vite and Jupyter do, without losing anything
    the spec asks for.
- **B. Preview reads need a `Referer` from Uraeda's own address.**
  - [pro] the paths stay as approved.
  - [con] the live sockets carry no `Referer`, so either hot reload is lost or the channel stays
    open to any website. Browsers and extensions that remove `Referer` break embeds.
- **C. Keep the rules as approved, until basic security comes.**
  - [pro] nothing changes.
  - [con] the hole stays: any website can read the code of a running preview, and use Storybook's
    channel.

**Answer:** C: Create a draft for the security task and include this

## Settled without the human

- **The review's other findings** are fixed with your answer:
  - an upgrade counts as a read only as a GET asking for a WebSocket;
  - Storybook's `Set-Cookie` and `Clear-Site-Data` are dropped;
  - headers named in `Connection` are removed;
  - the guard's pattern needs a folder, and is shared with the proxy;
  - the proxy's own answers carry the CORS and sandbox headers;
  - a Storybook is marked failed as soon as it exits.

  See [discovery](discovery-03.md#the-reviews-other-findings).

**Notes:**
