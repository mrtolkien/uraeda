// The data views of the Git page: the page, read at once, with whether an agent works in each of
// its checkouts and why the last background fetch failed; the sidebar's count; a file's diff; a
// commit; a page of the history; and a conflicted file for the editor. The core reads the repository at each request (R3): nothing is
// kept here. A record's optional fields are sent as null, as fate merges a record's fields
// shallowly and would keep a field an update leaves out.
import { dataView } from "@nkzw/fate/server";
import type {
  ChangeGroupView,
  ConflictFileView,
  GitCommitView,
  GitDiffView,
  GitHistoryPageView,
  GitPageView,
  GitSummaryView,
  StoppedView,
} from "uraeda-binding";
import { type Context, inRepository, type RepoContext } from "./context.ts";
import { chatWorks } from "./git-guard.ts";
import { working } from "./sessions.ts";
import { fileSource } from "./source.ts";
import type { Record_ } from "./views.ts";

/** The id of the one `GitPage` record, and of the one `GitSummary` record. */
export const GIT_ID = "git";

/** A group of changes as it is sent: its folder null for the main checkout's. */
export type GitGroup = Omit<Record_<ChangeGroupView>, "defaultMessage" | "folder"> & {
  /** The message a commit takes when none is typed; null when nothing is staged. */
  defaultMessage: string | null;
  folder: string | null;
  /** Whether its feature's agent works, which refuses its writes. */
  isWorking: boolean;
};

/** A linked worktree as it is sent. */
export type GitWorktreeRecord = Record_<GitPageView>["worktrees"][number] & {
  /** Whether its feature's agent works, which refuses its Clean and Remove. */
  isWorking: boolean;
};

export type GitPageRecord = Omit<
  Record_<GitPageView>,
  "branch" | "detached" | "fetchedAt" | "groups" | "stopped" | "worktrees"
> & {
  /** Whether a chat's agent works in the main checkout, which refuses the page's writes. */
  agentWorking: boolean;
  branch: string | null;
  detached: string | null;
  fetchedAt: number | null;
  /** Why the last background fetch failed, until one succeeds. */
  fetchFailure: string | null;
  groups: Array<GitGroup>;
  stopped: StoppedView | null;
  worktrees: Array<GitWorktreeRecord>;
};

/** The page as it is sent, with whether an agent works in each checkout. */
export async function gitPage(ctx: RepoContext): Promise<GitPageRecord> {
  const [view, agentWorking, folders] = await Promise.all([
    ctx.binding.gitPage(ctx.repo),
    chatWorks(ctx),
    working(ctx),
  ]);
  return {
    ...view,
    agentWorking,
    branch: view.branch ?? null,
    detached: view.detached ?? null,
    fetchedAt: view.fetchedAt ?? null,
    fetchFailure: ctx.hosts.byPath(ctx.repo)?.fetcher?.failure() ?? null,
    groups: view.groups.map((group) => ({
      ...group,
      defaultMessage: group.defaultMessage ?? null,
      folder: group.folder ?? null,
      isWorking: group.folder !== undefined && folders.includes(group.folder),
    })),
    stopped: view.stopped ?? null,
    worktrees: view.worktrees.map((worktree) => ({
      ...worktree,
      isWorking: worktree.folder !== undefined && folders.includes(worktree.folder),
    })),
  };
}

export const gitPageDataView = dataView<GitPageRecord>("GitPage")({
  agentWorking: true,
  ahead: true,
  behind: true,
  branch: true,
  branches: true,
  conflicts: true,
  detached: true,
  fetchedAt: true,
  fetchFailure: true,
  groups: true,
  hasMoreHistory: true,
  hasRemote: true,
  history: true,
  id: true,
  stopped: true,
  worktrees: true,
});

export type GitSummaryRecord = Record_<GitSummaryView>;

export const gitSummaryDataView = dataView<GitSummaryRecord>("GitSummary")({
  behind: true,
  changes: true,
  id: true,
});

export type GitDiffRecord = Omit<Record_<GitDiffView>, "binaryAfter" | "binaryBefore" | "text"> & {
  binaryAfter: number | null;
  binaryBefore: number | null;
  text: string | null;
};

/** A diff's id: what it is of, a group's folder or a commit, its path, and whether it is whole. */
export const gitDiffId = (
  folder: string | null,
  commit: string | null,
  path: string,
  whole: boolean,
) => JSON.stringify([folder, commit, path, whole]);

/** The diff of the id `gitDiffId` made, under that id. */
async function gitDiff(ctx: RepoContext, id: string): Promise<GitDiffRecord> {
  const [folder, commit, path, whole] = JSON.parse(id) as [
    string | null,
    string | null,
    string,
    boolean,
  ];
  const view = await ctx.binding.gitDiff(
    ctx.repo,
    { ...(folder === null ? {} : { folder }), ...(commit === null ? {} : { commit }) },
    path,
    whole,
  );
  return {
    ...view,
    binaryAfter: view.binaryAfter ?? null,
    binaryBefore: view.binaryBefore ?? null,
    id,
    text: view.text ?? null,
  };
}

export const gitDiffDataView = dataView<GitDiffRecord>("GitDiff")({
  added: true,
  binaryAfter: true,
  binaryBefore: true,
  id: true,
  isCapped: true,
  path: true,
  removed: true,
  text: true,
});

export type GitCommitRecord = Record_<GitCommitView>;

export const gitCommitDataView = dataView<GitCommitRecord>("GitCommit")({
  authored: true,
  body: true,
  files: true,
  id: true,
  subject: true,
});

export type GitHistoryPageRecord = Record_<GitHistoryPageView>;

export const gitHistoryPageDataView = dataView<GitHistoryPageRecord>("GitHistoryPage")({
  commits: true,
  hasMore: true,
  id: true,
});

export type ConflictFileRecord = Record_<ConflictFileView>;

export const conflictFileDataView = dataView<ConflictFileRecord>("ConflictFile")({
  hash: true,
  id: true,
  path: true,
  text: true,
});

/** Reads each id, leaving out the ones the core refuses, like a path outside the checkout. */
async function each<T>(ids: Array<string>, read: (id: string) => Promise<T>): Promise<Array<T>> {
  const results = await Promise.allSettled(ids.map(read));
  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

/** The one record of `GIT_ID`, read when asked for. */
const one =
  <T>(read: (ctx: RepoContext) => Promise<T>) =>
  async (ctx: Context, ids: Array<string>) =>
    ids.includes(GIT_ID) ? [await read(inRepository(ctx))] : [];

/** The Git page's sources, refused on the global endpoint, which has no repository. */
export const gitSources = [
  fileSource<Context, GitPageRecord>(gitPageDataView, { byIds: one(gitPage) }),
  fileSource<Context, GitSummaryRecord>(gitSummaryDataView, {
    byIds: one((ctx) => ctx.binding.gitSummary(ctx.repo)),
  }),
  fileSource<Context, GitDiffRecord>(gitDiffDataView, {
    byIds: (ctx, ids) => each(ids, (id) => gitDiff(inRepository(ctx), id)),
  }),
  fileSource<Context, GitCommitRecord>(gitCommitDataView, {
    byIds: (ctx, ids) => {
      const { binding, repo } = inRepository(ctx);
      return each(ids, (id) => binding.gitCommit(repo, id));
    },
  }),
  fileSource<Context, GitHistoryPageRecord>(gitHistoryPageDataView, {
    byIds: (ctx, ids) => {
      const { binding, repo } = inRepository(ctx);
      return each(ids, (id) => binding.gitHistory(repo, id));
    },
  }),
  fileSource<Context, ConflictFileRecord>(conflictFileDataView, {
    byIds: (ctx, ids) => {
      const { binding, repo } = inRepository(ctx);
      return each(ids, (id) => binding.conflictFile(repo, id));
    },
  }),
];
