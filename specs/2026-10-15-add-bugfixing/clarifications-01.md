---
status: answered
---

# Clarifications, round 01: Add a bugfixing/low impact change flow

> [!NOTE]
>
> Answered on 2026-10-15.
>
> - The proposal names three flows: the first question splits them, with the UI iteration flow
>   recommended as its own feature, later.
> - Two choices last beyond this feature: whether bugs and small changes share one flow, and its
>   folder and branch names, which rename today's `specs/bugs/` and `fix/`.
> - The gate before code, the escalation criteria, and the review work together: they set where your
>   time goes and what keeps quality up without a spec.
> - Small UI changes conflict with two active decisions, UI checks and UI layout, which require a
>   spec: one question proposes changing them.
> - The bug flow in the skill was never used, and about 24 small changes went straight to `main` in
>   five days: the context below says why that matters.
> - 14 points are settled without you, at the end: check them, especially the tests, the questions
>   rounds, and the scratchpad's hand-off.

## Context

The [proposal](proposal.md) asks for a flow shorter than the feature flow, for bugs and small
changes, that skips questions and specs when nothing needs them, keeps code quality, and offers to
upgrade a change that turns out too big. It also floats a third, visual flow for iterating on UI.

Today, the skill has an agent-written bug flow, `bug.md`, never reviewed and never used: it always
stops for your approval of its assessment, `ura start` panics on a bug, and the web UI cannot start
one. Small work bypasses the workflow instead: about 24 changes went straight to `main` between
2026-10-11 and 2026-10-15, with no record, test evidence, or review, and both `fix/` branches
skipped the bug flow's files. Even the smallest feature through the full flow wrote a 446-line spec
and a 616-line plan.

Other workflows converged on three sizes: just do it, a light path, the full flow. Bugs get their
own shape, with the root cause before any edit, a test that fails first, and what must stay
unchanged.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: Which flows does this feature build?

Bugs and small changes share their shape in every product studied: settled intent, an investigation,
code, a review. A visual UI flow needs new tooling: variants side by side, clicking an element,
feedback kept in the repository; products such as v0, Lovable, Stitch, and Claude Design each solve
it differently. More in [discovery](discovery-01.md#splitting-the-proposal) and
[visual iteration](discovery-01.md#visual-iteration-on-ui).

Why it matters: it sets the size of this feature, and when the long tails of UI fixes get their own
answer.

- **A (recommended). Build one light flow for bugs and small changes now, including small UI changes
  with their screenshots; the visual UI iteration flow becomes its own feature later, from this
  discovery's research.**
  - [pro] covers the direct commits and the unused bug flow soon; the UI feature starts from a
    working light flow.
  - [con] the UI tails, like 27 `fix(ui-improvements)` commits, keep their current shape until then.
  - Why recommended: the two flows are independent, and the visual one has its own design questions,
    on tools and visual direction, that would double this round.
- **B. Build all three flows in this feature.**
  - [pro] one design for everything small, the UI tails included.
  - [con] a much larger feature, with a second round on variants, element picking, and feedback.
- **C. Build the bug flow only, giving `bug.md` its spec; small changes come later.**
  - [pro] the smallest feature.
  - [con] most of the direct commits are small changes, not bugs: they keep bypassing the workflow.

**Answer:** A: Create a draft for the feature on main, I'll start it in parallel.

## Q2: Do bugs and small changes share one flow?

Uraeda has a bug flow and no flow for changes. BMAD's build and OpenSpec's fast-forward use one path
for both; Spec Kit keeps a bug extension apart from its small-feature extension; OpenSpec's and
Kiro's quick modes make small changes light features. A bug and a change differ only in the
investigation: reproducing and finding the root cause, or finding where the change goes. More in
[discovery](discovery-01.md#one-flow-or-two).

Why it matters: it decides how many step tables the skill and the core keep, and how many kinds you
learn.

- **A (recommended). One light flow for both: one request template, one agent file, one step table.
  The agent's investigation follows `bug.md` for a bug, and reads the code and decisions for a
  change.**
  - [pro] one set of rules, templates, and tools; a request that is half bug, half change has no
    wrong door.
  - [con] the bug flow's names change, see the follow-up.
  - Why recommended: the steps are the same, and every extra table is copied in the skill and in the
    core.
- **B. Two flows: keep the bug flow, and add a separate flow for small changes.**
  - [pro] each flow's file says exactly what it is.
  - [con] three step tables in the core and the skill, and a choice of door for every request.
- **C. Small changes become features with a light mode in their proposal, skipping questions when
  there are none and writing a short spec and plan; the bug flow stays apart.**
  - [pro] reuses the feature flow's files and tools.
  - [con] a spec and a plan stay files to read, the cost the proposal wants gone, and `feature_step`
    is already 85 lines of a 100-line limit.

**Answer:** A: The bug flow was never used and just a placeholder so far

### Q2.A: What are the light flow's folder and branch called?

Only if you picked A in Q2. Bugs live in `specs/bugs/<folder>/` on `fix/<folder>` branches, and no
real bug ever used them. The core once counted ad-hoc `fix/` branches as bugs, until `9187d86`
required a folder. More in [discovery](discovery-01.md#names-of-the-light-flow).

- **A (recommended). `specs/changes/YYYY-MM-DD-<slug>/` on the branch `change/YYYY-MM-DD-<slug>`,
  finished into a record with `kind: change`; `specs/bugs/` and `fix/` go away.**
  - [pro] "change" covers a bug and a tweak, as OpenSpec uses it; no other branch uses `change/`.
  - [con] renames the bug flow's names in the skill, the core, the UI, and the attachments decision.
  - Why recommended: one word that fits both, with nothing to migrate.
- **B. `specs/fixes/YYYY-MM-DD-<slug>/` on `fix/YYYY-MM-DD-<slug>`, with `kind: fix`.**
  - [pro] keeps the branch prefix; "fix" is short.
  - [con] reads as a bug more than a tweak; ad-hoc `fix/` branches stay possible look-alikes.
- **C. Keep `specs/bugs/` and `fix/` for bugs, and add `specs/changes/` and `change/` for changes.**
  - [pro] no rename.
  - [con] two names for one flow, and two kinds in every copy of the rule.

**Answer:** A

## Q3: Does the agent stop for you before writing code?

`bug.md` always stops on its assessment, as Spec Kit's bug workflow does. BMAD's small route, Kiro's
Quick Spec, and Copilot's agent go to code and keep the pull request as the review. Superpowers
keeps a nod in chat, because it "caught unexamined assumptions"; DORA found that approval before a
change does not lower failures. With any option, the agent stops for a question only you can answer,
and for an upgrade, Q4. More in [discovery](discovery-01.md#the-gate-before-code).

Why it matters: it decides whether a light change costs you one review or two.

C can come on top of A or B.

- **A (recommended). No stop unless the agent has a question or escalates: it writes its
  investigation, fixes, and opens the pull request, which lists the points it settled.**
  - [pro] one review per change, what the proposal asks for.
  - [con] a wrong reading of the request shows only at the pull request.
  - Why recommended: A with C on top: your request already approves the scope, and C keeps a stop
    when you want one.
- **B. Always stop on the agent's assessment before any code, as `bug.md` does today.**
  - [pro] wrong assumptions caught before code.
  - [con] two reviews for every change, however small.
- **C. A field in the request asks the agent to stop on its assessment, for this request only.**
  - [pro] you choose per request, for a risky area.
  - [con] one more field in the request.

**Answer:** A: Make sure the agent still works in a worktree every time

## Q4: When is a change too big for the light flow?

Sources stop the light path on contracts (API, schema, data format), a new dependency or migration,
security, intent the user would notice that the request leaves open, several independent goals,
repeated failed fixes, or a size: 100 lines or about 5 files for BMAD v7 and Spec Kit's tinyspec.
Superpowers found that hard rules make agents over-apply the heavy path. What happens next is Q5.
More in [discovery](discovery-01.md#when-a-change-is-too-big).

Why it matters: it decides how often a light change turns into a feature, and how predictable that
is.

- **A (recommended). The agent stops and offers an upgrade when the change needs a new or changed
  decision, changes data users already have or a public interface (CLI flags, file formats, the
  API), changes approved behaviour beyond what the request names, leaves open an intent you would
  notice, needs a constitution exception or a new lint marker, or fails three fixes; it reports the
  change's size in the pull request.**
  - [pro] each criterion names a risk, and keeps the change inside what you approved
    ([principle I](/specs/CONSTITUTION.md#i-humans-stay-in-control)).
  - [con] the agent judges, so two agents may judge one change differently.
  - Why recommended: a one-line format change is riskier than a 300-line test refactor; the criteria
    catch the first, a size does not.
- **B. A's criteria, plus a size that stops the flow: more than 200 changed lines outside tests, or
  more than 5 files.**
  - [pro] a number anyone can check.
  - [con] stops mechanical changes that are large and safe; the number is arbitrary.
- **C. A size only.**
  - [pro] the most predictable.
  - [con] misses small changes to contracts and data.

**Answer:** A: Small decision changes should be ok for this flow _but_ require human approval before
going through and making the PR

Never forget: decisions are OK to change, they are here to store human intent. Is that clear in the
skill and flow?

## Q5: What happens when you accept an upgrade to a feature?

The agent asks in a round of questions, and you answer. Drafts live on the default branch, and a
light change on its own branch. Postponing a feature already moves its folder to `specs/drafts/` and
merges it, and starting a draft folder keeps its files. More in
[discovery](discovery-01.md#how-an-upgrade-happens).

Why it matters: it decides how quickly an upgraded change gets going, and whether you choose when.

- **A (recommended). The agent postpones it into a draft folder: the request becomes `proposal.md`,
  unchanged, the investigation stays next to it, the branch merges into the default branch, and its
  `PRIORITIES.md` entry stays in Now; you start it as a feature.**
  - [pro] reuses postponing and starting; the investigation feeds the discovery.
  - [con] one start by you before the discovery runs.
  - Why recommended: you keep the choice of when and under which slug, through tools that exist.
- **B. The agent turns the branch into a feature at once: folder and branch renamed, and the
  discovery starts.**
  - [pro] no wait.
  - [con] renaming a branch, its worktree, and its remote is new and fragile; no moment to
    re-prioritise.
- **C. The agent drops its branch and asks you to write a draft.**
  - [pro] nothing new to build.
  - [con] the investigation is lost, and you write the request twice.

**Answer:** A

## Q6: How does a small UI change meet the UI decisions?

The [UI checks](/specs/decisions/ui-checks.md) decision says "Every UI test MUST guard a spec's
acceptance scenario, edge case, or success criterion, or a rule of a UI decision", and the
[UI layout](/specs/decisions/ui-layout.md) decision that "A view's spec MUST say why its layout
reads best" and "Every view's spec MUST say what it shows at both width classes, and its mockups
MUST show both". A light change has no spec. The screenshots rule, at both widths and in both
themes, works as it is. More in [discovery](discovery-01.md#ui-changes-without-a-spec).

Why it matters: it decides whether small UI tweaks can use the light flow at all.

- **A (recommended). Propose changes to both decisions: for a light change, its request and the
  agent's file stand for the spec, its tests guard the request's expected behaviour, and its
  screenshots at both widths stand for mockups; a new view stays a feature.**
  - [pro] small UI fixes get the light flow with the same checks and screenshots.
  - [con] no mockup before code: you judge from the pull request's screenshots.
  - Why recommended: the screenshots already show both widths and themes, and a new view is caught
    by the "new view" line.
- **B. Every UI change escalates to a feature.**
  - [pro] no decision changes.
  - [con] the full flow for a centred icon, the case the proposal wants gone.
- **C. Propose changes to both decisions, and a light UI change writes HTML mockups and stops for
  your approval before code.**
  - [pro] you see the change before it is built.
  - [con] two reviews per UI tweak, against Q3's answer.

**Answer:** A: I'm not sure that it conflicts too much with the decisions though, it's about testing
and specs, which should be pretty minimal for small fixes.

## Q7: How much review does a light change get before its pull request?

The feature flow reviews each task, then the whole branch with a fresh reviewer agent, then a second
reviewer when there is one. Claude Code and BMAD's small route use one fresh reviewer on the diff,
told to flag what affects correctness. Google, DORA, and Kubernetes review every change, small ones
faster. More in [discovery](discovery-01.md#the-review-before-the-pull-request).

Why it matters: the proposal wants less review and no loss of quality; this sets the balance.

- **A (recommended). One fresh reviewer agent on the whole diff, with the final review's criteria
  scaled to it; important findings fixed with a test, minor ones listed in the pull request.**
  - [pro] an independent check of every change, at one review's cost.
  - [con] no second reviewer, unless you ask in the request.
  - Why recommended: the reviewer is what the direct commits lacked, and a light diff is small
    enough for one pass.
- **B. The full final review, as for a feature: per-step reviews, a fresh reviewer, and a second
  reviewer.**
  - [pro] the most thorough.
  - [con] as slow as a feature's end, for a small diff.
- **C. The agent reviews its own diff.**
  - [pro] the cheapest.
  - [con] an author's review misses what a fresh one catches.

**Answer:** A

## Q8: Can one request hold several small changes?

The [look-and-feel draft](/specs/drafts/look-and-feel.md) is a list of small UI fixes. Google and
Linux keep one change per review; UI tools apply small edits in batches. With A, each change still
gets its own commit and test. More in [discovery](discovery-01.md#one-change-or-a-batch).

Why it matters: it decides how many pull requests you review for a list of tweaks.

- **A (recommended). A request may list a few related changes in one area; each gets its own commit
  and test, in one pull request.**
  - [pro] one review for a list of tweaks; commits keep each change apart.
  - [con] a larger diff; one change that escalates holds back the others, unless the agent splits it
    out.
  - Why recommended: your review time is the cost, and a related batch reads as one.
- **B. One change per request.**
  - [pro] the smallest diffs.
  - [con] a pull request per tweak.

**Answer:** A: Most rows in the look and feel draft could indeed be a small feature as described
here

## Q9: How much tooling does this feature build?

`ura start` panics on a bug, the web UI starts drafts only, and the runner's messages already know
the bug steps. The [CLI decision](/specs/decisions/cli.md) keeps every command's rule in the skill.
More in [discovery](discovery-01.md#tools-for-the-light-flow).

Why it matters: without the core's table, neither `ura next` nor the web UI's agent runner can run
the light flow.

- **A (recommended). The skill, the core's step table, `ura start` for a request, and a "start a
  change" action in the web UI, with the existing pages for its files; editors only through the
  core.**
  - [pro] you can start, run, answer, and review a light change from the web UI.
  - [con] a medium feature: two core files need splitting first, being at their limits.
  - Why recommended: the web UI is where you run agents; a flow it cannot start would stay unused,
    like `bug.md`.
- **B. The skill only; the tools come later.**
  - [pro] the smallest change.
  - [con] the runner and `ura start` cannot run it.
- **C. A, plus a dedicated view for light changes in the web UI.**
  - [pro] light changes stand apart from features.
  - [con] a larger UI feature, better decided after using A.

**Answer:** A and C: Light changes will be a dedicated view that should focus on the session
attached. The only change compared to a feature session will be what appears in the sidebar. It's a
larger UI feature but it should stay pretty small, I hope.

## Settled without the human

- **One request template** serves a bug and a change: what happens now, what should happen, how to
  see it. The agent tells a bug from a change against the spec, the docs, and the records, and says
  which in its file. See [discovery](discovery-01.md#needs-no-choice).
- **The investigation** follows `bug.md` for a bug: reproduce, a failing test, the root cause, one
  hypothesis at a time. For a change, it reads the code, the decisions, and the dependencies' docs,
  as a `low` discovery effort does, without comparing products online.
- **What stays unchanged** is listed in the agent's file, as Kiro's bugfix spec does, and checked by
  tests: fixes that over-edit are the main risk the sources name.
- **Tests**: a test fails first for the bug or the new behaviour, and checks of preserved behaviour
  keep passing, as in the implementation step. The request's expected behaviour stands for the
  spec's acceptance scenarios of
  [principle VI](/specs/CONSTITUTION.md#vi-code-is-checked-and-stays-maintainable).
- **Questions inside a light change** use a round, `clarifications-01.md`, which `ura answer`, the
  web UI, and the status table already handle, rather than questions inside the agent's file.
- **Code quality**: the [code-quality decision](/specs/decisions/code-quality.md) applies as it is;
  a structural commit comes first when a change grows a unit past a limit, and a new marker is a
  reason to escalate, since only a plan can carry its approval.
- **Catching up** with the default branch before the review, as the implementation step does.
- **Rulings** go in `rulings.md`, as today.
- **The record**: the finish step writes a short one, with the light flow's kind, and removes its
  `PRIORITIES.md` entry.
- **Priorities**: a light change gets an entry in **Now**, so `ura next` and the web UI find it.
- **Just-do-it edits**, typos, formatting, and comments, stay outside any flow, as today.
- **The scratchpad** owns capture and triage, in its own feature; a note starts as a light change
  like a draft starts as a feature.
- **Images** attach to a light change's folder as they do to a bug's today.
- **The UI iteration research** stays in this discovery, for its own feature: with A in Q1, the spec
  leaves it out.

**Notes:** Honestly the "small feature flow" is just a small structure for the files and how they
work together, but what they mostly do is build above the session/chat concept: chats (from the CLI)
are what I used for small features.

So make sure that the spec stays close to this: the small feature flow should look and feel like a
chat with a light structure on top: a file as input for context, optional clarifications rounds, and
then implementation and a PR.

Normal chats can stay but should be aware of this flow.

- **Questions inside a light change**: LGTM, let's make sure it's comfortable to see in the UI:
  re-use the clarifications view with a link in the right sidebar from the small feature flow (since
  the center column will be the agent)
