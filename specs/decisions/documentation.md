---
status: active
approved-by: mrtolkien
icon: book-open
---

# Documentation

The README is a short page for humans discovering Uraeda: what it is, what it looks like, a quick
install, and how to start. The full install lives in `INSTALL.md`, reference for users in `docs/`,
and building Uraeda in `CONTRIBUTING.md`. Documentation is written for reading, so it may repeat
what the reader needs where they need it.

## Rules

- The README MUST hold only what a newcomer needs to understand Uraeda, see it, install it, and
  start, linking to the rest. Checked by review.
- The README MUST present Uraeda as a workflow first, then the CLI that enforces it, then the web UI
  that drives it. Checked by review.
- The README's install MUST stay a few commands, with every other way to install in `INSTALL.md`.
  Checked by review.
- Reference for users, such as settings, sign-in, and the CLI's commands, MUST live in pages under
  `docs/`. Checked by review.
- Building, testing, and releasing Uraeda MUST be explained in `CONTRIBUTING.md`. Checked by review.
- A change that makes the README or a page of the documentation wrong SHOULD update it in the same
  pull request. Checked by review.
- Documentation MAY repeat the skill's rules, or another page's facts, wherever that helps its
  reader. Checked by review.

## Why

A README that grew into a reference buried what Uraeda is under flags and settings, before a visitor
learned how to start. A newcomer still needs to install it from the first page. Documentation exists
for readability: a fact repeated where the reader needs it costs less than a link they must follow,
so it is the one place where duplication is fine. History:
[Onboarding + README pass](../done/2026-10-30-onboarding-readme.md).

## Alternatives considered

- Cutting the reference down to `--help` and the settings file's comments: proxies and sign-in lose
  their only explanation.
- One README with the reference folded in collapsible sections: the file stays long, and a search
  lands on folded text.
- Documentation that only links to the skill's rules: every reader leaves the page to understand it.

## Consequences

- A flag or a setting that changes is updated in two places: the code's help and its page of the
  documentation.
- A rule of the skill that changes may leave a page of the documentation wrong, until a review
  catches it.
- A feature that changes how Uraeda is installed, configured, or used updates its page.

## Applies to

- [`README.md`](/README.md), `INSTALL.md`, `docs/`, `CONTRIBUTING.md`, and every feature that
  changes how Uraeda is installed, configured, built, or used
