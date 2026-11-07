// What the inbox's panes do to a category: add one, rename one, or delete one, undoable, each
// written at once over the inbox as read. A refusal is the core's message, which a field shows under
// itself or the page shows; a conflict also reads the inbox again.
import { useFateClient } from "react-fate";
import type { Inbox } from "uraeda-server/fate";
import { readInbox, rereadChanges } from "../data.ts";
import { guarded, refusal } from "../errors.ts";
import { categoryAdded, categoryRemoved, categoryRenamed } from "../optimisticLists.ts";
import { useUndo } from "../undo/useUndo.ts";
import { InboxRemovedView, InboxView } from "../views.ts";

/**
 * Deletes the category `name` over the file of `over`: the file as it was and the hash it left,
 * once done, or the refusal.
 */
async function removeOver(
  fate: ReturnType<typeof useFateClient>,
  over: Pick<Inbox, "categories" | "hash" | "names">,
  name: string,
  keepNotes: boolean,
): Promise<{ error?: unknown; written?: { after: string; before: string } }> {
  const shown = categoryRemoved(over, name, keepNotes);
  const result = await guarded(() =>
    fate.mutations.inbox.removeCategory({
      input: { hash: over.hash, keepNotes, name },
      ...(shown ? { optimistic: shown } : {}),
      view: InboxRemovedView,
    }),
  );
  if (result.error) {
    return { error: result.error };
  }
  const before = result.result?.removed;
  const after = result.result?.hash;
  return before === null || before === undefined || after === undefined
    ? {}
    : { written: { after, before } };
}

/**
 * The category edits over `inbox` as read, each shown at once. Each resolves with the refusal's
 * message, or with nothing once written. A delete's undo writes the file as it was back over the
 * file the delete wrote, so a file changed meanwhile refuses it, and is read again; its redo deletes
 * the category again, over the file as it is then.
 */
export function useCategoryActions(inbox: Pick<Inbox, "categories" | "hash" | "names">) {
  const { hash } = inbox;
  const fate = useFateClient();
  const record = useUndo();

  /** A refusal as its message, a conflict read again. */
  const failed = (error: unknown) => {
    const { kind, message } = refusal(error);
    if (kind === "conflict") {
      rereadChanges(fate);
    }
    return message;
  };

  const add = async (name: string) => {
    const shown = categoryAdded(inbox, name);
    const result = await guarded(() =>
      fate.mutations.inbox.addCategory({
        input: { hash, name },
        ...(shown ? { optimistic: shown } : {}),
        view: InboxView,
      }),
    );
    return result.error ? failed(result.error) : undefined;
  };

  const rename = async (from: string, to: string) => {
    // The core refuses a category's own name as taken: nothing to write.
    if (from === to) {
      return undefined;
    }
    const shown = categoryRenamed(inbox, from, to);
    const result = await guarded(() =>
      fate.mutations.inbox.renameCategory({
        input: { from, hash, to },
        ...(shown ? { optimistic: shown } : {}),
        view: InboxView,
      }),
    );
    return result.error ? failed(result.error) : undefined;
  };

  const remove = async (name: string, keepNotes: boolean) => {
    const removed = await removeOver(fate, inbox, name, keepNotes);
    if (removed.written === undefined) {
      return removed.error === undefined ? undefined : failed(removed.error);
    }
    // The last delete, which the undo writes back.
    let { after, before } = removed.written;
    const label = `Deleted the category ${name}`;
    const undo = async () => {
      try {
        const restored = await fate.mutations.inbox.restoreCategory({
          input: { before, hash: after },
          view: InboxView,
        });
        rereadChanges(fate);
        return restored.error ? failed(restored.error) : undefined;
      } catch {
        rereadChanges(fate);
        return `Could not restore the category ${name}: INBOX.md changed on disk.`;
      }
    };
    const redo = async () => {
      const again = await removeOver(fate, await readInbox(fate), name, keepNotes);
      if (again.written === undefined) {
        return again.error !== undefined
          ? failed(again.error)
          : `Could not redo: the category ${name} is no longer in INBOX.md.`;
      }
      ({ after, before } = again.written);
      return undefined;
    };
    record({ label, place: { path: "/inbox" }, redo, undo });
    return undefined;
  };

  return { add, remove, rename };
}
