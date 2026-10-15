/** The records the repository's mutations answer with, masked to the fields the client selected. */
import type { Inbox } from "uraeda-binding";
import type { Context } from "./context.ts";
import { sources } from "./sources.ts";
import {
  draftDataView,
  type DraftRecord,
  inboxDataView,
  PRIORITIES_ID,
  prioritiesDataView,
  type PrioritiesRecord,
  sentInbox,
} from "./views.ts";

export const priorities = (
  ctx: Context,
  record: Omit<PrioritiesRecord, "id">,
  select: Array<string>,
) => sources.masked(prioritiesDataView, ctx, { id: PRIORITIES_ID, ...record }, select);

export const draft = (ctx: Context, record: Omit<DraftRecord, "id">, select: Array<string>) =>
  sources.masked(draftDataView, ctx, { id: record.path, ...record }, select);

export const inbox = (ctx: Context, record: Inbox, select: Array<string>) =>
  sources.masked(inboxDataView, ctx, sentInbox(record), select);
