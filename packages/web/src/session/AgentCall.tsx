// A call of Uraeda's `run_agent` in the Activity: the sub-session it started, on one line under
// the row's head, its state's mark, its task as a link to its page, what it runs on, and how long
// it ran, counted on while it works. The Sub-agents tab holds its whole card.
import { Link } from "@astryxdesign/core/Link";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { createContext, type ReactNode, useContext } from "react";
import { sessionIdPath, useRepoPath } from "../routes.tsx";
import { type Ending, lasted, Unit, Value } from "../runs/AgentCard.tsx";
import { SubSessionMark } from "../runs/SubSessionRow.tsx";
import { runsOnText, type SubSession } from "../runs/subSessions.ts";
import { useSession } from "../sessionData.ts";
import { useNow } from "../useNow.ts";
import type { ActivityItem } from "./stretches.ts";

const styles = stylex.create({
  // The mark, the task, and its facts on a line, the task taking the room and cut at its end.
  fact: { flexShrink: 0, whiteSpace: "nowrap" },
  line: { alignItems: "center", display: "flex", gap: spacingVars["--spacing-2"], minWidth: 0 },
  task: {
    flexGrow: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

/** The sub-sessions of the session whose Activity is drawn. */
const SubSessions = createContext<ReadonlyArray<SubSession>>([]);

/** Gives the Activity's rows the sub-sessions of the session `session`. */
export function SubSessionsOf({ children, session }: { children: ReactNode; session: string }) {
  return <SubSessions value={useSession(session)?.subSessions ?? []}>{children}</SubSessions>;
}

/** The implementer `item` started, when it is a `run_agent` call whose sub-session is listed. */
export function useAgentCall(item: ActivityItem): SubSession | undefined {
  const subs = useContext(SubSessions);
  if (item.kind !== "tool" || !item.name.endsWith("__run_agent") || item.target === undefined) {
    return undefined;
  }
  return subs.find((sub) => sub.role === "implementer" && sub.about === item.target);
}

/** The sub-session `sub` on one line, a link to its page. */
export function AgentCall({ sub }: { sub: SubSession }) {
  const here = useRepoPath();
  const isWorking = sub.state === "working";
  const now = useNow(isWorking ? 1000 : null);
  const ending: Ending = isWorking
    ? "running"
    : sub.endedAt === null
      ? "unknown"
      : { at: Date.parse(sub.endedAt) };
  const duration = lasted(sub.startedAt, ending, now);
  return (
    <span {...stylex.props(styles.line)}>
      <SubSessionMark state={sub.state} />
      <Link
        href={here(sessionIdPath(sub.id))}
        onClick={(event: React.MouseEvent) => event.stopPropagation()}
        type="inherit"
        xstyle={styles.task}
      >
        {sub.about}
      </Link>
      <span {...stylex.props(styles.fact)}>
        <Unit>{runsOnText(sub)}</Unit>
      </span>
      {duration && (
        <span {...stylex.props(styles.fact)}>
          <Value>{duration}</Value>
        </span>
      )}
    </span>
  );
}
