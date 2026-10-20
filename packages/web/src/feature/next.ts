// What comes next for a feature or a change, from the step the core found: who acts, what, and the
// one action that does it. The page decides nothing: each row follows the step.
import type { FeatureView, StepView, TaskProgress } from "uraeda-binding";
import { agentNext, waiting } from "../labels.ts";
import { day } from "./times.ts";

/** The one action of "Next": a page of the app, by its path within the repository, or a URL. */
export type NextAction = { external: boolean; href: string; label: string };

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
    return { action: { external: false, href, label: title }, title };
  }
  return {
    action: { external: false, href, label: asked.action },
    ...(feature.step.fileKind === "proposal" || !line ? {} : { line }),
    title: asked.title,
  };
}

/** The action that opens a pull request on GitHub, in a new tab. */
function openPull(pull: { number: number; url: string }): NextAction {
  return { external: true, href: pull.url, label: `Open pull request #${pull.number}` };
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

/**
 * "Next" for a feature at its step. `merged` is a done feature's merge time or day; `working`,
 * whether a turn of its session runs or waits to.
 */
export function nextOf(
  feature: NextFeature,
  { merged: at, working }: { merged?: string; working: boolean },
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
    case "implementation": {
      const { progress } = step;
      return {
        ...(progress
          ? { line: `Task ${progress.position} of ${progress.total}: ${progress.title}` }
          : {}),
        title: "The agent is building",
      };
    }
    default:
      if (step.waitsOn === "human") {
        return gate(feature);
      }
      return {
        ...(working ? {} : { line: "The agent takes it from here: open the session to start it." }),
        title: agentNext(step.name),
      };
  }
}
