---
kind: [feature | change]
finished: [YYYY-MM-DD: the day of the finishing commit]
pull-request: [Optional: the pull request's URL]
---

# Record: [Feature name]

> [!NOTE]
>
> The record of a merged [feature | change], not instructions to follow. Started on [YYYY-MM-DD],
> finished on [YYYY-MM-DD], in [its pull request](https://...). Its full files are in git:
> `git log -- [specs/ | specs/changes/]YYYY-MM-DD-feature-slug/`.

## What and why

[Two to four sentences from the proposal: what it does, for whom, and why.]

## Behaviour

- [One line per user story: what users get, with the rules a later feature must keep. For a change,
  what was fixed or changed. Kept true to the merged code.]

## Design

[The approach in a few sentences, then the main components, each with a link to its code. For a
change, the root cause or the approach, and the code it touched.]

## Questions

[Optional, absent for a change without rounds: every round, every question with its heading as it
was, so links keep their anchors. A round's Context or settled points, when quoted, go under
`#### Context` or `#### Settled without the human`, their sub-headings at `#####`.]

### Round [NN]

#### Q1: [The question, exactly as its heading was in the questions file]

**Answer:** [The answer in a sentence: the letters and what they chose, or the human's words,
shortened.]

#### Notes

[Optional: the human's notes on the settled points, a sentence each.]

## Decisions

[Optional: each decision the feature made or changed, linked, in a line.]

## Changes after approval

[Optional: the changes made after the spec's approval that change behaviour, the spec's revisions,
and the changes asked on the pull request, one line each, said in words, without ruling IDs.]

## Follow-ups

[Optional: the agents' notes the feature added to the inbox, and the work left, one line each.]
