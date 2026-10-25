// Which stage of a feature's or a change's timeline each file of its folder shows under, so that
// every file shows once (SC-001). A pure rule, read by the timeline and its tests.

/** A workflow file, as the core summarises it. */
type File = { kind: string; name: string; round?: number | null; status?: string | null };

/** What the timeline reads of a feature to list its files. */
export type FilesFeature = {
  files: ReadonlyArray<File>;
  folder: string;
  mockups: ReadonlyArray<string>;
  step?: { file?: string | null; waitsOn: string };
};

/** A file as the timeline lists it: where it goes, its name, and what it is waiting on. */
export type TimelineFile = { href: string; label: string; status?: string; waiting?: boolean };

/** The stages in workflow order, features' and changes' together: a missing one falls back along it. */
const ORDER = ["proposal", "questions", "spec", "plan", "fix", "build", "pull-request", "merged"];

/** A file kind's name in words. */
const KINDS: Record<string, string> = {
  "data-model": "Data model",
  plan: "Plan",
  proposal: "Proposal",
  record: "Record",
  rulings: "Rulings",
  spec: "Spec",
};

/** The stage a file belongs to, before the feature's stages are known. */
function wanted(file: { kind: string; name: string }, stages: ReadonlyArray<string>): string {
  switch (file.kind) {
    case "proposal":
      return "proposal";
    case "discovery":
    case "clarifications":
      return "questions";
    case "review":
      return file.name.startsWith("plan") ? wanted({ kind: "plan", name: "" }, stages) : "spec";
    case "plan":
    case "rulings":
      // A change has no Plan: its notes on the fix are its Fix stage's.
      return stages.includes("plan") ? "plan" : "fix";
    case "record":
      return "merged";
    default:
      return "spec";
  }
}

/**
 * The stage of `stages` a file shows under: its own, else the nearest earlier stage of the list
 * (a change's round, with no Questions stage, falls to its proposal), else the first.
 */
export function stageOf(
  file: { kind: string; name: string },
  stages: ReadonlyArray<string>,
): string {
  const target = wanted(file, stages);
  if (stages.includes(target)) {
    return target;
  }
  const earlier = ORDER.slice(0, ORDER.indexOf(target)).reverse();
  return earlier.find((name) => stages.includes(name)) ?? stages[0] ?? target;
}

/** A file's name in words, "Questions 01" or "Spec review". */
function labelOf(file: File): string {
  const round = file.round ? ` ${String(file.round).padStart(2, "0")}` : "";
  switch (file.kind) {
    case "discovery":
      return `Discovery${round}`;
    case "clarifications":
      return `Questions${round}`;
    case "review":
      return file.name.startsWith("plan") ? "Plan review" : "Spec review";
    default:
      return KINDS[file.kind] ?? file.name;
  }
}

/** The files by stage: each of the folder's files and mockups under one of `stages`, in order. */
export function filesByStage(
  feature: FilesFeature,
  stages: ReadonlyArray<string>,
): Map<string, Array<TimelineFile>> {
  const grouped = new Map<string, Array<TimelineFile>>(stages.map((name) => [name, []]));
  const waitingFor = feature.step?.waitsOn === "human" ? feature.step.file : undefined;
  const put = (stage: string, file: TimelineFile) => grouped.get(stage)?.push(file);
  for (const file of feature.files) {
    const waiting = file.name === waitingFor;
    const status = waiting ? "to review" : file.kind === "record" ? undefined : file.status;
    put(stageOf(file, stages), {
      href: `/f/${feature.folder}/${file.name}`,
      label: labelOf(file),
      ...(status ? { status } : {}),
      ...(waiting ? { waiting } : {}),
    });
  }
  for (const name of feature.mockups) {
    put(stageOf({ kind: "mockup", name }, stages), {
      href: `/f/${feature.folder}/mockups/${name}`,
      label: `mockups/${name}`,
    });
  }
  return grouped;
}
