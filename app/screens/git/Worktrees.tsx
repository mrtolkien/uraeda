// The Worktrees pane, lazygit's: every linked worktree with its branch and its state. A merged
// feature's offers Clean, which removes its worktree, its branch, and its line of the priorities;
// one with nothing in it, or whose folder is gone, offers Remove, which keeps its branch. Both ask
// first, since nothing undoes them; one with changes, or locked, offers neither, and says why.
import { signal, View } from "nsh";
import { gitPage } from "./Sync";
import { refusalAt, write } from "./writes";
import type { GitWorktree } from "../../store/protocol";
import { Button, Refusal, Text } from "../../ui/controls";
import { registerKey } from "../../ui/keys/registry";
import { Card, createCursor, Empty, listKeys } from "../../ui/lists";
import { Dialog } from "../../ui/surfaces";
import { tokens } from "../../ui/tokens";
import { PaneScroll, usePane } from "../../ui/layout";

/** What a worktree offers: Clean for a merged feature's, Remove for one with nothing to lose. */
const offerOf = (tree: GitWorktree): "clean" | "remove" | undefined => {
  if (tree.isWorking) return undefined;
  if (tree.state === "merged" && tree.folder !== null) return "clean";
  return tree.state === "clean" || tree.state === "missing" ? "remove" : undefined;
};

/** A worktree's state, in words that name the cause. */
const STATE: Record<
  GitWorktree["state"],
  { label: string; tone: "done" | "caution" | "quiet" | "info" }
> = {
  changes: { label: "Has changes: commit or discard them first", tone: "caution" },
  clean: { label: "Nothing uncommitted", tone: "quiet" },
  locked: { label: "Locked by git", tone: "caution" },
  merged: { label: "Merged: ready to clean", tone: "done" },
  missing: { label: "Its folder is gone", tone: "info" },
};

export function Worktrees(props: { repo: string }) {
  const pane = usePane();
  const page = gitPage(props.repo);
  const trees = () => page()?.worktrees ?? [];
  const at = pane.remember<string | null>("cursor", null);
  const cursor = createCursor(trees, {
    initial: at() ?? undefined,
    onChange: (id) => at.set(id ?? null),
  });
  // The list's keys, as every list's: `j` `k`, `g g` `G`, `Home` `End`, the cursor shown at once.
  listKeys(cursor);
  const asking = signal<GitWorktree | null>(null);
  const where = (tree: GitWorktree) => `${props.repo}/worktree:${tree.path}`;
  const run = (tree: GitWorktree) => {
    asking.set(null);
    if (offerOf(tree) === "clean") {
      void write(
        where(tree),
        "git.clean",
        { folder: tree.folder ?? "", repo: props.repo },
        `Cleaning ${tree.name}`,
      );
    } else {
      void write(
        where(tree),
        "git.removeWorktree",
        { path: tree.path, repo: props.repo },
        `Removing the worktree of ${tree.name}`,
      );
    }
  };
  const selected = () => trees().find((tree) => tree.id === cursor.at());
  registerKey([
    {
      hint: "d",
      hintLabel: "remove",
      keys: "d",
      label: "clean or remove the worktree",
      run: () => {
        const tree = selected();
        if (tree === undefined || offerOf(tree) === undefined || page()?.agentWorking === true)
          return false;
        asking.set(tree);
        return undefined;
      },
    },
  ]);
  return (
    <PaneScroll style={{ flex: 1 }}>
      <View style={{ gap: 10, paddingBottom: 16 }}>
        <If
          when={trees().length > 0}
          else={
            <Empty
              icon="folder-git-2"
              title="No worktrees"
              words="Only the main checkout: a feature started here gets one of its own."
            />
          }
        >
          <Each key={(tree: GitWorktree) => tree.id} of={trees()}>
            {(tree) => (
              <View style={{ gap: 4 }}>
                <Card
                  actions={
                    offerOf(tree()) === undefined
                      ? []
                      : [
                          {
                            icon: offerOf(tree()) === "clean" ? "brush-cleaning" : "trash-2",
                            keys: cursor.at() === tree().id ? "Enter" : undefined,
                            label: offerOf(tree()) === "clean" ? "Clean…" : "Remove…",
                            run: () => asking.set(tree()),
                            variant: "danger",
                          },
                        ]
                  }
                  facts={[
                    { icon: "git-branch", label: tree().branch ?? "no branch" },
                    { icon: "folder", label: tree().path },
                  ]}
                  hue={tree().state === "merged" ? tokens.role.added : undefined}
                  icon="folder-git-2"
                  onPress={() => cursor.set(tree().id)}
                  selected={cursor.holds(tree().id)}
                  state={{
                    label: tree().isWorking ? "An agent works in it" : STATE[tree().state].label,
                    running: tree().isWorking,
                    tone: tree().isWorking ? "live" : STATE[tree().state].tone,
                  }}
                  title={tree().name}
                />
                <If when={refusalAt(where(tree()))}>{(words) => <Refusal words={words()} />}</If>
              </View>
            )}
          </Each>
        </If>
      </View>
      <Dialog
        icon={offerOf(asking() ?? trees()[0]!) === "clean" ? "brush-cleaning" : "trash-2"}
        onClose={() => asking.set(null)}
        open={asking() !== null}
        title={
          asking() !== null && offerOf(asking()!) === "clean"
            ? `Clean ${asking()?.name}?`
            : `Remove the worktree of ${asking()?.name ?? "it"}?`
        }
      >
        <View style={{ gap: 14 }}>
          <Text>
            {asking() !== null && offerOf(asking()!) === "clean"
              ? "Its worktree, its branch, and its line of the priorities go, as ura clean does. Nothing undoes it."
              : "Its folder goes; its branch stays, so it can be checked out again."}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
            <Button label="Keep it" onPress={() => asking.set(null)} />
            <Button
              label={asking() !== null && offerOf(asking()!) === "clean" ? "Clean" : "Remove"}
              onPress={() => {
                const tree = asking();
                if (tree !== null) run(tree);
              }}
              variant="danger"
            />
          </View>
        </View>
      </Dialog>
    </PaneScroll>
  );
}
