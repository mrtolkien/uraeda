// The Changes pane, lazygit's files panel: the branch and its sync, then one tree of the conflicts
// and of each checkout's changed files under their folders, and the commit of the checkout the
// cursor is in. Moving the cursor onto a file shows its diff in the Diff pane; `s` stages or
// unstages it, or every file under a folder or a checkout, `a` every file of the checkout; `d`
// discards a file's changes, after asking, since nothing undoes it; `c` goes to the message, which
// `Ctrl+Enter` or Commit commits. A conflict takes `o` or `t`, a side whole, after asking too: the
// other side's changes to the file go.
import { computed, effect, signal, untracked, View } from "nsh";
import { CommitBox } from "./CommitBox";
import { gitPage, Sync } from "./Sync";
import { pick, picked } from "./picked";
import { CONFLICTS, folderOf, rowOf, treeOf } from "./tree";
import { dismiss, refusalAt, write } from "./writes";
import { call, parseRoute, record } from "../../store";
import type { GitGroup, GitPage } from "../../store/protocol";
import { Button, Confirm, lastAsked, Refusal } from "../../ui/controls";
import { registerKey } from "../../ui/keys/registry";
import { createCursor, Empty, Tree, treeRows } from "../../ui/lists";
import { PaneScroll, usePane } from "../../ui/layout";

/** The files of a group under a tree's row: a file, a folder's, or the whole group's. */
function pathsUnder(group: GitGroup, row: ReturnType<typeof rowOf>): Array<string> {
  if (row.kind === "file") return [row.path];
  if (row.kind === "folder") {
    return group.files.filter((file) => file.path.startsWith(`${row.path}/`)).map((f) => f.path);
  }
  return group.files.map((file) => file.path);
}

/** The group a row is in: the main checkout's for the conflicts. */
function groupOf(page: GitPage, id: string | undefined): GitGroup | undefined {
  const row = id === undefined ? undefined : rowOf(id);
  const wanted = row === undefined || !("group" in row) ? "." : row.group;
  return page.groups.find((group) => group.id === wanted) ?? page.groups[0];
}

/** Whether a group's writes are refused: an agent works in its checkout. */
const held = (page: GitPage, group: GitGroup) =>
  group.folder === null ? page.agentWorking : group.isWorking;

export function Changes(props: { narrow: boolean; onOpen: () => void; repo: string }) {
  const pane = usePane();
  const page = gitPage(props.repo);
  const folded = pane.remember<string>("folded", "[]");
  const foldedSet = computed(() => new Set(JSON.parse(folded()) as Array<string>));
  const nodes = computed(() => {
    const now = page();
    return now === undefined || now === null ? [] : treeOf(now);
  });
  const rows = computed(() => treeRows(nodes(), foldedSet()));
  const at = pane.remember<string | null>("cursor", null);
  const cursor = createCursor(rows, {
    initial: at() ?? undefined,
    onChange: (id) => at.set(id ?? null),
  });
  // The page fetches as it opens, in the background: its failure is the page's `fetchFailure`.
  void call("git.fetch", { quiet: true, repo: props.repo, write: null }).catch(() => undefined);
  const discarding = signal<{ group: GitGroup; path: string; isNew: boolean } | null>(null);

  // The diff follows the cursor onto a file or a conflict, on a window wide enough to show both.
  effect(() => {
    const id = cursor.at();
    if (id === undefined) return;
    const row = rowOf(id);
    if (row.kind === "file")
      untracked(() => pick({ folder: folderOf(row.group), kind: "file", path: row.path }));
    if (row.kind === "conflict") untracked(() => pick({ kind: "conflict", path: row.path }));
  });
  // The page opens on the file the Diff shows, or the first file.
  effect(() => {
    if (untracked(cursor.at) !== undefined || rows().length === 0) return;
    const first = rows().find((row) => row.id.startsWith("f:") || row.id.startsWith("c:"));
    untracked(() => cursor.set(first?.id ?? rows()[0]?.id));
  });

  const now = () => page() ?? undefined;
  // The refused writes made on this page, which the queue keeps until dismissed: a card says them
  // on every other page, and this page under its commit.
  const queue = record("WriteQueue", { repo: props.repo });
  const dismissRefused = (where: string) => {
    dismiss(where);
    const made = (queue()?.writes ?? []).filter(
      (one) => one.state === "refused" && one.href !== "" && parseRoute(one.href).page === "git",
    );
    for (const one of made) {
      void call("writes.dismiss", { id: one.id, repo: props.repo }).catch(() => undefined);
    }
  };
  const group = () => {
    const shown = now();
    return shown === undefined ? undefined : groupOf(shown, cursor.at());
  };
  const groupAt = (folder: string | null) => `${props.repo}/commit:${folder ?? "."}`;

  /** Stages, or unstages when all of it is staged, what the row holds. */
  const toggle = (id: string) => {
    const shown = now();
    const row = rowOf(id);
    if (shown === undefined || row.kind === "conflicts" || row.kind === "conflict") return false;
    const target = groupOf(shown, id);
    if (target === undefined || held(shown, target)) return false;
    const paths = pathsUnder(target, row);
    if (paths.length === 0) return false;
    const all = target.files.filter((file) => paths.includes(file.path));
    const unstage = all.every((file) => file.staged === "yes");
    const what = paths.length === 1 ? paths[0] : `${paths.length} files`;
    const input = { folder: target.folder, paths, repo: props.repo };
    void write(
      groupAt(target.folder),
      unstage ? "git.unstage" : "git.stage",
      input,
      `${unstage ? "Unstaging" : "Staging"} ${what} in ${target.name}`,
    );
    return undefined;
  };
  // Taking a side whole drops the other's changes to the file: asked first.
  const taking = signal<{ path: string; resolution: "ours" | "theirs" } | null>(null);
  const taken = lastAsked(taking);
  const resolve = (resolution: "ours" | "theirs") => {
    const id = cursor.at();
    const row = id === undefined ? undefined : rowOf(id);
    if (row?.kind !== "conflict") return false;
    taking.set({ path: row.path, resolution });
    return undefined;
  };
  const take = () => {
    const what = untracked(taking);
    if (what === null) return;
    void write(
      `${props.repo}/stopped`,
      "git.resolve",
      { path: what.path, repo: props.repo, resolution: what.resolution },
      `Taking ${what.resolution === "ours" ? "ours" : "theirs"} for ${what.path}`,
    );
  };
  /** The branch a side is, and the other's, as the stopped pull or merge names them. */
  const sideOf = (resolution: "ours" | "theirs") => {
    const sides = now()?.stopped;
    const [ours, theirs] = [sides?.ours ?? "ours", sides?.theirs ?? "theirs"];
    return resolution === "ours" ? { other: theirs, side: ours } : { other: ours, side: theirs };
  };
  const askDiscard = () => {
    const shown = now();
    const id = cursor.at();
    const row = id === undefined ? undefined : rowOf(id);
    if (shown === undefined || row?.kind !== "file") return false;
    const target = groupOf(shown, id);
    const file = target?.files.find((one) => one.path === row.path);
    if (target === undefined || file === undefined || held(shown, target)) return false;
    discarding.set({ group: target, isNew: file.state === "new", path: file.path });
    return undefined;
  };
  const discarded = lastAsked(discarding);
  const discard = () => {
    const what = untracked(discarding);
    if (what === null) return;
    const input = { folder: what.group.folder, path: what.path, repo: props.repo };
    void write(groupAt(what.group.folder), "git.discard", input, `Discarding ${what.path}`);
  };

  const onFile = () => {
    const id = cursor.at();
    return id !== undefined && rowOf(id).kind === "file";
  };
  const onConflict = () => {
    const id = cursor.at();
    return id !== undefined && rowOf(id).kind === "conflict";
  };
  const stoppedSides = () => now()?.stopped;
  registerKey([
    {
      hint: "s",
      hintLabel: "stage",
      keys: "s",
      label: "stage or unstage",
      run: () => {
        const id = cursor.at();
        return id === undefined ? false : toggle(id);
      },
      when: () => cursor.at() !== undefined && !onConflict() && cursor.at() !== CONFLICTS,
    },
    {
      hint: "a",
      hintLabel: "all",
      keys: "a",
      label: "stage or unstage every file of the checkout",
      run: () => {
        const target = group();
        return target === undefined ? false : toggle(`g:${target.id}`);
      },
      when: () => (group()?.files.length ?? 0) > 0,
    },
    {
      hint: "d",
      hintLabel: "discard",
      keys: "d",
      label: "discard the file's changes",
      run: askDiscard,
      when: onFile,
    },
    {
      hint: "o",
      hintLabel: "ours",
      keys: "o",
      label: "take ours for the conflict",
      run: () => resolve("ours"),
      when: () => onConflict() && stoppedSides() !== null,
    },
    {
      hint: "t",
      hintLabel: "theirs",
      keys: "t",
      label: "take theirs for the conflict",
      run: () => resolve("theirs"),
      when: () => onConflict() && stoppedSides() !== null,
    },
  ]);

  return (
    <PaneScroll style={{ flex: 1 }}>
      <View style={{ gap: 14, paddingBottom: 16 }}>
        <Sync narrow={props.narrow} repo={props.repo} />
        <View>
          <Tree
            cursor={cursor}
            empty={
              <Empty
                icon="check"
                title="Nothing to commit"
                words="The checkout matches its last commit, and no feature's worktree waits."
              />
            }
            folded={foldedSet()}
            onFold={(id, fold) => {
              const next = new Set(foldedSet());
              if (fold) next.add(id);
              else next.delete(id);
              folded.set(JSON.stringify([...next]));
            }}
            onMark={(id) => void toggle(id)}
            onOpen={(id) => {
              const row = rowOf(id);
              if (row.kind === "file" || row.kind === "conflict") props.onOpen();
            }}
            testID="git-changes"
          />
        </View>
        {/* Keyed by the group, so each keeps its own message as the cursor crosses them. */}
        <Each key={(shown: GitGroup) => shown.id} of={group() === undefined ? [] : [group()!]}>
          {(shown) => (
            <View style={{ gap: 6 }}>
              <If when={refusalAt(groupAt(shown().folder))}>
                {(words) => (
                  <View style={{ alignItems: "flex-start", gap: 6 }}>
                    <Refusal testID="git-group-refusal" words={words()} />
                    {/* Its way out, which its words name: the card elsewhere has it too. */}
                    <Button
                      label="Dismiss"
                      onPress={() => dismissRefused(groupAt(shown().folder))}
                    />
                  </View>
                )}
              </If>
              <CommitBox
                group={shown()}
                held={now() !== undefined && held(now()!, shown())}
                repo={props.repo}
                where={groupAt(shown().folder)}
              />
            </View>
          )}
        </Each>
      </View>
      <Confirm
        danger
        icon="trash-2"
        keep="Keep them"
        keys="d"
        label="Discard the changes"
        onClose={() => discarding.set(null)}
        onConfirm={discard}
        open={discarding() !== null}
        title={`Discard the changes to ${discarded()?.path ?? "the file"}?`}
        words={
          discarded()?.isNew === true
            ? "The file is new: it is deleted. Nothing can bring it back."
            : "The file goes back to its last commit. Nothing can bring the changes back."
        }
      />
      <Confirm
        danger
        keep="Keep the conflict"
        keys={taken()?.resolution === "theirs" ? "t" : "o"}
        label={`Take ${sideOf(taken()?.resolution ?? "ours").side}`}
        onClose={() => taking.set(null)}
        onConfirm={take}
        open={taking() !== null}
        title={`Take ${sideOf(taken()?.resolution ?? "ours").side} for ${taken()?.path ?? "the file"}?`}
        words={`The file becomes ${sideOf(taken()?.resolution ?? "ours").side}'s version, whole: what ${sideOf(taken()?.resolution ?? "ours").other} changed in it is dropped. Aborting the ${now()?.stopped?.kind ?? "merge"} is the only way back.`}
      />
    </PaneScroll>
  );
}

/** Whether the picked row is a file of the page: the Diff pane says when it no longer is. */
export function isListed(page: GitPage): boolean {
  const shown = picked();
  if (shown?.kind === "file") {
    const group = page.groups.find((one) => (one.folder ?? null) === shown.folder);
    return group?.files.some((file) => file.path === shown.path) === true;
  }
  if (shown?.kind === "conflict") return page.conflicts.some((one) => one.path === shown.path);
  return true;
}
