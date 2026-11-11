// Sessions: the list of a repository's sessions, `/sessions`, and a session, by its id,
// `/sessions/<id>`, or as a feature's latest, `/f/<folder>/session` (`?new` for a new one). A
// session is its conversation in the main stack, its head, its transcript, and its composer in
// one pane, and the list of sessions beside it in the side stack, where task 44's panels join it
// through `addSessionPanes` (`place.ts`). On a phone the conversation is the pane shown, and the
// list the next one.
import { record, route } from "../../store";
import { definePane, definePlace, type Placed } from "../../ui/layout";
import { addedPanes, type SessionArgs, sessionIdOf } from "./place";
import { SessionsPane } from "./SessionsPage";
import { TranscriptPane } from "./Transcript";

export { addSessionPanes, type SessionArgs, sessionIdOf } from "./place";

export const sessionTranscript = definePane<SessionArgs>({
  flush: true,
  icon: "message-square",
  kind: "session-transcript",
  mark: (args) => {
    const id = sessionIdOf(args)();
    const session = typeof id === "string" ? record("Session", { id, repo: args.repo })() : null;
    return {
      needs: session?.status === "needs-you" || session?.status === "attention",
      running: session?.status === "working",
    };
  },
  stack: "main",
  title: "Conversation",
  view: (props) => <TranscriptPane args={props.args} />,
});

/** The list's arguments: the repository, and the session shown beside it, if any. */
type ListArgs = { repo: string; session: string };

export const sessionsList = definePane<ListArgs>({
  flush: true,
  icon: "square-terminal",
  kind: "sessions-list",
  mark: (args) => ({
    count: record("SessionList", { repo: args.repo })()?.rows.filter(
      (row) => row.status === "needs-you" || row.status === "attention",
    ).length,
  }),
  stack: "side",
  title: "Sessions",
  view: (props) => <SessionsPane repo={props.args.repo} session={props.args.session} />,
});

/** The repository of the page shown: every route of a repository's pages names one. */
const repoOf = (shown: { repo?: string }) => shown.repo ?? route().repo ?? "";

function sessionPlace(args: SessionArgs): ReadonlyArray<Placed> {
  return [
    sessionTranscript(args),
    sessionsList({ repo: args.repo, session: args.session }),
    ...addedPanes(args),
  ];
}

definePlace("sessions", (shown) => [
  { pane: sessionsList({ repo: repoOf(shown), session: "" }), stack: "main" },
]);
definePlace("session-id", (shown) =>
  sessionPlace({ folder: "", fresh: false, repo: repoOf(shown), session: shown.id }),
);
definePlace("session", (shown) =>
  sessionPlace({
    folder: shown.folder,
    fresh: shown.query?.new !== undefined,
    repo: repoOf(shown),
    session: "",
  }),
);
