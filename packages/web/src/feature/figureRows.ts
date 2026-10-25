// The figures of the Home's column, as rows: while a feature runs, its lines changed, tokens, agent
// time, and elapsed time; once done, its total time, lines, tokens, agent time, questions, and
// decisions. Pure: the browser's clock is an argument, so a running turn's time and the elapsed
// time grow with it (R5).
import { clock, day, duration } from "./times.ts";

/** A row's value: plain, lines added and removed, or one line per part. */
export type FigureValue = string | { added: number; removed: number } | { lines: Array<string> };

/** One row: its name, its value, what it counts, and where it leads, in the page or out of it. */
export type FigureRow = { caption?: string; href?: string; label: string; value: FigureValue };

/** The tokens the server summed over the feature's session, null when none were counted. */
export type Tokens = { input: number; output: number; partial: boolean; since: string } | null;

/** The agent's time the server summed: its ended turns, and the start of the one running now. */
export type Agent = { runningSince: string | null; seconds: number } | null;

/** What the figures read of the history. */
export type FiguresHistory = {
  decisions: ReadonlyArray<unknown>;
  found: boolean;
  lines?: { added: number; files: number; removed: number } | null;
  questions?: number | null;
  rounds?: number | null;
  stages: ReadonlyArray<{ name: string; started?: string | null }>;
  totalSeconds?: number | null;
};

const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact" });

/** A token count: "5.2 M", "113 k", "2.7 k", and under 1,000 as is. */
export function tokenCount(count: number): string {
  if (count < 1000) {
    return String(count);
  }
  const parts = COMPACT.formatToParts(count);
  const number = parts
    .filter((part) => part.type !== "compact" && part.type !== "literal")
    .map((part) => part.value)
    .join("");
  const unit = parts.find((part) => part.type === "compact")?.value ?? "";
  return `${number} ${unit === "K" ? "k" : unit}`;
}

/** "1 round", "2 rounds". */
function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** The tokens' row: in and out on two lines, "Not recorded" when none were counted. */
function tokensRow(tokens: Tokens): FigureRow {
  if (!tokens) {
    return { label: "tokens", value: "Not recorded" };
  }
  return {
    caption: tokens.partial ? `since ${day(tokens.since)}` : "cache reads left out",
    label: "tokens",
    value: { lines: [`${tokenCount(tokens.input)} in`, `${tokenCount(tokens.output)} out`] },
  };
}

/** The lines' row, leading to `href` when there is one. */
function linesRow(lines: NonNullable<FiguresHistory["lines"]>, href?: string): FigureRow {
  return {
    caption: plural(lines.files, "file"),
    ...(href === undefined ? {} : { href }),
    label: "lines",
    value: { added: lines.added, removed: lines.removed },
  };
}

/** The agent's time: its ended turns, plus what the running one has gone by `now`. */
function agentRow(agent: Agent, now: number): FigureRow {
  if (!agent) {
    return { label: "agent time", value: "Not recorded" };
  }
  const running = agent.runningSince === null ? 0 : (now - Date.parse(agent.runningSince)) / 1000;
  return { label: "agent time", value: duration(agent.seconds + Math.max(0, running)) };
}

/** What the rows read of the feature. */
export type FigureInput = {
  agent: Agent;
  /** A change, which shows its questions and decisions only when it has some. */
  change?: boolean;
  done: boolean;
  history: FiguresHistory;
  /** The browser's clock, in ms. */
  now: number;
  /** A done item's pull request, from its record. */
  pullRequest?: string | undefined;
  tokens: Tokens;
};

/** A done item's rows, each leading to its detail when it has one. */
function doneRows({ agent, change, history, now, pullRequest, tokens }: FigureInput) {
  const rows: Array<FigureRow> = [];
  const start = (name: string) => history.stages.find((stage) => stage.name === name)?.started;
  const [from, to] = [start("proposal"), start("pull-request")];
  if (history.totalSeconds != null && from && to) {
    rows.push({
      caption: `${clock(from)} to ${clock(to, from)}`,
      href: "#stages",
      label: "total time",
      value: duration(history.totalSeconds),
    });
  }
  if (history.lines) {
    rows.push(linesRow(history.lines, pullRequest ? `${pullRequest}/files` : undefined));
  }
  rows.push(tokensRow(tokens), agentRow(agent, now));
  // A feature always shows its questions and decisions, at zero too; a change only those it has.
  const rounds = history.rounds ?? 0;
  if (!change || rounds > 0) {
    rows.push({
      caption: rounds > 0 ? plural(rounds, "round") : "no round",
      ...(rounds > 0 ? { href: "#record-questions" } : {}),
      label: "questions",
      value: String(history.questions ?? 0),
    });
  }
  if (!change || history.decisions.length > 0) {
    rows.push({
      caption: "new or changed",
      ...(history.decisions.length > 0 ? { href: "#record-decisions" } : {}),
      label: "decisions",
      value: String(history.decisions.length),
    });
  }
  return rows;
}

/**
 * The rows of what a feature produced. A live item's lines lead to its timeline; a done one's to its
 * pull request's files, when its record names it. Elapsed counts from the first stage's start to
 * `now`, and has no row without a start (R5). A done item whose commits cannot be traced on the
 * default branch has no rows.
 */
export function figureRows(input: FigureInput): Array<FigureRow> {
  const { agent, done, history, now, tokens } = input;
  if (done) {
    return history.found ? doneRows(input) : [];
  }
  const rows: Array<FigureRow> = [];
  if (history.lines) {
    rows.push(linesRow(history.lines, "#stages"));
  }
  rows.push(tokensRow(tokens), agentRow(agent, now));
  const started = history.stages[0]?.started;
  if (started) {
    rows.push({
      label: "elapsed",
      value: duration(Math.max(0, (now - Date.parse(started)) / 1000)),
    });
  }
  return rows;
}
