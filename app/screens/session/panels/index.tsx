// A session's side panels, after the sessions' list in the side stack of every page of a session:
// its Activity, what its agent does as it happens, with the plan's progress at its foot; its
// Changes, the files it and its branch changed, each with its diff; and its Sub-agents, the
// implementers and reviewers its runs started. The frame's `l` crosses into them, `h` back; `j`
// `k` move through a panel's rows, `k` past the first reaches the tabs; `Enter` opens a row's own.
import { record } from "../../../store";
import { definePane } from "../../../ui/layout";
import { addSessionPanes, type SessionArgs, sessionIdOf } from "../place";
import { ActivityPane } from "./Activity";
import { ChangesPane } from "./Changes";
import { SubagentsPane } from "./Subagents";

/** The session the arguments name, read in a pane's mark: none before its first message. */
function sessionOf(args: SessionArgs) {
  const id = sessionIdOf(args)();
  return typeof id === "string" ? record("Session", { id, repo: args.repo })() : undefined;
}

export const sessionActivity = definePane<SessionArgs>({
  flush: true,
  icon: "activity",
  closes: true,
  kind: "session-activity",
  mark: (args) => ({ running: sessionOf(args)?.status === "working" }),
  stack: "side",
  title: "Activity",
  view: (props) => <ActivityPane args={props.args} />,
});

export const sessionChanges = definePane<SessionArgs>({
  flush: true,
  icon: "git-compare",
  closes: true,
  kind: "session-changes",
  mark: (args) => ({ count: sessionOf(args)?.edited.length || undefined }),
  stack: "side",
  title: "Changes",
  view: (props) => <ChangesPane args={props.args} />,
});

export const sessionSubagents = definePane<SessionArgs>({
  flush: true,
  icon: "users",
  closes: true,
  kind: "session-subagents",
  mark: (args) => {
    const subs = sessionOf(args)?.subSessions ?? [];
    const working = subs.filter((sub) => sub.state === "working").length;
    return { count: working || undefined, running: working > 0 };
  },
  stack: "side",
  title: "Sub-agents",
  view: (props) => <SubagentsPane args={props.args} />,
});

addSessionPanes((args) => [sessionActivity(args), sessionChanges(args), sessionSubagents(args)]);
