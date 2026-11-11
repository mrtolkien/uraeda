// Home, the first page of a day: what needs the human and what runs, in the main stack, and what
// comes next, the inbox, and the agents' usage, in the side stack. Both stacks show all their
// panes at once, a page read at a glance; on a phone, one pane at a time, the bar at the foot
// switching. The extensions' panes, the inbox's and Priorities now among them, come from the one list
// of the extensions on in the repository (`../extension`), each in its column's stack, before Usage.
import { InProgress, NeedsYou } from "./core";
import { InboxWidget, NowWidget, UsageWidget } from "./widgets";
import { homePanesIn } from "../extension";
import { record } from "../../store";
import { definePane, definePlace, PaneScroll } from "../../ui/layout";

/** Each pane of Home shows the repository of the address. */
type Repo = { repo: string };

export const needsYou = definePane<Repo>({
  icon: "hourglass",
  kind: "home-needs-you",
  mark: () => ({ needs: (record("NeedsYouList", null)()?.rows.length ?? 0) > 0 }),
  stack: "main",
  title: "Needs you",
  view: (props) => (
    <PaneScroll style={{ flex: 1 }}>
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
      <InProgress repo={props.args.repo} />
    </PaneScroll>
  ),
});

export const now = definePane<Repo>({
  icon: "list",
  kind: "home-now",
  stack: "side",
  title: "Priorities now",
  view: (props) => (
    <PaneScroll style={{ flex: 1 }}>
      <NowWidget repo={props.args.repo} />
    </PaneScroll>
  ),
});

export const inbox = definePane<Repo>({
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
