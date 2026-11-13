// Home, the first page of a day: what needs the human and what runs, in the main stack, and what
// comes next, the inbox, and the agents' usage, in the side stack. Both stacks show all their
// panes at once, a page read at a glance; on a phone, one pane at a time, the bar at the foot
// switching. The extensions' panes, the inbox's and Priorities now among them, come from the one list
// of the extensions on in the repository (`../extension`), each in its column's stack, before Usage.
import { InProgress, NeedsYou } from "./core";
import { askForNote, InboxWidget, NowWidget, UsageWidget } from "./widgets";
import { homePanesIn } from "../extension";
import { navigate, record } from "../../store";
import { registerKey } from "../../ui/keys/registry";
import { definePane, definePlace, focusPane, PaneScroll } from "../../ui/layout";

/** Each pane of Home shows the repository of the address. */
type Repo = { repo: string };

/**
 * `a`, a note in the inbox, from whichever pane of Home has the focus: the thing done most on Home
 * is one key away, wherever the focus landed. Home's inbox pane takes it, its field focused; with
 * the inbox's pane off, the inbox's page does.
 */
function NoteKey(props: Repo) {
  registerKey({
    hint: "a",
    hintLabel: "add a note",
    keys: "a",
    label: "Add a note to the inbox",
    run: () => {
      const pane = homePanesIn(props.repo)
        .map((one) => ("pane" in one ? one.pane : one))
        .find((one) => one.kind === "home-inbox");
      if (pane === undefined) {
        navigate({ page: "inbox" }, { focus: "text" });
        return undefined;
      }
      focusPane(pane);
      askForNote();
      return undefined;
    },
  });
  return null;
}

export const needsYou = definePane<Repo>({
  icon: "hourglass",
  kind: "home-needs-you",
  mark: () => ({ needs: (record("NeedsYouList", null)()?.rows.length ?? 0) > 0 }),
  stack: "main",
  title: "Needs you",
  view: (props) => (
    <PaneScroll style={{ flex: 1 }}>
      <NoteKey repo={props.args.repo} />
      <NeedsYou repo={props.args.repo} />
    </PaneScroll>
  ),
});

export const inProgress = definePane<Repo>({
  icon: "activity",
  kind: "home-in-progress",
  stack: "main",
  title: "In progress",
  view: (props) => (
    <PaneScroll style={{ flex: 1 }}>
      <NoteKey repo={props.args.repo} />
      <InProgress repo={props.args.repo} />
    </PaneScroll>
  ),
});

export const now = definePane<Repo>({
  // Its empty state and its action, or its few entries, whole: an extension's pane takes the rest.
  height: 200,
  icon: "list",
  kind: "home-now",
  stack: "side",
  title: "Priorities now",
  view: (props) => (
    <PaneScroll style={{ flex: 1 }}>
      <NoteKey repo={props.args.repo} />
      <NowWidget repo={props.args.repo} />
    </PaneScroll>
  ),
});

export const inbox = definePane<Repo>({
  // Its field, its hint, its three latest notes, and its link, whole: an equal share cut a note.
  height: 304,
  icon: "inbox",
  kind: "home-inbox",
  mark: ({ repo }) => ({ count: record("Inbox", { repo })()?.count }),
  stack: "side",
  title: "Inbox",
  view: (props) => (
    <PaneScroll style={{ flex: 1 }}>
      <InboxWidget repo={props.args.repo} />
    </PaneScroll>
  ),
});

export const usage = definePane<Repo>({
  icon: "gauge",
  kind: "home-usage",
  stack: "side",
  title: "Usage",
  view: (props) => (
    <PaneScroll style={{ flex: 1 }}>
      <NoteKey repo={props.args.repo} />
      <UsageWidget repo={props.args.repo} />
    </PaneScroll>
  ),
});

definePlace(
  "home",
  (route) => {
    const repo = { repo: route.repo ?? "" };
    return [needsYou(repo), inProgress(repo), ...homePanesIn(repo.repo), usage(repo)];
  },
  { split: ["main", "side"] },
);
