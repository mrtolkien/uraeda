import type { FeatureView } from "uraeda-binding";

const STEPS: Record<string, string> = {
  discovery: "Discovery",
  spec: "Spec",
  "spec-revision": "Spec revision",
  approval: "Approval",
  plan: "Plan",
  "plan-revision": "Plan revision",
  implementation: "Implementation",
  "final-review": "Final review",
  "pull-request-changes": "Pull request changes",
  "pull-request": "Pull request",
  finish: "Finish",
  assess: "Assessment",
  "assess-revision": "Assessment revision",
  fix: "Fix",
  done: "Done",
};

export function stepLabel(name: string) {
  return STEPS[name] ?? name;
}

/** What a feature at a human gate asks: the action, and the page that does it. */
export function waiting(feature: Pick<FeatureView, "folder" | "step" | "files">) {
  const file = feature.step.file;
  const summary = feature.files.find((f) => f.name === file);
  const kind = summary?.kind;
  const action =
    kind === "clarifications"
      ? { verb: "Answer", title: "Answer questions" }
      : kind === "spec" || kind === "plan" || kind === "assessment"
        ? { verb: "Review", title: `Review the ${kind}` }
        : kind === "proposal" || kind === "report"
          ? { verb: "Write", title: `Write the ${kind}` }
          : { verb: stepLabel(feature.step.name), title: stepLabel(feature.step.name) };
  const folder = kind === "report" ? `bugs/${feature.folder}` : feature.folder;
  const href =
    kind === "proposal" || kind === "report"
      ? `/edit/specs/${folder}/${file}`
      : file
        ? `/f/${feature.folder}/${file}`
        : `/f/${feature.folder}`;
  return { ...action, line: summary?.waitingLine, href };
}
