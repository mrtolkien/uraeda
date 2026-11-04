// The Git page's writes. Each is refused while an agent works in its checkout (`git-guard.ts`),
// then lands in the repository's write queue, after the writes made before it, named by its
// `write` input, git's output streamed into the queue's record for the toast. It answers once it
// landed, with the page; a refusal stays in the record and answers the call too. After each, landed
// or refused, the page and the sidebar's count are sent again.
import { publishGit } from "../live.ts";
import type { Land, NewWrite, WriteInput } from "../writes/queue.ts";
import type { RepoContext, Resolver } from "./context.ts";
import { refusable } from "./errors.ts";
import { checkoutWritable } from "./git-guard.ts";
import { working } from "./sessions.ts";
import { sources } from "./sources.ts";
import { conflictFileDataView, gitPage, gitPageDataView } from "./views-git.ts";
import { featureKeys, landed, type Queued } from "./write-queue.ts";

/** The key of the main checkout's git writes. */
const GIT = "git";

/** A group's checkout: a feature's folder, or null for the main checkout. */
type Group = { folder: string | null };

/** The keys of the writes to a group's checkout. */
const keysOf = (folder: string | null) => (folder === null ? [GIT] : featureKeys(folder));

/** What a write is named by, without the web's `write`: on the Git page, with `label`. */
const named = (write: WriteInput | undefined, label: string): NewWrite =>
  write ?? { href: "/git", label };

/** Sends the page and the sidebar's count of the context's repository again. */
const changed = (ctx: RepoContext) => {
  const host = ctx.hosts.byPath(ctx.repo);
  if (host) {
    publishGit(host.live);
  }
};

/**
 * Runs `land` as a write of the repository's queue once `guard` lets it, and answers with the page
 * masked to `select`. Without a host, it lands at once.
 */
async function gitWrite(
  { ctx, select }: Resolver<unknown>,
  guard: () => Promise<void>,
  write: NewWrite & { keys: Array<string> },
  land: Land,
) {
  try {
    await guard();
    const queue = ctx.hosts.byPath(ctx.repo)?.queue;
    const { keys, ...record } = write;
    await refusable(() => (queue ? queue.enqueue(record, land, keys) : land(() => {})));
  } finally {
    changed(ctx);
  }
  return sources.masked(gitPageDataView, ctx, await gitPage(ctx), select);
}

/** A write of the main checkout, refused while a chat's agent works in it. */
const mainWrite = (
  args: Resolver<Queued<object>>,
  label: string,
  land: (repo: string, onOutput: (line: string) => void) => Promise<unknown>,
) =>
  gitWrite(
    args,
    () => checkoutWritable(args.ctx, null),
    { ...named(args.input.write, label), keys: [GIT] },
    (onOutput) => land(args.ctx.repo, onOutput),
  );

/** A write of a group's checkout, refused while the agent of its checkout works. */
const groupWrite = (
  args: Resolver<Queued<Group>>,
  label: string,
  land: (repo: string, folder: string | null) => Promise<unknown>,
) =>
  gitWrite(
    args,
    () => checkoutWritable(args.ctx, args.input.folder),
    { ...named(args.input.write, label), keys: keysOf(args.input.folder) },
    () => land(args.ctx.repo, args.input.folder),
  );

/**
 * Refuses the removal of the worktree at `path` while a chat's agent works in the main checkout, or
 * the agent of the feature on its branch works in it.
 */
async function removable(ctx: RepoContext, path: string) {
  await checkoutWritable(ctx, null);
  if ((await working(ctx)).length === 0) {
    return;
  }
  const { worktrees } = await refusable(() => ctx.binding.gitPage(ctx.repo));
  const folder = worktrees.find((worktree) => worktree.path === path)?.folder;
  if (folder !== undefined) {
    await checkoutWritable(ctx, folder);
  }
}

export const gitMutations = {
  "git.abort": {
    resolve: (args: Resolver<Queued<object>>) =>
      mainWrite(args, "Aborting", (repo, onOutput) => args.ctx.binding.gitAbort(repo, onOutput)),
    type: "GitPage",
  },
  "git.clean": {
    resolve: (args: Resolver<Queued<{ folder: string }>>) => {
      const { ctx, input } = args;
      return gitWrite(
        args,
        async () => {
          await checkoutWritable(ctx, null);
          await checkoutWritable(ctx, input.folder);
        },
        { ...named(input.write, "Cleaning"), keys: [GIT, ...featureKeys(input.folder)] },
        () => ctx.binding.cleanFeature(ctx.repo, input.folder),
      );
    },
    type: "GitPage",
  },
  "git.commit": {
    resolve: (args: Resolver<Queued<Group & { message: string }>>) => {
      const { ctx, input } = args;
      return gitWrite(
        args,
        () => checkoutWritable(ctx, input.folder),
        { ...named(input.write, "Committing"), keys: keysOf(input.folder) },
        (onOutput) => ctx.binding.gitCommitStaged(ctx.repo, input.folder, input.message, onOutput),
      );
    },
    type: "GitPage",
  },
  "git.continue": {
    resolve: (args: Resolver<Queued<object>>) =>
      mainWrite(args, "Continuing", (repo, onOutput) =>
        args.ctx.binding.gitContinue(repo, onOutput),
      ),
    type: "GitPage",
  },
  "git.discard": {
    resolve: (args: Resolver<Queued<Group & { path: string }>>) =>
      groupWrite(args, `Discarding ${args.input.path}`, (repo, folder) =>
        args.ctx.binding.gitDiscard(repo, folder, args.input.path),
      ),
    type: "GitPage",
  },
  // A quiet fetch, the page's on its open, lands in the queue without a toast; it is no human's
  // write, and changes no file of a checkout, so no agent refuses it.
  "git.fetch": {
    resolve: async (args: Resolver<Queued<{ quiet?: boolean }>>) => {
      const { ctx, input, select } = args;
      const fetch: Land = (onOutput) => ctx.binding.gitFetch(ctx.repo, onOutput);
      if (!input.quiet) {
        return mainWrite(args, "Fetching", (_, onOutput) => fetch(onOutput));
      }
      const queue = ctx.hosts.byPath(ctx.repo)?.queue;
      try {
        await refusable(() => (queue ? queue.background(fetch) : fetch(() => {})));
      } finally {
        changed(ctx);
      }
      return sources.masked(gitPageDataView, ctx, await gitPage(ctx), select);
    },
    type: "GitPage",
  },
  "git.merge": {
    resolve: (args: Resolver<Queued<{ branch: string }>>) =>
      mainWrite(args, `Merging ${args.input.branch}`, (repo, onOutput) =>
        args.ctx.binding.gitMerge(repo, args.input.branch, onOutput),
      ),
    type: "GitPage",
  },
  "git.pull": {
    resolve: (args: Resolver<Queued<object>>) =>
      mainWrite(args, "Pulling", (repo, onOutput) => args.ctx.binding.gitPull(repo, onOutput)),
    type: "GitPage",
  },
  "git.push": {
    resolve: (args: Resolver<Queued<object>>) =>
      mainWrite(args, "Pushing", (repo, onOutput) => args.ctx.binding.gitPush(repo, onOutput)),
    type: "GitPage",
  },
  "git.removeWorktree": {
    resolve: (args: Resolver<Queued<{ path: string }>>) => {
      const { ctx, input } = args;
      return gitWrite(
        args,
        () => removable(ctx, input.path),
        { ...named(input.write, `Removing ${input.path}`), keys: [GIT] },
        () => ctx.binding.gitRemoveWorktree(ctx.repo, input.path),
      );
    },
    type: "GitPage",
  },
  "git.resolve": {
    resolve: (args: Resolver<Queued<{ path: string; resolution: "delete" | "ours" | "theirs" }>>) =>
      mainWrite(args, `Resolving ${args.input.path}`, (repo) =>
        args.ctx.binding.gitResolve(repo, args.input.path, args.input.resolution),
      ),
    type: "GitPage",
  },
  // A save of the editor's text answers with the file and its new hash, which the next save names;
  // a stale one leaves the queue's record, answered where it was made.
  "git.saveConflict": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<Queued<{ hash: string; path: string; text: string }>>) => {
      try {
        await checkoutWritable(ctx, null);
        const saved = await landed(ctx, [GIT], named(input.write, `Saving ${input.path}`), () =>
          ctx.binding.saveConflictFile(ctx.repo, input.path, input.text, input.hash),
        );
        return sources.masked(conflictFileDataView, ctx, { ...saved }, select);
      } finally {
        changed(ctx);
      }
    },
    type: "ConflictFile",
  },
  "git.stage": {
    resolve: (args: Resolver<Queued<Group & { paths: Array<string> }>>) =>
      groupWrite(args, "Staging", (repo, folder) =>
        args.ctx.binding.gitStage(repo, folder, args.input.paths),
      ),
    type: "GitPage",
  },
  "git.unstage": {
    resolve: (args: Resolver<Queued<Group & { paths: Array<string> }>>) =>
      groupWrite(args, "Unstaging", (repo, folder) =>
        args.ctx.binding.gitUnstage(repo, folder, args.input.paths),
      ),
    type: "GitPage",
  },
};
