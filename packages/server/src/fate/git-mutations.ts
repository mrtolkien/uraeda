// The Git page's writes. Each is refused while an agent works in its checkout (`git-guard.ts`), as
// it is queued and again as it lands, in the repository's write queue, after the writes made
// before it, named by its `write` input, git's output streamed into the queue's record for the
// toast. It answers once it landed, with the page; a refusal stays in the record and answers the
// call too. After each, landed or refused, the page and the sidebar's count are sent again.
import { publishGit } from "../live.ts";
import type { Land, NewWrite, WriteInput } from "../writes/queue.ts";
import type { RepoContext, Resolver } from "./context.ts";
import { refusable } from "./errors.ts";
import { checkoutWritable } from "./git-guard.ts";
import { sources } from "./sources.ts";
import { conflictFileDataView, gitPage, gitPageDataView } from "./views-git.ts";
import { featureKeys, landed, LISTS, type Queued } from "./write-queue.ts";

/**
 * The keys of the main checkout's git writes: the lists' commits, the inbox's, the priorities',
 * and the proposals', wait for them, as a pull or a merge may write their files.
 */
const MAIN = ["git", LISTS];

/** A group's checkout: a feature's folder, or null for the main checkout. */
type Group = { folder: string | null };

/** The keys of the writes to a group's checkout. */
const keysOf = (folder: string | null) => (folder === null ? MAIN : featureKeys(folder));

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

/** The page masked to `select`. */
const page = async ({ ctx, select }: Resolver<unknown>) =>
  sources.masked(gitPageDataView, ctx, await gitPage(ctx), select);

/**
 * Runs `land` as a write of the repository's queue once `guard` lets it, `guard` checked again as
 * it lands: an agent may have started meanwhile. Its refusal then stays in the record. It answers
 * with the page masked to `select`. Without a host, it lands at once.
 */
async function gitWrite(
  args: Resolver<unknown>,
  guard: () => Promise<void>,
  write: NewWrite & { keys: Array<string> },
  land: Land,
) {
  const { ctx } = args;
  try {
    await guard();
    const queue = ctx.hosts.byPath(ctx.repo)?.queue;
    const { keys, ...record } = write;
    const guarded: Land = async (onOutput) => {
      await guard();
      return land(onOutput);
    };
    await refusable(() => (queue ? queue.enqueue(record, guarded, keys) : land(() => {})));
  } finally {
    changed(ctx);
  }
  return page(args);
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
    { ...named(args.input.write, label), keys: MAIN },
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

/** The folder of the feature whose branch the worktree at `path` holds, if any. */
async function worktreeFolder(ctx: RepoContext, path: string): Promise<string | undefined> {
  const { worktrees } = await refusable(() => ctx.binding.gitPage(ctx.repo));
  return worktrees.find((worktree) => worktree.path === path)?.folder ?? undefined;
}

/**
 * Refuses a write of the main checkout and of `folder`'s, while a chat's agent works in the main
 * checkout, or the agent of the feature works in its worktree.
 */
async function bothWritable(ctx: RepoContext, folder: string | undefined) {
  await checkoutWritable(ctx, null);
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
        () => bothWritable(ctx, input.folder),
        { ...named(input.write, "Cleaning"), keys: [...MAIN, ...featureKeys(input.folder)] },
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
  // A quiet fetch, the page's on its open, is the fetcher's, without a toast: it is no human's
  // write, and changes no file of a checkout, so no agent refuses it, and a failure is the page's
  // `fetchFailure`. A loud one is the human's write, whose outcome the fetcher keeps too.
  "git.fetch": {
    resolve: async (args: Resolver<Queued<{ quiet?: boolean }>>) => {
      const { ctx, input } = args;
      const fetcher = ctx.hosts.byPath(ctx.repo)?.fetcher;
      if (input.quiet) {
        await fetcher?.now();
        return page(args);
      }
      return mainWrite(args, "Fetching", async (repo, onOutput) => {
        try {
          await ctx.binding.gitFetch(repo, onOutput);
        } catch (error) {
          fetcher?.settle(error);
          throw error;
        }
        fetcher?.settle();
      });
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
    resolve: async (args: Resolver<Queued<{ path: string }>>) => {
      const { ctx, input } = args;
      // Its removal writes the main checkout's git folder and the feature's worktree.
      const folder = await worktreeFolder(ctx, input.path);
      return gitWrite(
        args,
        () => bothWritable(ctx, folder),
        {
          ...named(input.write, `Removing ${input.path}`),
          keys: [...MAIN, ...(folder === undefined ? [] : featureKeys(folder))],
        },
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
        const saved = await landed(
          ctx,
          MAIN,
          named(input.write, `Saving ${input.path}`),
          async () => {
            await checkoutWritable(ctx, null);
            return ctx.binding.saveConflictFile(ctx.repo, input.path, input.text, input.hash);
          },
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
