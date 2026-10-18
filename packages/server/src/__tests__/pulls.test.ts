import type { Changes } from "uraeda-binding";
import { afterEach, expect, test, vi } from "vite-plus/test";
import type { Binding } from "../fate/context.ts";
import { PULL_REQUESTS_EVERY_MS, startPullRequests } from "../pulls.ts";

const binding: Binding = await import("uraeda-binding");

/** No change but a branch's move, as the watcher reports one. */
const moved: Changes = {
  branchDecisions: [],
  decisions: false,
  features: ["2026-10-20-sidebar-resize"],
  files: [],
  inbox: false,
  priorities: false,
  workspace: false,
};

/** A binding whose `gh` refresh is counted, its workspace one feature at `step`. */
function counted(step: string, changed = false) {
  const refreshPullRequests = vi.fn(async () => changed);
  const readWorkspace = vi.fn(async () => ({
    features: [{ folder: "2026-10-20-sidebar-resize", step: { name: step } }],
  }));
  return {
    binding: { ...binding, readWorkspace, refreshPullRequests } as unknown as Binding,
    refreshPullRequests,
  };
}

/** Lets the refreshes started settle. */
const settled = () => new Promise((resolve) => setImmediate(resolve));

afterEach(() => vi.useRealTimers());

/** SC-001 */
test("gh runs at start, after a branch moves, and every minute while a branch is past its last task", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const { binding: fake, refreshPullRequests } = counted("final-review");
  const pulls = startPullRequests("/repo", fake, () => {});
  await settled();
  expect(refreshPullRequests).toHaveBeenCalledTimes(1);

  pulls.onChanges(moved);
  await settled();
  expect(refreshPullRequests).toHaveBeenCalledTimes(2);

  vi.advanceTimersByTime(PULL_REQUESTS_EVERY_MS);
  await settled();
  await settled();
  expect(refreshPullRequests).toHaveBeenCalledTimes(3);
  pulls.stop();
});

test("no refresh by the minute while no branch is past its last task", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const { binding: fake, refreshPullRequests } = counted("implementation");
  const pulls = startPullRequests("/repo", fake, () => {});
  await settled();

  vi.advanceTimersByTime(3 * PULL_REQUESTS_EVERY_MS);
  await settled();
  await settled();

  expect(refreshPullRequests).toHaveBeenCalledTimes(1);
  pulls.stop();
});

test("a changed snapshot publishes the repository's features", async () => {
  const { binding: fake } = counted("final-review", true);
  const changed = vi.fn();

  const pulls = startPullRequests("/repo", fake, changed);
  await settled();
  await settled();

  expect(changed).toHaveBeenCalledWith(["2026-10-20-sidebar-resize"]);
  pulls.stop();
});

test("a stopped refresher runs gh no more", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const { binding: fake, refreshPullRequests } = counted("final-review");
  const pulls = startPullRequests("/repo", fake, () => {});
  await settled();

  pulls.stop();
  pulls.onChanges(moved);
  vi.advanceTimersByTime(PULL_REQUESTS_EVERY_MS);
  await settled();

  expect(refreshPullRequests).toHaveBeenCalledTimes(1);
});
