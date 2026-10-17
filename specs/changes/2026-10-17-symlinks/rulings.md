# Rulings: Share the main checkout's builds with worktrees

The low-impact choices made while building [the change](proposal.md), inside the limits of the
decisions. None binds future work: those are decisions.

## R1: `target/` is cloned once, not linked

- **Decision**: a new worktree's `target/` starts as a clone of the main checkout's, made with
  `cp -a --reflink=always`, and builds on its own from then on. Nothing is linked.
- **Rationale**: Cargo judges a crate fresh by its files' times. With one `target/` shared, by a
  link or by `build.build-dir`, a worktree whose files were older than another checkout's last build
  ran that build's code: reproduced with two copies of a crate, where the second printed the first
  one's output after a change, and its tests ran the first one's binary through `CARGO_BIN_EXE_*`. A
  clone shares the main checkout's blocks on btrfs, XFS, and APFS until a side rewrites them.
- **Alternatives considered**: a link, or a shared `build-dir`, which run stale code as above, and
  make builds in several worktrees wait on one lock; sccache, which saves the dependencies' CPU but
  keeps a full copy of each in every worktree and in its own cache, and adds a tool to the flake.
- **If wrong**: a worktree builds alone after its first build, so two worktrees still compile the
  same new dependency twice. The clone does not wait for a build running in the main checkout: a
  dependency rebuilt there during the clone's few seconds can reach the worktree half copied, and
  fail its first build, which `cargo clean -p <crate>` fixes; the workspace's crates are rebuilt
  whatever the clone holds. Undo by removing the shell hook from [`flake.nix`](/flake.nix).
- **Where**: [`worktree-seed.ts`](/packages/server/scripts/worktree-seed.ts),
  [`flake.nix`](/flake.nix)

## R2: The clone forgets the workspace's own crates

- **Decision**: the clone loses the fingerprints of the workspace's packages, read with
  `cargo metadata --no-deps`, in every profile and target folder, and the binaries and libraries
  Cargo copied next to them, before it becomes `target/`. Cargo builds them, and what depends on
  them, again; the dependencies stay built.
- **Rationale**: the clone keeps the main checkout's times. A worktree whose files are older than
  the main checkout's last build, as when the shell first runs days after the worktree was made,
  would otherwise reuse the main checkout's build of its crates, and the Neovim plugin's tests, run
  by hand, would run the main checkout's `target/debug/ura`. The dependencies come from the
  registry, the same files in every checkout.
- **Alternatives considered**: touching every tracked file of the worktree, which rewrites the times
  of files that are not the build's.
- **If wrong**: a package whose fingerprint is not named after it would keep the main checkout's
  build; Cargo names every unit's fingerprint folder after its package.
- **Where**: `forgetPackages` in [`worktree-seed.ts`](/packages/server/scripts/worktree-seed.ts)

## R3: Without clones, nothing is copied

- **Decision**: on a filesystem that cannot clone, such as ext4, the shell says so and leaves
  `target/` to Cargo.
- **Rationale**: the main checkout's `target/` here is 64 GB; a full copy would cost more storage
  than the worktree's own build, the opposite of the proposal.
- **Alternatives considered**: copying only the dependencies' files, which needs Cargo's layout and
  still costs their size in every worktree.
- **If wrong**: a machine without clones keeps today's cost.
- **Where**: `seedTarget` in [`worktree-seed.ts`](/packages/server/scripts/worktree-seed.ts)

## R4: `node_modules` stays installed per worktree

- **Decision**: `node_modules` is not linked to the main checkout's; `vp install` still installs a
  worktree's.
- **Rationale**: pnpm already links each package's files from its store, so the main checkout's 711
  MB and two worktrees' 627 MB each took 833 MB together, about 60 MB per worktree. A shared folder
  would let a branch that adds a dependency install it into the main checkout, and share
  `node_modules/.vite`, where Vite and Storybook keep each checkout's caches, between servers
  running at once.
- **Alternatives considered**: a link to the main checkout's `node_modules`, for the reasons above.
- **If wrong**: each worktree keeps its install's few seconds.
- **Where**: none

## R5: Vite Task's cache is copied once, after the install

- **Decision**: once a worktree's dependencies are installed, its `node_modules/.vite/task-cache`
  starts as a copy of the main checkout's: its SQLite databases read through SQLite with
  `VACUUM INTO`, then its archives, cloned where the filesystem can.
- **Rationale**: the cache is keyed by its inputs' contents, so the main checkout's entries hold in
  a worktree with the same files: the first `vp run ready` of a worktree replayed `rust:fmt` and
  `lua:fmt` from it. Reading through SQLite keeps a write in progress in the main checkout from
  tearing the copy.
- **Alternatives considered**: a link to the main checkout's cache, shared for good, which leaves
  concurrent runs of several checkouts to SQLite's locks, and `vp cache clean` in a worktree to the
  main checkout's.
- **If wrong**: entries recorded in the main checkout read `.worktrees/` files as inputs (see the
  pull request), so fewer of them hit than the same files would allow.
- **Where**: `seedTaskCache` in [`worktree-seed.ts`](/packages/server/scripts/worktree-seed.ts)

## R6: The script lives with the server's development scripts

- **Decision**: the script is `packages/server/scripts/worktree-seed.ts`, next to `dev.ts`, not in
  the root's `scripts/` next to `test-run.ts`.
- **Rationale**: the root's `scripts/` has no TypeScript project, so the commit hook type-checks a
  new file there without Node's types and refuses it; the server's project includes its `scripts/`,
  so the script is type-checked like the rest.
- **Alternatives considered**: a TypeScript project for the root's `scripts/`, which would also
  type-check `test-run.ts` and `coverage-summary.ts`, outside this change.
- **If wrong**: the script moves with its test's two imports and the shell hook's path.
- **Where**: [`worktree-seed.ts`](/packages/server/scripts/worktree-seed.ts),
  [`flake.nix`](/flake.nix)
