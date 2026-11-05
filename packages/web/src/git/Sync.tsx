// The Git page's title: its line says the checked-out branch against `origin`, "main · 3 to pull · 6
// to push · fetched just now", "main · no remote", "main · pull stopped · fetched just now", or
// "detached at 4f8c2b7"; beside it, under it on the phone, Fetch, Pull, Push, and "Merge into
// main…", each disabled while it cannot run.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { PageTitle } from "../layout/PageTitle.tsx";
import { useNow } from "../useNow.ts";
import { WriteButton } from "../writes/WriteButton.tsx";
import type { GitPageData } from "./data.ts";
import type { GitWrites } from "./useGitWrites.ts";

/** A count and its unit, "1 minute", "3 hours". */
const count = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** How long ago `ms` milliseconds is, in words: "just now", "2 minutes ago", "3 days ago". */
export function ago(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${count(minutes, "minute")} ago`;
  }
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${count(hours, "hour")} ago` : `${count(Math.floor(hours / 24), "day")} ago`;
}

/**
 * The operation a stopped pull or merge is, which the core refuses a pull, a push, and a merge
 * over; nothing for a stash's stop, which refuses none.
 */
export const stoppedOperation = (page: Pick<GitPageData, "stopped">) =>
  page.stopped && page.stopped.kind !== "stash" ? page.stopped.kind : undefined;

/**
 * Whether Pull, Push, and Merge cannot run: an agent works in the checkout, `HEAD` is detached, or
 * a pull or a merge is stopped.
 */
export const isSyncStuck = (
  page: Pick<GitPageData, "agentWorking" | "detached" | "stopped">,
): boolean => page.agentWorking || Boolean(page.detached) || stoppedOperation(page) !== undefined;

/**
 * The title's line, at `now` in milliseconds. While a pull or a merge is stopped, it says so in
 * place of the counts, which compare the branch's ref, not what the stop has replayed so far.
 */
export function syncLine(
  page: Pick<
    GitPageData,
    "ahead" | "behind" | "branch" | "detached" | "fetchedAt" | "hasRemote" | "stopped"
  >,
  now: number,
): string {
  if (page.detached) {
    return `detached at ${page.detached}`;
  }
  const branch = page.branch ?? "";
  if (!page.hasRemote) {
    return `${branch} · no remote`;
  }
  const fetched =
    page.fetchedAt === null || page.fetchedAt === undefined
      ? "never fetched"
      : `fetched ${ago(now - page.fetchedAt * 1000)}`;
  const stopped = stoppedOperation(page);
  const counts = stopped
    ? [`${stopped} stopped`]
    : [
        ...(page.behind > 0 ? [`${page.behind} to pull`] : []),
        ...(page.ahead > 0 ? [`${page.ahead} to push`] : []),
      ];
  return [branch, ...counts, fetched].join(" · ");
}

/** A button's label with its count, "Pull · 3", or alone at 0. */
const counted = (label: string, n: number) => (n > 0 ? `${label} · ${n}` : label);

/**
 * The title, its line, and the sync's buttons: without a remote, no Fetch, Pull, or Push; on a
 * detached `HEAD`, or while a pull or a merge is stopped, Pull, Push, and Merge disabled, the
 * stop's without their counts; while an agent works in the checkout, every one, as the guard refuses a fetch then
 * too (R20). Pull is the main action while there is something to pull, else Push.
 */
export function Sync({
  onMerge,
  page,
  writes,
}: {
  onMerge: () => void;
  page: GitPageData;
  writes: GitWrites;
}) {
  // The line's "fetched 2 minutes ago" grows on its own.
  const now = useNow(30_000);
  const isStuck = isSyncStuck(page);
  // A stop's counts compare the branch's ref, not what the stop replayed: the buttons drop them.
  const isStopped = stoppedOperation(page) !== undefined;
  const behind = isStopped ? 0 : page.behind;
  const ahead = isStopped ? 0 : page.ahead;
  const branch = page.branch ?? "main";
  const buttons = (
    <HStack gap={1} wrap="wrap">
      {page.hasRemote && (
        <>
          <WriteButton
            isDisabled={page.agentWorking}
            label="Fetch"
            onClick={writes.fetch}
            size="sm"
            variant="secondary"
          />
          <WriteButton
            isDisabled={isStuck}
            label={counted("Pull", behind)}
            onClick={writes.pull}
            size="sm"
            variant={behind > 0 ? "primary" : "secondary"}
          />
          <WriteButton
            isDisabled={isStuck}
            label={counted("Push", ahead)}
            onClick={writes.push}
            size="sm"
            variant={behind === 0 && ahead > 0 ? "primary" : "secondary"}
          />
        </>
      )}
      <Button
        isDisabled={isStuck || page.branches.length === 0}
        label={`Merge into ${branch}…`}
        onClick={onMerge}
        size="sm"
        variant="ghost"
      />
    </HStack>
  );
  return (
    // In the list's narrow column, as lazygit's status pane: the buttons under the branch's line.
    <PageTitle aside={buttons} isAsideBelow meta={{ text: syncLine(page, now) }}>
      Git
    </PageTitle>
  );
}
