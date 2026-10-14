// What the human does on a session besides writing to it.
import { useState } from "react";
import { useFateClient } from "react-fate";
import { refusal } from "./errors.ts";
import type { useSession } from "./data.ts";
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
 * What the human does on a session besides writing to it: allow a tool, and, for a chat, rename
 * and archive it. The last refusal shows under the transcript.
 */
export function useSessionControls(id: string, session: ReturnType<typeof useSession>) {
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
  return { allow, chat, error };
}
