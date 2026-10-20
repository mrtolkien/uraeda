// @vitest-environment node
// The three sample projects: what the core reads from each, through the binding's workspace view.
import { readInbox, readPriorities, readWorkspace, refreshPullRequests } from "uraeda-binding";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { beforeAll, expect, test } from "vite-plus/test";
import {
  fakeGh,
  FEATURE_STEPS,
  buildProjects,
  SAMPLE_FOLDERS,
  samplePullRequests,
} from "../index.ts";

/** A feature's step, a gate named by the file it waits on, and `none` named `blocked`. */
function label({ step }: { step: { fileKind?: string; name: string } }): string {
  if (step.name === "none") {
    return "blocked";
  }
  if (step.name !== "human-gate") {
    return step.name;
  }
  return step.fileKind === "clarifications" ? "round-waiting" : `${step.fileKind}-waiting`;
}

/** The steps of a project's features. */
async function featureSteps(repo: string): Promise<Set<string>> {
  const { features } = await readWorkspace(repo);
  return new Set(features.filter(({ kind }) => kind === "feature").map(label));
}

/** The steps of a project's changes. */
async function changeStates(repo: string): Promise<Set<string>> {
  const { features } = await readWorkspace(repo);
  return new Set(features.filter(({ kind }) => kind === "change").map(({ step }) => step.name));
}

/** The problems and notes `ura check` reports in the project's features. */
async function problemCount(repo: string): Promise<number> {
  const { features } = await readWorkspace(repo);
  return features.reduce((sum, { notes, problems }) => sum + problems.length + notes.length, 0);
}

// Building the three projects commits on dozens of branches: once for the three tests.
let projects: ReturnType<typeof buildProjects>;
beforeAll(() => {
  fakeGh(samplePullRequests());
  projects = buildProjects(temporaryFolder("samples"));
}, 120_000);

test("sample has a feature at every step, and a change at each of its steps", async () => {
  const { sample } = projects;
  await refreshPullRequests(sample);

  expect(await featureSteps(sample)).toEqual(new Set(FEATURE_STEPS));
  expect(await changeStates(sample)).toEqual(
    new Set(["change", "human-gate", "pull-request", "done"]),
  );
});

test("each folder is at the step SAMPLE_FOLDERS names it for", async () => {
  const { features } = await readWorkspace(projects.sample);
  const find = (folder: string) => features.find((feature) => feature.folder === folder);

  for (const [step, folder] of Object.entries(SAMPLE_FOLDERS.features)) {
    expect(find(folder) && label(find(folder)!), folder).toBe(step);
  }
  for (const [step, folder] of Object.entries(SAMPLE_FOLDERS.changes)) {
    expect(find(folder)?.step.name, folder).toBe(step);
  }
});

test("empty is a project just set up", async () => {
  const { empty } = projects;

  expect((await featureSteps(empty)).size).toBe(0);
  expect(await problemCount(empty)).toBe(0);
  const { sections } = await readPriorities(empty);
  expect(sections.flatMap(({ entries }) => entries)).toEqual([]);
  const { categories } = await readInbox(empty);
  expect(categories.flatMap(({ notes }) => notes)).toEqual([]);
});

test("broken's features carry the problems ura check reports", async () => {
  const { broken } = projects;

  expect(await problemCount(broken)).toBeGreaterThan(0);
});
