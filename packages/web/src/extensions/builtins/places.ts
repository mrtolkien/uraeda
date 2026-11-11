// The built-in extensions' places, each named once, with its icon and path: what their entries
// register (`builtins/<name>.tsx`), and what the kinds' icons and the stories read.
import type { Destination } from "../../destinations.ts";

export const BUILT_IN_PLACES = {
  decisions: { icon: "uraeda:decision-ruler", label: "Decisions", path: "/decisions" },
  git: { icon: "uraeda:git-branch", label: "Git", path: "/git" },
  inbox: { icon: "uraeda:inbox", label: "Inbox", path: "/inbox" },
  jobs: { icon: "uraeda:clock", label: "Jobs", path: "/jobs" },
  priorities: { icon: "uraeda:list", label: "Priorities", path: "/priorities" },
} as const satisfies Record<string, Destination>;
