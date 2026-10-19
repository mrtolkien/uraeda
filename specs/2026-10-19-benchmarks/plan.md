---
status: auto-approved
spec-revision: 2
---

# Plan: Benchmarks

**Goal:** A `packages/benchmarks` runner that plays the whole workflow on a SWE-bench Pro V2 case
with a simulated human, grades it, and records it under `benchmarks/`, with a page that shows the
results.

**Architecture:** A small TypeScript loop over what exists, as in the spec's
[Architecture](spec.md#architecture). It asks `ura next --json` who is up, runs the server's Claude
adapter for the agent or the human, and starts each session with the server's `runMessage`. Each
responsibility has one owner:

- `suite.ts` and `case.ts` own what a case and a suite are. `record.ts` owns the record's and the
  scores' fields and their schema.
- `skill.ts` owns which skill a run loads. `sandbox.ts` owns the environment: the repository copy,
  the container wrapper, the bare `origin`, and the run's configuration folder (model, effort, the
  deny rules of the web guard, fallback off). No other file passes a model, an effort, or a rule.
- `loop.ts` owns the order of sessions and when a run ends. `human.ts` owns the human's turns and
  the check of its commits. `grader.ts` owns grading. `report.ts` owns the page.
- The server owns the adapter, its events, `runMessage`, and `openBrowser`: Task 2 exports them and
  adds the cost and the answering models to the `result` event, the one place Claude Code's output
  is parsed.
- The record on disk is authoritative. The page and the plain arm's pairing read run folders, and
  hold no state.

**Spec:** [spec.md](spec.md), with its [data model](data-model.md). The implementer reads both.

## Review focus

- **A run that never reaches a pull request host.** The cases have none, so `ura next` may name an
  agent step forever after the final review. The loop ends `finished` when `origin/<branch>` equals
  the branch's `HEAD` after an agent session and `ura next` no longer names an unchecked task: else
  every good run would burn 30 sessions and end `stalled`. Task 7 records the real output as a
  fixture, and tests it with the fake adapter.
- **The hidden tests reach no session.** The tests come from the dataset, not the image. The grader
  fetches them after the flow ends, into a folder that no session mounts or uses as its working
  directory. Task 8 pins it with a test on the real session folder, and Task 9 on the grader's
  order.
- **A path the container and the host disagree on.** The adapter hands the container host paths for
  `--plugin-dir`, `--add-dir`, and the working directory. The sandbox mounts each at the same path,
  the repository copy at `/app`, and the bare `origin` at its host path, so a push from inside
  works. The feature starts with `ura start --switch`, never a git worktree, whose absolute gitdir
  paths break in a mount. Task 5 tests it with a fake `docker`.
- **A model that is not the one asked for.** A session whose `result` names another model fails the
  run, even when its answer is fine. Tasks 2 and 7.
- **A usage limit, an `auto` block, and a dead process** end or continue a run as the spec's edge
  cases say, never hanging. Task 7.
- **The credentials never move.** The runner reads the token only from its own environment and
  passes it to the container; it never copies `~/.claude`. Task 5.

## Global constraints

Copied from the [Benchmarks](../decisions/benchmarks.md) decision, and the decisions it relies on:

- Agents MUST NOT start a benchmark run without a human's explicit approval, and the run's record
  MUST name who gave it.
- A benchmark MUST reach agents through the server's adapter, and reuse the server's message,
  events, and parsing, never copying them.
- A run MUST load the skill from a named commit, never from the working tree, and MUST record that
  commit and whether the tree was clean.
- The simulated human MUST see only what a human would open, never the hidden tests or the reference
  solution, and a run MUST be marked invalid when the human's commit touches a file outside the
  feature's workflow files.
- A run MUST be marked failed when a session's models name one other than the model asked for.
- A run MUST record the commits, the harness and its version, the models asked for and answered, the
  effort, the task and its image digest, the simulated human's model and guidelines, each step's
  time, cost, and gate outcome, and every address the agents fetched.
- Git MUST hold each run's record, scores, `specs/` files, and final diff, and MUST NOT hold raw
  transcripts, which stay local with their SHA-256 recorded.
- Each case SHOULD have one plain-agent baseline run, on the same task, image, model, and effort as
  the flow runs it is compared with, kept for later runs of that case.
- Agents SHOULD NOT read the task's upstream repository, which the audit of the addresses they
  fetched checks.
- [Agents](../decisions/agents.md): every agent goes through one adapter, sessions pass
  `--permission-mode auto`, and tools do not touch the agent's credentials, model, effort, or
  settings other than through the run's own configuration folder.
- [Code quality](../decisions/code-quality.md): functions at most 100 lines, files at most 500, no
  new marker. [Toolchain](../decisions/toolchain.md): the package's checks run in `vp run ready`.
- Fixed values of the spec: the model `claude-sonnet-5-5` for every role, the effort `medium`, 30
  sessions at most per run, the human requests changes at most twice per run, and the outcomes are
  `finished`, `stalled`, `usage-limit`, `failed`, and `invalid`.
- The runner is TypeScript on Node and reads the workflow only through `ura` (`ura next --json`,
  `ura answer`, `ura review`, `ura start --switch`); it parses no `status:` field.

## Code read

- [`adapter.ts`](/packages/server/src/runner/adapter.ts):
  `Adapter.open({cwd, nativeId, resume, allowed})` returns an `AgentProcess` with `send`, `events`,
  `close`, `kill`. It takes no model, effort, or environment.
- [`claude.ts`](/packages/server/src/runner/claude.ts):
  `ClaudeAdapter({command, configDir, imagesDir, pluginDir})` spawns `command` with `claudeArgs`,
  and no `env`: the child inherits `process.env`. `command` is how the wrapper replaces `claude`.
  `hasSession` reads `<configDir>/projects`.
- [`claude-events.ts`](/packages/server/src/runner/claude-events.ts): `resultEvent` and
  `tokensEvent` read the `result` line. Nothing reads `total_cost_usd` or the names in `modelUsage`
  yet (Task 2). Fetched URLs are `toolStart` events of kind `fetch`, and blocked actions are
  `result.denials`.
- [`events.ts`](/packages/server/src/runner/events.ts),
  [`fake.ts`](/packages/server/src/runner/fake.ts): the event union and the scripted adapter, whose
  `script`, `emit`, and `opens` the loop's tests use.
- [`message.ts`](/packages/server/src/runner/message.ts):
  `runMessage({branch, feature, planReview, reference, step})`, the one home of the workflow's
  message. The server's `exports` do not list it.
- [`browser.ts`](/packages/server/src/browser.ts): `openBrowser`, not exported either.
- [`next.rs`](/crates/cli/src/next.rs): `ura next --json` prints
  `{feature, branch, step: {name, "waits-on", reference, file, task, progress, "plan-review", "pull-request"}}`.
- The tests: Vitest through `vp test`, one project per package in the root
  [`vite.config.ts`](/vite.config.ts) `test.projects`, helpers in
  [`packages/binding/test-utils.ts`](/packages/binding/test-utils.ts) (`temporaryFolder`,
  `fixture`). Tasks are registered in [`vite.tasks.ts`](/vite.tasks.ts): `ts:check`'s input already
  covers a new package's files, and `ts:test` runs every project.
- Validation: `nix develop -c vp run ready` (cached), `vp check`, `vp test`. Docker is installed;
  `CLAUDE_CODE_OAUTH_TOKEN` is not set on the machine this plan was written on.
- [`discovery-01.md`](discovery-01.md#important-reads) has the rest of the map.

## Constitution check

| I. Humans in control                       | II. Plain text                                | III. Async                           | IV. Review effort             | V. Tools optional                          | VI. Checked code                   |
| ------------------------------------------ | --------------------------------------------- | ------------------------------------ | ----------------------------- | ------------------------------------------ | ---------------------------------- |
| ✅ a run starts only with a named approval | ✅ records, scores, specs, and diffs are text | ✅ a run resumes from its run folder | ✅ the risky tasks are marked | ✅ the loop reads `ura`, which is optional | ✅ every task has tests and limits |

## Complexity tracking

| Addition                                    | Why it is needed                                                     | Simpler alternative rejected                                           |
| ------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/benchmarks` (a package)           | The runner is code with tests, neither the server's nor the web's    | A folder of scripts in `benchmarks/`: no tests or checks under `ready` |
| A wrapper script as the adapter's `command` | The agent runs in the case's image; the adapter spawns one command   | Passing a container option to the adapter: changes the agents decision |
| The `result` event's `costUsd` and `models` | The record and the model rule need them, and SC-005 forbids a parser | Parsing Claude Code's output in the runner: a second parser            |

No unit passes a limit, and no constitution exception is asked.

## Review comments

None: the spec was approved without a review file. Its four earlier comments are answered in the
spec's own **Your review**.

## Test map

The tests run on the fake adapter, a fake `docker` and a fake `ura`-less `git` repository in a
temporary folder, and the clock passed in as a parameter. Only Task 1 and Task 11 run the real
tools.

| Spec item                                                 | Task | Test                                                              |
| --------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| Unverified: Claude Code in an image, token, `auto` mode   | 1    | `benchmarks:probe` against a real image                           |
| US1.1 the proposal is the task's text, word for word      | 10   | `starts a feature whose proposal is the case's proposal`          |
| US1.2 the human's session runs before the agent's next    | 7    | `runs the human at a gate and the agent only after the answers`   |
| US1.3 30 sessions end the run as `stalled`                | 7    | `stalls after the session cap and keeps the steps so far`         |
| US1 more: no approval starts nothing                      | 10   | `refuses to start without an approval`                            |
| US1 more: usage limit ends the run                        | 7    | `ends as usage-limit when a session reports it`                   |
| US2.1 terse answers from the proposal, "your call"        | 8    | `the human prompt holds the proposal and the persona`             |
| US2.2 changes requested at most twice                     | 8    | `the human's prompt caps the requests for changes`                |
| US2.3 approves and confirms the risk tier                 | 8    | `approves with the spec's risk tier`                              |
| US2 more: a commit outside the feature's `specs/`         | 8    | `marks the run invalid when the human's commit leaves specs/`     |
| US2 more / SC-004: no hidden files in the human's folder  | 8    | `the human's folder holds no tests and no reference patch`        |
| US3.1 screening picks the five failing cases              | 10   | `screening keeps the failed cases, from four repositories`        |
| US3.2 a fresh baseline, not the screening run             | 10   | `the baseline is a new run`                                       |
| US3.3 later flow runs reuse the baseline                  | 10   | `a flow run starts no plain run when the baseline exists`         |
| US3 more: fewer than five fail, fill by share passed      | 10   | `fills the suite with the lowest share of passed tests`           |
| US3 more: an image digest change reruns the baseline      | 10   | `reruns the baseline when the digest changed`                     |
| US4.1 tests on the diff without `specs/`, fresh container | 9    | `applies the diff without specs/ to a fresh container`            |
| US4.2 the judge's verdict per requirement                 | 9    | `scores each requirement covered, partial, or missing`            |
| US4 more: no push, tests run on the branch                | 9    | `grades a branch with no push, and a branch with no change fails` |
| US5.1 newest suite first, the suite's versions named      | 6    | `writes the newer suite first and names its versions`             |
| US5.2 an invalid run is flagged and left out of the line  | 6    | `flags invalid and leak-suspected rows and leaves them out`       |
| US5.3 git holds the record, not the transcripts           | 3    | `the ignore file keeps transcripts out and the record in`         |
| US5 more: no display prints the path; no runs says so     | 6    | `prints the path without a display`, `says there is nothing`      |
| Edge: a model other than Sonnet 5.5 answers               | 2, 7 | `the result event names the models`, `fails the run`              |
| Edge: `auto` blocks an action                             | 7    | `allows once with the adapter's rule, and fails a repeat`         |
| Edge: the image's tests fail on the reference patch       | 10   | `drops a case whose reference patch fails`                        |
| Edge: the skill's tree is dirty                           | 4    | `records the dirty flag and goes on`                              |
| Edge: a late new round of questions                       | 7    | `answers a late round like the first, within the cap`             |
| Edge: the repository already has `specs/`                 | 3    | `rejects a case whose repository has a specs folder`              |
| Edge: fallback to another model                           | 5    | `the settings turn the fallback off`                              |
| Edge: an upstream repository fetched                      | 7    | `flags leak-suspected when a fetched address is the upstream's`   |
| SC-001 one command                                        | 10   | `one command runs a case from approval to its record`             |
| SC-002 five cases from four repositories                  | 11   | the screening's output, read by the owner                         |
| SC-003 every field                                        | 3    | `the record schema rejects a missing field`                       |
| SC-005 no copy                                            | 2    | `the runner imports the message, the events, and the adapter`     |
| SC-006 a fake agent                                       | 7    | the loop's tests, with no container                               |
| SC-007 one command to a page                              | 6    | `vp run benchmarks:report` writes and opens the page              |
| Review focus: finished without a pull request host        | 7    | `ends finished once the branch is pushed`                         |
| Review focus: path agreement                              | 5    | `mounts each path at its own path, and the repository at /app`    |
| Review focus: credentials                                 | 5    | `passes the token by name and never mounts the credentials`       |

## Waves

1. Task 1: the probe, and the package. Everything else relies on what it finds.
2. Task 2: the server's exports and event fields. Risky, a rule several callers share.
3. Task 3: the data files. Task 4, 5, and 6 consume its types.
4. Tasks 4, 5, and 6: the skill snapshot, the sandbox, and the page. They share no file, and each
   only consumes Task 3 and the exports of Task 2.
5. Task 7: the loop, which consumes the sandbox and the snapshot.
6. Task 8: the simulated human, which consumes the loop's session interface.
7. Task 9: the grader.
8. Task 10: the command, the plain arm, screening, and the documents.
9. Task 11: the first suite's real runs, which need a token and the owner's approval.

---

## Task 1: Probe the unverified behaviours, and create the package

**Files:**

- Create: `packages/benchmarks/package.json` (`uraeda-benchmarks`, private, `"type": "module"`,
  `uraeda-server` as `workspace:*`), `packages/benchmarks/tsconfig.json`,
  `packages/benchmarks/vite.config.ts`, `packages/benchmarks/scripts/probe.ts`,
  `packages/benchmarks/src/__tests__/probe.test.ts`
- Modify: `vite.config.ts` (`test.projects` gains `packages/benchmarks`), `vite.tasks.ts` (a
  `benchmarks:probe` task, uncached, not part of `ready`)

**Interfaces:**

- Consumes: nothing.
- Produces: the package, and `benchmarks:probe`, which prints one line per check, `ok` or `FAIL`,
  and exits non-zero on a failure. The findings are written in `rulings.md` as R1.

The probe checks, against one real V2 image of the smallest candidate (`ansible`, about 700 MB),
what the spec marks as not verified:

1. The image runs under local Docker, and the host's `claude` binary, mounted read-only, starts
   inside it beside `git` (`claude --version`; `ura` needs a newer glibc than the image has, see
   R1). If the binary does not run there, the fallback is installing Claude Code in a layer built on
   the image: record which one worked.
2. A fresh `CLAUDE_CONFIG_DIR` answers "Not logged in" from inside the container, so the folder is
   isolated.
3. With `CLAUDE_CODE_OAUTH_TOKEN` set: a `claude -p` session in the container with a fresh
   configuration folder answers, `modelUsage` names `claude-sonnet-5-5` for a `settings.json` that
   sets `model` and `effort`, and `--plugin-dir` loads the skill as `uraeda`.
4. With the token: a session in `--permission-mode auto` runs a command and edits a file without a
   block (one session: see R2).

- [x] **Step 1: Write the probe's unit tests, and the helpers they use**

```ts
// packages/benchmarks/src/__tests__/probe.test.ts
test("a failed check exits non-zero and names the check", async () => {
  const result = await runProbe({ checks: [failing("not logged in")] });

  expect(result.exitCode).toBe(1);
  expect(result.lines).toContain("FAIL not logged in");
});

test("a check that needs the token is skipped, not passed, without it", async () => {
  const result = await runProbe({ checks: [needsToken("auto mode")], env: {} });

  expect(result.lines).toContain("SKIPPED auto mode: CLAUDE_CODE_OAUTH_TOKEN is not set");
  expect(result.exitCode).toBe(2);
});
```

The break each test catches:

- The failed check: a probe that reports success while a check failed.
- The skipped check: a missing token counted as a pass, which would unlock the later tasks falsely.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/benchmarks`
- Expected: FAIL, `Cannot find module '../probe.ts'` or `runProbe is not a function`

- [x] **Step 3: Implement `runProbe` and `scripts/probe.ts`**

`runProbe({checks, env})` runs the checks in order and returns `{exitCode, lines}`: `0` when all
passed, `1` when one failed, `2` when none failed and one was skipped for the token. The script
holds the four checks above, through `docker` and the real `claude`. It never prints the token.

- [x] **Step 4: Run the project's validation**

- Run: `nix develop -c vp check && nix develop -c vp test packages/benchmarks`
- Expected: PASS

- [x] **Step 5: Run the probe**

- Run: `nix develop -c vp run benchmarks:probe`
- Expected: checks 1 and 2 `ok`. Checks 3 and 4 `ok`, or `SKIPPED` when the token is not set. A
  `FAIL`, or a skip, goes back to the human before Task 2 starts: see
  [implementation](../../skills/uraeda/references/implementation.md#when-you-must-stop).

- [x] **Step 6: Commit**

```bash
git add packages/benchmarks vite.config.ts vite.tasks.ts specs/2026-10-19-benchmarks/rulings.md
git commit -m "feat(benchmarks): probe Claude Code in a case's image"
```

---

## Task 2: Export the server's adapter, and report cost and models

**Risky:** it changes the event union every consumer of the adapter reads, and the parser that owns
Claude Code's output.

**Files:**

- Modify: `packages/server/package.json` (`exports` gains `./runner/adapter`, `./runner/claude`,
  `./runner/events`, `./runner/fake`, `./runner/message`, `./browser`),
  `packages/server/src/runner/events.ts` (`result`), `packages/server/src/runner/claude-events.ts`
  (`resultEvent`), `packages/server/src/runner/fake.ts` (scripted results)
- Test: `packages/server/src/runner/__tests__/claude.test.ts`, `fake.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `result` events gain `costUsd?: number` (Claude Code's `total_cost_usd`, absent when it
  reports none) and `models?: Array<string>` (the keys of `modelUsage`). A result whose line has
  neither keeps its fields absent. The fake adapter takes both in a scripted `result`. Existing
  consumers of `result` keep working, with the new fields ignored.

- [x] **Step 1: Write the failing tests**

```ts
test("a result line's cost and models reach the result event", () => {
  const events = parse(
    resultLine({ total_cost_usd: 0.42, modelUsage: { "claude-sonnet-5-5": usage } }),
  );

  expect(events.at(-1)).toMatchObject({
    type: "result",
    costUsd: 0.42,
    models: ["claude-sonnet-5-5"],
  });
});

test("a result with no cost or models keeps both fields absent", () => {
  const event = parse(resultLine({})).at(-1);

  expect(event).not.toHaveProperty("costUsd");
  expect(event).not.toHaveProperty("models");
});
```

The break each test catches:

- The first: a parser that sums tokens but drops the cost, so the record's cost is empty.
- The second: a default of `0` or `[]`, which the record would read as a free session on no model.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/server/src/runner/__tests__/claude.test.ts`
- Expected: FAIL, `expected {…} to match object {costUsd: 0.42, …}`

- [x] **Step 3: Implement the fields in `resultEvent` and the type, and export the modules**

Read both from the result message, as `tokensEvent` reads `modelUsage`. Fix every exhaustive use of
the `result` type the compiler names. List the exports in `package.json`.

- [x] **Step 4: Run the project's validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/server specs/2026-10-19-benchmarks/plan.md
git commit -m "feat(server): report a session's cost and models, and export the adapter"
```

---

## Task 3: The suite, the case, the record, and the recorder

**Files:**

- Create: `packages/benchmarks/src/suite.ts`, `case.ts`, `record.ts`, `recorder.ts`,
  `packages/benchmarks/src/__tests__/data.test.ts`, `benchmarks/.gitignore`
- Modify: `.gitignore` (`benchmarks/report.html`)

**Interfaces:**

- Consumes: nothing.
- Produces, with the fields of the [data model](data-model.md) as written there:
  `readSuite(path): Suite`, `readCase(folder): Case`, `type RunRecord`, `type Scores`, `type Step`,
  `parseRecord(json): RunRecord` and `parseScores(json): Scores` (throwing a message that names the
  missing field), `type Outcome = "finished" | "stalled" | "usage-limit" | "failed" | "invalid"`,
  `type RunFolder = {date, suite, case, arm, n}`, `runFolderPath(root, RunFolder): string`
  (`<root>/runs/<date>-<suite>/<case>--<arm>--<n>`),
  `writeRun(folder, {record, scores, specs, diff, transcripts}): Promise<void>` which writes
  `record.json`, `scores.json`, `specs/`, `final.diff`, and hashes each transcript with SHA-256 into
  `record.transcripts` while leaving the files in `<folder>/transcripts/`, and
  `listRuns(root): Array<{folder, record, scores?}>`.

- [x] **Step 1: Write the failing tests**

```ts
test("SC-003: the record schema rejects a missing field", () => {
  const { urls: _, ...record } = fullRecord();

  expect(() => parseRecord(record)).toThrow("urls");
});

test("a suite and a case read with every field of the data model", () => {
  const suite = readSuite(writeSuiteFile(SUITE_TOML));

  expect(suite).toMatchObject({
    model: "claude-sonnet-5-5",
    maxSteps: 30,
    arms: ["uraeda", "plain"],
  });
});

test("US5.3: git ignores the transcripts and keeps the record", async () => {
  const folder = await writeSampleRun();

  expect(await trackedFiles(folder)).toEqual([
    "final.diff",
    "record.json",
    "scores.json",
    "specs/…",
  ]);
  expect(record(folder).transcripts[0]).toMatchObject({ sha256: sha256Of("transcripts/a.jsonl") });
});

test("a case whose repository has a specs folder is rejected", async () => {
  await expect(checkCase(caseWithSpecsFolder())).rejects.toThrow("specs/");
});
```

The break each test catches:

- The schema: an optional field that makes a record pass with a hole, as the decision forbids.
- The tracked files: a `.gitignore` that lets a megabyte transcript into git, or hides the record.
- The case: an image whose repository already holds a `specs/` folder, which would confuse the flow.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/benchmarks/src/__tests__/data.test.ts`
- Expected: FAIL, `Cannot find module '../record.ts'`

- [x] **Step 3: Implement the readers, the schema, and the recorder**

Use plain TypeScript and the TOML parser already in the workspace, if one is
(`rg smol-toml pnpm-lock.yaml`), else add the smallest maintained one, and name it in the commit.
Schema checks are explicit and name the field. `checkCase` reads the image's repository listing
through an injected `list(image, path)` function, so the test needs no Docker.

- [x] **Step 4: Run the project's validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/benchmarks benchmarks/.gitignore .gitignore specs/2026-10-19-benchmarks/plan.md
git commit -m "feat(benchmarks): the suite, the case, and the record"
```

---

## Task 4: The skill snapshot

**Files:**

- Create: `packages/benchmarks/src/skill.ts`, `packages/benchmarks/src/__tests__/skill.test.ts`

**Interfaces:**

- Consumes: `RunRecord["skill"]` from Task 3.
- Produces: `snapshotSkill({repository, commit, into}): Promise<{pluginDir, commit, dirty}>`. It
  runs `git archive <commit> skills/uraeda` into `<into>/uraeda/skills/uraeda` with a plugin
  manifest, so the plugin is named `uraeda`, and `dirty` is whether the repository's tree differs
  from `commit`.

- [x] **Step 1: Write the failing tests**

```ts
test("the plugin holds the skill as the commit had it, not the working tree", async () => {
  const repo = await repoWithSkill("v1");
  const commit = await head(repo);
  await editSkill(repo, "v2");

  const { pluginDir, dirty } = await snapshotSkill({ repository: repo, commit, into: tmp() });

  expect(readSkill(pluginDir)).toBe("v1");
  expect(dirty).toBe(true);
});

test("a clean tree records dirty false and the commit", async () => {
  const { commit, dirty } = await snapshotSkill(cleanRepoArgs());

  expect({ commit, dirty }).toEqual({
    commit: expect.stringMatching(/^[0-9a-f]{40}$/),
    dirty: false,
  });
});
```

The break each test catches:

- The first: a snapshot copied from the working tree, whose edits a run would then use unrecorded.
- The second: a dirty flag that is always true, or a commit that is a branch name.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/benchmarks/src/__tests__/skill.test.ts`
- Expected: FAIL, `Cannot find module '../skill.ts'`

- [x] **Step 3: Implement `snapshotSkill`**

Through `git archive` and `git status --porcelain -- skills/uraeda`; the dirty flag covers the
skill's folder, as the decision asks for the skill's state.

- [x] **Step 4: Run the project's validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/benchmarks specs/2026-10-19-benchmarks/plan.md
git commit -m "feat(benchmarks): load the skill from a commit"
```

---

## Task 5: The sandbox and the run's configuration folder

**Risky:** it owns the isolation: the credentials, the web rules, the mounts, and the model.

**Files:**

- Create: `packages/benchmarks/src/sandbox.ts`, `config-dir.ts`, `docker-wrapper.ts`,
  `packages/benchmarks/src/__tests__/sandbox.test.ts`

**Interfaces:**

- Consumes: `Case` from Task 3, `Suite`.
- Produces: `makeConfigDir({folder, model, effort, deniedHosts}): string` writing `settings.json`
  with `model`, `effort`, `switchModelsOnFlag: false`, `env: {DISABLE_AUTOUPDATER: "1"}`, and
  `permissions.deny` for each denied host's `WebFetch(domain:<host>)`, and returns the folder.
  `prepareSandbox({case, run, bareOrigin}): Promise<Sandbox>` where
  `Sandbox = {repo, command, env, bareOrigin, close()}`: `repo` is the host copy of the case's
  repository, with `origin` set to the bare repository, `command` the path of the generated wrapper
  script that is the adapter's `command`, and `env` the variables for the runner's adapter
  (`CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_OAUTH_TOKEN` read from the runner's own environment). `close()`
  removes the container and the folders it made, on success, failure, and cancellation.
  `upstreamHosts(upstream: string): Array<string>` returns `github.com`,
  `raw.githubusercontent.com`, `api.github.com`, and `codeload.github.com` for a GitHub upstream,
  and its own host otherwise.

- [x] **Step 1: Write the failing tests**, with a `docker` script on the `PATH` that records its
      arguments

```ts
test("mounts each path at its own path, and the repository at /app", async () => {
  const { args } = await runWrapper({ cwd: repo, pluginDir: "/p", imagesDir: "/i" });

  expect(args).toEqual(
    expect.arrayContaining([`${repo}:/app`, "/p:/p:ro", "/i:/i", `${bare}:${bare}`]),
  );
});

test("passes the token by name and never mounts the credentials", async () => {
  const { args } = await runWrapper({ env: { CLAUDE_CODE_OAUTH_TOKEN: "secret" } });

  expect(args).toContain("CLAUDE_CODE_OAUTH_TOKEN");
  expect(args.join(" ")).not.toContain("secret");
  expect(args.join(" ")).not.toContain(".claude");
});

test("the settings turn the fallback off and deny the upstream's hosts", () => {
  const settings = readSettings(makeConfigDir({ ...ARGS, deniedHosts: ["github.com"] }));

  expect(settings).toMatchObject({
    model: "claude-sonnet-5-5",
    effort: "medium",
    switchModelsOnFlag: false,
    permissions: { deny: ["WebFetch(domain:github.com)"] },
  });
});

test("close removes the container and the folders after a failure", async () => {
  const sandbox = await prepareSandbox(FAILING_ARGS);

  await sandbox.close();

  expect(dockerCalls()).toContain("rm");
  expect(existsSync(sandbox.repo)).toBe(false);
});
```

The break each test catches:

- The mounts: a plugin or images path that exists only on the host, so the agent cannot read the
  skill, or a repository mounted anywhere but `/app`, where the image's installed packages point.
- The token: its value in the arguments, visible in `ps`, or the host's credentials in the
  container.
- The settings: a fallback to Opus 4.8 that changes the model unnoticed, or an upstream left open.
- The close: a container left running after a failed run.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/benchmarks/src/__tests__/sandbox.test.ts`
- Expected: FAIL, `Cannot find module '../sandbox.ts'`

- [x] **Step 3: Implement the sandbox**

The repository is copied out of the image with `docker create` and `docker cp`, initialised as a git
repository at the base commit if the image has none, given `origin` as a bare repository in a host
folder, and the wrapper runs `docker run --rm -i` with the user's uid, the mounts of the test,
`-w /app`, `-e` for each variable by name, and the host's `claude` mounted read-only (no `ura`: R1),
or the way Task 1's finding says. The wrapper receives the adapter's arguments and passes them on.

- [x] **Step 4: Run the project's validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/benchmarks specs/2026-10-19-benchmarks/plan.md
git commit -m "feat(benchmarks): a sandbox in the case's image"
```

---

## Task 6: The results page

**Files:**

- Create: `packages/benchmarks/src/report.ts`, `packages/benchmarks/src/report-cli.ts`,
  `packages/benchmarks/src/__tests__/report.test.ts`
- Modify: `vite.tasks.ts` (`benchmarks:report`, uncached)

**Interfaces:**

- Consumes: `listRuns`, `RunRecord`, `Scores` from Task 3, and `openBrowser` from the server (Task
  2).
- Produces: `renderReport(runs): string` (one self-contained HTML document, no script from the
  network), `writeReport(root, {open}): Promise<{path: string; opened: boolean} | {empty: true}>`.

- [x] **Step 1: Write the failing tests**

```ts
test("US5.1: the newer suite comes first and names its versions", () => {
  const html = renderReport([run("2026-09-01", "a"), run("2026-10-19", "b")]);

  expect(html.indexOf("2026-10-19")).toBeLessThan(html.indexOf("2026-09-01"));
  expect(html).toContain("claude-sonnet-5-5");
  expect(html).toContain("2.1.303");
});

test("US5.2: invalid and leak-suspected runs show their flag and leave the line", () => {
  const html = renderReport([run("2026-10-19", "a", { outcome: "invalid" })]);

  expect(html).toContain("invalid");
  expect(comparisonLine(html)).toEqual([]);
});

test("without a display the path is printed, not opened", async () => {
  const result = await writeReport(root, { open: () => false });

  expect(result).toMatchObject({ opened: false, path: join(root, "report.html") });
});

test("with no run folder it says there is nothing to show", async () => {
  expect(await writeReport(emptyRoot, { open: () => true })).toEqual({ empty: true });
});
```

The break each test catches:

- Order: an alphabetical page, whose newest suite is last.
- The flags: an invalid run counted in the comparison, which would hide that it broke a rule.
- The path: a failed `xdg-open` over SSH that crashes the command.
- The empty case: an empty page opened for nothing.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/benchmarks/src/__tests__/report.test.ts`
- Expected: FAIL, `Cannot find module '../report.ts'`

- [x] **Step 3: Implement the page**

Start from the [mockup](mockups/results.html): its structure and wording are the target. Each case
shows its flow run beside its baseline: tests passed of total, requirements covered of total,
sessions, cost, and time. The file is `benchmarks/report.html`, which git ignores.

- [x] **Step 4: Run the project's validation**

- Run: `nix develop -c vp run ready && nix develop -c vp run benchmarks:report`
- Expected: `ready` passes. The command prints "Nothing to show" in a checkout with no run folder.

- [x] **Step 5: Commit**

```bash
git add packages/benchmarks vite.tasks.ts specs/2026-10-19-benchmarks/plan.md
git commit -m "feat(benchmarks): the results page"
```

---

## Task 7: The loop

**Risky:** it owns when a run ends, and concurrency with the child processes.

**Files:**

- Create: `packages/benchmarks/src/loop.ts`, `session.ts`, `next.ts`,
  `packages/benchmarks/src/__tests__/loop.test.ts`,
  `packages/benchmarks/src/__tests__/fixtures/next-after-push.json`
- Test: helpers in `packages/benchmarks/src/__tests__/helpers.ts`

**Interfaces:**

- Consumes: `Sandbox` (Task 5), `snapshotSkill` (Task 4), `writeRun` (Task 3), the server's
  `Adapter`, `FakeAdapter`, `runMessage`, and the event types (Task 2).
- Produces: `nextStep(repo, slug): Promise<NextView>` (runs `ura next <slug> --json` and parses it),
  `runSession({adapter, message, cwd, nativeId}): Promise<SessionResult>` where
  `SessionResult = {events, costUsd?, models, seconds, tokens, denials, urls, ok, exit}`, and
  `runLoop({adapter, human, repo, slug, suite, maxSteps, now}): Promise<{outcome: Outcome; steps: Array<Step>; urls: Array<string>; blocked: Array<Blocked>}>`,
  where `human: (turn: HumanTurn) => Promise<HumanResult>` is Task 8's,
  `HumanTurn = {step: string; file: string; repo: string}` and
  `HumanResult = {commit?: string; gate: string}`.

- [ ] **Step 1: Write the failing tests**, on the fake adapter and a temporary repository with a
      fake `ura`

```ts
test("US1.2: the human runs at a gate and the agent only after the answers", async () => {
  const order = await runScripted(["agent:discovery", "human:answers", "agent:spec"]);

  expect(order).toEqual(["agent:discovery", "human:answers", "agent:spec"]);
});

test("US1.3: 30 sessions end the run as stalled and keep the steps", async () => {
  const result = await runScripted(neverEnding(), { maxSteps: 30 });

  expect(result).toMatchObject({ outcome: "stalled" });
  expect(result.steps).toHaveLength(30);
});

test("the run ends finished once the branch is pushed", async () => {
  const result = await runScripted(throughImplementation(), { nextAfterPush: AFTER_PUSH });

  expect(result.outcome).toBe("finished");
});

test("a result naming another model fails the run, naming it", async () => {
  const result = await runScripted([agentTurn({ models: ["claude-opus-4-8"] })]);

  expect(result).toMatchObject({
    outcome: "failed",
    reason: expect.stringContaining("claude-opus-4-8"),
  });
});

test("a usage limit ends the run as usage-limit", async () => {
  expect((await runScripted([usageLimitTurn()])).outcome).toBe("usage-limit");
});

test("an auto block is allowed once with the adapter's rule, a repeat fails", async () => {
  const result = await runScripted([blockedTurn("Bash(npm test)"), blockedTurn("Bash(npm test)")]);

  expect(result.blocked).toHaveLength(1);
  expect(result.outcome).toBe("failed");
});

test("a fetched address of the upstream flags the run leak-suspected", async () => {
  const result = await runScripted([fetchTurn("https://github.com/ansible/ansible/pull/1")], {
    upstream,
  });

  expect(result.leakSuspected).toBe(true);
  expect(result.urls).toContain("https://github.com/ansible/ansible/pull/1");
});

test("a late new round is answered like the first, within the cap", async () => {
  const result = await runScripted(withSecondRound(), { maxSteps: 30 });

  expect(result.steps.map((step) => step.role)).toEqual(expect.arrayContaining(["human"]));
});
```

The break each test catches:

- Order: an agent started before the human answered, which reads unanswered questions.
- The cap: a loop that never ends against agents that keep asking.
- Finished: every good run stalled because `ura next` still names an implementation step.
- The model: an Opus run recorded as Sonnet.
- The limit: a run retried against a closed account, or reported as a failure of the flow.
- The block: an unrecorded permission, or a block allowed over and over.
- The leak: an upstream fetch that nobody sees in the report.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/benchmarks/src/__tests__/loop.test.ts`
- Expected: FAIL, `Cannot find module '../loop.ts'`

- [ ] **Step 3: Implement the loop**

Record what `ura next --json` returns after the final push, with a real feature in a temporary
repository without a pull request host, into the fixture, and decide "finished" from it: the
`origin/<branch>` equals `HEAD` after an agent session, and the step is no unchecked task. Each
session is fresh (`resume: false`, a new session ID); the agent's message is `runMessage` from the
step `ura next` names. `usage` events with a limit at 100%, or the result's error naming the usage
limit, end the run as `usage-limit`. A blocked action is reopened once with `adapter.allowRule`.

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/benchmarks specs/2026-10-19-benchmarks/plan.md
git commit -m "feat(benchmarks): the loop of sessions"
```

---

## Task 8: The simulated human

**Risky:** it owns what the human can see, and a rule of the decision.

**Files:**

- Create: `benchmarks/human.md`, `packages/benchmarks/src/human.ts`,
  `packages/benchmarks/src/__tests__/human.test.ts`

**Interfaces:**

- Consumes: `runSession`, `HumanTurn`, `HumanResult` (Task 7), `Case`, `Sandbox` (Task 5).
- Produces:
  `makeHuman({adapter, caseFolder, guidelines, repo}): (turn: HumanTurn) => Promise<HumanResult>`.
  It opens a fresh session whose message is `human.md` and the case's proposal, and the step's file
  to read. After the turn, it reads the commit the human made and throws `InvalidRun` when it
  touches a file outside the feature's `specs/` folder.

- [ ] **Step 1: Write the failing tests**

```ts
test("the human prompt holds the proposal and the persona, and nothing else", () => {
  const message = humanMessage({
    guidelines: GUIDELINES,
    proposal: PROPOSAL,
    file: "clarifications-01.md",
  });

  expect(message).toContain(PROPOSAL);
  expect(message).toContain("your call");
  expect(message).not.toContain("hidden");
});

test("the human's prompt caps the requests for changes at two", () => {
  expect(humanMessage(args)).toContain("at most twice");
});

test("approves with the spec's risk tier", async () => {
  const result = await humanTurnWith(fakeApproval({ tier: "medium" }));

  expect(result.gate).toBe("approved");
});

test("marks the run invalid when the human's commit leaves specs/", async () => {
  await expect(humanTurnWith(commitTouching("src/app.py"))).rejects.toThrow(InvalidRun);
});

test("SC-004: the human's folder holds no tests and no reference patch", async () => {
  const { opens } = await humanTurnWith(fakeApproval());

  for (const open of opens) {
    expect(listAll(open.cwd)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/hidden|reference\.patch|\/tests\//)]),
    );
  }
});
```

The break each test catches:

- The prompt: a persona that leaks the hidden tests, or lets the human ask for changes forever.
- The commit: a human that edits code, which would hand the agent the solution.
- The folder: a hidden test left in the mount the human reads, found by the real session's folder.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/benchmarks/src/__tests__/human.test.ts`
- Expected: FAIL, `Cannot find module '../human.ts'`

- [ ] **Step 3: Write `benchmarks/human.md` and `human.ts`**

The persona follows SWE-Interact's "busy colleague" as the
[discovery](discovery-01.md#interactive-benchmarks-with-a-simulated-user) describes: terse answers
in a few words taken from the proposal, "your call" when it is silent, never saying it is a
simulation, approval only when each requirement of the proposal appears in the spec and nothing is
added, changes requested at most twice, and acting only through `ura answer` and `ura review`. Check
the human's commit by listing its files with `git show --name-only`.

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/benchmarks benchmarks/human.md specs/2026-10-19-benchmarks/plan.md
git commit -m "feat(benchmarks): the simulated human"
```

---

## Task 9: The grader and the judge

**Files:**

- Create: `packages/benchmarks/src/grader.ts`, `judge.ts`,
  `packages/benchmarks/src/__tests__/grader.test.ts`

**Interfaces:**

- Consumes: `Sandbox` (Task 5), `runSession` (Task 7), `Scores` (Task 3).
- Produces: `gradeTests({case, repo, branch, fetchTests, docker}): Promise<Scores["tests"]>` and
  `judgeRequirements({adapter, proposal, spec}): Promise<Scores["requirements"]>`, and
  `gradeRun(...)` putting them in a `Scores` with the rounds, revisions, and questions counted from
  the run's `specs/` files.

- [ ] **Step 1: Write the failing tests**, with a fake `docker` and the fake adapter

```ts
test("US4.1: applies the diff without specs/ to a fresh container", async () => {
  const calls = await gradeWith(DIFF_WITH_SPECS);

  expect(calls.applied).not.toContain("specs/");
  expect(calls.container).not.toBe(calls.agentContainer);
});

test("the hidden tests are fetched after the flow, not into any session's folder", async () => {
  const calls = await gradeWith(DIFF);

  expect(calls.testsFetchedAfter).toBe("flow-end");
  expect(calls.testsFolder).not.toContain(calls.repo);
});

test("US4.2: scores each requirement covered, partial, or missing, with the line", async () => {
  const scores = await judgeWith(verdicts(["covered", "partial", "missing"]));

  expect(scores).toMatchObject({ covered: 1, total: 3 });
  expect(scores.items[0]).toMatchObject({ verdict: "covered", line: expect.any(String) });
});

test("a branch with no push is graded as it stands, and no change counts as failed", async () => {
  expect((await gradeWith(EMPTY_DIFF)).tests).toMatchObject({ passed: 0, resolved: false });
});
```

The break each test catches:

- The diff: `specs/` files applied to the tests' container, or the tests run in the agent's own
  container, with its leftovers.
- The folder: tests visible to a session that ran before them.
- The judge: a verdict with no line, which no one can check.
- No change: a run credited with the tests that pass on the base.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/benchmarks/src/__tests__/grader.test.ts`
- Expected: FAIL, `Cannot find module '../grader.ts'`

- [ ] **Step 3: Implement the grader**

The dataset's tests for the task come through an injected `fetchTests(task, folder)` (the real one
downloads the task's `tests/` folder from the dataset). The judge session is Sonnet 5.5, blind to
the arm, with one binary check per requirement, and reads the spec and the proposal only.

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/benchmarks specs/2026-10-19-benchmarks/plan.md
git commit -m "feat(benchmarks): grade the tests and the requirements"
```

---

## Task 10: The command, the plain arm, screening, and the documents

**Files:**

- Create: `packages/benchmarks/src/cli.ts`, `run-case.ts`, `plain.ts`, `screen.ts`,
  `packages/benchmarks/src/__tests__/run-case.test.ts`, `benchmarks/README.md`,
  `benchmarks/suites/`, `benchmarks/cases/` (the candidates' `case.toml` and `proposal.md`)
- Modify: `AGENTS.md` (the repository layout gains `benchmarks/` and `packages/benchmarks/`),
  `specs/PRIORITIES.md` is left to the finish step

**Interfaces:**

- Consumes: everything above.
- Produces:
  `node packages/benchmarks/src/cli.ts run <suite> <case> --arm uraeda|plain --approved-by <name>`,
  `screen <candidates...> --approved-by <name>`, and `report`. `runCase(...)` starts the feature
  with `ura start --switch` from a draft that is the case's proposal, runs the loop, grades, and
  writes the run folder. `runPlain(...)` is one session with the proposal as the prompt, no skill,
  then `gradeTests`. `baselineFor(case, root)` returns the existing plain run whose image digest
  equals the case's, or none.

- [ ] **Step 1: Write the failing tests**

```ts
test("US1.1: starts a feature whose proposal is the case's proposal, word for word", async () => {
  const { repo } = await runCaseWithFakes(CASE);

  expect(readFeatureProposal(repo)).toBe(readFileSync(join(CASE, "proposal.md"), "utf8"));
});

test("refuses to start without an approval", async () => {
  await expect(cli(["run", "suite", "case"])).rejects.toThrow("approval");
  expect(dockerCalls()).toEqual([]);
});

test("the record names who approved", async () => {
  const run = await runCaseWithFakes(CASE, { approvedBy: "owner" });

  expect(run.record.approvedBy).toBe("owner");
});

test("a flow run starts no plain run when the baseline exists", async () => {
  const calls = await runSuiteWith({ baselines: ["case-a"] });

  expect(calls.plainRuns).toEqual([]);
});

test("reruns the baseline when the digest changed", async () => {
  expect((await runSuiteWith({ baselines: ["case-a"], digestChanged: true })).plainRuns).toEqual([
    "case-a",
  ]);
});

test("the baseline is a new run, not the screening run", async () => {
  expect((await runSuiteWith({ screened: ["case-a"] })).plainRuns).toEqual(["case-a"]);
});

test("screening keeps the failed cases from at least four repositories", async () => {
  expect((await screenWith(TEN_CANDIDATES)).chosen.map(repositoryOf)).toSatisfy(distinctAtLeast(4));
});

test("fills the suite with the lowest share of passed tests when fewer than five fail", async () => {
  expect((await screenWith(THREE_FAIL)).chosen).toHaveLength(5);
});

test("drops a case whose reference patch fails the tests, and screens the next", async () => {
  expect((await screenWith(OneBrokenReference)).dropped).toEqual(["broken"]);
});
```

The break each test catches:

- The proposal: a trimmed or reformatted task text, which changes what the human knows.
- The approval: a run started by an agent on its own, which spends the owner's usage.
- The baselines: a plain run per flow run, or a stale one compared with a new image.
- The screening: five cases from one repository, or a screening run mistaken for the baseline.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/benchmarks/src/__tests__/run-case.test.ts`
- Expected: FAIL, `Cannot find module '../run-case.ts'`

- [ ] **Step 3: Implement the command**

The candidates' folders come from the five tasks the [spec's assumptions](spec.md#assumptions) name,
with the five more of the hard subset's list, read from the dataset: write each `case.toml` and the
`proposal.md` verbatim from `problem_statement`, `requirements`, and `interface`. Write
`benchmarks/README.md`: what is measured, how to run it and who must approve it, the prerequisites
(Docker, the token from `claude setup-token`), and how to read the page.

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/benchmarks benchmarks AGENTS.md specs/2026-10-19-benchmarks/plan.md
git commit -m "feat(benchmarks): run a case, a baseline, and the screening"
```

---

## Task 11: The first suite's real runs

**Files:**

- Create: `benchmarks/suites/2026-10-19.toml`, `benchmarks/runs/…` (the runs' folders)

**Interfaces:**

- Consumes: Task 10's command.
- Produces: the five cases of SC-002, each with a flow run and a fresh plain baseline, in git.

- [ ] **Step 1: Screen about ten candidates**

- Run: `node packages/benchmarks/src/cli.ts screen <candidates> --approved-by <the owner>`
- Expected: the five that fail the hidden tests, from at least four repositories, named in the
  output.

- [ ] **Step 2: Write the suite file from the screening**

- [ ] **Step 3: Run each case's flow arm and its baseline**

- Run:
  `node packages/benchmarks/src/cli.ts run 2026-10-19 <case> --arm uraeda --approved-by <the owner>`,
  then `--arm plain`, for each case
- Expected: each run folder holds `record.json`, `scores.json`, `specs/`, and `final.diff`.

- [ ] **Step 4: Open the page and commit the runs**

- Run: `nix develop -c vp run benchmarks:report`
- Expected: the page opens with the suite's five cases.

```bash
git add benchmarks
git commit -m "feat(benchmarks): the first suite's runs"
```
