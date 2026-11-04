// The Git page's history: the checked-out branch's commits, newest first, those `origin` has that
// it lacks marked ↓ until pulled, those it has that `origin` lacks ↑. Each opens its files.
// "Show more" reads the next page after the last commit shown; when the history lost that commit, it
// reads the first page again.
import { Button } from "@astryxdesign/core/Button";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import { useFateClient } from "react-fate";
import { Pane } from "../layout/Pane.tsx";
import { useRepoPath } from "../routes.tsx";
import { useNow } from "../useNow.ts";
import { gitAddress } from "./address.ts";
import {
  GIT_PAGE_REQUEST,
  type GitCommitRow,
  GitHistoryPageView,
  type GitPageData,
} from "./data.ts";
import { Row } from "./Row.tsx";

/** The key of a commit's row among the list's rows. */
export const historyKey = (id: string) => `h:${id}`;

/** A commit's mark: ↓ to pull, ↑ to push. */
const MARKS: Readonly<Record<string, string>> = { pull: "↓", push: "↑" };

/** How old a commit is, short: "5 min", "3 h", "2 d", "4 w". */
export function age(ms: number): string {
  const minutes = Math.max(Math.floor(ms / 60_000), 0);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} h`;
  }
  const days = Math.floor(hours / 24);
  return days < 14 ? `${days} d` : `${Math.floor(days / 7)} w`;
}

/**
 * The commits past the view's first page, read by "Show more", forgotten once the first page
 * changes, as after a pull.
 */
export function useMoreHistory(page: GitPageData) {
  const fate = useFateClient();
  const last = page.history.at(-1)?.id;
  const [more, setMore] = useState<{
    after: string | undefined;
    commits: ReadonlyArray<GitCommitRow>;
    hasMore: boolean;
  }>({ after: last, commits: [], hasMore: page.hasMoreHistory });
  const current =
    more.after === last ? more : { after: last, commits: [], hasMore: page.hasMoreHistory };
  const commits = [...page.history, ...current.commits];
  /** The page of the history after the commit `from`, none when the server refused it. */
  const readPage = async (from: string) => {
    const { gitHistoryPage } = await fate.request(
      { gitHistoryPage: { id: from, view: GitHistoryPageView } },
      { mode: "network-only" },
    );
    if (!gitHistoryPage) {
      return undefined;
    }
    const { data } = await fate.readView(GitHistoryPageView, gitHistoryPage);
    return data as unknown as { commits: ReadonlyArray<GitCommitRow>; hasMore: boolean };
  };
  const showMore = async () => {
    const from = commits.at(-1)?.id;
    if (from === undefined) {
      return;
    }
    const read = await readPage(from).catch(() => undefined);
    if (read === undefined) {
      // The history no longer holds the last commit shown, as after a rebase (R23): it starts over
      // from its first page, read again.
      setMore({ after: undefined, commits: [], hasMore: false });
      await fate.request(GIT_PAGE_REQUEST, { mode: "network-only" }).catch(() => {});
      return;
    }
    setMore({ after: last, commits: [...current.commits, ...read.commits], hasMore: read.hasMore });
  };
  return { commits, hasMore: current.hasMore, showMore };
}

export function History({
  commits,
  cursor,
  hasMore,
  onPick,
  onShowMore,
}: {
  commits: ReadonlyArray<GitCommitRow>;
  cursor: string | undefined;
  hasMore: boolean;
  onPick: (key: string) => void;
  onShowMore: () => void;
}) {
  const here = useRepoPath();
  const now = useNow(60_000);
  if (commits.length === 0) {
    return null;
  }
  return (
    <Pane title="History">
      <VStack gap={0}>
        {commits.map((commit) => {
          const key = historyKey(commit.id);
          const mark = MARKS[commit.mark];
          return (
            <Row
              end={
                <Text color="secondary" hasTabularNumbers type="supporting">
                  {mark ? `${mark} ` : ""}
                  {commit.short} · {age(now - commit.authored * 1000)}
                </Text>
              }
              isPicked={cursor === key}
              key={commit.id}
              onPick={() => onPick(key)}
              rowKey={key}
            >
              <Link href={here(gitAddress({ commit: commit.id, kind: "commit" }))}>
                {commit.subject}
              </Link>
            </Row>
          );
        })}
        {hasMore && <Button label="Show more" onClick={onShowMore} variant="ghost" />}
      </VStack>
    </Pane>
  );
}
