// The agents' usage as the sidebar says it: one line per login, its five hours alone, "default 5h
// 58% · 15:08", "b signed out", "c no folder"; for an agent with no account listed, its own five
// hours. And the one window the folded rail's bar shows: the account of the session in view, else
// the one a new session would start on. The multi-accounts record has the rules
// (`specs/done/2026-11-10-multi-accounts.md`).
import type { Agent, RuntimeRecord } from "../../store/protocol";

/** The agents' id of their five hours. */
const FIVE_HOURS = "five_hour";

/** What is left, in percent, at which a window reads as nearly gone. */
export const LOW = 20;

export type UsageLine = {
  /** Unique among the lines. */
  id: string;
  /** Its agent's mark, an icon's name. */
  icon: string;
  /** "default 5h", "Claude Code 5h", "b". */
  label: string;
  /** What is left, from 0 to 100: none for a login that cannot run. */
  left?: number;
  /** When it resets, as a person reads it: "15:08", "Tue 09:00". */
  resets?: string;
  /** Why a login cannot run: "signed out", "no folder". */
  trouble?: string;
};

type Window = { label: string; resetsAt: string | null; used: number };

/** What is left of `window`, in whole percent. */
const leftOf = (window: Window) => Math.round(Math.min(100, Math.max(0, 100 - window.used * 100)));

/** When a window resets: its time today, or its day and time on another day. */
export function resetWords(resetsAt: string, now: Date): string {
  const at = new Date(resetsAt);
  const time = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  if (at.toDateString() === now.toDateString()) return time;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][at.getDay()];
  return `${day} ${time}`;
}

function line(id: string, icon: string, label: string, window: Window, now: Date): UsageLine {
  return {
    icon,
    id,
    label: `${label} ${window.label}`,
    left: leftOf(window),
    resets: window.resetsAt === null ? undefined : resetWords(window.resetsAt, now),
  };
}

/** The sidebar's lines, in the agents' order, then their accounts'. */
export function usageLines(agent: Agent | undefined, now: Date): UsageLine[] {
  const lines: UsageLine[] = [];
  for (const runtime of agent?.runtimes ?? []) {
    if (!runtime.isOn) continue;
    for (const account of runtime.accounts) {
      const id = `${runtime.id}/${account.id}`;
      const [first] = account.windows;
      if (account.state !== "ready") {
        const trouble = account.state === "missing" ? "no folder" : "signed out";
        lines.push({ icon: runtime.icon, id, label: account.name, trouble });
      } else if (first !== undefined) {
        lines.push(line(id, runtime.icon, account.name, first, now));
      }
    }
    const five = runtime.usage.find((window) => window.id === FIVE_HOURS);
    if (runtime.accounts.length === 0 && five !== undefined) {
      lines.push(line(runtime.id, runtime.icon, runtime.name, five, now));
    }
  }
  return lines;
}

/** Where a run is: its agent and its account, as a session records them. */
export type InView = { agent: string; accountId: string | null };

/**
 * The window the folded rail's bar shows: the first of the account of the session in view, `none`
 * for a session whose account is not listed or that has none; with no session in view, the one a
 * new session would start on, of the first agent on. An agent without accounts shows its five hours.
 */
export function barWindow(agent: Agent | undefined, inView: InView | undefined) {
  const runtimes = (agent?.runtimes ?? []).filter((runtime) => runtime.isOn);
  const runtime: RuntimeRecord | undefined =
    inView === undefined ? runtimes[0] : runtimes.find((each) => each.id === inView.agent);
  if (runtime === undefined) return undefined;
  if (runtime.accounts.length === 0) {
    const five = runtime.usage.find((window) => window.id === FIVE_HOURS);
    return five && { label: `${runtime.name} ${five.label}`, left: leftOf(five) };
  }
  const account =
    inView === undefined
      ? runtime.accounts.find((each) => each.isNext)
      : runtime.accounts.find((each) => each.id === inView.accountId);
  const [first] = account?.state === "ready" ? account.windows : [];
  return first && account && { label: `${account.name} ${first.label}`, left: leftOf(first) };
}
