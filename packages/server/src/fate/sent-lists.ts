// The inbox and the priorities as the server sends them.
import type { Inbox, Priorities } from "uraeda-binding";
import { INBOX_ID, type InboxRecord, type PrioritiesRecord, sentStep } from "./views.ts";

/** The inbox as it is sent: the client's cache keeps a field an answer leaves out. */
export function sentInbox(inbox: Inbox): InboxRecord {
  return {
    ...inbox,
    change: null,
    id: INBOX_ID,
    triage: inbox.triage ?? null,
  };
}

/** The priorities as they are sent: each running feature's step as `sentStep` sends it. */
export const sentPriorities = (read: Priorities): Omit<PrioritiesRecord, "id"> => ({
  ...read,
  change: null,
  sections: read.sections.map((section) => ({
    ...section,
    proposals: section.proposals.map(({ running, ...proposal }) => ({
      ...proposal,
      ...(running && { running: { ...running, step: sentStep(running.step) } }),
    })),
  })),
});
