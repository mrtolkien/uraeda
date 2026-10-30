---
verdict: changes-requested
commit: 26dbdae
---

# Review: Spec, Onboarding + README pass

## C1: Decision documentation, lines 9–12, under "Documentation"

> The README is a short page for humans discovering Uraeda: what it is, what it looks like, and how
> to start. Reference for users lives in pages under `docs/`, building Uraeda in `CONTRIBUTING.md`,
> and the workflow's rules in the skill alone. Each fact has one home, so the README stays short as
> Uraeda grows.

Add a few screenshots generated from the sandbox "realistic" env, for both 1440px and mobile. Show a
few pages.

This does not change the decision. Create a command to run that refreshes the screenshots.

## C2: Decision documentation, lines 20–21, under "Rules"

> - The README and the pages of `docs/` MUST NOT state the workflow's rules, which only the skill
>   holds. Checked by review.

I disagree: doc is here for readability and information, it can hold whatever it needs to hold. Docs
is the only place where information duplication is ok.

## C3: Decision documentation, lines 22–23, under "Rules"

> - Reference for users, such as install options, settings, sign-in, and the CLI's commands, MUST
>   live in pages under `docs/`. Checked by review.

Quick install guidelines should be in the README.md. Very short guidelines though, with an extra
INSTALL.md.

## C4: Lines 64–66, under "US1: A visitor understands Uraeda from its README (P1)"

> 1. **The banner**: the dot tree and "URAEDA" in dots, as you picked, in a light and a dark file.
> 2. **A tagline**, then **what Uraeda is**: a workflow for coding agents, shipped as a skill; a
>    CLI, `ura`, that checks and moves it; a web UI that drives it, sessions included.

The screenshots will go below the banner

## C5: General

You should start the implementation even without the composer changes. If you finish before I merge
the perf ameliorations, nbd, its branch will pull your changes and make the composer changes.
