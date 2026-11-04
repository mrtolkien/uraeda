// The Git page (`specs/2026-11-04-basic-git/spec.md`), for the main checkout: its title's line and
// sync, the banners of what holds its writes back, each group's changes as a tree with its commit,
// the history, and the worktrees, with the picked row's diff or commit beside them on wide screens,
// a page of its own on the phone, the picked row in the address. It fetches as it opens, in the
// background. Every write is refused while an agent works in its checkout: its buttons are
// disabled, and the page says why.
import { VStack } from "@astryxdesign/core/VStack";
import { Suspense, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { EditorHandle } from "../fields/editor/Editor.tsx";
import { readUnsaved, unsavedKey } from "../fields/unsaved.ts";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Page } from "../layout/Page.tsx";
import { Panes } from "../layout/Panes.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import {
  navigateHere,
  redirect,
  useRepoPath,
  useRepositoryPath,
  useRestoreScroll,
  useSearch,
} from "../routes.tsx";
import { gitRefusalTitle } from "../writes/labels.ts";
import { RefusedHere } from "../writes/RefusedHere.tsx";
import { WriteButton } from "../writes/WriteButton.tsx";
import { gitAddress, type Picked, pickedOf } from "./address.ts";
import { ChangesGroup, RowEnd, TreeLine, treeKey } from "./ChangesTree.tsx";
import { type GitGroup, type GitPageData, GitPageView, useGitPage } from "./data.ts";
import { Detail } from "./Diff.tsx";
import { History, historyKey, useMoreHistory } from "./History.tsx";
import { MergePicker } from "./MergePicker.tsx";
import { PlaceError } from "./PlaceError.tsx";
import { Row } from "./Row.tsx";
import { Sync } from "./Sync.tsx";
import { buildTree, type FileChange } from "./tree.ts";
import { type GitActions, type ListRow, pickOf, useGitKeys } from "./useGitKeys.ts";
import {
  type GitWrites,
  messageField,
  placeHref,
  stagingKey,
  useGitWrites,
} from "./useGitWrites.ts";
import { offerOf, Worktrees, worktreeKey } from "./Worktrees.tsx";

/** A group's files, each box as its staging write left it while that write answers. */
function filesShown(group: GitGroup, writes: GitWrites): ReadonlyArray<FileChange> {
  return group.files.map((file) => {
    const pending = writes.staging.get(stagingKey(group.folder, file.path));
    return pending === undefined ? file : { ...file, staged: pending ? "yes" : "no" };
  });
}

/** The folded folders of each group, by `treeKey`. */
type Folded = ReadonlySet<string>;

/** The rows the list's keys move over, in the page's order. */
function rowsOf(
  page: GitPageData,
  commits: ReadonlyArray<GitPageData["history"][number]>,
  folded: Folded,
  writes: GitWrites,
): ReadonlyArray<ListRow> {
  const trees = page.groups.flatMap((group) => {
    const shut = new Set(
      [...folded].flatMap((key) => {
        const prefix = treeKey(group.folder, "", false);
        return key.startsWith(prefix) ? [key.slice(prefix.length, -1)] : [];
      }),
    );
    return buildTree(filesShown(group, writes), shut).map((row): ListRow => ({
      group,
      key: treeKey(group.folder, row.path, row.folder),
      kind: "tree",
      row,
    }));
  });
  return [
    ...trees,
    ...commits.map((commit): ListRow => ({ commit, key: historyKey(commit.id), kind: "commit" })),
    ...page.worktrees
      .filter((worktree) => offerOf(worktree) !== undefined)
      .map((worktree): ListRow => ({
        key: worktreeKey(worktree.path),
        kind: "worktree",
        worktree,
      })),
  ];
}

/** The key of the row `picked` names, among the list's rows. */
function keyOfPicked(picked: Picked | undefined): string | undefined {
  if (picked?.kind === "file") {
    return treeKey(picked.folder ?? null, picked.file, false);
  }
  return picked?.kind === "commit" ? historyKey(picked.commit) : undefined;
}

/** Whether a group's writes are refused: a chat's agent in the main checkout, or its feature's. */
const refusedIn = (page: GitPageData, group: GitGroup) =>
  group.folder === null ? page.agentWorking : group.isWorking;

/** The banners under the title: an agent at work, and the last background fetch's failure. */
function Banners({ page, writes }: { page: GitPageData; writes: GitWrites }) {
  return (
    <>
      <RefusedHere title={gitRefusalTitle} what="" where={{ href: placeHref("sync") }} />
      <PlaceError href={placeHref("sync")} message={writes.errorAt("sync")} />
      {page.agentWorking && (
        <AnnouncedBanner
          collapsible={false}
          description="Pull, push, merge, staging, and commits come back once its turn ends."
          status="info"
          title="An agent works in this checkout."
        />
      )}
      {page.fetchFailure && (
        <AnnouncedBanner
          collapsible={false}
          description={page.fetchFailure}
          status="warning"
          title="The last fetch failed."
        />
      )}
    </>
  );
}

/** The page's actions, as its keys and its buttons run them. */
function useActions(
  page: GitPageData | null,
  writes: GitWrites,
  narrow: boolean,
  openMerge: () => void,
  commitField: (group: GitGroup) => EditorHandle | null | undefined,
  setFolded: (change: (folded: Folded) => Folded) => void,
): GitActions {
  const here = useRepoPath();
  const repo = useRepositoryPath();
  const writable = (group: GitGroup) => page !== null && !refusedIn(page, group);
  const stuck = page === null || page.agentWorking || Boolean(page.detached);
  return {
    commit: (group) => {
      if (!writable(group)) {
        return;
      }
      // With no message typed yet, `c` goes to the message first.
      if (!readUnsaved(unsavedKey(repo, messageField(group.folder)))?.text.trim()) {
        commitField(group)?.focus();
        return;
      }
      void writes.commit(group);
    },
    discard: (row) => {
      if (row.kind === "tree" && !row.row.folder && writable(row.group)) {
        void writes.discard(row.group, row.row.path, row.row.file?.state === "new");
        return true;
      }
      if (row.kind === "worktree" && offerOf(row.worktree) === "remove" && !page?.agentWorking) {
        void writes.remove(row.worktree);
        return true;
      }
      return false;
    },
    fetch: () => void (page?.hasRemote && writes.fetch()),
    fold: (group, path) => {
      const key = treeKey(group.folder, path, true);
      setFolded((folded) => {
        const next = new Set(folded);
        if (!next.delete(key)) {
          next.add(key);
        }
        return next;
      });
    },
    follow: (picked) => {
      if (!narrow) {
        redirect(here(gitAddress(picked)));
      }
    },
    merge: () => {
      if (!stuck && page.branches.length > 0) {
        openMerge();
      }
    },
    open: (picked) => navigateHere(gitAddress(picked)),
    pull: () => void (page?.hasRemote && !stuck && writes.pull()),
    push: () => void (page?.hasRemote && !stuck && writes.push()),
    stageAll: (group) => {
      if (writable(group) && group.files.length > 0) {
        const all = group.files.every((file) => file.staged === "yes");
        void writes.stage(
          group,
          group.files.map((file) => file.path),
          !all,
        );
      }
    },
  };
}

/** The Git page, at `/git`. */
export function GitPage() {
  const fate = useFateClient();
  const page = useGitPage();
  const narrow = isNarrow(useWidthClass());
  const picked = pickedOf(useSearch());
  const writes = useGitWrites();
  const [folded, setFolded] = useState<Folded>(new Set());
  const [cursor, setCursor] = useState<string>();
  const [isMerging, setMerging] = useState(false);
  const commitFields = useRef(new Map<string | null, EditorHandle | null>());
  const history = useMoreHistory(page ?? EMPTY);
  useRestoreScroll(page !== null);
  // The page fetches as it opens, outside the toast: its failure is the fetcher's to keep.
  useEffect(() => {
    void fate.mutations.git.fetch({ input: { quiet: true }, view: GitPageView }).catch(() => {});
  }, [fate]);
  const actions = useActions(
    page,
    writes,
    narrow,
    () => setMerging(true),
    (group) => commitFields.current.get(group.folder),
    setFolded,
  );
  const rows = page ? rowsOf(page, history.commits, folded, writes) : [];
  const shown = cursor ?? keyOfPicked(picked) ?? rows[0]?.key;
  const listRef = useGitKeys({ actions, cursor: shown, main: page?.groups[0], rows, setCursor });
  if (!page) {
    return null;
  }
  // Nothing in the address: wide screens show the selected row's, or the first row's that has one,
  // so the detail stays while the selection is on a folder; the phone shows the sections.
  const detailOf =
    picked ??
    (narrow
      ? undefined
      : (pickOf(rows.find((row) => row.key === shown)) ??
        rows.map(pickOf).find((one) => one !== undefined)));
  const branch = page.branch ?? page.detached ?? "main";
  return (
    <Page kind="panes">
      <Panes
        columns="minmax(0, 1fr) minmax(0, 1fr)"
        detail={
          detailOf && (
            <PickedDetail isNarrow={narrow} page={page} picked={detailOf} writes={writes} />
          )
        }
        detailKey={detailOf && gitAddress(detailOf)}
        list={
          <div ref={listRef}>
            <VStack gap={4}>
              <Sync onMerge={() => setMerging(true)} page={page} writes={writes} />
              <Banners page={page} writes={writes} />
              {/* Task 10: the stopped pull's or merge's banner, and the Conflicts section. */}
              {page.groups.map((group) => (
                <Group
                  commitRef={(handle) => {
                    commitFields.current.set(group.folder, handle);
                  }}
                  cursor={shown}
                  group={group}
                  isDisabled={refusedIn(page, group)}
                  key={group.folder ?? ""}
                  onFold={(path) => actions.fold(group, path)}
                  onPick={setCursor}
                  rows={rows}
                  writes={writes}
                />
              ))}
              <History
                commits={history.commits}
                cursor={shown}
                hasMore={history.hasMore}
                onPick={setCursor}
                onShowMore={() => void history.showMore()}
              />
              <Worktrees
                branch={branch}
                cursor={shown}
                isDisabled={page.agentWorking}
                onPick={setCursor}
                worktrees={page.worktrees}
                writes={writes}
              />
            </VStack>
          </div>
        }
      />
      <MergePicker
        branches={page.branches}
        into={branch}
        isOpen={isMerging}
        onClose={() => setMerging(false)}
        onPick={(picked) => void writes.merge(picked)}
      />
    </Page>
  );
}

/** A page's record before it is read: nothing. */
const EMPTY: GitPageData = {
  agentWorking: false,
  ahead: 0,
  behind: 0,
  branch: null,
  branches: [],
  conflicts: [],
  detached: null,
  fetchedAt: null,
  groups: [],
  hasMoreHistory: false,
  hasRemote: false,
  history: [],
  stopped: null,
  worktrees: [],
};

/** The changed file a picked file names, and its group. */
function fileOf(page: GitPageData, picked: Extract<Picked, { kind: "file" }>) {
  const group = page.groups.find((one) => one.folder === (picked.folder ?? null));
  const file = group?.files.find((one) => one.path === picked.file);
  return group && file ? { file, group } : undefined;
}

/** The picked row's detail, a changed file's with its Stage. */
function PickedDetail({
  isNarrow,
  page,
  picked,
  writes,
}: {
  isNarrow: boolean;
  page: GitPageData;
  picked: Picked;
  writes: GitWrites;
}) {
  const target = picked.kind === "file" ? fileOf(page, picked) : undefined;
  return (
    <Suspense fallback={null}>
      <Detail
        isNarrow={isNarrow}
        picked={picked}
        stage={target && <StageButton page={page} target={target} writes={writes} />}
      />
    </Suspense>
  );
}

/** The diff's Stage, or Unstage once the file is staged whole. */
function StageButton({
  page,
  target,
  writes,
}: {
  page: GitPageData;
  target: { file: FileChange; group: GitGroup };
  writes: GitWrites;
}) {
  const staged = target.file.staged === "yes";
  return (
    <WriteButton
      isDisabled={refusedIn(page, target.group)}
      label={staged ? "Unstage" : "Stage"}
      onClick={() => writes.stage(target.group, [target.file.path], !staged)}
      variant="ghost"
    />
  );
}

/** A group's pane, its rows among the list's. */
function Group({
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
