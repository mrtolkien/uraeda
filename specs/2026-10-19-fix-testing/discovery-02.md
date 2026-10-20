# Discovery, round 02: Fix testing

## Why this round

The human rejected the previous run's outcome on 2026-10-20: coverage fell sharply, but runtime did
not improve enough. Changes to widely imported files still took minutes. They requested an in-depth
review of good testing for Uraeda before continuing.

The [approved spec](spec.md) implements [round 01](clarifications-01.md)'s choice to replace every
suite with flows. The attempted implementation reached
[closed pull request 48](https://github.com/mrtolkien/uraeda/pull/48), at commit `32e2693f`. The
branch was subsequently reset to approval commit `e498b4f7`; its reflog records both states. This
worktree therefore contains the original tests, with no implementation plan. Historical
implementation links below use immutable commit URLs, not paths that exist in this worktree.

This round investigates the failed design, rather than treating the reset checkout as the failed
implementation. It leaves the previous answers, approved spec, constitution, decisions, and product
code unchanged.

## Summary

Good testing here means detecting meaningful regressions quickly, identifying their cause, and
surviving changes that preserve behavior. Test count, test lines, coverage, and the number of
systems exercised are insufficient measures individually.

The failed rebuild kept the whole-app dependency graph while discarding many inexpensive, distinct
behavioral checks. It also introduced shared mutable fixtures and waits for events that did not
establish readiness. A flow can execute many lines without asserting the rule those lines implement.

The principal design choice is where each guarantee gets its strongest, cheapest test. Uraeda has
unusually important boundaries: git history, human-owned text, authorization, native bindings, child
processes, and browser frames. These need focused behavioral tests alongside a small set of real
application journeys. Improving setup and dependency boundaries can reduce cost without abandoning
those guarantees.

## How other products do it

### Google's testing practice

[Testing overview](https://abseil.io/resources/swe-book/html/ch11.html) separates test scope from
resource use. A test can exercise several real collaborators without starting processes or a network
service. Broader tests complement cheaper tests; their proportions depend on the system. Its
coverage discussion distinguishes executing code from checking its effects.

[Unit testing](https://abseil.io/resources/swe-book/html/ch12.html) organizes tests around
observable behaviors, rather than individual methods. Narrow scope does not require asserting
private implementation details. [Test doubles](https://abseil.io/resources/swe-book/html/ch13.html)
favors real dependencies when practical and describes contract checks for fakes. A fake needs to
preserve the contract relevant to its callers.

Application to Uraeda is a judgement: a parser table, route request, and browser journey can all be
behavioral tests. The resource cost and failure they distinguish determine their role.

### Browser testing practice

[Playwright's best practices](https://playwright.dev/docs/best-practices) emphasize user-visible
outcomes, independent tests, and waiting through browser-aware assertions. This fits Uraeda's
keyboard, scrolling, frame, and navigation checks. It does not imply every file-format edge case
should be reached by clicking through the UI.

[Testing Library's event guidance](https://testing-library.com/docs/guide-events/) explains the
difference between dispatching an event and performing a user's interaction. The test needs the
relevant focus and event sequence when those affect behavior. Application: a click against an absent
node is a harness/readiness failure, not evidence of a product refusal.

### What they have in common

Tests need independent preconditions, explicit observable outcomes, and controlled sources of
nondeterminism. Real integration matters where components meet; the whole system need not own every
boundary case. Testability and runtime are design properties, not consequences of deleting
assertions.

## Standards and libraries

### Coverage and fault detection

[Inozemtseva and Holmes, ICSE 2014](https://www.cs.ubc.ca/~rtholmes/papers/icse_2014_inozemtseva.pdf)
studied coverage and fault detection in Java systems. Controlling suite size weakened the
relationship between coverage and effectiveness. Coverage still identifies code that tests never
execute. This supports investigating losses, rather than choosing a universal percentage as the
definition of quality. It does not establish that a drop in this application is harmless.

[Mutation testing at Google](https://research.google/pubs/state-of-mutation-testing-at-google/)
describes selective fault injection rather than exhaustive mutation of every line.
[Long-term effects](https://research.google/pubs/long-term-effects-of-mutation-testing/) studies
changes in test quality under mutation feedback. For this feature, a few deliberately broken
high-risk guards can expose weak assertions without adding a permanent mutation gate. These studies
do not prove that any particular replacement test is adequate.

[ImpossibleBench](https://arxiv.org/html/2510.20270v1) studies conflicts between specifications and
tests, including attempts to pass by violating the task. Its constructed tasks are not estimates of
Uraeda's defect rate. The useful implication is procedural: review the required behavior and changed
assertions independently of whether the final run is green.

### Vitest selection and profiling

The checkout runs Vitest 5.0.1 through Vite+. Context7 returned
[versioned CLI documentation](https://github.com/vitest-dev/vitest/blob/v5.0.3/docs/guide/cli.md)
and official implementation excerpts. The installed implementation also confirms that related-test
selection walks transitive imports, including imports discoverable during transformation. It cannot
infer arbitrary files read at runtime or Rust behavior behind a native module.

Consequently, changing a component reaches every test whose harness imports the entire app.
Restricting selection to direct importers would hide this relationship rather than remove it.

[Performance guidance](https://vitest.dev/guide/improving-performance) and
[profiling guidance](https://vitest.dev/guide/profiling-test-performance) distinguish
transformation, imports, environment, setup, workers, and test execution. Phase percentages
aggregate tracked worker time; they are not fractions of elapsed wall time. An optimization must
target the observed phase and preserve isolation. Disabling isolation globally is unsuitable for
this suite's environment variables, browser globals, native state, and filesystem mutations.

## The code

### Important reads

#### Baseline, failed attempt, and evidence quality

Sources are the current checkout, the attempted implementation at `a068a923`, its
[rulings](https://github.com/mrtolkien/uraeda/blob/a068a923/specs/2026-10-19-fix-testing/rulings.md),
and [CI run 39332744979](https://github.com/mrtolkien/uraeda/actions/runs/39332744979). The finish
commit `32e2693f` retains the implementation and replaces the workflow folder with its record.

| Measure                        | Before, as recorded previously      | Attempted rebuild, as recorded previously  |
| ------------------------------ | ----------------------------------- | ------------------------------------------ |
| Rust test execution            | 1,039 tests, 17 seconds             | 204 tests, 4 seconds                       |
| Rust line coverage             | 93.6%                               | 84.5%; 1,748 fewer product lines exercised |
| Server line coverage           | 83.0%                               | Reported 59.2%; measurement caveat below   |
| Web line coverage              | 81.21%                              | 79.13%; branch coverage 76.41% to 72.69%   |
| Web suite wall time            | 222 seconds                         | 81 seconds                                 |
| Fast check after Composer edit | 192 seconds                         | 90 seconds                                 |
| Fast check after Crumbs edit   | 191 seconds; 51 of 53 related files | No comparable final measurement recorded   |

These historical measurements were not rerun in this round. The server report was collected before
excluding the new flow directory from instrumentation. It also omitted child-process execution. The
web report's product-line denominator changed from 12,110 to 11,976. These are reasons to recollect
comparable reports, not reasons to dismiss the independently verified omissions below. The test
counts also vary by checkpoint and retained tooling files; they are not acceptance targets.

The original discovery's Rust figure was 51 seconds; the implementation's comparable local baseline
was 17 seconds. They are different observations and must not be combined into a speedup claim. The
discarded rebuild also optimized image dependencies in the development profile, improving encoding
runtime independently of deleting tests.

Two focused baseline probes were reproduced on 2026-10-20:

| Command, inside the Nix dev shell                                                                                                     | Result                                | Vitest duration  |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------- |
| `vp test --project uraeda-web packages/web/src/__tests__/draft-text.test.ts --run`                                                    | 5 passed                              | 144 milliseconds |
| `vp test --project uraeda-web packages/web/src/__tests__/home.test.tsx --run -t 'Needs you lists what waits on the human, by action'` | 1 passed; other 18 cases filtered out | 11.28 seconds    |

The latter reported transformation as its dominant tracked phase. These probes ran concurrently and
exclude configuration startup before Vitest's duration begins. They illustrate different cost
structures; they are not controlled benchmarks or proof of the one-minute budget. No test was
permanently skipped or changed for the probes.

#### CI did not validate the claimed outcome

The actual failed run is more informative than the completion record's pending success criteria:

| Job             | Elapsed job time, including setup | Result                         |
| --------------- | --------------------------------- | ------------------------------ |
| TypeScript      | 9 minutes 1 second                | Failed: 15 tests in 7 files    |
| Desktop browser | 5 minutes 20 seconds              | Failed: one column interaction |
| Phone browser   | 4 minutes 11 seconds              | Passed                         |
| Rust            | 3 minutes 9 seconds               | Passed                         |
| Neovim          | 2 minutes 57 seconds              | Passed                         |
| Release         | 3 minutes 3 seconds               | Passed                         |

TypeScript's check step took 7 minutes 39 seconds, after 1 minute 18 seconds of setup. Vitest itself
reported 338.24 seconds, with tests dominating tracked worker time. The desktop Vitest run reported
148.72 seconds. These figures include failed waits and cannot predict the duration of a corrected
green run. They establish that neither stability nor the whole-CI budget had been demonstrated.

#### The fast loop retains the expensive graph

Current [UI helpers](/packages/web/src/__tests__/helpers.tsx) import the complete
[App](/packages/web/src/App.tsx), server, and binding. The replacement
[harness](https://github.com/mrtolkien/uraeda/blob/a068a923/packages/web/src/__flows__/harness.tsx)
preserves those imports. App imports the pages, so a leaf component can transitively affect almost
every application test. The previous measurements selected 838 tests even for `Crumbs.tsx`.

The discarded [fast task](https://github.com/mrtolkien/uraeda/blob/a068a923/vite.tasks.ts) depends
on binding generation and a production web build before selection. The
[selector](https://github.com/mrtolkien/uraeda/blob/a068a923/scripts/fast-check.ts) then always runs
whole-repository `vp check`. A production build is justified for tests consuming built output, not
automatically for every source test. Selection needs to precede optional build prerequisites.

[Task inputs](/vite.tasks.ts) broadly include packages, fixtures, the skill, and binding inputs.
Those dependencies protect cache correctness but invalidate unrelated work together. Splitting
cached tasks requires auditing their actual reads, not removing inputs to create more cache hits.

The selector has additional correctness gaps by inspection:

- Deleted source paths are discarded before related selection; surviving importers may still need
  tests.
- Declaration files are ignored, and root configuration changes lack comprehensive routing to
  affected tests.
- Skill changes select binding-dependent TypeScript tests but do not select Rust tests, although
  Rust embeds the skill.
- Runtime assets and native dependencies need explicit ownership outside the JavaScript import
  graph.
- Git-command failure becomes an empty file list, which can report insufficient validation as
  success.

The current [test wrapper](/scripts/test-run.ts) owns cleanup and machine-wide resource locks. Queue
time, cancellation, and cleanup belong in elapsed-time measurements. Removing those protections to
improve a timing result would reintroduce known multi-worktree problems.

#### Setup reuse introduced dependencies between tests

[fixtureRepo](/packages/binding/test-utils.ts) repeatedly builds history through synchronous git
processes. The discarded harness instead creates one mutable repository and server per test file.
Its `beforeEach` clears browser stores, but does not reset repository, settings, cache, or runner
state.

For example, the replacement
[settings tests](https://github.com/mrtolkien/uraeda/blob/a068a923/packages/web/src/__flows__/settings.test.tsx)
expect later cases to use hosts added or renamed by earlier cases. These cases cannot establish
their own preconditions when run individually. They are also harder to diagnose after an earlier
failure.

Replacement round and review suites create many feature branches in the same repository: 15 and 14
respectively. Every App mount also loads shell projections over that accumulated data. Additional
scanning cost is plausible, but requires profiling; this round does not claim to have measured it.

The existing [browser fixture](/packages/web/vite.browser.config.ts) already builds a template and
copies it for isolated cases. That pattern separates reusable immutable history from mutable state.
Copies containing linked worktrees need path repair or a template without external worktree
references. Each independent case still needs its own server state, cache, configuration, and fake
runner where these can change.

#### Readiness was weakened while wording was removed

The failed
[home flows](https://github.com/mrtolkien/uraeda/blob/a068a923/packages/web/src/__flows__/home.test.tsx)
wait for any link before looking for a particular feature. Sidebar links satisfy that wait while the
main page is still loading. Several CI failures therefore encounter missing nodes. Waiting for the
actual feature's link is both less fragile and more precise.

The settings flow waits for a file write, then immediately checks the checkbox's rendered state.
Persistence completion does not establish that React has drawn the result. Both outcomes should be
awaited when both are required.

The failed browser column test observed 48 pixels where it expected 320 after expanding. Its helper
accepts two unchanged width samples, which can occur before expansion begins. That is a plausible
explanation, not a reproduced root cause. The test should establish expansion before observing
completion and assert the supported behavior rather than an incidental default width.

The review flow's 20-second timeout alone does not distinguish a race from genuinely slow work. The
failed embed flow repeatedly remounts App inside a readiness wait, changing what it is trying to
observe. Both need focused diagnosis; neither justifies a longer timeout by default.

#### Concrete coverage losses and weak replacements

These are inspection findings, not newly executed mutation experiments. Each example names the
required distinction and a plausible defect that the replacement misses.

| Guarantee                                                                    | Existing evidence                                                                                                                         | Failed replacement and the gap                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reject oversized bodies before consuming them; bound chunked uploads         | [attachment request tests](/packages/server/src/__tests__/attach.test.ts), including a body that throws if read                           | [attachment flow](https://github.com/mrtolkien/uraeda/blob/a068a923/packages/server/src/__flows__/attachments.test.ts) sends 22 MiB of zeros named PNG and accepts any 400. Invalid image decoding can reject it even without size enforcement. |
| Derive narrow permission rules and reject wildcards or line breaks           | [adapter tables](/packages/server/src/runner/__tests__/claude.test.ts)                                                                    | [adapter flow](https://github.com/mrtolkien/uraeda/blob/a068a923/packages/server/src/__flows__/claude.test.ts) accepts an undefined rule or any rule-shaped string. Always returning undefined passes.                                          |
| Keep comments inside edited arrays, line endings, and byte-order marks       | [settings write cases](/crates/core/tests/settings_writes.rs)                                                                             | [settings flow](https://github.com/mrtolkien/uraeda/blob/a068a923/crates/core/tests/flows/settings.rs) does not place comments inside array entries; its preservation helper excludes some edited lines.                                        |
| Distinguish merge history from squash history when quoting earlier reviews   | [answered cases](/crates/core/tests/answered.rs)                                                                                          | [view flow](https://github.com/mrtolkien/uraeda/blob/a068a923/crates/core/tests/flows/views.rs) checks ordinary revision history. A squash removes history the ordinary case retains.                                                           |
| Keep exact source ranges used by document callers                            | [document cases](/crates/core/tests/document.rs)                                                                                          | The inventory treats source positions as structure. Wrong positions can associate an edit or comment with the wrong text.                                                                                                                       |
| Preserve image orientation, animation content, delays, and metadata removal  | [image cases](/crates/core/tests/images.rs)                                                                                               | [attachment flows](https://github.com/mrtolkien/uraeda/blob/a068a923/crates/core/tests/flows/attachments.rs) check broad dimensions/frame presence, which cannot establish pixel placement or timing preservation.                              |
| Handle preview timeout, idle stop, startup failure, and changed commits      | [preview lifecycle cases](/packages/server/src/preview/__tests__/runner.test.ts)                                                          | Several are explicitly dropped as elapsed-time checks, although the old tests advance a controlled clock instead of waiting minutes.                                                                                                            |
| Track insertion positions while the human edits text                         | [insertion cases](/packages/web/src/__tests__/insertLink.test.ts)                                                                         | Replaced by server attachment writes, which cannot exercise cursor tracking in the browser's editing logic.                                                                                                                                     |
| Handle unavailable storage, persistence, and repository separation           | [unsaved cases](/packages/web/src/__tests__/unsaved.test.ts)                                                                              | Whole-page happy paths do not independently exercise storage failure boundaries.                                                                                                                                                                |
| Validate parent/child frame messages, reload handshakes, and persisted picks | [frame tests](/packages/web/src/__browser__/story-embed.test.tsx), [comment tests](/packages/web/src/__browser__/story-comments.test.tsx) | [embed flow](https://github.com/mrtolkien/uraeda/blob/a068a923/packages/web/src/__flows__/spec-embed.test.tsx) checks attributes with iframe loading disabled. The remaining pick-script test exercises only the child script.                  |

The install rollback check is weak in both versions. Making the installation parent unwritable fails
while creating the temporary staging directory, before a partial install exists. That cannot prove
cleanup after a later write fails. Keeping an old test is therefore not sufficient evidence either.

The preview's real isolation and message handling are especially important under the
[stack decision](../decisions/stack.md). A frame attribute assertion cannot prove that an untrusted
window cannot trigger a parent action. Losing that test does not establish a vulnerability; it
removes evidence protecting the boundary.

#### What assertions should mean

The [approved spec](spec.md)'s blanket wording against text, counts, and sizes conflates different
contracts. These distinctions matter:

| Assertion                                                                 | Why it can be useful or wasteful                                                                                           |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Full home heading concatenated with fixture totals                        | Usually incidental copy plus unrelated fixture coupling; use the required action/state instead.                            |
| Exact user text, unknown TOML keys, line endings, or unchanged file bytes | Data preservation is the requirement. Approximate assertions can miss loss.                                                |
| Exact count of commits caused by one approval, with a captured baseline   | Guards duplicate writes; a hard-coded total for the entire fixture does not.                                               |
| HTTP status, cookie flags, protocol version, source span, permission rule | These values are contracts or security behavior. Exactness is often required.                                              |
| A timeout tested by advancing a clock                                     | Checks lifecycle behavior deterministically; it is not a wall-clock performance assertion.                                 |
| Fixed default column width                                                | Usually incidental; test expansion, persistence of a user-chosen width, or readable layout where the decision requires it. |

A negative test needs an input that would otherwise succeed, or evidence that the intended guard
caused rejection. An unconditional exception, generic refusal, or second independent failure must
not satisfy it accidentally. Assert preserved state and lack of side effects when refusal is the
promise.

### The proposal's path and existing actions

#### Other work touching these tests

The concurrent `change/2026-10-20-session-transcript` branch changes the session, shared prose
rendering, and their tests. Its
[proposal](https://github.com/mrtolkien/uraeda/blob/cc955b7c/specs/changes/2026-10-20-session-transcript/proposal.md)
preserves the latest 20 messages while reducing mounted tool-call content. Its
[UI behavior decision](https://github.com/mrtolkien/uraeda/blob/cc955b7c/specs/decisions/ui-behaviour.md)
explicitly requires bounded mounting checked by counts rather than elapsed time. This is a concrete
incoming contract that a blanket ban on count assertions would prevent testing.

Its
[rulings](https://github.com/mrtolkien/uraeda/blob/cc955b7c/specs/changes/2026-10-20-session-transcript/rulings.md)
also describe a shrinking list of legacy reading-style exceptions, guarded by lint tests. Such tests
enforce a requested migration rather than merely snapshotting configuration. The eventual plan must
reconcile these changed tests and decisions with its actual base before replacing or moving them.
This review neither merges that branch nor treats its changes as already present here.

#### A test architecture matched to this application

This is a candidate design, not a change to the approved architecture. Each row identifies the
boundary best suited to owning a family of guarantees. It does not prescribe a test quota or a new
test framework.

| Area                      | Primary focused tests                                                                                                       | Integration evidence that still matters                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Workflow and markdown     | Core public APIs: state transitions, unanswered follow-ups, validation, document ranges, exact text preservation            | CLI and UI agree on a representative gate read from the committed branch tip.                                                 |
| Git writes and cleanup    | Real temporary repositories: hooks, dirty index, stale hashes, conflicts, merge/squash differences, rollback, unmerged work | Answer, approval, and commit/start reach the intended branch without disturbing another checkout.                             |
| Native binding            | Representative serialization and errors, with actual Rust output                                                            | Server reaches rebuilt binding; non-JavaScript inputs invalidate its checks. Do not duplicate every core table in TypeScript. |
| Server requests           | Real app request handling, route/auth/origin/path tables, two-repository isolation                                          | A few live transport checks prove cookies, streams, sockets, and shutdown behavior.                                           |
| Sessions and adapter      | Fake adapter, isolated real cache, event/permission tables, controlled clocks and cancellation                              | One run/chat/stop journey proves worktree, persistence, and live publication together. No paid agent in ordinary tests.       |
| Settings and attachments  | Owning core APIs preserve files and image properties; server checks authorization and bounded reads                         | One UI save/upload persists through the real server and core, including a refusal that leaves input intact.                   |
| UI editing                | Actual component behavior and pure editing/storage functions, importing only their relevant collaborators                   | One round/review journey proves routing, saving, reload, and conflicting revision handling.                                   |
| Notifications and refresh | Controlled permission/visibility inputs, event sequences, independent clients where necessary                               | One actual live-update boundary proves subscription and repository scoping.                                                   |
| Browser capabilities      | Real browser for focus, keyboard, scrolling, paste/drop, frame security, and reading-place preservation                     | Required page accessibility/readability matrix at both sizes and themes remains in ready.                                     |
| CLI and LSP               | Exit/protocol mapping, permitted edits, stale buffers, structured failures, no unexpected writes                            | Native installation/startup and a small editor smoke; core owns the complete workflow case matrix.                            |
| Benchmarks                | Approval, record completeness, model mismatch, hidden-data isolation, and baseline identity through fakes                   | Test the runner without starting a chargeable benchmark.                                                                      |
| Tooling                   | Observable selection/cache/process contracts with representative inputs and a few real subprocesses                         | Cancellation leaves no orphan; new test projects participate in ready and CI. Avoid formatting snapshots of configuration.    |

Whole-app journeys remain essential, but repeating all parser and refusal variants through each
caller adds cost without new assurance. Conversely, a component refusal and a server authorization
refusal protect different boundaries even if one flow reaches both. Sharing a fixture or reaching
the same function does not prove two tests are duplicates.

The few critical application journeys should establish:

1. A committed feature at a gate appears, accepts answers, commits once, and reaches the next
   expected step after reload.
2. Review and approval preserve comments and reject a stale revision without losing the human's
   pending input.
3. Starting, chatting with, and stopping a fake runner preserve worktree/session identity and
   publish the expected state.
4. Switching repositories and authenticating scopes reads, writes, and live updates correctly;
   signing out ends access.
5. A real preview frame loads, exchanges trusted messages, persists a picked comment, and ignores an
   untrusted sender.

A journey may contain several actions when their sequence is the behavior. Independent tests must
not require earlier tests to perform their setup.

#### Changes that preserve the product should preserve its tests

A heading rename, component extraction, or internal call reordering should pass when its public
behavior stays the same. A changed permission scope, lost draft, incorrect source range, or extra
commit should fail. Use public inputs and results rather than call counts, component state, CSS
classes, or duplicated algorithms. The expected result should come from a small reviewed example or
a requirement, not the function being tested.

Failure cases need explicit ownership: rejected writes, partial failures, cancellation, restart,
storage errors, malformed events, and conflicting edits. Their being less common does not make data
loss or a security bypass a normal-risk edge case. Keep this classification tied to the spec and
decisions, not to the ease of writing a happy-path flow.

#### A workable iteration loop

Two distinct semantics are possible, compared under [approaches](#the-fast-checks-guarantee). An
incomplete fast check must say what it deferred; it must not claim the whole affected system passed.

A layered fast check could run related focused tests, the relevant boundary checks, and a small
wiring check. The full application and browser sets would remain in ready, explicitly deferred.
Related selection becomes useful once the focused layer no longer imports App. That is different
from limiting an unchanged application's graph to direct importers.

For Rust, retain cheap core behavior tests and scope packages by reverse dependencies. A core change
still affects the binding and its contract checks. A complete binding-loading application suite in
every iteration would preserve the previous multi-minute cost. Deferring that full suite needs the
human's agreement about the fast check's promise.

For source tests, schedule binding or generated prerequisites only where needed. Keep production web
and Storybook builds in ready and in checks explicitly exercising built output. No new runner,
remote cache, browser engine, or paid service is necessary for this candidate design.

### Rules and their owners

- [Constitution VI](../CONSTITUTION.md#vi-code-is-checked-and-stays-maintainable) owns behavioral
  adequacy and visible justification for weakening tests. It does not require every test to exercise
  the whole stack.
- [Stack](../decisions/stack.md) owns the Rust workflow implementation and real server-fed
  application. Focused UI tests must not introduce a second workflow parser or guessed server model.
- [Git](../decisions/git.md), [repositories](../decisions/repositories.md),
  [settings](../decisions/settings.md), [attachments](../decisions/attachments.md),
  [agents](../decisions/agents.md), and [sign-in](../decisions/sign-in.md) own the contracts the
  corresponding test families must guard.
- [UI checks](../decisions/ui-checks.md) owns the page matrix and behavior-based UI testing.
  [Preview](../decisions/preview.md) keeps stories separate from tests and requires the Storybook
  build.
- [Toolchain](../decisions/toolchain.md) holds this branch's proposed fast/ready split; the approved
  spec authorizes that split. Coverage remains optional, with no automatic failure on a percentage
  drop.
- [Code quality](../decisions/code-quality.md) prohibits unit tests depending on elapsed time.
  Injected clocks satisfy that rule without deleting lifecycle behavior.
- [Testing guidance](/skills/uraeda/references/code-quality.md) currently favors integration and
  narrowly limits unit tests. Its plan, implementation, change, templates, and example need to
  express the revised architecture together if approved.

### Likely changes

All approaches need corrected selection, readiness conditions, evidence records, and honest
reporting of unmet criteria. Product bugs discovered by tests remain subject to the approved product
scope.

With a layered design, likely implementation changes are:

- [Test helpers](/packages/binding/test-utils.ts),
  [UI helpers](/packages/web/src/__tests__/helpers.tsx), and
  [browser setup](/packages/web/vite.browser.config.ts): reusable templates with independent mutable
  state and smaller imports.
- [Task graph](/vite.tasks.ts), package test configurations, and a replacement fast selector: select
  before optional builds and separate test families.
- Existing core, server, UI, and browser tests: retain valuable cases, move them to their owning
  boundaries, and replace incidental assertions.
- [Skill entry](/skills/uraeda/SKILL.md), its testing/plan/implementation/change references,
  templates, and [example](/skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/): align
  behavioral ownership, cost, and deletion evidence.
- The spec, its eventual plan, and the toolchain proposal: define the fast check's exact promise and
  evidence required before deletion.

No constitution amendment is identified as necessary. The failed attempt's record may supply useful
flows, but is not a plan to resume wholesale.

## The proposal

### Replacing every suite prejudges which tests are useful

The [answers](clarifications-01.md) explicitly authorized a complete replacement. Retaining and
repairing good existing tests changes that approved scope and needs a human choice. The evidence
shows both valuable old cases and weak old cases. Neither blanket retention nor blanket deletion
follows from the original goal.

### Flow count does not bound runtime

The accepted architecture keeps the graph that relates almost every page to a shared edit. Its final
recommendation offered either relaxing the budget or selecting direct importers. That omitted a
third option: change test boundaries so relevant focused tests are independently runnable. Shared
widgets will still affect multiple callers; the cost of those callers needs a measured bound.

### A file mapping cannot establish behavioral replacement

An old-file-to-new-file table can be complete while losing important cases inside each file. The
upload, permission, frame, and merge-history examples demonstrate that weakness. A useful record
identifies the required guarantee, its owning assertion, and why a removed check adds no distinct
protection. It must not become a new one-test-per-sentence bureaucracy.

### The speed budgets need representative evidence

Keep the approved one-minute development and five-minute CI targets during investigation. Do not
quietly relax them when a selected sample fails. Distinguish a warm dependency build from a clean
build, and include command startup, prerequisites, locks, and cleanup in end-to-end timing.

The pilot's change matrix should include a leaf, Composer, a shared helper, core Rust, embedded
skill, fixtures, root configuration, declarations, deleted source, and documentation. Record
selected suites, deferred suites, timing phases, repository size, and machine contention for each.
Use repeated measurements and report median and worst observed time; avoid claiming a percentile
from a handful of samples. Compare old and new commands on the same machine, state, and workload.

The old spec does not distinguish warm edits from clean builds. If native rebuilding alone exceeds
its budget, report the conflicting requirement before expanding the rebuild. Do not treat a new
budget as an implementation detail.

## Worth it and feasibility

The outcome remains worth pursuing: reliable checks and shorter iteration directly reduce this
project's maintenance cost. The previous all-flow rebuild is not validated by its evidence. Runtime,
adequacy, and stability need separate demonstrations.

A Composer pilot can test the largest known UI selection problem before replacing other areas. A
companion core/binding probe must establish whether the proposed fast guarantee works across
languages. Neither needs a new dependency or a chargeable benchmark. The whole-app suite remains
available until replacement evidence is adequate.

Real browser checks cannot be replaced by a DOM emulator for frame isolation, actual layout, or
browser focus behavior. Real git checks cannot be replaced by in-memory records where merge history,
hooks, or worktree safety is the behavior. Conversely, pure text transforms do not need temporary
git repositories. This boundary allocation is feasible by inspection; its final speed is not yet
demonstrated.

## Approaches

Criteria come from the [proposal](proposal.md), [approved spec](spec.md), constitution, and
decisions linked above. They are meaningful fault detection, preservation of work, stable tests,
bounded iteration time, and maintainable test code.

### The suite architecture

This choice revisits the approved replacement of every suite. See
[coverage losses](#concrete-coverage-losses-and-weak-replacements) and
[candidate architecture](#a-test-architecture-matched-to-this-application).

| Option                                                  | Fault detection                                        | Runtime                                                          | Migration cost                                       |
| ------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------- |
| Layered repair, retaining useful tests                  | Focused cases guard boundaries; journeys prove wiring  | Can remove whole-app work from frequent checks; requires a pilot | Incremental, with behavior evidence before deletion  |
| Repair and optimize the discarded all-flow rebuild      | Missing cases need restoring inside broader flows      | App fanout remains unless flows become independently scoped      | Large restoration and fixture redesign               |
| Keep the current suite and optimize infrastructure only | Existing protections remain, including weak assertions | Can improve setup/imports; does not remove redundant tests       | Lowest initial disruption, incomplete quality reform |

### The fast check's guarantee

This choice determines what a green local check promises after a shared edit. See
[iteration loop](#a-workable-iteration-loop) and
[selection gaps](#the-fast-loop-retains-the-expensive-graph).

| Option                                                                                               | Local assurance                                       | Speed constraint                                                                     | Full validation                                              |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| All related focused tests, affected boundary checks, limited wiring; defer broad journeys explicitly | Deliberately partial, with named deferred checks      | Narrow test imports and prerequisites make the target plausible; pilot must prove it | Ready runs all journeys, browser checks, and required builds |
| Every transitively affected non-browser test                                                         | Broad local assurance, including application journeys | Shared/core edits can still select almost everything; speed is unproven              | Ready adds remaining checks                                  |

### Evidence before deleting tests

The existing constitution and approved high-risk checks require evidence that replacements guard
meaningful behavior. The alternatives below distinguish implementing that requirement from adding a
new coverage policy. See [assertion meaning](#what-assertions-should-mean) and
[file mapping](#a-file-mapping-cannot-establish-behavioral-replacement).

| Option                                                                                            | Evidence                                         | Cost                                                             | Main limitation                                                            |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Per-guarantee replacement/redundancy evidence, selective fault probes, comparable coverage review | Shows which behavior remains protected and where | Focused reviewer effort and occasional instrumented runs         | Cannot prove every possible fault is caught                                |
| Require old coverage percentages as an additional gate                                            | Flags structural losses mechanically             | May preserve low-value execution or encourage shallow assertions | Needs a toolchain decision change; percentages do not establish assertions |
| Keep the previous old-file mapping only                                                           | Every path has a disposition                     | Lowest recording cost                                            | Already allowed meaningful losses and vacuous replacements                 |

### Needs no choice

Independent tests, explicit readiness, real git where git matters, and real browsers where browser
semantics matter follow existing constraints. Keep the required page matrix, fake runner, no-retry
policy, process cleanup, and worktree isolation. Keep coverage outside ordinary ready/CI; collecting
it during this rebuild is an investigation, not a new permanent gate. Do not measure success through
fewer tests or fewer assertions. Do not run paid workflow benchmarks. Behavior-level deletion
evidence implements the existing constitution and approved fault checks. It needs no new human
choice; a permanent percentage gate would change the toolchain policy and is outside the proposed
implementation.

## Not checked

- The failed attempt's historical coverage artifacts were not available as current comparable
  product-only reports. Their recorded exclusions and denominators differ; recollection belongs to
  the pilot.
- No new product mutations were executed in this round. Weak-oracle findings above are by code
  inspection, and need explicit break checks before they justify replacement.
- The browser column failure's root cause and the review timeout were not reproduced locally. CI
  evidence and suspicious waits identify investigations, not final fixes.
- The candidate architecture's one-minute timing, native rebuild bound, five-minute green CI, and
  five-run stability remain unproven. These are pilot/implementation acceptance work, not results of
  this review.
- No current protocol compatibility test against the installed external agent was run. Ordinary
  tests must remain fake; an explicit compatibility check is separate from the test rebuild.
