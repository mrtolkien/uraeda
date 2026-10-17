# CI and testing review, 2026-10-17

## Findings and evidence

The failures have several causes. Increasing every timeout, retrying tests, or dropping browser
validation would conceal useful failures. The changes here keep every acceptance test in `ready` and
CI, remove the optional instrumented duplicate from CI, repair stale local cache results, and
preserve evidence of browser failures.

The review sampled the 100 most recent runs of
[CI](https://github.com/mrtolkien/uraeda/actions/workflows/ci.yml), from October 14 at 11:07 UTC
through October 17 at 13:09 UTC: 45 failures, 33 successes, 19 cancellations, and three unfinished
runs. Of the 56 runs on `main`, 31 failed, 18 succeeded, five were cancelled, and two were
unfinished. These are a bounded sample, not a failure-rate estimate: consecutive commits often carry
the same unfixed problem. Failed-job logs from the 18 latest failed `main` runs were read, alongside
the current tests, runners, fixtures, task graph, and previous testing review.

| Finding                                           | Evidence                                                                                                                                                                                                                                                                                                                                                                                         | Resolution                                                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coverage made an otherwise green revision red     | [Run 39027468790](https://github.com/mrtolkien/uraeda/actions/runs/39027468790): all six validation jobs passed; coverage failed in `review.test.tsx`, restoring a comment after the reviewed commit changed, at its 20-second timeout. The instrumented TypeScript run took 659 seconds.                                                                                                        | Keep coverage available locally, outside CI. Reduce unnecessary document size in review-flow fixtures.                                                    |
| Tests observed partially loaded pages             | [Run 39025655133](https://github.com/mrtolkien/uraeda/actions/runs/39025655133): pane/editor textboxes and a Home group were absent when queried. Its coverage run compared the entire navigation text before the independently loaded Inbox count arrived. [Run 39014300919](https://github.com/mrtolkien/uraeda/actions/runs/39014300919) also observed the old URL after adding a repository. | Current `main` already waits for the relevant controls, count, or URL. Preserve those fixes and document the synchronization rule below.                  |
| Browser readiness and writes also race assertions | [Run 39026399082](https://github.com/mrtolkien/uraeda/actions/runs/39026399082): the sidebar's Idle icon was queried too early, and the story comment was read before the write completed. Earlier runs failed a drag's file comparison and queried an embed not yet rendered.                                                                                                                   | Current `main` waits for the icon, polls the completed file write, and waits for embeds. Retain full browser validation and capture first-failure traces. |
| Some failures were valid change detection         | The Rust job of run 39025655133 caught clippy's `int_plus_one`. The Neovim job of [run 39013298099](https://github.com/mrtolkien/uraeda/actions/runs/39013298099) expected three priority hints after a fourth, Backlog, was added.                                                                                                                                                              | Both are fixed on `main`. Keep warnings as errors and the real Neovim/LSP integration; do not classify every red run as a flake.                          |
| Some failures were infrastructure failures        | [Run 38835852348](https://github.com/mrtolkien/uraeda/actions/runs/38835852348) failed realizing the Nix shell after binary-cache HTTP errors, before the Neovim tests ran.                                                                                                                                                                                                                      | Distinguish setup failures from assertions. No test retry would fix a failed shell setup.                                                                 |

## Testing approach

### Rust, binding, server, and editor

The Rust core is the source of workflow parsing and validation. Its tests cover files, branches,
worktrees, conflicts, and failed writes using temporary git repositories. CLI tests execute the
binary and check observable files and output. LSP tests exchange real protocol messages and check
unsaved documents and worktree roots; Neovim tests start the real LSP inside child editors. These
are useful boundaries to keep: replacing them with mocks would lose integration coverage.

The Node binding is correctly omitted from Rust test selection because its napi symbols are provided
by Node. The TypeScript binding tests exercise it there instead. nextest gives Rust tests process
isolation, failure collection in CI, hang detection, and leaked-process detection. Benchmarks stay
opt-in; the memory-bound image test is appropriately excluded only under coverage instrumentation.
The normal Rust job still exercises it.

An uncached local run also exposed two CLI editor tests inheriting `TERM=dumb` despite creating a
pseudo-terminal with `script`. The CLI correctly refused interaction, but the tests expected an
editor launch or fallback message. The terminal harness now declares its required `TERM` and POSIX
shell and checks the subprocess exit status before inspecting its effects. This fixes the test
environment rather than changing the CLI's behavior in a headless terminal.

Server tests use the real binding and git, exercise routes and streaming, and substitute a fake
runner for external processes. This preserves repeatable tests without requiring an installed
external service. Sign-in, host guards, preview forwarding, and failure handling belong at this
layer. Keep checks of streamed updates here: happy-dom's UI harness deliberately uses a silent
EventSource, so a passing UI test there does not prove subscriptions reconnect or publish correctly.

### UI behavior and browser checks

The split between happy-dom behavior tests and WebKit layout/interaction tests is appropriate.
Layout, scrolling, touch behavior, sandboxed frames, focus, and accessibility need an actual
browser. Saving text, conflict handling, restored drafts, and routing can mostly be checked by
happy-dom against the real server and repository. The browser matrix covers the project's chosen
phone and desktop sizes; theme/layout checks run in both themes. That is intentional coverage of the
product decisions, not a claim to test every device or browser.

Most observed failures come from synchronization rather than missing retries. `renderPage` finishes
mounting the app; it does not promise every independent data read or suspended component has
finished. A heading's presence does not prove that an editor, badge, session icon, or embed is
ready. Likewise, a click returning does not prove a debounced write is on disk.

For each test, wait for the exact observable prerequisite before interacting, then wait for the
complete expected result. Poll the intended file contents after a write, including an invariant that
prevents a temporarily empty file from satisfying a negative assertion. Use roles, labels, and
visible text, scope queries to the relevant part of the page, and keep asynchronous waits free of
repeated user actions. When testing a pending state, hold the response explicitly and release it;
elapsed time is not a synchronization signal.

The 300-paragraph fixture was necessary for the test proving typing does not redraw the document.
Eleven other save/restore/comment tests reused it despite selecting only lines 40–60. Their default
fixture now has 30 paragraphs, with the same selected lines and exact outcome assertions. The
render-efficiency test still requests all 300. The failing restoration scenario remains in the
suite; neither its assertions nor its timeout were loosened.

Further validation found an ambiguous notifier query: both the sidebar and Home have a group called
"Needs you". Its test now counts links within the navigation and declares the initial document
title, so running it alone does not depend on another test's teardown. A thumbnail-focus failure was
a product race: removal could synchronously update the image store before the focus target was
recorded. Recording it first fixes the order. A focused regression forces a synchronous commit and
was observed failing before the fix and passing after it; the full session flow stays. The
[four review screenshots](ci-reliability/screenshots/) show keyboard focus on the remaining
thumbnail after removal at both sizes and in both themes. They were visually reviewed.

The tests intentionally use real git frequently, which costs time but verifies Uraeda's central
contract. Browser fixtures already build a template once and copy it for each test, with a fresh
repository name and a serialized fake-runner turn. Happy-dom tests have file-level temporary folders
and close hosts, settings watchers, sessions, and previews after each test. Keep file isolation:
disabling it to reduce startup time would make their globals and environment changes shared state.

### Cache correctness and resource use

The most consequential approach defect was outside the failing assertions: the TypeScript and
browser task cache inputs included packages, fixtures, and the skill, but not the Rust sources
loaded through the binding. A changed core could rebuild the binding while the test task reused an
earlier pass. Running uncached on CI exposed what cached local validation missed.

The changes track the binding's authoritative `SOURCES` list in both test families, rather than
creating another list. Cached checks also track the dev-shell pins and workspace runtime/package
configuration. `web:theme` tracks the dependency lockfile; the package smoke test tracks the Cargo
version and generated binding loader it reads; the Storybook build tracks the root config it loads.
Type checking waits for binding generation. Generated coverage, browser evidence, built Storybook
files, and copied package output stop invalidating unrelated checks. The ineffective
`packages/web/dist/**` inclusion beneath the universal dist exclusion is removed: source and
toolchain inputs plus the build dependency determine that output.

Regression tests exercise representative matching paths, including exclusions, so a positive glob
cancelled by a negative one cannot pass by merely appearing in an input list. They also check that
every cached `ready` task tracks `flake.lock`. The CI-completeness test now counts actual run
commands, including indented run blocks, rather than text in a job name or an echo. This is a
deliberately narrow command recognizer: a new shell wrapper must teach it its invocation.

The pre-commit hook exposed a second local validation mismatch: `vp check` passed across the whole
repository, but its staged-file invocation could not resolve Node types for the root Vite config and
task graph. Root tooling now has an explicit TypeScript project extending the shared settings and a
direct Node-types dependency, using the version already in the lockfile. Root scripts are included
too. The hook is validated through an actual commit, without bypassing it.

Vitest's worker count is capped at four and the available CPU count, without changing isolation.
Each UI worker loads the native binding and a browser-like DOM and builds repositories. The local
uncapped run started many large workers together while other checkouts were active; CPU count alone
is an unsuitable memory budget. Browser runs retain their existing machine-wide two-slot limit. This
does not claim a universal memory bound across arbitrary concurrent checkouts.

Cancellation testing exposed a process-lifecycle defect in `scripts/test-run.ts`. After another
check failed, the wrapper could stop `vp` while its Vitest child remained alive. Its temporary
folder was then treated as stale by the next run, which failed with `ENOTEMPTY` while the orphan was
still creating files. Commands now start in their own process group; cancellation signals the group,
and any remaining group members are stopped before cleanup and lock release. A regression test runs
a real launcher and child, waits for the child's readiness, cancels the wrapper, and checks that the
child exited and its files were removed. A separate IPC guard handles a force-killed wrapper: its
disconnect handler stops the command group and cleans the run folder even when SIGKILL prevents the
wrapper's own handlers from running. Both SIGTERM and SIGKILL have subprocess regressions. Bounded
filesystem-removal retries handle deletions in progress; tests themselves are never retried.

Complexity tracking: the guard adds one short-lived Node process per test command. This is needed
because a JavaScript signal handler cannot run after SIGKILL; a signal handler alone reproduced the
orphan under Vite Task's cancellation. IPC avoids polling and shell- or Linux-specific supervisor
tools. The group-signalling implementation is shared with the wrapper and serialized with the guard
so it remains one rule, without adding another script to every test task's input list.

### CI policy and diagnostics

Coverage was described as non-enforcing but its instrumented test failures still failed the
workflow, and it ran only after a push to `main`. A PR could therefore pass and make `main` red
without a coverage threshold being involved. With the owner's explicit direction that coverage is
optional, automatic collection is removed. `vp run coverage` and its reports remain available for
investigations; ordinary unit, integration, browser, editor, and release validation remain required.
An optional coverage command still reports test failures if its instrumented run fails.

Superseded `main` runs now cancel just as superseded PR runs do. Preserving every historical
coverage artifact no longer justifies occupying runners for revisions already replaced. The workflow
still has no path filters and still checks the working tree after successful validation.

Browser failures retain screenshots under ignored `.vitest/` paths and upload them as per-size
artifacts even after a failed test command. An intentional temporary failure verified both
screenshot and trace generation and was removed. Recording full DOM/network traces for every passing
test made validation much slower: the phone job took over 12 minutes, compared with about seven in
the latest baseline run. Traces therefore stay opt-in, with
`URAEDA_TEST_TRACE=1 nix develop -c vp run --no-cache browser:desktop` (or `browser:phone`). That
mode keeps the failing attempt's trace and discards successful traces, without a test retry.
Instrumentation can change timing and should be used for a focused investigation. Vitest's
[trace configuration](https://vitest.dev/config/browser/trace) documents this mode. The pinned
runner's implementation and types were also checked.

## Boundaries and remaining risks

- This review preserves Linux x64 validation and WebKit, as the active toolchain and UI decisions
  require. Release builds on other platforms do not substitute for running their tests.
- A passing accessibility/layout check does not prove visual design quality. The existing manual
  screenshot-review requirement remains for product UI changes. Thumbnail focus ordering changes;
  its layout does not.
- Broader fixture changes can still invalidate literal hint/count expectations in several layers.
  Update them with the intended behavior; do not replace exact expectations with permissive ones.
- Explicit cache inputs remain a maintained dependency map. Representative regression cases guard
  the defects found here, not every file any future tool might read. CI remains uncached.
- The test-runner lock's stale-file reclamation and free-port selection remain best-effort
  cross-process coordination. Neither is evidence that the historical assertion failures were port
  conflicts. Changes to those mechanisms need their own contention reproduction.

## Validation

The first uncached local TypeScript run passed 111 files and 1,642 tests. Final targeted and full
validation, the PR revision, and its hosted CI result are recorded in the pull request so they
identify the exact reviewed commit rather than an earlier checkout state.
