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
export { type Ask, quoted, useAsk } from "./ask";

/** The session `args` names, read as a signal: `null` while there is none. */
function sessionOf(args: SessionArgs) {
  const id = sessionIdOf(args)();
  return typeof id === "string" ? record("Session", { id, repo: args.repo })() : null;
}

/** What a conversation's tab says besides its title: it waits on the human, or it runs. */
const conversationMark = (args: SessionArgs) => {
  const session = sessionOf(args);
  return {
    needs: session?.status === "needs-you" || session?.status === "attention",
    running: session?.status === "working",
  };
};

export const sessionTranscript = definePane<SessionArgs>({
  flush: true,
  icon: "message-square",
  kind: "session-transcript",
  mark: conversationMark,
  stack: "main",
  title: "Conversation",
  view: (props) => <TranscriptPane args={props.args} />,
});

/** A title cut to what a tab holds, with an ellipsis. */
const short = (title: string) => (title.length > 28 ? `${title.slice(0, 27).trimEnd()}…` : title);

/**
 * Another session's conversation, opened beside the page's own from the sessions' list
 * (`shift+Enter`), as Kiro opens a chat as an editor tab: the same pane, its tab named by the
 * session, since two read "Conversation". A pane of its own kind, so the page's arrangement never
 * places it, and the page's own session may be opened beside itself, to read two places of it.
 */
export const sessionBeside = definePane<SessionArgs>({
  closes: true,
  flush: true,
  icon: "message-square",
  kind: "session-beside",
  mark: conversationMark,
  stack: "main",
  title: (args) => short(sessionOf(args)?.title ?? "Conversation"),
  view: (props) => <TranscriptPane args={props.args} beside />,
});

/** The list's arguments: the repository, and the session shown beside it, if any. */
type ListArgs = { repo: string; session: string };

export const sessionsList = definePane<ListArgs>({
  // Beside a session, the human may close it; on `/sessions`, the main stack's one pane, never.
  closes: true,
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
  view: (props) => (
    <SessionsPane
      // `shift+Enter` on a row: its conversation beside the one shown, as a tab of main.
      beside={(id) =>
        sessionBeside({ folder: "", fresh: false, repo: props.args.repo, session: id })
      }
      repo={props.args.repo}
      session={props.args.session}
    />
  ),
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
