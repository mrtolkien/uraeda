// The Git page's title: its line says the checked-out branch against `origin`, "main · 3 to pull · 6
// to push · fetched just now", "main · no remote", or "detached at 4f8c2b7"; beside it, Fetch, Pull,
// Push, and "Merge into main…", each disabled while it cannot run.
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

/** The title's line, at `now` in milliseconds. */
export function syncLine(
  page: Pick<GitPageData, "ahead" | "behind" | "branch" | "detached" | "fetchedAt" | "hasRemote">,
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
  return [
    branch,
    ...(page.behind > 0 ? [`${page.behind} to pull`] : []),
    ...(page.ahead > 0 ? [`${page.ahead} to push`] : []),
    fetched,
  ].join(" · ");
}

/** A button's label with its count, "Pull · 3", or alone at 0. */
const counted = (label: string, n: number) => (n > 0 ? `${label} · ${n}` : label);

/**
 * The title, its line, and the sync's buttons: without a remote, no Fetch, Pull, or Push; on a
 * detached `HEAD`, Pull, Push, and Merge disabled; while an agent works in the checkout, every one
 * but Fetch. Pull is the main action while there is something to pull, else Push.
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
  const isStuck = page.agentWorking || Boolean(page.detached);
  const branch = page.branch ?? "main";
  return (
    <PageTitle
      aside={
        <HStack gap={1} wrap="wrap">
          {page.hasRemote && (
            <>
              <WriteButton label="Fetch" onClick={writes.fetch} variant="secondary" />
              <WriteButton
                isDisabled={isStuck}
                label={counted("Pull", page.behind)}
                onClick={writes.pull}
                variant={page.behind > 0 ? "primary" : "secondary"}
              />
              <WriteButton
                isDisabled={isStuck}
                label={counted("Push", page.ahead)}
                onClick={writes.push}
                variant={page.behind === 0 && page.ahead > 0 ? "primary" : "secondary"}
              />
            </>
          )}
          <Button
            isDisabled={isStuck || page.branches.length === 0}
            label={`Merge into ${branch}…`}
            onClick={onMerge}
            variant="ghost"
          />
        </HStack>
      }
      meta={{ text: syncLine(page, now) }}
    >
      Git
    </PageTitle>
  );
}
