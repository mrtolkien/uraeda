---
kind: [feature | change]
finished: [YYYY-MM-DD: the day of the finishing commit]
pull-request: [Optional: the pull request's URL]
supersedes: [] # Optional: the older records whose behaviour this one replaces, by name
superseded-by: [] # Optional, added after the merge: the newer records that replace this one
---

# Record: [Feature name]

> [!NOTE]
>
> The record of a merged [feature | change], not instructions to follow. Started on [YYYY-MM-DD],
> finished on [YYYY-MM-DD], in [its pull request](https://...). Its full files are in git:
> `git log -- [specs/ | specs/changes/]YYYY-MM-DD-feature-slug/`.
>
> [Optional, one line for each `superseded-by`, the last paragraph of this block: Superseded in part
> by [YYYY-MM-DD-newer-slug](YYYY-MM-DD-newer-slug.md).]

## What and why

[Two to four sentences from the proposal: what it does, for whom, and why.]

## Behaviour

- [One line per user story: what users get, with the rules a later feature must keep. For a change,
  what was fixed or changed. Kept true to the merged code.]

## Design

[The approach in a few sentences, then the main components, each with a link to its code. For a
change, the root cause or the approach, and the code it touched.]

## Replaced behaviour

[Optional, left out when nothing was replaced: the behaviour the feature replaced, one line each, in
bold, with the tests that guarded it and the tests removed, the spec's list first, then the tests
removed by ruling.]

## Gotchas

[Optional, left out when there is none: what the code and tests do not show, one line each, starting
with the choice it shaped and linking its code. No routine debugging step.]

## Questions

[Optional, absent for a change without rounds: every round, every question with its heading as it
was, so links keep their anchors. A round's Context or settled points, when quoted, go under
`#### Context`, `#### Check these`, or `#### Settled without the human`, their sub-headings at
`#####`.]

### Round [NN]

#### Q1: [The question, exactly as its heading was in the questions file]

**Answer:** [The answer in a sentence: the letters and what they chose, or the human's words,
shortened.]

#### Notes

[Optional: the human's notes on the settled points, a sentence each.]

## Decisions

[Optional: each decision the feature made or changed, linked, in a line.]

## Changes after approval

[Optional: the rulings that change behaviour, the spec's revisions after its approval, and the
changes asked on the pull request, one line each, said in words, without ruling IDs.]

## Follow-ups

[Optional: the agents' notes the feature added to the inbox, and the work left, one line each.]
