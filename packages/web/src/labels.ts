import type { FeatureView, StepView } from "uraeda-binding";

const STEPS: Record<string, string> = {
  approval: "Approval",
  change: "Change",
  discovery: "Discovery",
  done: "Done",
  "final-review": "Final review",
  finish: "Finishing, draft pull request",
  implementation: "Implementation",
  plan: "Plan",
  "plan-revision": "Plan revision",
  "pull-request": "Pull request ready",
  "pull-request-changes": "Changes requested",
  "pull-request-unknown": "Pull request state unknown",
  spec: "Spec",
  "spec-revision": "Spec revision",
};

export function stepLabel(name: string) {
  return STEPS[name] ?? name;
}

type Step = Pick<StepView, "fileKind" | "name">;

/** What a human gate asks, from the kind of the file it waits on, as the core names it. */
function gateAction(step: Step) {
  const kind = step.fileKind;
  return kind === "clarifications"
    ? { title: "Answer questions", verb: "Answer" }
    : kind === "spec" || kind === "plan"
      ? { title: `Review the ${kind}`, verb: "Review" }
      : kind === "proposal"
        ? { title: "Write the proposal", verb: "Write" }
        : { title: stepLabel(step.name), verb: stepLabel(step.name) };
}

/** A step as the human reads it: what a gate asks of them, like "Review the spec", or its name. */
export function stepTitle(step: Step & Pick<StepView, "waitsOn">) {
  return step.waitsOn === "human" ? gateAction(step).title : stepLabel(step.name);
}

/**
 * What a feature or a change at a human gate asks: the action, and the page that does it, by its
 * path within the repository.
 */
export function waiting(
  feature: Pick<FeatureView, "folder" | "files" | "path"> & {
    step: Pick<StepView, "file" | "fileKind" | "name">;
  },
) {
  const file = feature.step.file;
  const summary = feature.files.find((f) => f.name === file);
  const href =
    feature.step.fileKind === "proposal"
      ? `/edit/${feature.path}/${file}`
      : file
        ? `/f/${feature.folder}/${file}`
        : `/f/${feature.folder}`;
  return { ...gateAction(feature.step), href, line: summary?.waitingLine };
}
