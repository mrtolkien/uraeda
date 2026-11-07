// An entry of the undo stack made from the change a write answered with: the core writes each
// file's bytes back for an undo, and forward for a redo, refusing once a file changed since.
import { type useFateClient, view } from "react-fate";
import type { ChangeView } from "uraeda-binding";
import type { Undo } from "uraeda-server/fate";
import { rereadChanges } from "../data.ts";
import { refusal } from "../errors.ts";
import type { UndoEntry } from "./stack.ts";

type Fate = ReturnType<typeof useFateClient>;

/** An undo's or a redo's answer: the checkout's commit once written. */
const AppliedView = view<Undo>()({ commit: true, id: true });

/** The committed check's answer. */
const CommittedView = view<Undo>()({ committed: true, id: true });

/**
 * The entry of a write that answered `change`, labelled `label`, which happened at `place`. Its undo
 * and redo write the change back and forward, each resolving with the refusal the server answered,
 * "Could not undo: “Color themes” changed since in PRIORITIES.md.", `subject` the name it gives,
 * and rejecting when the request failed: the stack keeps the entry for another try.
 * After each, the change's commit is the one the checkout was at then: a commit since that undo
 * makes its redo ask too. The answers are read from the mutations, as the record's id is fixed.
 */
export function changeEntry(
  fate: Fate,
  change: ChangeView,
  label: string,
  place: UndoEntry["place"],
  subject: string,
): UndoEntry {
  let now = change;
  const apply = async (direction: "redo" | "undo") => {
    let result;
    try {
      result = await fate.mutations.undo.apply({
        input: { change: now, direction, subject },
        view: AppliedView,
      });
    } finally {
      // The lists, which show the change's count, are read again with what came back.
      rereadChanges(fate);
    }
    if (result.error) {
      // Only the core's refusal drops the entry: a lost connection or a server's failure rejects,
      // leaving it on its side for another try.
      const text = result.error instanceof Error ? result.error.message : String(result.error);
      if (!/^(refused|conflict): /.test(text)) {
        throw result.error instanceof Error ? result.error : new Error(text);
      }
      return refusal(text).message;
    }
    now = { ...now, commit: result.result?.commit ?? now.commit };
    return undefined;
  };
  return {
    committed: async () => {
      const result = await fate.mutations.undo.committed({
        input: { change: now },
        view: CommittedView,
      });
      if (result.error) {
        throw new Error(refusal(result.error).message);
      }
      return result.result?.committed === true;
    },
    label,
    place,
    redo: () => apply("redo"),
    undo: () => apply("undo"),
  };
}

/**
 * The change of a run of moves, `earlier` then `later`: per file, its bytes before the earlier, and
 * after the later, from the commit the run started at.
 */
export function joinChanges(earlier: ChangeView, later: ChangeView): ChangeView {
  const files = new Map(earlier.files.map((file) => [file.path, file]));
  for (const file of later.files) {
    const first = files.get(file.path);
    files.set(file.path, { ...file, before: first ? first.before : file.before });
  }
  return { commit: earlier.commit, files: [...files.values()] };
}
