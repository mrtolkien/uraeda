// What comes next for a feature or a change: who acts, why, and the one action that does it. The
// server decides the step, the status, and the message; this only reads them in order, the first
// that holds winning: the human's run to deal with, the agent at work, the step's gate, the agent's
// step, the pull request, the merge.
import type { Route } from "../../store";
import type {
  Feature,
  HistoryView,
  RecommendedMessage,
  StatusReason,
  Trigger,
} from "../../store/protocol";
import { agentDoes, clock, day, plural, stepWord } from "./words";

/** The one action of "Next". */
export type NextAction =
  | { kind: "open"; label: string; to: Route }
  | { kind: "url"; label: string; url: string }
  | { kind: "clean"; label: string }
  | { kind: "continue"; label: string; step: string | null; text: string; trigger: Trigger };

/**
 * What "Next" shows: its title, the line of why under it, who acts (`human` when the page waits on
 * them, which colours the pane), and its action.
 */
export type Next = {
  action?: NextAction;
  line?: string;
  title: string;
  waitsOn: "agent" | "human" | "nobody";
};

/** What the next step reads beyond the feature. */
export type NextInput = {
  history?: HistoryView;
  /** The run's own words, as a failed turn's reason. */
  ended?: string;
  now: number;
  recommended?: RecommendedMessage | null;
  /** Why the run waits, in words, while it waits to go on by itself. */
  waits?: string;
};

/** The session the feature follows, else its feature's session page. */
const sessionOf = (feature: Feature): Route =>
  feature.status.session === null
    ? { folder: feature.folder, page: "session" }
    : { id: feature.status.session, page: "session-id" };

const openSession = (feature: Feature, label = "Open the session"): NextAction => ({
  kind: "open",
  label,
  to: sessionOf(feature),
});

/** A run that stopped and asks the human: its title, by why. */
const ENDED: Partial<Record<StatusReason, string>> = {
  blocked: "The agent asks for your permission",
  capped: "The run stopped going on by itself",
  conflict: "Catching up ended on a conflict",
  failed: "The run failed",
  halted: "The run ended before its gate",
  interrupted: "The server stopped the run",
  stopped: "You stopped the run",
};

/** What a gate asks, by the kind of the file it waits on. */
const GATES: Readonly<Record<string, { action: string; title: string }>> = {
  clarifications: { action: "Answer the questions", title: "You answer the questions" },
  plan: { action: "Review the plan", title: "You review the plan" },
  proposal: { action: "Write the proposal", title: "You write the proposal" },
  spec: { action: "Review the spec", title: "You review the spec" },
};

/** When the current stage started: "since 14:02". */
function since(history: HistoryView | undefined, now: number): string | undefined {
  const started = history?.stages[history.current]?.started;
  return started ? `Waiting since ${clock(started, now)}` : undefined;
}

/** A human gate: the file it waits on, and the page that answers it. */
function gate(feature: Feature, input: NextInput): Next {
  const { file, fileKind } = feature.step;
  const asked = GATES[fileKind ?? ""];
  const to: Route =
    fileKind === "proposal" && file !== null
      ? { page: "edit", path: `${feature.path}/${file}` }
      : file === null
        ? { folder: feature.folder, page: "feature" }
        : { folder: feature.folder, name: file, page: "file" };
  const waiting = feature.files.find((one) => one.name === file)?.waitingLine ?? undefined;
  const title = asked?.title ?? stepWord(feature.step.name);
  const line = [waiting, since(input.history, input.now)].filter(Boolean).join(" · ");
  return {
    action: { kind: "open", label: asked?.action ?? `Open ${file ?? "the step"}`, to },
    line: line === "" ? undefined : line,
    title,
    waitsOn: "human",
  };
}

/** A step the agent takes: the message that starts it, or why none can. */
function agentStep(feature: Feature, input: NextInput): Next {
  const { step } = feature;
  const progress = step.progress;
  const built =
    step.name === "implementation" && progress !== null
      ? `${progress.done} of ${plural(progress.total, "task")} done · ${progress.title}`
      : undefined;
  const recommended = input.recommended;
  if (recommended?.name && recommended.trigger !== null) {
    return {
      action: {
        kind: "continue",
        label: recommended.name,
        step: recommended.step,
        text: recommended.text,
        trigger: recommended.trigger,
      },
      line: built,
      title: agentDoes(step.name),
      waitsOn: "human",
    };
  }
  return {
    action: feature.sessions.length > 0 ? openSession(feature) : undefined,
    line: recommended?.reason ?? built,
    title: agentDoes(step.name),
    waitsOn: "nobody",
  };
}

/** The merge: its day, and Clean while its worktree or branch is left, else its pull request. */
function merged(feature: Feature, history: HistoryView | undefined): Next {
  const at = history?.stages.find((stage) => stage.name === "merged")?.started ?? history?.finished;
  const pull = feature.pullRequest;
  const line = at
    ? `On ${day(at)}${pull === null ? "" : `, in pull request #${pull.number}`}.`
    : undefined;
  const left = feature.leftBranch !== null || feature.leftWorktree !== null;
  const action: NextAction | undefined = left
    ? { kind: "clean", label: "Clean what it left" }
    : pull === null
      ? undefined
      : { kind: "url", label: `Open pull request #${pull.number}`, url: pull.url };
  return { action, line, title: "Merged", waitsOn: left ? "human" : "nobody" };
}

/** "Next" for `feature`, from its status first, then its step. */
export function nextOf(feature: Feature, input: NextInput): Next {
  const { status, step } = feature;
  if (step.name === "done") return merged(feature, input.history);
  if (feature.problems.length > 0) {
    const first = feature.problems[0].file.split("/").pop() ?? feature.problems[0].file;
    return {
      action: {
        kind: "open",
        label: `Open ${first}`,
        to: { folder: feature.folder, name: first, page: "file" },
      },
      line: "Fix what the check found: the workflow cannot tell what comes next.",
      title: `This ${feature.kind === "change" ? "change" : "feature"} cannot go on`,
      waitsOn: "human",
    };
  }
  const ended = status.reason === null ? undefined : ENDED[status.reason];
  if (ended !== undefined && status.status !== "working") {
    return { action: openSession(feature), line: input.ended, title: ended, waitsOn: "human" };
  }
  if (status.status === "working") {
    const building = step.name === "implementation" && step.progress !== null;
    return {
      action: openSession(feature, "Follow the session"),
      line:
        input.waits ??
        (building && step.progress !== null
          ? `${step.progress.done} of ${plural(step.progress.total, "task")} done · ${step.progress.title}`
          : undefined),
      title: input.waits === undefined ? agentDoes(step.name) : "The run waits",
      waitsOn: "agent",
    };
  }
  if (step.name === "pull-request") {
    const pull = feature.pullRequest;
    return {
      action:
        pull === null
          ? undefined
          : { kind: "url", label: `Open pull request #${pull.number}`, url: pull.url },
      line: "Review it on GitHub: the agent then answers its comments.",
      title:
        pull === null
          ? "Your review on the pull request"
          : `Your review on pull request #${pull.number}`,
      waitsOn: "human",
    };
  }
  if (step.name === "pull-request-unknown") {
    return {
      line: "Its state could not be read from GitHub: check `gh auth status` on the server.",
      title: "The pull request's state is unknown",
      waitsOn: "nobody",
    };
  }
  if (step.name === "none") {
    return {
      line: "Fix its files: the workflow cannot tell what comes next.",
      title: "Nothing can go on",
      waitsOn: "human",
    };
  }
  if (step.waitsOn === "human" && step.name !== "implementation") return gate(feature, input);
  return agentStep(feature, input);
}
