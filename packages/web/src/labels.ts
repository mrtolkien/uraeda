import type { FeatureView, StepView } from "uraeda-binding";

const STEPS: Record<string, string> = {
  approval: "Approval",
  change: "Change",
  discovery: "Discovery",
  done: "Done",
  "final-review": "Final review",
  finish: "Finish",
  implementation: "Implementation",
  plan: "Plan",
  "plan-revision": "Plan revision",
  "pull-request": "Pull request",
  "pull-request-changes": "Pull request changes",
  spec: "Spec",
  "spec-revision": "Spec revision",
};

export function stepLabel(name: string) {
  return STEPS[name] ?? name;
}

/**
 * What a feature or a change at a human gate asks: the action, and the page that does it, by its
 * path within the repository.
 */
export function waiting(
  feature: Pick<FeatureView, "folder" | "files" | "kind"> & {
    step: Pick<StepView, "file" | "name">;
  },
) {
  const file = feature.step.file;
  const summary = feature.files.find((f) => f.name === file);
  const kind = summary?.kind;
  const action =
    kind === "clarifications"
      ? { title: "Answer questions", verb: "Answer" }
      : kind === "spec" || kind === "plan"
        ? { title: `Review the ${kind}`, verb: "Review" }
        : kind === "proposal"
          ? { title: "Write the proposal", verb: "Write" }
          : { title: stepLabel(feature.step.name), verb: stepLabel(feature.step.name) };
  // A change's folder is in `specs/changes/`, a feature's in `specs/`.
  const folder = feature.kind === "change" ? `changes/${feature.folder}` : feature.folder;
  const href =
    kind === "proposal"
      ? `/edit/specs/${folder}/${file}`
      : file
        ? `/f/${feature.folder}/${file}`
        : `/f/${feature.folder}`;
  return { ...action, href, line: summary?.waitingLine };
}
