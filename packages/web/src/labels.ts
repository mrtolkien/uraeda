import type { FeatureView, FileSummary } from "uraeda-binding";

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

const RANK: Record<string, number> = {
  proposal: 0,
  report: 0,
  discovery: 1,
  clarifications: 1,
  spec: 2,
  plan: 3,
  assessment: 3,
  rulings: 4,
  "data-model": 5,
  review: 6,
};

/** A feature's files in workflow order: rounds of discovery and questions by round, then the rest. */
export function workflowOrder(files: ReadonlyArray<FileSummary>) {
  return [...files].sort(
    (a, b) =>
      (RANK[a.kind] ?? 9) - (RANK[b.kind] ?? 9) ||
      (a.round ?? 0) - (b.round ?? 0) ||
      (a.kind === "discovery" ? 0 : 1) - (b.kind === "discovery" ? 0 : 1) ||
      a.name.localeCompare(b.name),
  );
}
