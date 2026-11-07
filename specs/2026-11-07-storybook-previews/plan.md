---
status: auto-approved
spec-revision: 1
---

# Plan: Faster Storybook previews

**Goal:** a story linked by a file waiting for the human shows at once: its branch's Storybook stays
up while the file waits, survives commits under `specs/`, and compiles the story before its frame
shows.

**Architecture:** the preview runner, [`runner.ts`](/packages/server/src/preview/runner.ts), keeps
owning every Storybook process, and gains three rules, each in its own place, as the
[spec's architecture](spec.md#architecture) lays out:

- **When it restarts**: the runner compares a checkout's **code version** where it compared its
  commit. The core computes it, `api::code_version`: the id of the `HEAD` commit's tree with its
  `specs` entry left out. The runner's `moved` rule stays as it is, on versions.
- **When it stops**: `Previews.sweep(kept)` takes the bases kept up. A kept Storybook counts as
  viewed at each sweep, so it stops 30 minutes after it is no longer kept. The **review watch**,
  [`fate/preview-waiting.ts`](/packages/server/src/fate/preview-waiting.ts), new, computes the kept
  bases from the core's step and the waiting file's embedded stories. The server's sweep tick and
  its start read it.
- **When a story is ready**: the **story warmer**,
  [`preview/warmer.ts`](/packages/server/src/preview/warmer.ts), new, fetches a story's page and its
  modules from the Storybook as a browser would. The runner holds each Storybook's compiles, once
  per story, shared by concurrent asks, and forgets them with the process. `readStory` answers
  `starting` until the story's compile ended or passed 60 seconds.

The runner's process handling moves to its own module first, `preview/run.ts`, so the runner, at 447
of 500 lines, has room for the rules. The fixture of Uraeda's own Storybook gets cheaper to build by
a cache, as the clarifications settled.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A sweep tick that takes longer than the next**: the review watch reads every repository through
   the core, asynchronously. Ticks never run two reads at once: a tick while one runs is skipped. A
   failed read keeps nothing, as today's sweep. Task 6, by review: no test.
2. **A compile still running as its Storybook stops or restarts**: its fetches are aborted, and its
   end sends no update for the stopped Storybook, nor marks the new one's story compiled. Task 5's
   compile state lives on the runner's entry, which a restart replaces.
3. **A removed worktree whose folder still waits for the human**: removal wins over the keep. Task
   4, in the existing "a removed worktree stops its Storybook" test, swept with its base kept.
4. **A story file the warmer cannot fetch, or an import that fails**: the compile ends, and the
   frame shows Storybook's own error. Task 1, a failing import in its test's graph.
5. **The warmer following every story's import**: Storybook's stories module imports each stories
   file dynamically. Only static imports are followed, so a compile builds one story's graph, not
   the whole Storybook's. Task 1.
6. **A runner stopped with `stopAll` while the start at boot waits**: the boot's next view gets
   `NOT_RUNNING`, and the boot ends. Task 6, by review.

## Global constraints

From the spec, word for word:

- The embed reads "Starting Storybook for this branch…" until the story's code compiled, then shows
  the frame.
- A story whose compile fails or passes 60 seconds: the frame shows anyway, and Storybook shows its
  own loader or error.
- A Storybook not viewed for 30 minutes stops, unless one of its folder's files waits for the human
  and links a story.
- Only a commit outside `specs/` restarts a Storybook. A code version that cannot be read counts as
  unknown, which restarts as an unknown commit does today.
- At the server's start, the Storybooks of the waiting folders start one after the other, and
  compile their linked stories. A branch without `node_modules` starts nothing.

From [Preview](../decisions/preview.md):

- Storybook MUST run Uraeda's real server over fixture data, never faking its responses.
- Stories MUST NOT run as tests.

From [Code quality](../decisions/code-quality.md):

- Rust and TypeScript functions and files MUST stay within limits on length, parameters, and
  nesting. Checked by clippy and Oxlint.
- A new marker MUST NOT be added unless a human approves it in the plan.
- Unit tests MUST NOT depend on elapsed time, except benchmarks of a spec's success criteria.

From [Testing](../decisions/testing.md):

- A test MUST give way to the approved spec: a test of behaviour it replaces is rewritten or removed
  in the task that changes it.
- A test MUST assert what a caller or a user observes, never how the code does it.

From [Git](../decisions/git.md): worktrees stay the workflow's; nothing here creates one.

Existing guarantees to keep, from [`runner.ts`](/packages/server/src/preview/runner.ts) and its
tests: one Storybook per base; a view at an unknown version never restarts a known one; a version
read before a Storybook started cannot move it (the `read` stamps); a stopped Storybook's records
get no live update ([`changedRecords`](/packages/server/src/fate/preview.ts)); frames load only once
on screen ([`StoryFrames.tsx`](/packages/web/src/StoryFrames.tsx), unchanged).

## Code read

- [`preview/runner.ts`](/packages/server/src/preview/runner.ts): `Previews`, one `Entry` per base.
  `view` starts, or restarts when `moved(entry, checkout)`: a known commit read after the entry's
  start stamp, different from its own. `sweep` stops entries idle for `IDLE_MS` or whose `dir` is
  gone. `#launch`, `#watch`, `#exited`, `#kill` own the process; `#poll` turns ready on the index's
  first answer. `onChange(base)` drives the live updates.
- [`fate/preview.ts`](/packages/server/src/fate/preview.ts): `runnable` builds a `Checkout` with
  `binding.checkoutCommit`, the only caller feeding the runner a commit; `readStory` views, reads
  the index, matches the story with `matchStory`, and returns the frame; `warmPreview` starts a
  folder's Storybook at a turn's end when `node_modules` exists. Called by
  [`app.ts`](/packages/server/src/app.ts) in `onTurnDone`, with a `RepoContext` built inline.
- [`live.ts`](/packages/server/src/live.ts): `livePreviews` sends the `Preview` and `Story` records
  watched for a base on each `onChange`.
- [`server.ts`](/packages/server/src/server.ts): `startOpened` makes the runner, opens the hosts,
  and its `sweeping` interval, every `SWEEP_EVERY_MS` (60 s), calls `previews.sweep()`.
- [`preview/index.ts`](/packages/server/src/preview/index.ts): `IndexEntry` has `id` and
  `importPath`, `./src/X.stories.tsx` from the folder Storybook runs in, which is Vite's root.
- [`preview/proxy.ts`](/packages/server/src/preview/proxy.ts): forwards `<base><rest>` to the
  Storybook as `/<rest>`: Storybook's Vite serves its modules without the base, though its pages
  name them under it ([`uraeda-preview.js`](/skills/uraeda/assets/storybook/uraeda-preview.js) sets
  Vite's `base`).
- [`crates/core/src/api/preview.rs`](/crates/core/src/api/preview.rs): `checkout_commit` reads
  `HEAD` through [`Git`](/crates/core/src/git.rs) (gix); exposed by
  [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs) as `checkoutCommit`, which
  [`continue-reads.ts`](/packages/server/src/runner/continue-reads.ts) also uses: it stays. Tested
  in [`crates/core/tests/preview.rs`](/crates/core/tests/preview.rs) on `TestRepo`.
- The binding's `readWorkspace(repo)` gives each feature and change its `step` (`waitsOn`, `file`);
  `readFile(repo, folder, name).current.stories` lists the stories its paragraphs embed, each
  `{ path, export }`. [`needs-you.ts`](/packages/server/src/fate/needs-you.ts) reads the waiting
  file the same way.
- Story links run in the folder of the page showing them
  ([`stories.tsx`](/packages/web/src/stories.tsx)): a waiting file's stories run in its own folder's
  checkout. The spec's edge case of a story of another branch has no other path today.
- [`StoryEmbed.tsx`](/packages/web/src/StoryEmbed.tsx) already shows "Starting Storybook for this
  branch…" for a `starting` story record, and the frame for `ready`: no web change.
- Tests: [`preview/__tests__/runner.test.ts`](/packages/server/src/preview/__tests__/runner.test.ts)
  on the fake Storybook, [`fixtures/preview/serve.mjs`](/fixtures/preview/serve.mjs), with
  `previews()`, `fakeClock()`, `storyCheckout()`, `ready()` from its `helpers.ts`;
  [`__tests__/preview.test.ts`](/packages/server/src/__tests__/preview.test.ts) through fate, with
  `testApp`, `testServer`, `addStoryFeature` (its round `awaiting-human`, embedding `ThinLine` and
  `Grip` of `packages/web/src/SidebarHandle.stories.tsx`), `commitOnBranch`, `previewStarts`.
- [`packages/web/.storybook/fixture.ts`](/packages/web/.storybook/fixture.ts): `storybookFixture`
  builds the fixture repository with dozens of synchronous git commands at each Storybook start, and
  `fixtureServer` runs it in `viteFinal`.
- Validation: `nix develop -c vp run fast` after each task, `nix develop -c vp run ready` before the
  push; `nix develop -c cargo nextest run -p uraeda-core --test preview` for the core;
  `nix develop -c vp test <file>` for one TypeScript file; the binding rebuilds with
  `nix develop -c vp run --filter uraeda-binding build`.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Complexity tracking

| What                                | Why                                                                   | Simpler alternative rejected                                                               |
| ----------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `preview/run.ts`, the process's run | the runner at 447 of 500 lines splits before it grows                 | growing the runner past its limit: needs a marker                                          |
| `preview/warmer.ts`, the warmer     | one rule, "ready once compiled", fetched over HTTP, tested on its own | Vite's `server.warmup` in the skill's helper: unverified in middleware mode, every project |
| `fate/preview-waiting.ts`           | the keep and the start at boot share one reading of the waiting files | reading them in `server.ts`: the sweep tick and the boot would each grow their own         |
| `api::code_version` in the core     | the code version is a git read, the core's                            | a diff of paths in TypeScript: git reads stay in the core                                  |
| The Storybook fixture's cache       | the clarifications settled a cheaper fixture build                    | none cheaper: the build's cost is its git processes                                        |

## Test map

The runner's tests run the fake Storybook in a fixture repository, with a clock the test moves. The
fate tests run the app in process on a fixture repository and the same fake. The core's tests run
real git on `TestRepo`. Task 1 measures the warmer on the real Storybook, in headless Chromium,
outside the tests.

| Spec item                                                      | Task | Check                                                                                                                            |
| -------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------- |
| US1.1 still runs at 15:00, its stories compiled                | 6    | `preview.test.ts` "a folder waiting with a story link keeps its Storybook…" (waiting row), and "the turn's end…" for the compile |
| US1.2 shows within 1 second                                    | 1    | the measurement on the real Storybook                                                                                            |
| US1.3 stops at 15:50 once answered                             | 4    | `runner.test.ts` "a kept Storybook counts as viewed at each sweep…"                                                              |
| US1 more 1: both Storybooks start at boot, one after the other | 6    | `preview.test.ts` "the server's start begins a waiting folder's Storybook…", one folder; the order by review                     |
| US1 more 2: a waiting file without a story stops after 30 min  | 6    | the answered row of "a folder waiting with a story link…": the same path, no story embedded                                      |
| US2.1 answers keep the process                                 | 4    | `preview.test.ts` "a commit under `specs/` keeps the Storybook; one outside restarts it"                                         |
| US2.2 a code commit restarts                                   | 4    | the same test, and the core's `a_code_version_moves_only_outside_specs`                                                          |
| US2 more 1: two commits restart once                           | 4    | the same fate test: one start after both commits                                                                                 |
| US3.1 starting until compiled                                  | 5    | `preview.test.ts` "a story stays starting until its compile ends, then turns ready live"                                         |
| US3.2 a failed or slow compile still shows                     | 1, 5 | `warmer.test.ts` (a failing import ends the compile), `runner.test.ts` "a compile past its time counts as ended"                 |
| Edge: `.storybook/` and `specs/` together restart              | 2    | the core's test, a row                                                                                                           |
| Edge: an unreadable code version is unknown                    | 4    | the existing unknown-commit tests of `runner.test.ts`, renamed to versions                                                       |
| Edge: a story of another branch, or `main`                     | —    | none: stories run in the page's folder, so the waiting file's are its own (see Code read)                                        |
| Edge: removed worktree of a waiting folder                     | 4    | `runner.test.ts` "a removed worktree stops its Storybook", swept with its base kept                                              |
| Edge: sign-out replaces the secret                             | —    | none: `renewPreviews` stops each, as today; the keep never starts one                                                            |
| Edge: "Try again" on a kept Storybook                          | —    | none: the existing restart tests; compiles live on the entry a restart replaces                                                  |
| Edge: a story's compile fails                                  | 1    | `warmer.test.ts`                                                                                                                 |
| Edge: no `node_modules` at boot                                | 6    | none new: `startWaiting` calls `warmPreview`, whose existing turn test owns the check                                            |
| SC-001 warm view within 1 second                               | 1    | the measurement                                                                                                                  |
| SC-002 answers start no process                                | 4    | the `specs/` commit test                                                                                                         |
| SC-003 kept past 30 minutes                                    | 6    | the waiting row                                                                                                                  |
| SC-004 no frame before its compile                             | 5    | the "stays starting" test: `frame` is null while held                                                                            |
| Replaced: every commit restarts                                | 4    | the unknown-commit tests of `runner.test.ts`, their commits become versions                                                      |
| Replaced: ready once listed                                    | 5    | "a story's first read starts its Storybook, and turns ready live" now passes through the compile                                 |
| Review focus: tick overlap, boot after stop                    | 6    | none: review; a test would need timing of the core's reads                                                                       |
| Review focus: compile during a stop                            | 5    | none: by review; the entry's abort                                                                                               |
| Review focus: removal wins over keep                           | 4    | the removed worktree test                                                                                                        |
| Review focus: failing import, static imports only              | 1    | `warmer.test.ts`                                                                                                                 |
| Settled: the fixture builds faster                             | 7    | none: measured before and after, as a ruling                                                                                     |

## Waves

1. Tasks 1, 2, 3: the warmer and the fake's module serving, the core's code version, and the
   runner's split touch different files.
2. Tasks 4 and 7: the runner's restart and stop rules, and the Storybook fixture's cache, touch
   different files.
3. Task 5: story readiness, on the runner and `readStory` that task 4 changed.
4. Task 6: the review watch, the keep, and the start at boot, on tasks 4 and 5.

---

## Task 1: The story warmer, measured

Outside behaviour the spec marks unverified: whether fetching a story's modules ahead makes its
first view fast. This task builds the warmer, tests it on the fake, then measures it on the real
Storybook. If it gains nothing, the build stops here for the compile: see step 6.

**Files:**

- Create: `packages/server/src/preview/warmer.ts`
- Modify: `fixtures/preview/serve.mjs` (serve source files, log requests, the `hold-modules` mode)
- Modify: `packages/binding/test-utils.ts` (`FakeMode` gains `"hold-modules"`)
- Test: `packages/server/src/preview/__tests__/warmer.test.ts`
- Create: `specs/2026-11-07-storybook-previews/rulings.md` (the measurement)

**Interfaces:**

- Produces:
  `warmStory(port: number, base: string, story: { id: string; importPath: string }, signal: AbortSignal): Promise<void>`
  in `preview/warmer.ts`. It fetches `http://127.0.0.1:<port>/iframe.html?id=<id>&viewMode=story`,
  the module scripts the page holds (by `src`, and the imports of inline module scripts), and the
  story's file, `/<importPath without ./>`. It follows each JavaScript answer's static imports
  (`import … from "…"`, `import "…"`, `export … from "…"`), never dynamic `import(…)`, on the same
  server only, each URL once. A path under `base` is fetched with `base` cut to `/`, as the proxy
  does. At most 6 requests at once. It resolves once every fetch answered or failed, or when
  `signal` aborts; it never rejects.
- Produces, in the fake: answers for any file under its working folder by its path (`/src/A.tsx`),
  as `text/javascript`; `/__requests`, the paths it served, in order, as JSON; mode `hold-modules`,
  which holds every source file's answer until `/__release` is requested.

- [x] **Step 1: Write the failing test**

```ts
// packages/server/src/preview/__tests__/warmer.test.ts
test("a story's compile fetches its page's modules and its file's static imports, each once", async () => {
  // A stories file importing a module, which imports one under the base, one missing, and one
  // dynamically.
  const { checkout, runner, port } = await readyWith({
    "packages/web/src/Warm.stories.tsx": `import "./Dep.tsx";\nexport const A = {};`,
    "packages/web/src/Dep.tsx": `import "${BASE}src/Leaf.tsx";\nimport "./Missing.tsx";\nimport("./Lazy.tsx");`,
    "packages/web/src/Leaf.tsx": `import "./Dep.tsx";`,
  });

  await warmStory(
    port,
    checkout.base,
    { id: "warm--a", importPath: "./src/Warm.stories.tsx" },
    new AbortController().signal,
  );

  const served = await requests(port);
  expect(served).toEqual(
    expect.arrayContaining(["/story.js", "/src/Warm.stories.tsx", "/src/Dep.tsx", "/src/Leaf.tsx"]),
  );
  expect(served.filter((path) => path === "/src/Dep.tsx")).toHaveLength(1);
  expect(served).not.toContain("/src/Lazy.tsx");
});
```

`readyWith` writes the files in the test feature's worktree and returns its ready Storybook's port;
`requests` reads `/__requests`. Both go in the test file.

The break each assertion catches: a warmer that fetches only the page; one that does not cut the
base; one that loops on the `Dep`/`Leaf` cycle or fetches twice; one that compiles every story by
following dynamic imports. The missing import resolving is the test finishing at all.

- [x] **Step 2: Run it to check it fails**

- Run: `nix develop -c vp test packages/server/src/preview/__tests__/warmer.test.ts`
- Expected: FAIL, the import of `../warmer.ts` cannot be resolved.

- [x] **Step 3: Implement the fake's serving, and `warmStory`**

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 5: Measure on the real Storybook**

A throwaway script, outside the repository (in a scratch folder), drives `pnpm exec storybook dev`
in `packages/web` without `URAEDA_PREVIEW_BASE`, and headless Chromium (`playwright-core` from the
workspace, `/usr/bin/chromium`). For the page story `spec-page--waiting`, three runs of each, a
fresh process each time:

- **A, cold**: once the index answers, the time until the story's root draws in the browser.
- **B, warmed**: once the index answers, the time `warmStory` takes, then the browser's time.
- **C, Vite's warm-up**: `server.warmup.clientFiles` set on the story's file in a local, uncommitted
  edit of `.storybook/main.ts`; the browser's time once the index answers.

Note the machine's load average with each run. Write the results as R1 of `rulings.md`, from
[the template](/skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/rulings.md). The warmer
gains when B's browser time is under 2 seconds and B's total is no longer than A's.

- [x] **Step 6: Act on the measurement**

When the warmer gains: go on. When it does not: delete `warmer.ts` and its test, keep the fake's
changes, and in tasks 5 and 6 build only what does not compile stories: task 5 is skipped, and task
6's `warm` is a view. Record it in R1, and say it in the pull request.

- [x] **Step 7: Commit**

```bash
git add packages/server/src/preview/warmer.ts packages/server/src/preview/__tests__/warmer.test.ts fixtures/preview/serve.mjs packages/binding/test-utils.ts specs/2026-11-07-storybook-previews/rulings.md
git commit -m "feat(storybook-previews): compile a story by fetching its modules"
```

## Task 2: The code version

**Files:**

- Modify: `crates/core/src/api/preview.rs`, `crates/core/src/api.rs` (export),
  `crates/core/src/git.rs` if a tree helper is needed
- Modify: `crates/binding/src/lib.rs`, and the generated `packages/binding/index.js` and
  `index.d.ts`
- Test: `crates/core/tests/preview.rs`

**Interfaces:**

- Produces: `api::code_version(checkout: &Path) -> Result<Option<String>>`: the hex id of the `HEAD`
  commit's root tree with its `specs` entry removed, computed, not written to the object database;
  `None` before the first commit. A tree without `specs` gives its own id.
- Produces: the binding's `codeVersion(checkout: string): Promise<string | null>`.

- [ ] **Step 1: Write the failing test**

```rust
/// A Storybook restarts only for a commit outside `specs/`.
#[test]
fn a_code_version_moves_only_outside_specs() {
    let rows: &[(&str, &[(&str, &str)], bool)] = &[
        ("specs only", &[("specs/x/clarifications-01.md", "answered")], false),
        ("code", &[("packages/web/src/A.tsx", "a")], true),
        ("both", &[("specs/x/spec.md", "s"), ("packages/web/.storybook/main.ts", "m")], true),
    ];
    for (case, files, moves) in rows {
        let repo = TestRepo::new();
        let before = api::code_version(repo.path()).unwrap();
        // commit `files` on the checked-out branch, as one commit
        let after = api::code_version(repo.path()).unwrap();
        assert_eq!(before != after, *moves, "{case}");
    }
}
```

The break: a version that is the commit (the specs row moves), or that ignores the tree (the code
rows do not).

- [ ] **Step 2: Run it to check it fails**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test preview`
- Expected: FAIL to compile, no function `code_version` in `api`.

- [ ] **Step 3: Implement `code_version`, and the binding's `codeVersion`**

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run --filter uraeda-binding build && nix develop -c vp run fast`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crates/core crates/binding packages/binding/index.js packages/binding/index.d.ts
git commit -m "feat(storybook-previews): a checkout's code version, without specs/"
```

## Task 3: Split the runner's process handling

A structural step only: the runner is at 447 of 500 lines, and tasks 4 and 5 grow it.

**Files:**

- Create: `packages/server/src/preview/run.ts`
- Modify: `packages/server/src/preview/runner.ts` (`Run`, `#launch`'s spawn, `#watch`, `#kill`)

**Interfaces:**

- Produces: `preview/run.ts` owns starting one process in its own group, keeping its output's last
  lines, recording its group, and killing it (SIGTERM, then SIGKILL after `KILL_MS`). The runner
  keeps its states, its entries, and its timers. Names are the implementer's; no behaviour changes.

- [ ] **Step 1: Move the process's start, watch, and kill to `run.ts`**

- [ ] **Step 2: Run the runner's tests, unchanged**

- Run: `nix develop -c vp test packages/server/src/preview`
- Expected: PASS, as before the move.

- [ ] **Step 3: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/preview/run.ts packages/server/src/preview/runner.ts
git commit -m "refactor(storybook-previews): the preview runner's process in its own module"
```

## Task 4: Restart on code versions, and keep the waiting Storybooks

**Risky:** a rule every view shares, when a Storybook restarts, and the only idle stop.

**Files:**

- Modify: `packages/server/src/preview/runner.ts` (`Checkout`, `moved`, `sweep`)
- Modify: `packages/server/src/fate/preview.ts` (`runnable`: `codeVersion`)
- Modify: `packages/server/src/preview/__tests__/helpers.ts`,
  `packages/server/src/__tests__/helpers.ts` (`runningPreview`'s commit), if they set `commit`
- Test: `packages/server/src/preview/__tests__/runner.test.ts`,
  `packages/server/src/__tests__/preview.test.ts`

**Interfaces:**

- Consumes: the binding's `codeVersion(checkout: string): Promise<string | null>` (task 2).
- Produces: `Checkout.version?: string` in place of `commit`, with the same rules: unknown when
  undefined, compared only when read after the Storybook's start stamp.
- Produces: `Previews.sweep(kept: ReadonlySet<string> = new Set()): void`. A Storybook whose base is
  in `kept` counts as viewed now, and is not stopped for idleness; one whose checkout folder is gone
  stops, kept or not; any other stops after `IDLE_MS` without a view.

- [ ] **Step 1: Write the failing tests, and rename `commit` to `version` in the existing ones**

```ts
// runner.test.ts
test("a kept Storybook counts as viewed at each sweep, and stops 30 minutes after it is no longer kept (US1.3)", async () => {
  const { checkout } = await storyCheckout();
  const clock = fakeClock();
  const runner = previews({ now: clock.now });
  runner.view(checkout);
  await ready(runner, checkout);

  clock.advance(5 * 60 * 60_000);
  runner.sweep(new Set([checkout.base]));
  expect(runner.state(checkout.base)?.state).toBe("ready");
  clock.advance(29 * 60_000);
  runner.sweep();
  expect(runner.state(checkout.base)?.state).toBe("ready");
  clock.advance(60_001);
  runner.sweep();

  expect(runner.state(checkout.base)).toBeUndefined();
});
```

The "a removed worktree stops its Storybook" test sweeps with `new Set([checkout.base])`.

```ts
// preview.test.ts: replaces "a view after a new commit in the checkout restarts its Storybook…"
test("a commit under specs/ keeps the Storybook; one outside restarts it, once (US2)", async () => {
  // ...the story read and ready, as today's test...
  commitOnBranch(repo, STORY_FEATURE, {
    [`specs/${STORY_FEATURE}/clarifications-01.md`]: "answered\n",
  });
  await byId(app, "Story", [STORY], FIELDS);
  expect(previewStarts(log!), "a commit under specs/ restarted it").toHaveLength(1);

  commitOnBranch(repo, STORY_FEATURE, { [`specs/${STORY_FEATURE}/spec.md`]: "x\n" });
  commitOnBranch(repo, STORY_FEATURE, { "packages/web/.storybook/fixture.ts": "// changed\n" });
  // ...then today's assertions: starting, a live update to ready, the first process gone, and a
  // view at the same version starting nothing: 2 starts.
});
```

The breaks: a sweep that ignores `kept` (stops at 5 hours); one that keeps without refreshing the
view (stops at once after the keep ends, at 5 hours 29 minutes); a keep that outlives a removed
worktree; a version still the commit (the `specs/` commit restarts).

- [ ] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test packages/server/src/preview/__tests__/runner.test.ts packages/server/src/__tests__/preview.test.ts`
- Expected: FAIL, "a kept Storybook…" `expected undefined to be 'ready'`; the `specs/` test,
  `a commit under specs/ restarted it`.

- [ ] **Step 3: Implement versions and the kept sweep**

`runnable` reads `ctx.binding.codeVersion(dir)`, `null` on failure, in place of `checkoutCommit`.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/preview packages/server/src/fate/preview.ts packages/server/src/__tests__
git commit -m "feat(storybook-previews): restart only on code commits, keep what waits"
```

## Task 5: A story is ready once compiled

**Risky:** concurrency: compiles shared by concurrent reads, ending after their Storybook stopped.

**Files:**

- Modify: `packages/server/src/preview/runner.ts` (the entry's compiles, `compiled`, `warm`)
- Modify: `packages/server/src/fate/preview.ts` (`readStory`)
- Test: `packages/server/src/preview/__tests__/runner.test.ts`,
  `packages/server/src/__tests__/preview.test.ts`

**Interfaces:**

- Consumes: `warmStory` (task 1); `sweep`, `Checkout.version` (task 4).
- Produces: the `Previews` option `warmMs?: number`, `WARM_MS = 60_000` by default.
- Produces: `Previews.compiled(base: string, story: IndexEntry): boolean`: whether the story's
  compile, in the ready Storybook under `base`, ended or passed `warmMs`. The first ask starts it;
  later asks share it. False while it runs, and when no Storybook is ready under `base`. Its end
  calls `onChange(base)`, unless its Storybook stopped or was replaced, whose compiles are aborted.
- Produces:
  `Previews.warm(checkout: Checkout, stories: Array<{ path: string; export: string }>): Promise<void>`:
  a view of the checkout; once its Storybook is ready, reads its index, and compiles each story of
  `stories` it holds (`matchStory`), one after another. Resolves once they all ended, or the
  Storybook failed or stopped. Never rejects.
- Changes `readStory`: a ready Storybook's story found in its index is `starting`, `frame: null`,
  until `compiled` is true.

- [ ] **Step 1: Write the failing tests**

```ts
// runner.test.ts
test("a story's compile runs once per Storybook, shared by its asks", async () => {
  const { checkout, log } = await storyCheckout();
  const runner = previews();
  runner.view(checkout);
  await ready(runner, checkout);
  const story = await entryOf(runner, checkout, "sidebarhandle--dragging");

  expect(runner.compiled(checkout.base, story)).toBe(false);
  runner.compiled(checkout.base, story);
  await expect.poll(() => runner.compiled(checkout.base, story), WAIT).toBe(true);

  expect(servedPaths(log).filter((path) => path === "/src/SidebarHandle.stories.tsx")).toHaveLength(
    1,
  );
});

test("a compile past its time counts as ended (US3.2)", async () => {
  const { checkout } = await storyCheckout({ mode: "hold-modules" });
  const runner = previews({ warmMs: 100 });
  // ...ready, then:
  await expect.poll(() => runner.compiled(checkout.base, story), WAIT).toBe(true);
});
```

```ts
// preview.test.ts
test("a story stays starting until its compile ends, then turns ready live (US3.1, SC-004)", async () => {
  const repo = fixtureRepo();
  addStoryFeature(repo, { preview: { mode: "hold-modules" } });
  const { app, name, previews, frames } = await testApp(repo);
  const updates = await liveUpdates(app, name, "Story", STORY);
  await expect
    .poll(async () => (await byId(app, "Preview", [STORY_FEATURE], ["state"]))[0]?.state, WAIT)
    .toBe("ready");

  expect((await byId(app, "Story", [STORY], FIELDS))[0]).toMatchObject({
    frame: null,
    state: "starting",
  });
  await release(previews, `/r/${name}/preview/${frames.current()}/${STORY_FEATURE}/`);

  expect(await updates.arrival('"state":"ready"'), "no live update to ready").toBeDefined();
  await updates.close();
});
```

`entryOf` reads the index entry through `runner.index`; `servedPaths` reads the fake's `/__requests`
through the port of the base's state; `release` requests the fake's `/__release`. The breaks: a
story ready at the index's answer (SC-004); a compile run per ask; a held compile never ending; an
end that sends no update.

- [ ] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test packages/server/src/preview/__tests__/runner.test.ts packages/server/src/__tests__/preview.test.ts`
- Expected: FAIL, `runner.compiled is not a function`, and the story `ready` where `starting` is
  expected.

- [ ] **Step 3: Implement the compiles, `compiled`, `warm`, and `readStory`'s wait**

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/preview packages/server/src/fate/preview.ts packages/server/src/__tests__/preview.test.ts
git commit -m "feat(storybook-previews): show a story once it compiled"
```

## Task 6: The review watch, the keep, and the start at boot

**Files:**

- Create: `packages/server/src/fate/preview-waiting.ts`
- Modify: `packages/server/src/fate/preview.ts` (export `runnable`; `warmPreview` warms the waiting
  file's stories and returns the warm's promise)
- Modify: `packages/server/src/server.ts` (the sweep tick and the start at boot)
- Test: `packages/server/src/__tests__/preview.test.ts`

**Interfaces:**

- Consumes: `Previews.sweep(kept)` (task 4), `Previews.warm` (task 5).
- Produces, in `fate/preview-waiting.ts`:
  - `waitingStories(ctx: RepoContext): Promise<Array<{ folder: string; stories: Array<{ path: string; export: string }> }>>`:
    each feature or change of `readWorkspace` whose step waits on the human with a `file`, and the
    stories that file's current version embeds, `readFile(…).current.stories`; folders without
    stories, and those the core cannot read, left out.
  - `keptBases(contexts: Array<RepoContext>): Promise<Set<string>>`: the bases, under the current
    frame secret, of every waiting folder with a checkout and a preview.
  - `startWaiting(contexts: Array<RepoContext>): Promise<void>`: `warmPreview` for each waiting
    folder, awaiting each before the next.
- Changes `warmPreview(ctx, folder): Promise<void>`: also warms the stories of the folder's waiting
  file, when it has one; it still starts nothing without `node_modules`.
- In `server.ts`: each listed repository's `RepoContext` is built with the fields `app.ts`'s
  `onTurnDone` gives `warmPreview`. The sweep tick calls `previews.sweep(await keptBases(…))`,
  skipping a tick while the last one reads, and sweeping with no keep when the read fails. Once the
  repositories are open, the server calls `startWaiting` without awaiting it.

- [ ] **Step 1: Write the failing tests, and extend the turn's test**

```ts
test.each([
  ["waiting with a story link", {}, "ready"],
  ["answered, nothing waiting", { round: "answered", specStatus: "approved" }, undefined],
] as const)(
  "a folder %s keeps its Storybook past 30 minutes, or not (US1.1, SC-003)",
  async (_, options, state) => {
    // testApp with a moved clock, the story read and ready; the clock passes IDLE_MS + 1; then
    previews.sweep(await keptBases([repoContext(opened)]));
    expect(previews.state(base)?.state).toBe(state);
  },
);

test("the server's start begins a waiting folder's Storybook, and compiles its linked stories (US1)", async () => {
  // addStoryFeature, its worktree's packages/web/node_modules made, then:
  await startWaiting([repoContext(opened)]);
  expect(previewStarts(log!)).toHaveLength(1);
  expect(servedPaths).toContain("/src/SidebarHandle.stories.tsx");
});
```

The existing "a feature's turn that ends done starts its Storybook…" test also asserts, once
started, that the fake served `/src/SidebarHandle.stories.tsx`. `repoContext` builds a `RepoContext`
from `testApp`'s or `testServer`'s parts, in `__tests__/helpers.ts`. The breaks: a keep that ignores
the step (the answered row stays); one that keeps nothing (the waiting row stops); a boot that
starts nothing, or starts without compiling.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/server/src/__tests__/preview.test.ts`
- Expected: FAIL, the import of `../fate/preview-waiting.ts` cannot be resolved.

- [ ] **Step 3: Implement the review watch, the ahead warm, the keep, and the start at boot**

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src
git commit -m "feat(storybook-previews): keep and start the Storybooks waiting for review"
```

## Task 7: A cheaper fixture for Uraeda's Storybook

**Files:**

- Modify: `packages/web/.storybook/fixture.ts` (`storybookFixture`)
- Modify: `fixtures/preview/serve.mjs` (creates its log's folder), if the cache needs it
- Modify: `specs/2026-11-07-storybook-previews/rulings.md` (R2, the measurement)

**Interfaces:**

- Produces: `storybookFixture()` keeps its signature and its result: a fresh repository each start,
  with the same branches, worktrees, and files. It builds the repository once into
  `node_modules/.cache/uraeda-storybook-fixture/<key>/`, the key a hash of the checkout's absolute
  path and of every file its build reads (`fixtures/`, `packages/web/samples/`,
  `packages/binding/test-utils.ts`, `.storybook/fixture.ts`, `.storybook/checkouts.ts`). Each start
  copies the cached repository to its temporary folder, repairs its worktrees with
  `git worktree repair`, and builds the data folder afresh. A failed copy or repair builds it as
  today.

- [ ] **Step 1: Measure the fixture's build today**

- Run: `storybookFixture()` timed, three times, in a script outside the repository.

- [ ] **Step 2: Implement the cache**

- [ ] **Step 3: Measure again, and check the stories**

Time a cached start three times. Then run `pnpm exec storybook dev` in `packages/web`, and load
`storyembed--ready`, `spec-page--waiting`, and a round page's story in the browser: each draws as
before. Write both measurements as R2 of `rulings.md`. When the cache saves under half the build,
drop it, and say so in R2.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/.storybook/fixture.ts fixtures/preview/serve.mjs specs/2026-11-07-storybook-previews/rulings.md
git commit -m "perf(storybook-previews): build the Storybook fixture once per change of its sources"
```
