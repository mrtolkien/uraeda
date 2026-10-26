---
status: active
approved-by: mrtolkien
icon: flask-conical
---

# Testing

Tests check that the code behaves as the decisions and the approved spec say, and never override
them. How much is tested follows the app's stage, now `growing`: stored data, the date and repeat
logic, and the main scenario of each user story, through the real app.

## Rules

- A test MUST give way to the approved spec, the decisions, and the human's requests: a test that
  guards behaviour they replace is rewritten or removed in the task that changes the behaviour,
  never kept by bending the code. Checked by review.
- A spec that replaces behaviour MUST list it with the tests that guard it, so its approval covers
  their removal, and the record MUST name them. Checked by review.
- A test MUST assert what a caller or a user observes, never how the code does it. Checked by
  review.
- A feature MUST test the data it stores, its date and repeat logic, the main scenario of each of
  its user stories, and the reproduction of each bug fixed. Checked by review.
- The main scenario of a story MUST run through the whole app on an in-memory store, as a user does
  it: by roles, labels, and visible text. Checked by review.
- The stage MUST be set by the human, and moves only when they say so. Checked by review.

## Why

Set up with the project, as Uraeda proposes. Stored tasks and calendar-day due dates are costly to
get wrong, and the app is growing: each story's main scenario proves that its parts connect, while a
test of every sentence of a spec would slow each change.

## Consequences

- A scenario beyond a story's main one has a test only when that test can own it too, or when it is
  logic with many cases. The human finds a regression elsewhere by using the app.
- Moving to `stable` will add a test for every scenario of a spec.

## Applies to

- [`tests/`](/tests/), and every feature or change of the app
