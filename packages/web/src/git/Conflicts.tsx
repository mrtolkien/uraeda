// A stopped pull or merge (US4): the banner under the title, "The pull stopped: 1 file conflicts.",
// and the Conflicts section, each conflicted file with its kind in words and its whole sides, named
// by branch, a text file opening in the editor, with Abort and Continue. `m` opens Continue and
// Abort as a menu, at Continue. A stash put back with conflicts reads as its own stop, the stash
// named, without Abort.
import { DropdownMenu, type DropdownMenuTriggerProps } from "@astryxdesign/core/DropdownMenu";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import { useKeys } from "../keys/registry.tsx";
import { plural } from "../labels.ts";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Pane } from "../layout/Pane.tsx";
import { useRepoPath } from "../routes.tsx";
import { Path } from "../session/Path.tsx";
import { WriteButton } from "../writes/WriteButton.tsx";
import { gitAddress } from "./address.ts";
import type { GitPageData } from "./data.ts";
import { Row } from "./Row.tsx";
import {
  type ConflictWrites,
  type GitConflict,
  operationOf,
  type Resolution,
  type Stopped,
  useConflictWrites,
} from "./useConflictWrites.ts";
import type { GitWrites } from "./useGitWrites.ts";

/** The key of a conflict's row among the list's rows. */
export const conflictKey = (path: string) => `x:${path}`;

/** "1 file conflicts.", "2 files conflict.", or that none is left. */
function conflictCount(unresolved: number): string {
  if (unresolved === 0) {
    return "every conflict is resolved.";
  }
  return unresolved === 1 ? "1 file conflicts." : `${plural(unresolved, "file")} conflict.`;
}

/** The banner of a stopped operation, under the page's title. */
function StoppedBanner({ page }: { page: Pick<GitPageData, "branch" | "conflicts" | "stopped"> }) {
  const { stopped } = page;
  if (!stopped) {
    return null;
  }
  const unresolved = page.conflicts.filter((conflict) => !conflict.isResolved).length;
  if (stopped.kind === "stash") {
    return (
      <AnnouncedBanner
        collapsible={false}
        description={`Resolve each file, then Continue, which stages them. ${stopped.stash ?? "The stash"} is kept: drop it once its changes are back.`}
        status="warning"
        title={`The pull's stash could not be put back: ${conflictCount(unresolved)}`}
      />
    );
  }
  const what = operationOf(stopped);
  return (
    <AnnouncedBanner
      collapsible={false}
      description={`Resolve each conflict, then Continue. Abort puts ${page.branch ?? "the branch"} back as it was before the ${what}.`}
      status="warning"
      title={`The ${what} stopped: ${conflictCount(unresolved)}`}
    />
  );
}

/** A side of a conflict as its row offers it: its label and what it writes. */
type Side = { label: string; resolution: Resolution };

/** Keeping a file one side deleted: the other side's. */
const keep = (resolution: Resolution): Side => ({ label: "Keep the file", resolution });

/** What a conflict is, in words, and the whole sides its row offers. */
export function sidesOf(
  conflict: GitConflict,
  stopped: Stopped,
): { kind: string; sides: ReadonlyArray<Side> } {
  const { ours, theirs } = stopped;
  const remove: Side = { label: "Delete the file", resolution: "delete" };
  switch (conflict.kind) {
    case "deleted-ours":
      return { kind: `deleted on ${ours}, changed on ${theirs}`, sides: [keep("theirs"), remove] };
    case "deleted-theirs":
      return { kind: `deleted on ${theirs}, changed on ${ours}`, sides: [keep("ours"), remove] };
    case "both-deleted":
      return { kind: "deleted on both", sides: [remove] };
    case "added-ours":
      return { kind: `added on ${ours} alone`, sides: [keep("ours"), remove] };
    case "added-theirs":
      return { kind: `added on ${theirs} alone`, sides: [keep("theirs"), remove] };
    default: {
      const both = conflict.kind === "both-added" ? "added on both" : "both changed";
      return {
        kind: conflict.isBinary ? `${both}, binary` : both,
        sides: [
          { label: `Use ${ours}`, resolution: "ours" },
          { label: `Use ${theirs}`, resolution: "theirs" },
        ],
      };
    }
  }
}

/** Whether a conflict opens in the editor: a text file both sides have. */
export const isEditable = (conflict: GitConflict) =>
  !conflict.isBinary && (conflict.kind === "both-changed" || conflict.kind === "both-added");

/** A conflicted file's row: its path, a link to the editor for a text file, and its sides. */
function ConflictRow({
  conflict,
  cursor,
  isDisabled,
  onPick,
  stopped,
  writes,
}: {
  conflict: GitConflict;
  cursor: string | undefined;
  isDisabled: boolean;
  onPick: (key: string) => void;
  stopped: Stopped;
  writes: ConflictWrites;
}) {
  const here = useRepoPath();
  const key = conflictKey(conflict.path);
  const { kind, sides } = sidesOf(conflict, stopped);
  const line = conflict.isResolved ? `${kind} · resolved` : kind;
  return (
    <Row
      end={sides.map((side) => (
        <WriteButton
          isDisabled={isDisabled}
          key={side.label}
          label={side.label}
          onClick={() => writes.resolve(conflict.path, side.resolution, side.label)}
          variant="ghost"
        />
      ))}
      isPicked={cursor === key}
      onPick={() => onPick(key)}
      rowKey={key}
    >
      <VStack gap={0}>
        {isEditable(conflict) ? (
          <Link href={here(gitAddress({ kind: "conflict", path: conflict.path }))}>
            <Path path={conflict.path} />
          </Link>
        ) : (
          // The row's action is what the list's keys focus on it, as a worktree's.
          <span data-row-link="">
            <Path path={conflict.path} />
          </span>
        )}
        <Text color="secondary" type="supporting">
          {line}
        </Text>
      </VStack>
    </Row>
  );
}

/** Abort, then Continue, which `m` opens as a menu at Continue. */
function StopActions({
  isDisabled,
  page,
  writes,
}: {
  isDisabled: boolean;
  page: Pick<GitPageData, "conflicts" | "stopped">;
  writes: ConflictWrites;
}) {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const canAbort = page.stopped?.kind !== "stash";
  const canContinue = !isDisabled && page.conflicts.every((conflict) => conflict.isResolved);
  useKeys([{ hint: "m", keys: "m", label: "continue or abort", run: () => setMenuOpen(true) }]);
  return (
    <HStack gap={1}>
      {canAbort && (
        <WriteButton
          isDisabled={isDisabled}
          label="Abort"
          onClick={writes.abort}
          variant="secondary"
        />
      )}
      <DropdownMenu
        isMenuOpen={isMenuOpen}
        items={[
          {
            isDisabled: !canContinue,
            label: "Continue",
            onClick: () => void writes.proceed(),
          },
          ...(canAbort
            ? [{ isDisabled, label: "Abort…", onClick: () => void writes.abort() }]
            : []),
        ]}
        onOpenChange={setMenuOpen}
        presentation="popover"
        renderTrigger={(trigger: DropdownMenuTriggerProps) => (
          // The menu's anchor alone, so `m` opens it at Continue: Continue's press continues.
          <span id={trigger.id} ref={trigger.ref}>
            <WriteButton
              isDisabled={!canContinue}
              label="Continue"
              onClick={writes.proceed}
              variant="primary"
            />
          </span>
        )}
      />
    </HStack>
  );
}

/**
 * A stopped operation's banner and its conflicted files, with Abort and Continue, refused while a
 * chat's agent works in the checkout.
 */
export function Conflicts({
  cursor,
  onPick,
  page,
  writes,
}: {
  cursor: string | undefined;
  onPick: (key: string) => void;
  page: Pick<GitPageData, "agentWorking" | "branch" | "conflicts" | "stopped">;
  writes: GitWrites;
}) {
  const stopWrites = useConflictWrites(page, writes);
  const { stopped } = page;
  if (!stopped) {
    return null;
  }
  const isDisabled = page.agentWorking;
  return (
    <>
      <StoppedBanner page={page} />
      <Pane
        actions={<StopActions isDisabled={isDisabled} page={page} writes={stopWrites} />}
        count={page.conflicts.length}
        id="conflicts"
        title="Conflicts"
        tone="attention"
      >
        <VStack gap={0}>
          {page.conflicts.map((conflict) => (
            <ConflictRow
              conflict={conflict}
              cursor={cursor}
              isDisabled={isDisabled}
              key={conflict.path}
              onPick={onPick}
              stopped={stopped}
              writes={stopWrites}
            />
          ))}
        </VStack>
      </Pane>
    </>
  );
}
