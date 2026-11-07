// The views of the writes that answer their change, which the undo stack takes: each list's or
// file's own view, with the change, and the fields the writer reads from its answer.
import { view } from "react-fate";
import type { Inbox, Priorities, ProposalFile } from "uraeda-server/fate";
import { InboxView, PrioritiesView, ProposalFileView } from "../views.ts";

/** A write's change, as `changeEntry` takes it. */
const ChangeSelection = { commit: true, files: true } as const;

/** The priorities as a write answers them, with its change and the sections it left. */
export const PrioritiesChangeView = view<Priorities>()({
  ...PrioritiesView,
  change: ChangeSelection,
  sections: true,
});

/** The inbox as a write answers it, with its change. */
export const InboxChangeView = view<Inbox>()({ ...InboxView, change: ChangeSelection });

/** A proposal file as a write answers it, with its change and its path now. */
export const ProposalFileChangeView = view<ProposalFile>()({
  ...ProposalFileView,
  change: ChangeSelection,
  path: true,
});
