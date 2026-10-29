/** The records the repository's mutations answer with, masked to the fields the client selected. */
import type { Inbox, Priorities, RemovedImage } from "uraeda-binding";
import type { Context } from "./context.ts";
import { sentInbox, sentPriorities, sources } from "./sources.ts";
import {
  inboxDataView,
  PRIORITIES_ID,
  prioritiesDataView,
  proposalFileDataView,
  type ProposalFileRecord,
} from "./views.ts";

/** The priorities. */
export const priorities = (ctx: Context, record: Priorities, select: Array<string>) =>
  sources.masked(prioritiesDataView, ctx, { id: PRIORITIES_ID, ...sentPriorities(record) }, select);

/** A proposal file, or a started proposal, by its path. */
export const proposalFile = (
  ctx: Context,
  record: Omit<ProposalFileRecord, "id">,
  select: Array<string>,
) => sources.masked(proposalFileDataView, ctx, { id: record.path, ...record }, select);

/**
 * The inbox, with what the answer's mutation adds to it: `removed`, the file as it was, for a
 * category's delete; and `imageRemoved`, what Undo takes back, for an image taken out of a note.
 */
export const inbox = (
  ctx: Context,
  record: Inbox,
  select: Array<string>,
  extra: { imageRemoved?: RemovedImage; removed?: string } = {},
) =>
  sources.masked(
    inboxDataView,
    ctx,
    {
      ...sentInbox(record),
      imageRemoved: extra.imageRemoved ?? null,
      removed: extra.removed ?? null,
    },
    select,
  );
