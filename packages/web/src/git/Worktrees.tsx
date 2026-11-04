// The Git page's worktrees: the main checkout first, then each linked one, its feature's name or
// its folder's, over its path and its state. A merged feature's offers Clean, as `ura clean` does;
// one with no changes, or whose folder is gone, Remove, which keeps its branch. One with changes
// offers neither.
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Pane } from "../layout/Pane.tsx";
import { gitRefusalTitle } from "../writes/labels.ts";
import { RefusedHere } from "../writes/RefusedHere.tsx";
import { WriteButton } from "../writes/WriteButton.tsx";
import type { GitWorktree } from "./data.ts";
import { PlaceError } from "./PlaceError.tsx";
import { Row } from "./Row.tsx";
import { type GitWrites, placeHref } from "./useGitWrites.ts";

/** The key of a worktree's row among the list's rows. */
export const worktreeKey = (path: string) => `w:${path}`;

/** A worktree's state in words. */
const STATES: Readonly<Record<string, string>> = {
  changes: "has changes",
  clean: "no changes",
  locked: "locked",
  merged: "merged",
  missing: "missing",
};

/** What a worktree's row offers: Clean for a merged feature's, Remove for one clean or missing. */
export function offerOf(worktree: GitWorktree): "clean" | "remove" | undefined {
  if (worktree.state === "merged" && worktree.folder) {
    return "clean";
  }
  return worktree.state === "clean" || worktree.state === "missing" ? "remove" : undefined;
}

/** A worktree's line under its name: its path, then its state, "detached" without a branch. */
const lineOf = (worktree: GitWorktree) =>
  `${worktree.path} · ${worktree.branch ? "" : "detached, "}${STATES[worktree.state] ?? worktree.state}`;

/** A worktree's row: its name over its line, its action at its end. */
function Worktree({
  cursor,
  isDisabled,
  onPick,
  worktree,
  writes,
}: {
  cursor: string | undefined;
  isDisabled: boolean;
  onPick: (key: string) => void;
  worktree: GitWorktree;
  writes: GitWrites;
}) {
  const key = worktreeKey(worktree.path);
  const offer = offerOf(worktree);
  return (
    <Row
      end={
        offer && (
          // The row's action is what the list's keys focus on it.
          <span data-row-link="">
            <WriteButton
              isDisabled={isDisabled}
              label={offer === "clean" ? "Clean" : "Remove"}
              onClick={() => (offer === "clean" ? writes.clean(worktree) : writes.remove(worktree))}
              variant="secondary"
            />
          </span>
        )
      }
      isPicked={offer !== undefined && cursor === key}
      onPick={() => onPick(key)}
      rowKey={offer ? key : undefined}
    >
      <VStack gap={0}>
        <Text>{worktree.name}</Text>
        <Text color="secondary" type="supporting">
          {lineOf(worktree)}
        </Text>
      </VStack>
    </Row>
  );
}

/** Every worktree, the main checkout first, with what each one allows. */
export function Worktrees({
  branch,
  cursor,
  isDisabled,
  onPick,
  worktrees,
  writes,
}: {
  branch: string;
  cursor: string | undefined;
  isDisabled: boolean;
  onPick: (key: string) => void;
  worktrees: ReadonlyArray<GitWorktree>;
  writes: GitWrites;
}) {
  if (worktrees.length === 0) {
    return null;
  }
  return (
    <VStack gap={2}>
      <RefusedHere title={gitRefusalTitle} what="" where={{ href: placeHref("worktrees") }} />
      <PlaceError href={placeHref("worktrees")} message={writes.errorAt("worktrees")} />
      <Pane count={worktrees.length + 1} id="worktrees" title="Worktrees">
        <VStack gap={0}>
          <Row>
            <VStack gap={0}>
              <Text>{branch}</Text>
              <Text color="secondary" type="supporting">
                this checkout
              </Text>
            </VStack>
          </Row>
          {worktrees.map((worktree) => (
            <Worktree
              cursor={cursor}
              isDisabled={isDisabled}
              key={worktree.path}
              onPick={onPick}
              worktree={worktree}
              writes={writes}
            />
          ))}
        </VStack>
      </Pane>
    </VStack>
  );
}
