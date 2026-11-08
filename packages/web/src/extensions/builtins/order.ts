// The built-ins' order in every list, today's: the inbox, the priorities, the decisions, the
// sessions, then Git; previews and notifications draw no place.
import { pageApi } from "../pageApi.ts";
import { registry } from "../useContributions.ts";

const ORDER = {
  decisions: { order: 3, title: "Decisions" },
  git: { order: 5, title: "Git" },
  inbox: { order: 1, title: "Inbox" },
  notifications: { order: 7, title: "Notifications" },
  previews: { order: 6, title: "Previews" },
  priorities: { order: 2, title: "Priorities and proposals" },
  sessions: { order: 4, title: "Sessions" },
} as const;

/** The page API of the built-in `name`, in its place among the built-ins, over the app's registry. */
export const builtIn = (name: keyof typeof ORDER) => pageApi(name, registry, ORDER[name]);
