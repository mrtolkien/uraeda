# Tests and checks

How Uraeda is tested, when its checks run, and how `ura serve`'s pages are looked at before they are
handed over. The boundaries are three decisions: [Testing](../decisions/testing.md),
[Toolchain](../decisions/toolchain.md), and [Code quality](../decisions/code-quality.md). This guide
says what they aim at, in the human's words, and shows what good looks like. Read it before writing
a plan's tests, and when a test fails.

## In one paragraph

Tests are few, and each one earns its upkeep. A failure means a bug worth fixing. The checks an
agent runs while building are the ones of what it touched, and the full check runs once, at the end.
The pages are judged by using them, not by tests of how they look. When the human says "no tests",
there are none.

## What a test is for

> "I'm down for tests but they should be useful: each test is added maintenance, because tests also
> drift away from expected behaviour."

A test checks that the code behaves as the decisions and the approved spec say. It is never the
authority: "Tests validate behaviour? Evidence of what the human asked for is in the decisions and
the code itself?" So a test of behaviour a spec replaces goes with that behaviour. The human asked
for this after the opposite: "Many times the implementation made bad changes, breaking the specs,
due to forcing itself to pass old tests that should now be obsolete."

The project's stage is `early`, and the human moves it. They said why: "I feel like tests get more
useful the more stable an application is, but in early stage development it's undue inertia." And of
the suite of the time: "There are _too many_ tests, many not pulling their weight. This is
particularly true for frontend, where specs and requirements can change fast."

What that means for a feature's plan:

| Gets a test                                             | Gets none                                    |
| ------------------------------------------------------- | -------------------------------------------- |
| A stored format: a settings write keeps a hand edit     | A page's layout, sizes, or colours           |
| A write of the human's: an answer, a verdict, a sync    | A page that only shows what a file holds     |
| Security: every page asks for a sign-in and the origin  | The markup a page is drawn with              |
| A contract between two parts: the vault's sync protocol | Wiring that using the pages shows at once    |
| Pure logic with many cases: the next step of a feature  | One test for every sentence of a spec        |
| The bug a change fixes, reproduced first                | A second test of what another already proves |

The human's own example of the right column: "some tests/decisions record exact pixel values: this
is pointless, this is exactly the kind of "light" requirement that's bound to evolve and be broken".

Two habits, which the skill's [code quality](/skills/uraeda/references/code-quality.md) reference
gives in full:

- **A test asserts what a user or a caller observes**, not how the code does it. The first draft of
  this rule listed markup, class names, sizes, and call sequences, and the human found it "overly
  specific": the short form is the whole rule.
- **No elapsed time.** A test waits for the condition, or sets the clock. Racing two processes on a
  timer was refused for that reason. A benchmark of a spec's success criterion is the exception: it
  measures time on purpose, and it is not a unit test.

## Tests of the pages

> "Also we shouldn't forbid ALL webUI tests I think, but they should be extremely useful if there
> are any."

A test of a page's UI is rare. It guards behaviour that is costly to lose and that using the page
would not show: an answer refused because the round changed since it was drawn, a review written on
the version the human read, a write that a stale page must not make. When the old web UI's suite was
cut, twelve of its files were kept, all of that kind.

The question to ask of a UI test is the human's: "Are those tests really _useful_?" A regression in
how a page looks or flows is found by the human, on the page, and costs one line of a later session.
A test of it costs an edit at every change of the page.

## When a test fails

> "This is CRITICAL, a CI failure MUST mean that there is an IMPORTANT bug to fix"

A failing test is in one of five cases. Find which before touching anything.

| The test                                                  | What to do                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Guards behaviour the spec or the human's request replaces | Rewrite or remove it in the task that changes the behaviour                     |
| Guards behaviour nothing replaces                         | The code is wrong: fix the code, never the assertion                            |
| Fails without a bug, and guards something that matters    | Fix the test in the pull request that finds it                                  |
| Fails without a bug, and guards nothing important         | Remove it, with a ruling, and say so in the pull request                        |
| Failed while other builds saturated the machine           | Run it again, at most twice, once the machine is quiet, and name it in a ruling |

A retry is never the answer to the third case: it hides a real race. The fourth case is decided by
the agent, without a question to the human. They said so over a flaky width check, and its ruling
records it: "flaky tests that do not guard important behaviour are dropped, not investigated". The
goal, in their words, is "a GOOD testing set", not every test kept.

The last case exists because several worktrees build on one machine. A check that draws a diagram
failed twice under other builds' load, and passed three times of three on a quiet machine. That is
not a bug, and "fixing" it would be guessing. What is never done: loading the machine, or looping a
test, to hunt a failure that does not come back.

## When checks run

> "Remember that for you, writing code is cheap. Running 15 minutes tests on every small change is
> not."

The full check after every task once added more than an hour to a feature, and later held every
group of tasks for a drawing check that failed only under other builds' load. The human's answer was
a question: "… should our guidelines be more open to only running the tests that matter, and one
full run of the testing suite at the END of a feature?" Yes. That is the rule.

| When                              | What runs                                           | Recipe               |
| --------------------------------- | --------------------------------------------------- | -------------------- |
| After a task                      | Formatting, lints, and the tests of what it touched | `just task <crates>` |
| After a group of tasks merges     | That the merged code builds, in the background      | `just check`         |
| Once, at the end, before the push | Every check of the repository                       | `just ready`         |
| On the pull request               | The same as `just ready`, in the same dev shell     | CI                   |

A failure of the background check does not stop the next group: it is fixed beside it. Checks of
code the feature replaces are left out when the approved plan says so, since they prove nothing
about what replaces it.

Coverage is collected on demand, with `just coverage`. A drop fails nothing.

**The human can turn all of this off for a session**, and does, when iterating fast on a UI: "This
session is for FAST ITERATION. NO TESTS UNLESS I ASK FOR THEM", "Do not run or rewrite any tests.
Nothing." Then no test is run, written, or repaired. A request stands above a decision.

## Runs that touch nothing of the person's

The human asked for tests that are "properly isolated and reproducible". Every test and sandbox
recipe, and whatever `hidden-display` runs, goes through one wrapper,
[`scripts/isolated.sh`](/scripts/isolated.sh), which gives the run temporary data, configuration,
cache, and state folders. The wrapper fails the run when it wrote in the person's own folders of
Uraeda. A run of your own does the same: its own port, `--port 0`, and its own data folder. This is
a rule, and the wrapper enforces it.

Two worktrees testing at the same time never share a folder or a port, so one cannot fail the other.

## A check that fails says how to fix it

A custom lint or a structural test writes the fix in its message: "split this file by
responsibility", not only "file too long". The agent that meets it has nothing else open. This is a
habit, from the skill.

## How the pages are checked

> "I don't even want screenshots, I'd rather review actual behaviour with the sandbox."

The sandbox is `ura serve` over sample projects, each feature's branch in a worktree, started with
`just sandbox`. It is where the pages are judged, by the agent first and by the human later.

**Before handing a page over, the agent uses it** in the sandbox, at a desk's width and at a
phone's, in both themes: every act, with the sample's content. A picture taken then is a tool to
look with, never a check: none fails a build, and none is committed. This is a habit, and a strong
one: the human does not "want to come back to half-baked views again where it's mostly good but also
very scuffed".

**The agent never waits for the human to look.** A draft rule once said UI work must be checked by
the human live, and they corrected it: "Honestly that's not even really how I do it: I do multiple
UI features together, I merge them, then I do some quickfixing in a new session." So a UI feature
goes to its pull request like any other, and the human's review comes after the merge, over several
features at once. This is a rule.

**A pull request that adds a page shows one screenshot of it**, in its body: "Maybe 1 screenshot per
new view in the PR is warranted but that's it. No screenshots for review in the repo." This is a
rule too.

**Obsidian runs only on the hidden display.** The vault's sync is checked against the real Obsidian
by starting it under `hidden-display`, with `--ozone-platform=x11`, on a vault of its own, never on
the human's screen or their vault.

## Where this comes from

The human's words are from the proposals, answers, and reviews of four features: UI improvements
(2026-10-12), Testing review (2026-10-14), Fix testing (2026-10-19), and Testing communication
(2026-10-26), and from their sessions during the move to Native Shell (2026-11-11), whose app Uraeda
light removed. Their records are in [`specs/done/`](../done/).
