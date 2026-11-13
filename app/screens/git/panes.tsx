// The Git page, `/git`, shaped like lazygit: its lists in the side stack, as tabs, Changes (the
// branch, the changed files of every checkout, and the commit), History, and Worktrees; and in the
// main stack the Diff of what the list in view picked, at the room a diff needs. The page opens
// with the focus in Changes, where the work is: `h` and `l` cross to the Diff and back, each list
// has its own keys, and `f` `p` `P` `M` sync from any of them. On a phone, each is a tab.
import { focusPane, definePane, definePlace } from "../../ui/layout";
import { Changes } from "./Changes";
import { Detail } from "./Detail";
import { History } from "./History";
import { gitPage, SyncKeys } from "./Sync";
import { Worktrees } from "./Worktrees";
import { record } from "../../store";

type Args = { repo: string };

export const diff = definePane<Args>({
  icon: "git-compare",
  kind: "git-diff",
  stack: "main",
  title: "Diff",
  view: (props) => (
    <>
      <Detail repo={props.args.repo} width={props.width} />
      <SyncKeys repo={props.args.repo} toChanges={() => focusPane(changes(props.args))} />
    </>
  ),
});

export const changes = definePane<Args>({
  icon: "git-branch",
  kind: "git-changes",
  mark: ({ repo }) => {
    const summary = record("GitSummary", { repo })();
    return { count: summary?.changes, needs: (gitPage(repo)()?.conflicts.length ?? 0) > 0 };
  },
  stack: "side",
  title: "Changes",
  view: (props) => (
    <>
      <Changes
        narrow={props.width === "narrow"}
        onOpen={() => focusPane(diff(props.args))}
        repo={props.args.repo}
      />
      <SyncKeys repo={props.args.repo} />
    </>
  ),
});

export const history = definePane<Args>({
  icon: "history",
  kind: "git-history",
  mark: ({ repo }) => ({ count: gitPage(repo)()?.behind }),
  stack: "side",
  title: "History",
  view: (props) => (
    <>
      <History
        narrow={props.width === "narrow"}
        onOpen={() => focusPane(diff(props.args))}
        repo={props.args.repo}
      />
      <SyncKeys repo={props.args.repo} toChanges={() => focusPane(changes(props.args))} />
    </>
  ),
});

export const worktrees = definePane<Args>({
  icon: "folder-git-2",
  kind: "git-worktrees",
  stack: "side",
  title: "Worktrees",
  view: (props) => (
    <>
      <Worktrees repo={props.args.repo} />
      <SyncKeys repo={props.args.repo} toChanges={() => focusPane(changes(props.args))} />
    </>
  ),
});

definePlace("git", (route) => {
  const args = { repo: route.repo ?? "" };
  return [diff(args), { focus: true, pane: changes(args) }, history(args), worktrees(args)];
});
