// Which stage each file of a feature's folder shows under: every file once, each in its stage.
import { expect, test } from "vite-plus/test";
import { filesByStage, stageOf } from "../feature/stageFiles.ts";

const FEATURE = ["proposal", "questions", "spec", "plan", "build", "pull-request", "merged"];
const CHANGE = ["proposal", "fix", "pull-request", "merged"];

/** US1.2 */
test("every kind of file goes to one stage", () => {
  const files = [
    [{ kind: "proposal", name: "proposal.md" }, "proposal"],
    [{ kind: "discovery", name: "discovery-01.md" }, "questions"],
    [{ kind: "clarifications", name: "clarifications-01.md" }, "questions"],
    [{ kind: "spec", name: "spec.md" }, "spec"],
    [{ kind: "review", name: "spec-review.md" }, "spec"],
    [{ kind: "data-model", name: "data-model.md" }, "spec"],
    [{ kind: "mockup", name: "mockups/settings.html" }, "spec"],
    [{ kind: "plan", name: "plan.md" }, "plan"],
    [{ kind: "review", name: "plan-review.md" }, "plan"],
    [{ kind: "rulings", name: "rulings.md" }, "plan"],
    [{ kind: "record", name: "record.md" }, "merged"],
  ] as const;
  for (const [file, stage] of files) {
    expect(stageOf(file, FEATURE), file.name).toBe(stage);
  }
  expect(stageOf({ kind: "rulings", name: "rulings.md" }, CHANGE)).toBe("fix");
});

/** Review focus 1 */
test("a file whose stage is absent falls to the nearest earlier one", () => {
  // A change with a round but no Questions stage: its round falls to the proposal.
  expect(stageOf({ kind: "clarifications", name: "clarifications-01.md" }, CHANGE)).toBe(
    "proposal",
  );
  // A feature at its start has only a proposal: a file of a later stage goes to it.
  expect(stageOf({ kind: "spec", name: "spec.md" }, ["proposal"])).toBe("proposal");
  expect(stageOf({ kind: "plan", name: "plan.md" }, ["questions", "merged"])).toBe("questions");
  // None of the earlier stages is there: the first.
  expect(stageOf({ kind: "proposal", name: "proposal.md" }, ["spec", "plan"])).toBe("spec");
});

/** SC-001 */
test("no file is listed twice", () => {
  const feature = {
    files: [
      { kind: "proposal", name: "proposal.md" },
      { kind: "discovery", name: "discovery-01.md", round: 1 },
      { kind: "clarifications", name: "clarifications-01.md", round: 1, status: "answered" },
      { kind: "spec", name: "spec.md", status: "awaiting-human" },
      { kind: "review", name: "spec-review.md" },
      { kind: "plan", name: "plan.md" },
      { kind: "rulings", name: "rulings.md" },
    ],
    folder: "2026-10-06-recurring-tasks",
    mockups: ["settings.html"],
    step: { file: "spec.md", waitsOn: "human" },
  };
  const grouped = filesByStage(feature, FEATURE);
  const hrefs = [...grouped.values()].flat().map((file) => file.href);
  expect(hrefs).toHaveLength(feature.files.length + feature.mockups.length);
  expect(new Set(hrefs).size).toBe(hrefs.length);
  expect(grouped.get("questions")?.map((file) => file.label)).toEqual([
    "Discovery 01",
    "Questions 01",
  ]);
  expect(grouped.get("spec")?.find((file) => file.label === "Spec")).toMatchObject({
    status: "to review",
    waiting: true,
  });
});
