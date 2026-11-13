// The pickers a note opens, from its row (`c`, `p`) or its pane's buttons: the categories to move
// it to, and where it goes up to out of the inbox, in the priorities or a proposal file. Both are
// the app's key picker, searched by typing, so a long list of proposals costs no scrolling.
import { computed } from "nsh";
import { record } from "../../store";
import type { Inbox, InboxNote } from "../../store/protocol";
import { KeyPicker, type PickerItem } from "../../ui/keys";
import { moveNote, promote, type Promotion } from "./actions";
import { plain } from "./model";

/** Which picker is open, and for which note. */
export type Picking = { kind: "move" | "promote"; note: InboxNote; category: string | null };

type Row = PickerItem & { run: () => Promise<void> };

/** The categories a note can move to: every one but its own, "No category" first. */
function moveRows(repo: string, inbox: Inbox, picking: Picking): Array<Row> {
  const names: Array<string | null> = [null, ...inbox.names];
  return names
    .filter((name) => name !== picking.category)
    .map((name) => ({
      id: name === null ? "\n" : name,
      run: () => moveNote(repo, inbox, picking.note, name),
      summary: name === null ? "The notes before the first category" : null,
      title: name ?? "No category",
    }));
}

/** Where a note can go: a section, as a line or a file; under a proposal; into a proposal file. */
function promoteRows(repo: string, inbox: Inbox, picking: Picking): Array<Row> {
  const priorities = record("Priorities", { repo })();
  if (priorities == null) return [];
  const hash = priorities.hash;
  const go = (to: Promotion) => () => promote(repo, inbox, picking.note, to, hash);
  const rows: Array<Row> = [];
  for (const section of priorities.sections) {
    rows.push({
      aside: "line",
      id: `line:${section.section}`,
      run: go({ kind: "line", section: section.section, title: section.title }),
      summary: `At the end of ${section.title}, as a line of the priorities`,
      title: section.title,
    });
    rows.push({
      aside: "new file",
      id: `file:${section.section}`,
      run: go({ kind: "file", section: section.section, title: section.title }),
      summary: `A new proposal file, linked at the end of ${section.title}`,
      title: `${section.title}, as a proposal file`,
    });
  }
  for (const section of priorities.sections) {
    for (const proposal of section.proposals) {
      const title = plain(proposal.spans) || proposal.text;
      rows.push({
        aside: section.title,
        id: `under:${proposal.id}`,
        run: go({ kind: "under", proposal: proposal.id, title: `“${title}”` }),
        summary: "Under this proposal, as a sub-item",
        title,
      });
      if (proposal.file !== null) {
        const file = proposal.file.path;
        rows.push({
          aside: "its file",
          id: `into:${file}`,
          run: go({ file, kind: "into", title: `“${title}”` }),
          summary: `Into its proposal file, ${file}`,
          title: `${title}: its file`,
        });
      }
    }
  }
  return rows;
}

/**
 * The picker open, if any: its pick runs the write, and a refusal goes to `onRefused`, said in
 * the pane where the note was.
 */
export function NotePicker(props: {
  inbox: Inbox;
  onClose: () => void;
  onRefused: (words: string) => void;
  picking: Picking;
  repo: string;
}) {
  const moving = () => props.picking.kind === "move";
  // Read where the picker is drawn: a pick runs a row already made, and reads no record.
  const rows = computed(() =>
    moving()
      ? moveRows(props.repo, props.inbox, props.picking)
      : promoteRows(props.repo, props.inbox, props.picking),
  );
  return (
    <KeyPicker
      isLoading={!moving() && record("Priorities", { repo: props.repo })() === undefined}
      items={rows()}
      onClose={props.onClose}
      onPick={(row) => {
        // The row picked carries its write: the picker is closed by then.
        row.run().catch((error: Error) => props.onRefused(error.message));
      }}
      placeholder={moving() ? "Move to a category…" : "Make it a proposal…"}
      title={moving() ? "Move to a category" : "Make it a proposal"}
    />
  );
}
