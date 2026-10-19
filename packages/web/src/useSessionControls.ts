// What the human does on a session besides writing to it.
import { useState } from "react";
import { useFateClient } from "react-fate";
import { refusal } from "./errors.ts";
import type { useSession } from "./sessionData.ts";
import { SessionView } from "./views.ts";

/** A chat's title, renamed in place, and Archive, which hides it under "Archived" in the sidebar. */
export type ChatControls = {
  archived: boolean;
  /** The title's key in the unsaved store. */
  field: string;
  onArchive: () => Promise<void>;
  onRename: (title: string) => Promise<string | undefined>;
};

/**
 * What the human does on a session besides writing to it: allow a tool, or every blocked action of
 * the latest turn, and, for a chat, rename and archive it. The last refusal shows under the
 * transcript. `id` is `undefined` before a first message creates the session.
 */
export function useSessionControls(
  given: string | undefined,
  session: ReturnType<typeof useSession> | undefined,
) {
  const id = given ?? "";
  const fate = useFateClient();
  const [error, setError] = useState<string>();
  const chat: ChatControls | undefined =
    session && session.folder === null
      ? {
          archived: session.archived,
          field: `session#${id}:title`,
          onArchive: async () => {
            setError(undefined);
            const result = await fate.mutations.session.archive({
              input: { archived: !session.archived, session: id },
              view: SessionView,
            });
            if (result.error) {
              setError(refusal(result.error).message);
            }
          },
          onRename: async (title) => {
            const result = await fate.mutations.session.rename({
              input: { session: id, title },
              view: SessionView,
            });
            return result.error ? refusal(result.error).message : undefined;
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
      view: SessionView,
    });
    if (result.error) {
      setError(refusal(result.error).message);
    }
  };
  return { allow, allowAll, chat, error };
}

/** What `useSessionControls` returns, shared by the transcript and the composer. */
export type Controls = ReturnType<typeof useSessionControls>;
