// What the inbox's panes do to a category: add one, rename one, or delete one, each written at once
// over the inbox as read, and recorded on the undo stack with the change it answered. A refusal is
// the core's message, which a field shows under itself or the page shows; a conflict also reads the
// inbox again.
import { useFateClient } from "react-fate";
import type { ChangeView } from "uraeda-binding";
import type { Inbox } from "uraeda-server/fate";
import { rereadChanges } from "../data.ts";
import { guarded, refusal } from "../errors.ts";
import { inboxEntry, type InboxWrite } from "../inboxUndo.ts";
import { categoryAdded, categoryRemoved, categoryRenamed } from "../optimisticLists.ts";
import { useRepository } from "../routes.tsx";
import { InboxChangeView } from "../undo/changeViews.ts";
import { useUndo } from "../undo/useUndo.ts";

/** A category write's answer: its refusal, or the inbox with the change it recorded. */
type Answer = { error?: unknown; result?: { change?: ChangeView | null } | null };

/**
 * The category edits over `inbox` as read, each shown at once. Each resolves with the refusal's
 * message, or with nothing once written, recorded on the undo stack: its undo writes `INBOX.md`
 * back, with the note files a delete took, and its redo writes it again, each refused once a file
 * changed since.
 */
export function useCategoryActions(inbox: Pick<Inbox, "categories" | "hash" | "names">) {
  const { hash } = inbox;
  const fate = useFateClient();
  const record = useUndo();
  const repo = useRepository();

  /** A write's answer: a refusal as its message, a conflict read again; one that landed recorded. */
  const landed = (result: Answer, write: InboxWrite) => {
    if (result.error) {
      const { kind, message } = refusal(result.error);
      if (kind === "conflict") {
        rereadChanges(fate);
      }
      return message;
    }
    const change = result.result?.change;
    if (change) {
      record(inboxEntry(fate, change, write, repo));
    }
    return undefined;
  };

  const add = async (name: string) => {
    const shown = categoryAdded(inbox, name);
    const result = await guarded(() =>
      fate.mutations.inbox.addCategory({
        input: { hash, name },
        ...(shown ? { optimistic: shown } : {}),
        view: InboxChangeView,
      }),
    );
    return landed(result, { label: `Added the category ${name}`, subject: name });
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
        view: InboxChangeView,
      }),
    );
    return landed(result, { label: `Renamed the category ${from} to ${to}`, subject: to });
  };

  const remove = async (name: string, keepNotes: boolean) => {
    const shown = categoryRemoved(inbox, name, keepNotes);
    const result = await guarded(() =>
      fate.mutations.inbox.removeCategory({
        input: { hash, keepNotes, name },
        ...(shown ? { optimistic: shown } : {}),
        view: InboxChangeView,
      }),
    );
    return landed(result, { label: `Deleted the category ${name}`, subject: name });
  };

  return { add, remove, rename };
}
