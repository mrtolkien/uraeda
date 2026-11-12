// A session's words: its header's line, its state and its cause, its banner's, and a tool call's
// line. Pure: the rules they say are the server's, these only put them in words.
import type { Item, Session, SessionRow, StatusReason, Turn } from "../../store/protocol";
import type { IconName, Ink } from "../../ui/controls";
import type { Tone } from "../../ui/tokens";

/**
 * Who runs the session, as its header says it: the agent, its account, the model and the effort
 * it last said it runs on, "Claude Code · b · Opus 5.5 · High". `agentName` is the agent's name
 * for people, from the record `Agent`; its registered name stands in until it is read.
 */
export function runsOnWords(
  session: Pick<Session, "account" | "agent" | "effort" | "model" | "ranEffort" | "ranModel">,
  agentName: string | undefined,
): string {
  return [
    agentName ?? session.agent,
    session.account,
    session.ranModel ?? session.model,
    session.ranEffort ?? session.effort,
  ]
    .filter((part): part is string => part !== null && part !== undefined && part !== "")
    .join(" · ");
}

/** A status's tone, as every status of the app reads it. */
export function statusTone(status: Session["status"]): Tone {
  switch (status) {
    case "working":
      return "live";
    case "needs-you":
      return "needs";
    case "attention":
      return "caution";
    case "unread":
      return "accent";
    default:
      return "quiet";
  }
}

/** What a session that needs attention says, by why: its banner's title, its words, its tone. */
export type Attention = {
  title: string;
  words: string;
  tone: "caution" | "danger";
  /** Whether Dismiss takes it away: a run that ended badly asks until dismissed. */
  dismisses: boolean;
};

/**
 * Why a session needs the human, and what they do next, its item named as a feature, a change, or
 * the chat; none for a reason no banner says, like a gate the step's own words say.
 */
export function attentionWords(
  reason: StatusReason | null,
  of: { continues: number; item: string; why?: string | null },
): Attention | undefined {
  const lead = (text: string) =>
    of.why ? `${of.why}${/[.!?]$/.test(of.why) ? "" : "."} ${text}` : text;
  switch (reason) {
    case "failed":
      return {
        dismisses: true,
        title: "The agent's run failed.",
        tone: "danger",
        words: lead("Read how it ended, then tell the agent how to go on, or dismiss this."),
      };
    case "stopped":
      return {
        dismisses: true,
        title: "You stopped the agent.",
        tone: "caution",
        words: lead("Tell the agent how to go on when you are ready, or dismiss this."),
      };
    case "interrupted":
      return {
        dismisses: true,
        title: "The server stopped the agent.",
        tone: "caution",
        words:
          "It was running when the server stopped. Tell the agent how to go on, or dismiss this.",
      };
    case "halted":
      return {
        dismisses: false,
        title: "The agent stopped before a human gate.",
        tone: "caution",
        words: `The ${of.item} still waits on the agent. Read its last message, then tell it how to go on.`,
      };
    case "capped":
      return {
        dismisses: true,
        title: "The agent keeps stopping.",
        tone: "caution",
        words: `Uraeda continued it ${of.continues} times in a row without a commit or a message from you, and stops there. Read its last message, then tell it how to go on, or dismiss this.`,
      };
    case "conflict":
      return {
        dismisses: true,
        title: "The catch-up stopped on a conflict.",
        tone: "caution",
        words:
          "It left the branch as it was, and asked on the pull request how to settle a conflict. Answer there by requesting changes, or dismiss this.",
      };
    case "blocked":
      return {
        dismisses: false,
        title: "Auto mode blocked an action.",
        tone: "caution",
        words:
          "Allow it where the transcript shows it, and the agent tries again; or tell it another way.",
      };
    default:
      return undefined;
  }
}

/** Why a run waits to go on by itself, and when: "Waits for the usage limit to reset, at 15:08". */
export function waitWords(reason: string, account: string | null, at: string): string {
  const on = account === null ? "" : ` on ${account}`;
  switch (reason) {
    case "limit":
      return `Waits for the usage limit${on} to reset: goes on by itself at ${at}. A message you send goes at once, and Stop cancels the wait.`;
    case "account":
      return `Waits for an account with usage left: goes on by itself at ${at}. A message you send goes at once, and Stop cancels the wait.`;
    case "restart":
      return `Goes on after the server's restart, at ${at}.`;
    default:
      return `Goes on by itself at ${at}. Stop cancels the wait.`;
  }
}

/** A tool call's icon, by what it does. */
const TOOL_ICONS: Readonly<Record<string, IconName>> = {
  delete: "trash-2",
  edit: "pencil-line",
  execute: "terminal",
  fetch: "globe",
  move: "arrow-right-left",
  other: "wrench",
  read: "file-text",
  search: "search",
  think: "brain",
};

/** What a line of the transcript shows that is not a text: its icon, its words, its ink. */
export type LineWords = {
  icon: IconName;
  /** The colour of its icon: a role's name of the tokens. */
  hue: "context" | "inkFaint" | "removed" | "caution" | "subAgent";
  words: string;
  /** Code, as a command or a path is. */
  code: boolean;
  /** The words' ink. */
  ink: Ink;
  /** A quiet fact at its end: how long it took. */
  meta: string;
};

/** "45 s", "12 min", "2 h 50 min": how long something took. */
export function took(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 1) return `${Math.max(0, Math.round(ms))} ms`;
  if (s < 60) return `${s} s`;
  const minutes = Math.floor(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
}

/** A tool's name as a person reads it: an MCP server's tool without its server. */
const toolName = (name: string) =>
  name.startsWith("mcp__") ? name.slice(name.lastIndexOf("__") + 2) : name;

/** The line of a tool call, a thought, or the runner's notice; none for a message or a text. */
export function lineWords(item: Item): LineWords | undefined {
  switch (item.kind) {
    case "tool": {
      const failed = item.status === "failed";
      const name = toolName(item.name);
      // Uraeda's `run_agent` starts an implementer: said as a person would, as its panel says it.
      const implementer = name === "run_agent";
      const words = implementer
        ? `Implementer of ${item.target ?? "a task"}`
        : item.target === null
          ? name
          : `${name} ${item.target}`;
      return {
        code: item.target !== null && !implementer,
        hue: failed
          ? "removed"
          : item.subagent !== null || implementer
            ? "subAgent"
            : "context",
        icon:
          item.subagent !== null
            ? "bot"
            : implementer
              ? "users"
              : (TOOL_ICONS[item.toolKind] ?? "wrench"),
        ink: failed ? "danger" : "quiet",
        meta:
          item.status === "in-progress"
            ? "running"
            : `${failed ? "failed · " : ""}${item.durationMs === null ? "" : took(item.durationMs)}`,
        words: item.subagent !== null ? `Sub-agent: ${item.subagent}` : words,
      };
    }
    case "thought":
      return {
        code: false,
        hue: "inkFaint",
        icon: "brain",
        ink: "faint",
        meta: "",
        words: item.durationMs > 0 ? `Thought for ${took(item.durationMs)}` : "Thought",
      };
    case "system":
      return {
        code: false,
        hue: "context",
        icon: "info",
        ink: "quiet",
        meta: "",
        words: item.text,
      };
    default:
      return undefined;
  }
}

/** Whether an item of a turn is the chat's: a sub-agent's calls and thoughts are its Activity's. */
export const isChats = (item: Item) =>
  !((item.kind === "tool" || item.kind === "thought") && item.parent !== null);

/** A turn's state as a session's list reads it, for a card's facts. */
export function turnWords(turn: Pick<Turn, "kind" | "reason" | "state">): string | undefined {
  if (turn.state === "failed") return turn.reason ?? "The run failed, and said nothing of why.";
  if (turn.state === "stopped") return turn.reason ?? "The run was stopped.";
  return undefined;
}

/** A session row's state, with its cause where it has one: "Waiting · goes on at 15:08". */
export function rowState(
  row: Pick<SessionRow, "statusLabel" | "subagents" | "backgroundCommands">,
) {
  const extra = [
    row.subagents > 0 ? `${row.subagents} sub-agent${row.subagents === 1 ? "" : "s"} at work` : "",
    row.backgroundCommands > 0
      ? `${row.backgroundCommands} background command${row.backgroundCommands === 1 ? "" : "s"}`
      : "",
  ].filter((part) => part !== "");
  return extra.length === 0 ? row.statusLabel : `${row.statusLabel} · ${extra.join(", ")}`;
}

/** What a screen reader hears as a session's status moves from `before` to `now`, if anything. */
export function statusNews(before: Session["status"], now: Session["status"]): string | undefined {
  if (now === "working") return "The agent started";
  if (before !== "working") return undefined;
  if (now === "needs-you") return "The agent finished: it waits for you";
  if (now === "attention") return "The agent stopped: it needs your attention";
  return "The agent finished";
}
