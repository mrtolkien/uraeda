---
verdict: changes-requested
commit: 4d0bade
---

# Review: Spec, Benchmarks

## C1: Decision benchmarks, lines 18–19, under "Rules"

> - A benchmark MUST reach agents only through the server's adapter, with the model and the effort
>   set in a benchmark-only configuration folder, never passed as flags. Checked by review.

Not sure why we should care about flags that much. What matters is that we use the server's adapter
and stay as close as possible to our code.

## C2: Decision benchmarks, lines 34–36, under "Rules"

> - Each full-flow run SHOULD have a plain-agent run on the same task, image, model, and effort, and
>   the agents SHOULD NOT read the task's upstream repository, which the audit of fetched addresses
>   checks. Checked by review.

We don't really need that to run for every model: it's just to have a baseline for a particular test

## C3: Lines 100–101, under "US3: A plain run on the same case (P1)"

> The runner runs a plain Claude Code session on the same case: one prompt with the case's proposal,
> no skill, no human, the same image, model, and effort. Its diff is graded like the flow's.

We need to pick 5 cases where plain Claude Code struggled btw, check existing results

## C4: Lines 130–131, under "US5: Read results over time (P2)"

> Each run saves a record and its scores in a folder named by date and suite. `benchmarks report`
> prints a table of paired outcomes per case, from any set of run folders.

Add a command to vp that outputs a beautiful page with latest results first and opens it in my web
browser
