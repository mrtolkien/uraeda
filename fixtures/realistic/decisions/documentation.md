---
icon: book-open
---

# Documentation

> "The README is for someone discovering Uraeda, not a reference."

## Rules

- The README holds what a newcomer needs to understand Uraeda, see it, install it in a few
  commands, and start, linking to the rest. _So:_ a new flag goes in `docs/`, never in the README.
- Reference for users lives in `docs/`, every way to install in `INSTALL.md`, and building Uraeda
  in `CONTRIBUTING.md`. _So:_ the settings' reference is a page of `docs/`.
- Documentation may repeat a fact wherever its reader needs it. _So:_ a page explains a rule of the
  skill without sending its reader away.

## Why

A README that grew into a reference buried what Uraeda is under flags and settings. Documentation
exists for readability: a fact repeated where the reader needs it costs less than a link. History:
[Onboarding + README pass](../done/2026-10-30-onboarding-readme.md).

## Alternatives considered

- One README with the reference folded in collapsible sections: the file stays long.

## Applies to

- [`README.md`](/README.md), `INSTALL.md`, `docs/`, `CONTRIBUTING.md`, and every feature that
  changes how Uraeda is installed, configured, built, or used
