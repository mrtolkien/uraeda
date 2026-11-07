/** The records the repository's mutations answer with, masked to the fields the client selected. */
import type { ChangeView, Inbox, Priorities, RemovedImage } from "uraeda-binding";
import type { Context, RepoContext } from "./context.ts";
import { refusable } from "./errors.ts";
import { sentInbox, sentPriorities } from "./sent-lists.ts";
import { sources } from "./sources.ts";
import { undoable } from "./undo-mutations.ts";
import {
  inboxDataView,
  PRIORITIES_ID,
  prioritiesDataView,
  proposalFileDataView,
  type ProposalFileRecord,
} from "./views.ts";
import { sentProposalFile } from "./views-proposal-file.ts";

/** The priorities, with the change an undoable write recorded, for its answer. */
export const priorities = (
  ctx: Context,
  record: Priorities,
  select: Array<string>,
  change: ChangeView | null = null,
) =>
  sources.masked(
    prioritiesDataView,
    ctx,
    { id: PRIORITIES_ID, ...sentPriorities(record), change },
    select,
  );

/** A proposal file, or a started proposal, by its path, with an undoable write's change. */
export const proposalFile = (
  ctx: Context,
  record: Omit<ProposalFileRecord, "id">,
  select: Array<string>,
  change: ChangeView | null = null,
) =>
  sources.masked(
    proposalFileDataView,
    ctx,
    { ...sentProposalFile({ id: record.path, ...record }), change },
    select,
  );

/**
 * The inbox, with what the answer's mutation adds to it: `removed`, the file as it was, for a
 * category's delete; `imageRemoved`, what Undo takes back, for an image taken out of a note; and
 * `change`, the change an undoable write recorded.
 */
export const inbox = (
  ctx: Context,
  record: Inbox,
  select: Array<string>,
  extra: { change?: ChangeView | null; imageRemoved?: RemovedImage; removed?: string } = {},
) =>
  sources.masked(
    inboxDataView,
    ctx,
    {
      ...sentInbox(record),
      change: extra.change ?? null,
      imageRemoved: extra.imageRemoved ?? null,
      removed: extra.removed ?? null,
    },
    select,
  );

/** The priorities an undoable write answers, through `refusable`, with the change it recorded. */
export async function undoablePriorities(
  ctx: RepoContext,
  select: Array<string>,
  call: (undo: string) => Promise<Priorities>,
) {
  const { answer, change } = await refusable(() => undoable(ctx, call));
  return priorities(ctx, answer, select, change);
}

/** The inbox an undoable write answers, through `refusable`, with the change it recorded. */
export async function undoableInbox(
  ctx: RepoContext,
  select: Array<string>,
  call: (undo: string) => Promise<Inbox>,
) {
  const { answer, change } = await refusable(() => undoable(ctx, call));
  return inbox(ctx, answer, select, { change });
}
