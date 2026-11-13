// A session's place: what its panes are given, which session they show, and the panes other
// screens add to it. A session is shown by its id, `/sessions/<id>`, or as a feature's latest,
// `/f/<folder>/session`, whose session the feature names; `?new` there is a new session of the
// feature, which its first message makes.
//
// The session's side panels (task 44: its activity, its changes, its sub-agents, its plan) add
// their panes here, from their own module, without touching this folder:
//
//   import { addSessionPanes } from "../session/place";
//   addSessionPanes((args) => [activity(args), changes(args)]);
//
// Each is placed after the transcript and the sessions' list, in its kind's stack (the side
// stack, as `definePane({ stack: "side" })` says), on all three pages of a session.
import { record } from "../../store";
import type { Placed } from "../../ui/layout";

/**
 * What a session's panes show: the repository; the session by its id, or "" for a feature's
 * latest; and the feature's folder, or "" for a session named by its id alone. `fresh`, a new
 * session of the feature, which none is yet.
 */
export type SessionArgs = { folder: string; fresh: boolean; repo: string; session: string };

/**
 * The session the panes show: its id, `undefined` while the feature is read, or `null` when
 * there is none: a new session's, or a feature's that has none yet. Call it in a component.
 */
export function sessionIdOf(args: SessionArgs): () => string | null | undefined {
  if (args.session !== "") return () => args.session;
  if (args.fresh || args.folder === "") return () => null;
  const feature = record("Feature", { id: args.folder, repo: args.repo });
  return () => {
    const shown = feature();
    return shown === undefined ? undefined : (shown?.session ?? null);
  };
}

const added: Array<(args: SessionArgs) => ReadonlyArray<Placed>> = [];

/** Adds panes to every page of a session, after its own: at a module's top level, once. */
export function addSessionPanes(panes: (args: SessionArgs) => ReadonlyArray<Placed>) {
  added.push(panes);
}

/** The panes other screens added for `args`, in the order they were added. */
export const addedPanes = (args: SessionArgs): ReadonlyArray<Placed> =>
  added.flatMap((panes) => panes(args));
