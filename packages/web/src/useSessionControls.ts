// What the human does on a session besides writing to it.
import { useState } from "react";
import { useFateClient } from "react-fate";
import { refusal } from "./errors.ts";
import type { useSession } from "./sessionData.ts";
import { SessionView } from "./views.ts";

/** A session's title, renamed in place: its key in the unsaved store, and the rename. */
export type RenameControls = {
  field: string;
  onRename: (title: string) => Promise<string | undefined>;
};

/**
 * What renames a session: its ID and its new title, to the server's refusal in words, or none. The
 * session's page's title, edited in place, and its Rename dialog (`RenameSession`).
 */
export function useRenameSession() {
  const fate = useFateClient();
  return async (session: string, title: string) => {
    const result = await fate.mutations.session.rename({
      input: { session, title },
      optimistic: { id: session, title },
      view: SessionView,
    });
    return result.error ? refusal(result.error).message : undefined;
  };
}

/** A session without a workflow's Archive, which takes it out of the sidebar's list: search still finds it. */
export type ArchiveControls = { archived: boolean; onArchive: () => Promise<void> };

/**
 * What the human does on a session besides writing to it: allow a tool, or every blocked action of
 * the latest turn, rename it, and, for a session without a workflow, archive it. The last refusal
 * shows under the transcript, as one `fail` gives. `id` is `undefined` before a first message
 * creates the session.
 */
export function useSessionControls(
  given: string | undefined,
  session: ReturnType<typeof useSession> | undefined,
) {
  const id = given ?? "";
  const fate = useFateClient();
  const [error, setError] = useState<string>();
  const renameSession = useRenameSession();
  const rename: RenameControls | undefined = session
    ? { field: `session#${id}:title`, onRename: (title) => renameSession(id, title) }
    : undefined;
  const archive: ArchiveControls | undefined =
    session && session.folder === null
      ? {
          archived: session.archived,
          onArchive: async () => {
            setError(undefined);
            const result = await fate.mutations.session.archive({
              input: { archived: !session.archived, session: id },
              optimistic: { archived: !session.archived, id },
              view: SessionView,
            });
            if (result.error) {
              setError(refusal(result.error).message);
            }
          },
        }
      : undefined;
  const allow = async (turn: string, seq: number) => {
    setError(undefined);
    const result = await fate.mutations.session.allow({
      input: { seq, session: id, turn },
      view: SessionView,
    });
    if (result.error) {
      setError(refusal(result.error).message);
    }
  };
  const allowAll = async () => {
    setError(undefined);
    const result = await fate.mutations.session.allowAll({
      input: { session: id },
      // Nothing is left blocked: what the allows start is the server's.
      optimistic: { allowable: 0, id },
      view: SessionView,
    });
    if (result.error) {
      setError(refusal(result.error).message);
    }
  };
  return { allow, allowAll, archive, error, fail: setError, rename };
}

/** What `useSessionControls` returns, shared by the transcript and the composer. */
export type Controls = ReturnType<typeof useSessionControls>;
