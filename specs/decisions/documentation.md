---
status: proposed
approved-by:
icon: book-open
---

# Documentation

The README is a short page for humans discovering Uraeda: what it is, what it looks like, and how to
start. Reference for users lives in pages under `docs/`, building Uraeda in `CONTRIBUTING.md`, and
the workflow's rules in the skill alone. Each fact has one home, so the README stays short as Uraeda
grows.

## Rules

- The README MUST hold only what a newcomer needs to understand Uraeda and start using it, linking
  to the rest. Checked by review.
- The README MUST present Uraeda as a workflow first, then the CLI that enforces it, then the web UI
  that drives it. Checked by review.
- The README and the pages of `docs/` MUST NOT state the workflow's rules, which only the skill
  holds. Checked by review.
- Reference for users, such as install options, settings, sign-in, and the CLI's commands, MUST live
  in pages under `docs/`. Checked by review.
- Building, testing, and releasing Uraeda MUST be explained in `CONTRIBUTING.md`. Checked by review.
- A change that makes the README or a page of `docs/` wrong SHOULD update it in the same pull
  request. Checked by review.

## Why

A README that grew into a reference buried what Uraeda is under flags and settings, before a visitor
learned how to start. Agents read the skill, not the README, so a rule written there is a second
copy that drifts. Pages under `docs/` keep every fact, and can feed a docs website later. History:
[Onboarding + README pass](../2026-10-30-onboarding-readme/spec.md).

## Alternatives considered

- Cutting the reference down to `--help` and the settings file's comments: proxies and sign-in lose
  their only explanation.
- One README with the reference folded in collapsible sections: the file stays long, and a search
  lands on folded text.

## Consequences

- A flag or a setting that changes is updated in two places: the code's help and its page of
  `docs/`.
- A feature that changes how Uraeda is installed, configured, or used updates its page of `docs/`.

## Applies to

- [`README.md`](/README.md), `docs/`, `CONTRIBUTING.md`, and every feature that changes how Uraeda
  is installed, configured, built, or used
