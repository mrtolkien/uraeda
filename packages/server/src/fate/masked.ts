/** The records the repository's mutations answer with, masked to the fields the client selected. */
import type { AddCommit, Inbox, Priorities } from "uraeda-binding";
import type { Context } from "./context.ts";
import { sentInbox, sentPriorities, sources } from "./sources.ts";
import {
  draftDataView,
  type DraftRecord,
  inboxDataView,
  PRIORITIES_ID,
  prioritiesDataView,
} from "./views.ts";

/** The priorities, with `added` when the answer is an add's: "Add and commit" sets it. */
export const priorities = (
  ctx: Context,
  record: Priorities,
  select: Array<string>,
  added: AddCommit | null = null,
) =>
  sources.masked(
    prioritiesDataView,
    ctx,
    { id: PRIORITIES_ID, ...sentPriorities(record), added },
    select,
  );

export const draft = (ctx: Context, record: Omit<DraftRecord, "id">, select: Array<string>) =>
  sources.masked(draftDataView, ctx, { id: record.path, ...record }, select);

/** The inbox, with `added` when the answer is an add's, as for the priorities. */
export const inbox = (
  ctx: Context,
  record: Inbox,
  select: Array<string>,
  added: AddCommit | null = null,
) => sources.masked(inboxDataView, ctx, { ...sentInbox(record), added }, select);
