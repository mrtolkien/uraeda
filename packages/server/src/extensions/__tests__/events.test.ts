// The watch of steps and commits reads a repository only while an extension listens to them: the
// first listener reads where each repository is, so its first change compares with that.
import { expect, test } from "vite-plus/test";
import { EventBus, StepWatch } from "../events.ts";

/** A repository whose one feature, `f`, is at `step`, read through a binding that counts reads. */
function watched() {
  const repository = { reads: 0, step: "spec" };
  const binding = {
    checkoutCommit: async () => "c1",
    readWorkspace: async () => {
      repository.reads += 1;
      return {
        currentBranch: "main",
        features: [{ folder: "f", step: { name: repository.step, waitsOn: "human" } }],
      };
    },
  } as unknown as ConstructorParameters<typeof StepWatch>[0];
  const bus = new EventBus(() => true);
  return { bus, repository, watch: new StepWatch(binding, bus) };
}

const repo = { name: "uraeda", path: "/repos/uraeda" };
const changed = { features: ["f"], git: false };

test("no listener, no read", async () => {
  const { bus, repository, watch } = watched();
  watch.seed(repo);
  repository.step = "plan";
  await watch.changes(repo, changed);
  bus.on("wiki", "turn-ended", () => {});

  expect(repository.reads).toBe(0);
});

test("the first listener reads where the repository is, and its changes compare with that", async () => {
  const { bus, repository, watch } = watched();
  watch.seed(repo);
  repository.step = "plan";
  await watch.changes(repo, changed);
  const events: Array<unknown> = [];

  bus.on("wiki", "step-reached", (event) => events.push(event));
  await expect.poll(() => repository.reads).toBe(1);
  bus.on("other", "commit-landed", () => {});
  repository.step = "tasks";
  await watch.changes(repo, changed);

  expect(repository.reads).toBe(2);
  expect(events).toMatchObject([{ feature: "f", repository: "uraeda", step: "tasks" }]);
});

test("a forgotten repository is not read as a listener comes", () => {
  const { bus, repository, watch } = watched();
  watch.seed(repo);
  watch.forget(repo);

  bus.on("wiki", "step-reached", () => {});

  expect(repository.reads).toBe(0);
});
