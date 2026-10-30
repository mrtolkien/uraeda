// What comes next for a feature or a change, from the step the core found: who acts, what, and the
// one action that does it. The page decides nothing: each row follows the step.
import type { FeatureView, StepView, TaskProgress } from "uraeda-binding";
import type { Trigger } from "uraeda-server/fate";
import { agentNext, waiting } from "../labels.ts";
import { sessionPath } from "../sessions.ts";
import { day } from "./times.ts";

/**
 * The one action of "Next": a link to a page of the app, by its path within the repository, or to a
 * URL; or "continue", which opens the session with the workflow's message in the composer, unsent.
 */
export type NextAction =
  | { external: boolean; href: string; kind: "link"; label: string }
  | { kind: "continue"; label: string; trigger: Trigger };

/** The workflow's recommended message, or why there is none, as the server reads it. */
export type Recommended = { name: string; trigger: Trigger } | { reason: string } | undefined;

/** The agent, as far as "Next" needs it: whether it can run, and what it is called. */
export type NextAgent = { available: boolean; name: string } | undefined;

/** What "Next" shows: its heading, the line under it, and its action. */
export type Next = { action?: NextAction; line?: string; title: string };

/** What "Next" reads of a feature. */
export type NextFeature = Pick<FeatureView, "files" | "folder" | "path"> & {
  pullRequest?: { number: number; url: string } | null;
  step: Pick<StepView, "file" | "fileKind" | "name" | "waitsOn"> & {
    progress?: TaskProgress | null;
  };
};

/** What a gate asks, by the kind of the file it waits on: the heading and the action's label. */
const GATES: Record<string, { action: string; title: string }> = {
  clarifications: { action: "Answer the questions", title: "You answer the questions" },
  plan: { action: "Review the plan", title: "You review the plan" },
  proposal: { action: "Write the proposal", title: "You write the proposal" },
  spec: { action: "Review the spec", title: "You review the spec" },
};

/** A human gate: the file's waiting line, and the page that answers it. */
function gate(feature: NextFeature): Next {
  const { href, line, title } = waiting(feature);
  const asked = GATES[feature.step.fileKind ?? ""];
  if (!asked) {
    return { action: { external: false, href, kind: "link", label: title }, title };
  }
  return {
    action: { external: false, href, kind: "link", label: asked.action },
    ...(feature.step.fileKind === "proposal" || !line ? {} : { line }),
    title: asked.title,
  };
}

/** The action that opens a pull request on GitHub, in a new tab. */
function openPull(pull: { number: number; url: string }): NextAction {
  return {
    external: true,
    href: pull.url,
    kind: "link",
    label: `Open pull request #${pull.number}`,
  };
}

/** The merge: its day, and its pull request, opened from here, when the record names one. */
function merged(feature: NextFeature, at?: string): Next {
  const pull = feature.pullRequest;
  const line = at
    ? pull
      ? `On ${day(at)}, in pull request #${pull.number}.`
      : `On ${day(at)}.`
    : undefined;
  return {
    ...(pull ? { action: openPull(pull) } : {}),
    ...(line ? { line } : {}),
    title: "Merged",
  };
}

/** The link that opens the feature's session. */
function openSession(folder: string): NextAction {
  return { external: false, href: sessionPath(folder), kind: "link", label: "Open the session" };
}

/**
 * What "Next" says at a step the agent takes: nothing to press if it cannot run, "Open the
 * session" while it works, else the recommended message as the button, or why there is none.
 */
function agentStep(
  feature: NextFeature,
  { agent, recommended, working }: { agent: NextAgent; recommended: Recommended; working: boolean },
): Pick<Next, "action" | "line"> {
  if (agent && !agent.available) {
    return { line: `${agent.name} is not available on this machine` };
  }
  if (working) {
    return { action: openSession(feature.folder) };
  }
  if (recommended && "name" in recommended) {
    return {
      action: { kind: "continue", label: recommended.name, trigger: recommended.trigger },
    };
  }
  if (recommended) {
    return { action: openSession(feature.folder), line: recommended.reason };
  }
  return {};
}

/**
 * "Next" for a feature at its step. `merged` is a done feature's merge time or day; `working`,
 * whether a turn of its session runs or waits to; `recommended`, the message the server
 * recommends, read once the page has it; `agent`, the machine's agent.
 */
export function nextOf(
  feature: NextFeature,
  {
    agent,
    merged: at,
    recommended,
    working,
  }: { agent?: NextAgent; merged?: string; recommended?: Recommended; working: boolean },
): Next {
  const { step } = feature;
  switch (step.name) {
    case "done":
      return merged(feature, at);
    case "none":
      return {
        line: "Fix the file above: the workflow cannot tell what comes next.",
        title: "Nothing can go on",
      };
    case "pull-request-unknown":
      return { title: "Pull request state unknown" };
    case "pull-request": {
      const pull = feature.pullRequest;
      return {
        ...(pull ? { action: openPull(pull) } : {}),
        line: "Review it on GitHub. The session's recommended message sends the agent to its comments.",
        title: pull
          ? `Your review on pull request #${pull.number}`
          : "Your review on the pull request",
      };
    }
    default: {
      if (step.waitsOn === "human" && step.name !== "implementation") {
        return gate(feature);
      }
      const built = step.name === "implementation";
      const { progress } = step;
      const taken = agentStep(feature, { agent, recommended, working });
      // A build at work keeps its task; its line otherwise is the step's own.
      const line =
        built && working && progress
          ? `${progress.done} of ${progress.total} tasks done · ${progress.title}`
          : taken.line;
      return {
        ...(taken.action ? { action: taken.action } : {}),
        ...(line ? { line } : {}),
        title: working && built ? "The agent is building" : agentNext(step.name),
      };
    }
  }
}
