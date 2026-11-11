// The built-in extensions, in their order in every list, the React UI's (`order.ts` there): the
// inbox, the priorities, the decisions, the sessions, Git, then Jobs; previews and notifications
// draw no place. The agents' built-ins, Claude Code and Codex, are runtimes, which the settings and
// the run map list: they declare no part here.
import type { BuiltIn } from "./declare";
import { decisions } from "./decisions";
import { git } from "./git";
import { inbox } from "./inbox";
import { jobs } from "./jobs";
import { notifications } from "./notifications";
import { previews } from "./previews";
import { priorities } from "./priorities";
import { sessions } from "./sessions";

export type { BuiltIn, BuiltInHomePane, BuiltInPlace } from "./declare";

export const BUILT_INS: ReadonlyArray<BuiltIn> = [
  inbox,
  priorities,
  decisions,
  sessions,
  git,
  jobs,
  previews,
  notifications,
];
