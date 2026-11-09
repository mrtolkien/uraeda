---
kind: change
finished: 2026-11-09
pull-request: https://github.com/mrtolkien/uraeda/pull/115
supersedes: [2026-10-30-review-inbox]
---

# Record: Spec comments: suggestion vs change needed

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-11-09, finished on
> 2026-11-09, in [its pull request](https://github.com/mrtolkien/uraeda/pull/115). Its full files
> are in git: `git log -- specs/changes/2026-11-09-spec-comments/`.

## What and why

A comment on a part of a spec held its Approve back in the web UI, so a human with a mere suggestion
had to request a revision or move it to the general comment. Comments are now accepted with either
verdict, anywhere in the file: a comment that only guides the next step goes with an approval, and
one that needs the spec changed goes with Request changes. One quiet line tells the two apart,
without a warning or a held button.

## Behaviour

- A spec or a plan is approved, or has changes requested, with comments on any of its parts or
  general ones. An approved spec's comments are carried out by its plan, in its
  `## Review comments`; an approved plan's by the implementation, as the skill already said.
- Once a review has a comment, one supporting line under the verdict's buttons says what each does
  with it: "With comments, Approve leaves them to the plan; Request changes revises the spec first."
  A plan's reads "the implementation" and "the plan". With no comment, the line is "Request changes:
  Add a comment first", as before.
- Request changes still needs a comment, and a verdict with an open comment holding text is still
  refused.

## Design

[`ReviewVerdict`](/packages/web/src/ReviewVerdict.tsx) no longer takes the count of comments on a
part, which [`YourReview`](/packages/web/src/YourReview.tsx) passed to it: Approve is disabled only
while the file has changes not committed. `weighing` writes the line from the file's kind, in place
of "Approve: A comment on a part of the spec asks for changes". `ura review` and the core always
accepted a spec approved with any comments: the hold was the web UI's alone. The
[flows guide](/specs/ui/flows.md) says so. Tested by "a spec is approved with a comment on a part of
it, the hint saying what each verdict does" in
[`review.test.tsx`](/packages/web/src/__tests__/review.test.tsx).

## Replaced behaviour

- **A comment on a part of a spec held its Approve back**, from
  [2026-10-30-review-inbox](2026-10-30-review-inbox.md). Its test, "a comment on a part of the spec
  holds Approve back, a general one does not", in
  [`review.test.tsx`](/packages/web/src/__tests__/review.test.tsx), is replaced by the one above.
