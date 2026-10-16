// The records of the agent's sessions: a session, its turns and their items, the navigation's list,
// and the search, read as `data.ts` reads the others.
import { useEffect } from "react";
import { useFateClient, useLiveView, useRequest, useView } from "react-fate";
import { useRefreshOnShow, WORKSPACE_ID } from "./data.ts";
import {
  SessionListView,
  SessionSearchView,
  SessionView,
  TurnLogView,
  TurnView,
  WorkspaceView,
} from "./views.ts";

/** The id of the sessions' list, as the server names it. */
const SESSION_LIST_ID = "all";

/** A session, without its turns. */
export function useSession(id: string) {
  const request = { session: { id, view: SessionView } };
  const { session } = useRequest(request);
  useRefreshOnShow(request);
  const live = useLiveView(SessionView, session);
  useReadOnceLive(request, id, true);
  return live;
}

/** How long a view's live subscription may take to reach the server once asked for. */
const SUBSCRIBED_MS = 1000;

/**
 * Reads a record again as its view starts listening to its live updates, and once more when the
 * subscription has surely reached the server, when `enabled`: a session just created by a send is
 * drawn from the send's answer, and a reply that ended its turn before the view listened would
 * leave it working past SC-002's second. Once per record shown.
 */
function useReadOnceLive(request: Parameters<typeof useRequest>[0], id: string, enabled: boolean) {
  const fate = useFateClient();
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const read = () =>
      void fate.request(request as never, { mode: "network-only" }).catch(() => {});
    read();
    const timer = setTimeout(read, SUBSCRIBED_MS);
    return () => clearTimeout(timer);
    // Once per record: `request` is a new object at each draw.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [fate, id, enabled]);
}

/**
 * A turn of a session, without its items. `latest`, for the session's latest turn, which may still
 * go on: read again once live, as a session is.
 */
export function useTurn(id: string, latest = false) {
  const request = { turn: { id, view: TurnView } };
  const { turn } = useRequest(request);
  useRefreshOnShow(request);
  const live = useLiveView(TurnView, turn);
  useReadOnceLive(request, id, latest);
  return live;
}

/** A page of a turn's items, `<turn>:<page>`, of 100 items; `latest` as for `useTurn`. */
export function useTurnLog(id: string, latest = false) {
  const request = { turnLog: { id, view: TurnLogView } };
  const { turnLog } = useRequest(request);
  useRefreshOnShow(request);
  const live = useLiveView(TurnLogView, turnLog);
  useReadOnceLive(request, id, latest);
  return live;
}

/**
 * What the navigation reads: the workspace's features and the sessions' list, in one request, so
 * the shell waits for them once.
 */
export function useNavigation() {
  const request = {
    sessionList: { id: SESSION_LIST_ID, view: SessionListView },
    workspace: { id: WORKSPACE_ID, view: WorkspaceView },
  };
  const { sessionList, workspace } = useRequest(request);
  useRefreshOnShow(request);
  return {
    sessionList: useLiveView(SessionListView, sessionList),
    workspace: useLiveView(WorkspaceView, workspace),
  };
}

/** The sessions whose title or messages hold the query: read again as the query changes. */
export function useSessionSearch(query: string) {
  const request = { sessionSearch: { id: query, view: SessionSearchView } };
  const { sessionSearch } = useRequest(request);
  useRefreshOnShow(request);
  return useView(SessionSearchView, sessionSearch);
}
