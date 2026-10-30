// What the inbox's panes do to a category: add one, rename one, or delete one with Undo, each
// written at once over the inbox as read. A refusal is the core's message, which a field shows under
// itself or the page shows; a conflict also reads the inbox again.
import { useFateClient } from "react-fate";
import type { Inbox } from "uraeda-server/fate";
import { rereadChanges } from "../data.ts";
import { guarded, refusal } from "../errors.ts";
import { useUndoToast } from "../layout/useUndoToast.ts";
import { categoryAdded, categoryRemoved, categoryRenamed } from "../optimisticLists.ts";
import { InboxRemovedView, InboxView } from "../views.ts";

/**
 * The category edits over `inbox` as read, each shown at once. Each resolves with the refusal's
 * message, or with nothing once written. A delete's Undo writes the file as it was back over the file the delete
 * wrote, so a file changed meanwhile refuses it, and is read again.
 */
export function useCategoryActions(inbox: Pick<Inbox, "categories" | "hash" | "names">) {
  const { hash } = inbox;
  const fate = useFateClient();
  const toast = useUndoToast();

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
    const shown = categoryRemoved(inbox, name, keepNotes);
    const result = await guarded(() =>
      fate.mutations.inbox.removeCategory({
        input: { hash, keepNotes, name },
        ...(shown ? { optimistic: shown } : {}),
        view: InboxRemovedView,
      }),
    );
    if (result.error) {
      return failed(result.error);
    }
    const before = result.result?.removed;
    const after = result.result?.hash;
    if (before === null || before === undefined || after === undefined) {
      return undefined;
    }
    toast(`Deleted the category ${name}`, async () => {
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
    });
    return undefined;
  };

  return { add, remove, rename };
}
