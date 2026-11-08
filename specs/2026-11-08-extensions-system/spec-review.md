---
verdict: changes-requested
commit: 11ce13f
---

# Review: Spec, Extensions system

## C1: Lines 290–291, under "Constitution check"

> - Tools optional: an instruction an extension adds to runs reaches only runs the web UI starts. An
>   agent following the skill unaided never sees it. The workflow itself stays whole without it.

So extensions should never be able to add instructions. Which makes sense since we don't have
workflow instructions yet.

## C2: Decision agents, lines 16–17, under "Rules"

> - Uraeda's shipped runtimes MUST run the user's installed agent, never a bundled one or the
>   agent's SDK.

This is false. We'll do a pi-durable harness that will be bundled.

This is just true for Claude Code and Codex. So it's a SHOULD, or maybe it doesn't even deserve to
be here.

## C3: General

I want to be able to have extensions per-repo btw.

For example the deploy extension will likely be repo-specific.

This should be a part of the options: we need a difference of global options vs repo options. A new
extension should ask if it's made to be repo-specific vs global.

## C4: General

Another important comment: it's important that a session inside uraeda is able to edit itself. This
means uraeda's prompt in a session should point to uraeda's documentation/internal contract for
extensions. pi does it. We need to do it too.

## C5: Lines 106–107, under "US3: Install a shared extension from git (P2)"

> Someone shares a repository's address. `ura` clones it into your config folder, pinned to its
> commit, and only moves it when you update.

For the usage window, I'd like for it to look relatively the same for any provider (Codex, any
future ones)

I don't like the idea of here having two extensions tied to Claude Code.

How would you handle this kind of extension cross-communication/dependency?
