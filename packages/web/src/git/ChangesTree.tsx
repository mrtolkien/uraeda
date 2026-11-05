// A group's changes on the Git page: the main checkout's, or a feature's worktree's with a buffer's
// save, each a tree of its changed files with its own commit. A row's box is the checkbox Space
// ticks, staging or unstaging the file, or every file under a folder; a staged file keeps its row.
// A folder's chevron and name fold it, as Enter does; a file's name opens its diff.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode, Ref } from "react";
import type { EditorHandle } from "../fields/editor/Editor.tsx";
import { DiffCount } from "../layout/DiffCount.tsx";
import { Pane } from "../layout/Pane.tsx";
import { useRepoPath } from "../routes.tsx";
import { gitRefusalTitle } from "../writes/labels.ts";
import { RefusedHere } from "../writes/RefusedHere.tsx";
import { gitAddress } from "./address.ts";
import { CommitField } from "./CommitField.tsx";
import type { GitGroup } from "./data.ts";
import { PlaceError } from "./PlaceError.tsx";
import { Row, useRowLines } from "./Row.tsx";
import type { TreeRow } from "./tree.ts";
import type { ListRow } from "./useGitKeys.ts";
import { filesShown, placeHref, type GitWrites } from "./useGitWrites.ts";

const styles = stylex.create({
  // A row's depth, a step each. A custom property: the token lint takes a calc of a number read at
  // run time only there.
  depth: (depth: number) => ({
    "--tree-depth": `calc(${depth} * ${spacingVars["--spacing-5"]})`,
    paddingInlineStart: "var(--tree-depth)",
  }),
  // A file's room where a folder's chevron sits, so the names line up.
  leaf: { flexShrink: 0, width: spacingVars["--spacing-6"] },
  name: { minWidth: 0 },
});

/** The key of a tree's row among the list's rows. */
export const treeKey = (folder: string | null, path: string, isFolder: boolean) =>
  `t:${folder ?? ""}:${path}${isFolder ? "/" : ""}`;

/** A file's change in words, beside its counts: a new or a deleted file. */
const STATE_WORDS: Readonly<Record<string, string>> = { deleted: "deleted", new: "new" };

/** What a row shows at its end: its state for a new or deleted file, and its counts. */
export function RowEnd({ row }: { row: TreeRow }) {
  const word = row.file && STATE_WORDS[row.file.state];
  const binary = row.file && (row.file.added === null || row.file.added === undefined);
  return (
    <>
      {word && (
        <Text color="secondary" type="supporting">
          {word}
        </Text>
      )}
      {binary ? (
        <Text color="secondary" type="supporting">
          binary
        </Text>
      ) : (
        <DiffCount added={row.added} removed={row.removed} type="supporting" />
      )}
    </>
  );
}

/** A row of the tree: a folder's chevron or a file's room, its box, its name, then its end. */
export function TreeLine({
  group,
  isDisabled,
  onFold,
  row,
  writes,
}: {
  group: GitGroup;
  isDisabled: boolean;
  onFold: (path: string) => void;
  row: TreeRow;
  writes: GitWrites;
}) {
  const here = useRepoPath();
  const lines = useRowLines();
  const folder = group.folder ?? undefined;
  return (
    <HStack align="center" gap={1} xstyle={styles.depth(row.depth)}>
      {row.folder ? (
        <Button
          icon={<Icon icon={row.isOpen ? "chevronDown" : "chevronRight"} size="sm" />}
          isIconOnly
          label={row.isOpen ? `Fold ${row.path}` : `Unfold ${row.path}`}
          onClick={() => onFold(row.path)}
          size="sm"
          tooltip={row.isOpen ? "Fold" : "Unfold"}
          variant="ghost"
        />
      ) : (
        // A blank of a chevron's width: Astryx's stacks have no fixed-width spacer.
        <span {...stylex.props(styles.leaf)} />
      )}
      <CheckboxInput
        isDisabled={isDisabled}
        isLabelHidden
        label={row.path}
        onChange={() => void writes.stage(group, row.paths, row.staged !== true)}
        value={row.staged}
      />
      {row.folder ? (
        // The text's own colour: a name reads as a file, not as the accent of a link.
        <Link
          color="primary"
          maxLines={lines}
          onClick={() => onFold(row.path)}
          xstyle={styles.name}
        >
          {row.name}
        </Link>
      ) : (
        <Link
          color="primary"
          href={here(gitAddress({ file: row.path, folder, kind: "file" }))}
          maxLines={lines}
          xstyle={styles.name}
        >
          {row.name}
        </Link>
      )}
    </HStack>
  );
}

/**
 * A group's pane: its refusals above it, its tree, then its message and, under it, its Commit,
 * which commits what is staged. `children` draws the rows, which the page owns for its keys.
 */
export function ChangesGroup({
  children,
  commitRef,
  group,
  isDisabled,
  writes,
}: {
  children: ReactNode;
  commitRef?: Ref<EditorHandle>;
  group: GitGroup;
  isDisabled: boolean;
  writes: GitWrites;
}) {
  const place = { folder: group.folder };
  const isMain = group.folder === null;
  const staged = filesShown(group, writes).filter((file) => file.staged !== "no").length;
  return (
    <VStack gap={2}>
      <RefusedHere
        title={gitRefusalTitle}
        what="the files stay staged."
        where={{ href: placeHref(place) }}
      />
      <PlaceError href={placeHref(place)} message={writes.errorAt(place)} />
      <Pane
        count={group.files.length}
        id={isMain ? "changes" : `changes-${group.folder}`}
        title={isMain ? "Changes" : group.name}
      >
        <VStack gap={3}>
          <VStack gap={0}>{children}</VStack>
          <CommitField
            group={group}
            isDisabled={isDisabled}
            isPrimary={isMain}
            onCommit={() => writes.commit(group)}
            ref={commitRef}
            staged={staged}
          />
        </VStack>
      </Pane>
    </VStack>
  );
}

/** A group's pane, with its rows among the list's `rows`: none without a change. */
export function Group({
  commitRef,
  cursor,
  group,
  isDisabled,
  onFold,
  onPick,
  rows,
  writes,
}: {
  commitRef: (handle: EditorHandle | null) => void;
  cursor: string | undefined;
  group: GitGroup;
  isDisabled: boolean;
  onFold: (path: string) => void;
  onPick: (key: string) => void;
  rows: ReadonlyArray<ListRow>;
  writes: GitWrites;
}) {
  if (group.files.length === 0) {
    return null;
  }
  return (
    <ChangesGroup commitRef={commitRef} group={group} isDisabled={isDisabled} writes={writes}>
      {rows.map(
        (row) =>
          row.kind === "tree" &&
          row.group === group && (
            <Row
              end={<RowEnd row={row.row} />}
              isInline
              isPicked={cursor === row.key}
              key={row.key}
              onPick={() => onPick(row.key)}
              rowKey={row.key}
            >
              <TreeLine
                group={group}
                isDisabled={isDisabled}
                onFold={onFold}
                row={row.row}
                writes={writes}
              />
            </Row>
          ),
      )}
    </ChangesGroup>
  );
}
