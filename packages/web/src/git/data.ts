// The Git page's records: the page, read at once and kept up to date by the server's live updates,
// the sidebar's count, a file's diff, a commit, and the history's later pages. Here rather than in
// `views.ts` and `data.ts`, which are at the length limit (ruling R22).
import { useLiveView, useRequest, view } from "react-fate";
import type { GitCommit, GitDiff, GitHistoryPage, GitPage, GitSummary } from "uraeda-server/fate";
import { useRefreshOnShow } from "../data.ts";

/** The id of the one `GitPage` and `GitSummary` record, as the server names it (`GIT_ID`). */
export const GIT_ID = "git";

/**
 * A diff's id, as the server's `gitDiffId` makes it: a group's folder or a commit, null for the
 * other, its path, and whether the whole diff is asked for, past the cap.
 */
export const gitDiffId = (
  folder: string | null,
  commit: string | null,
  path: string,
  whole: boolean,
) => JSON.stringify([folder, commit, path, whole]);

/**
 * The page: its sync, its groups of changes, its conflicts, its history, its worktrees, and the
 * last background fetch's failure.
 */
export const GitPageView = view<GitPage>()({
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
  // An object comes field by field.
  stopped: { kind: true, ours: true, stash: true, theirs: true },
  worktrees: true,
});

/** The sidebar's count: the changes to commit, and the commits to pull. */
export const GitSummaryView = view<GitSummary>()({ behind: true, changes: true, id: true });

export const GitDiffView = view<GitDiff>()({
  added: true,
  binaryAfter: true,
  binaryBefore: true,
  id: true,
  isCapped: true,
  path: true,
  removed: true,
  text: true,
});

export const GitCommitView = view<GitCommit>()({
  authored: true,
  body: true,
  files: true,
  id: true,
  subject: true,
});

export const GitHistoryPageView = view<GitHistoryPage>()({
  commits: true,
  hasMore: true,
  id: true,
});

/** The page's record, as the page reads it. */
export type GitPageData = Pick<
  GitPage,
  | "agentWorking"
  | "ahead"
  | "behind"
  | "branch"
  | "branches"
  | "conflicts"
  | "detached"
  | "fetchedAt"
  | "fetchFailure"
  | "groups"
  | "hasMoreHistory"
  | "hasRemote"
  | "history"
  | "stopped"
  | "worktrees"
>;

/** A group of changes: the main checkout's, its folder null, or a feature's worktree's. */
export type GitGroup = GitPageData["groups"][number];
export type GitWorktree = GitPageData["worktrees"][number];
export type GitCommitRow = GitPageData["history"][number];

/** The request of the page's record. */
export const GIT_PAGE_REQUEST = { gitPage: { id: GIT_ID, view: GitPageView } };

/** The Git page's record. */
export function useGitPage(): GitPageData | null {
  const { gitPage } = useRequest(GIT_PAGE_REQUEST);
  useRefreshOnShow(GIT_PAGE_REQUEST);
  return useLiveView(GitPageView, gitPage) as GitPageData | null;
}

const SUMMARY_REQUEST = { gitSummary: { id: GIT_ID, view: GitSummaryView } };

/** The sidebar's count of what waits on the Git page. */
export function useGitSummary() {
  const { gitSummary } = useRequest(SUMMARY_REQUEST);
  useRefreshOnShow(SUMMARY_REQUEST);
  return useLiveView(GitSummaryView, gitSummary);
}
