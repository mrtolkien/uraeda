import type { FeatureView } from "uraeda-binding";

const STEPS: Record<string, string> = {
  approval: "Approval",
  assess: "Assessment",
  "assess-revision": "Assessment revision",
  discovery: "Discovery",
  done: "Done",
  "final-review": "Final review",
  finish: "Finish",
  fix: "Fix",
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
 * What a feature at a human gate asks: the action, and the page that does it, by its path within
 * the repository.
 */
export function waiting(feature: Pick<FeatureView, "folder" | "step" | "files">) {
  const file = feature.step.file;
  const summary = feature.files.find((f) => f.name === file);
  const kind = summary?.kind;
  const action =
    kind === "clarifications"
      ? { title: "Answer questions", verb: "Answer" }
      : kind === "spec" || kind === "plan" || kind === "assessment"
        ? { title: `Review the ${kind}`, verb: "Review" }
        : kind === "proposal" || kind === "report"
          ? { title: `Write the ${kind}`, verb: "Write" }
          : { title: stepLabel(feature.step.name), verb: stepLabel(feature.step.name) };
  const folder = kind === "report" ? `bugs/${feature.folder}` : feature.folder;
  const href =
    kind === "proposal" || kind === "report"
      ? `/edit/specs/${folder}/${file}`
      : file
        ? `/f/${feature.folder}/${file}`
        : `/f/${feature.folder}`;
  return { ...action, href, line: summary?.waitingLine };
}
