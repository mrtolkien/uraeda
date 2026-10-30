// What a start from the New page takes out of the files its entries are in: a note leaves
// `INBOX.md`, a proposal line `PRIORITIES.md`.
import { useFateClient } from "react-fate";
import type { Inbox, Priorities } from "uraeda-server/fate";
import { readInbox, readPriorities, rereadChanges } from "./data.ts";
import { withFreshBase } from "./freshBase.ts";
import { startable } from "./NewEntries.tsx";
import { plain } from "./Spans.tsx";
import { InboxView, PrioritiesView } from "./views.ts";

type Fate = ReturnType<typeof useFateClient>;

/**
 * An entry the New page's composer was filled from: its kind, id, text, and own file, if it has
 * one.
 */
export type Taken = {
  id: string;
  kind: "line" | "note";
  linked?: string | undefined;
  text: string;
};

/**
 * The ID of the startable line of `priorities` whose text is `text`, the one of `id` when several
 * are: a start moves the lines of Now, so a line read before it is found again by its text.
 */
function lineByText(priorities: Pick<Priorities, "sections">, { id, text }: Taken) {
  const found = priorities.sections
    .flatMap((section) => section.proposals)
    .filter((line) => startable(line) && plain(line.spans) === text);
  return (found.find((line) => line.id === id) ?? found[0])?.id;
}

/**
 * The ID of the note of `inbox` whose text is `text`, the one of `id` when several are: a note's ID
 * is its place, which a note removed above it since the composer was filled moves.
 */
function noteByText(inbox: Pick<Inbox, "categories">, { id, text }: Taken) {
  const found = inbox.categories
    .flatMap((category) => category.notes)
    .filter((note) => plain(note.spans) === text);
  return (found.find((note) => note.id === id) ?? found[0])?.id;
}

/**
 * Takes the entries out of their file, as a start from them does: a note leaves `INBOX.md`, a
 * proposal `PRIORITIES.md`, each found by its text in the file read after the start: none left
 * with it, it stays. A refused removal leaves the entry where it is: the start already happened. A
 * change's start replaces the first line of Now it was filled from itself, in its commit: that line
 * is not one of `taken`.
 */
export async function takeOut(fate: Fate, taken: ReadonlyArray<Taken>) {
  for (const entry of taken) {
    try {
      if (entry.kind === "note") {
        await withFreshBase(
          (mode) => readInbox(fate, mode),
          async (inbox) => {
            const note = noteByText(inbox, entry);
            return note === undefined
              ? undefined
              : fate.mutations.inbox.remove({ input: { hash: inbox.hash, note }, view: InboxView });
          },
        );
      } else {
        await withFreshBase(
          (mode) => readPriorities(fate, mode),
          async (priorities) => {
            const proposal = lineByText(priorities, entry);
            return proposal === undefined
              ? undefined
              : fate.mutations.proposals.remove({
                  input: { hash: priorities.hash, proposal },
                  view: PrioritiesView,
                });
          },
        );
      }
    } catch {
      // Left in its file, for the human to take out.
    }
  }
  rereadChanges(fate);
}
