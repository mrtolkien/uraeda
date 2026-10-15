// The preview runner's test helpers: runners stopped after each test, a clock the test moves, and
// the test feature's checkout on the fake preview.
import { join } from "node:path";
import { afterEach, expect } from "vite-plus/test";
import {
  addStoryFeature,
  type FakeMode,
  fixtureRepo,
  STORY_FEATURE,
} from "uraeda-binding/test-utils";
import { type Checkout, Previews } from "../runner.ts";

const binding = await import("uraeda-binding");

/** How long a test waits for a Storybook: a fake preview starts in well under a second. */
export const WAIT = { interval: 50, timeout: 10_000 };

/** The runners of a test, whose Storybooks are stopped after it. */
const runners: Array<Previews> = [];

afterEach(async () => {
  await Promise.all(runners.splice(0).map((runner) => runner.stopAll()));
});

/** A runner, stopped after the test. */
export function previews(options: ConstructorParameters<typeof Previews>[0] = {}): Previews {
  const runner = new Previews(options);
  runners.push(runner);
  return runner;
}

/** A clock the test moves by hand, for the runner's `now`. */
export function fakeClock(): { advance: (ms: number) => void; now: () => number } {
  let time = 1_000_000;
  return {
    advance: (ms) => {
      time += ms;
    },
    now: () => time,
  };
}

/** The checkout at `dir`, under `base`, from its own preview decision, read by the binding. */
export async function checkoutOf(dir: string, base: string): Promise<Checkout> {
  const found = await binding.preview(dir);
  if (found === null) {
    throw new Error(`${dir} has no active preview decision`);
  }
  return { base, command: found.command, dir, folder: found.folder };
}

/**
 * A fixture repository with the test feature, its worktree's preview running the fake preview in
 * `mode`: the worktree's checkout, under `/r/repo/preview/2026-10-20-sidebar-resize/`, and the
 * fake's log of starts.
 */
export async function storyCheckout(
  options: { delay?: number; mode?: FakeMode } = {},
): Promise<{ checkout: Checkout; log: string; repo: string }> {
  const repo = fixtureRepo();
  const { log } = addStoryFeature(repo, { preview: options });
  const dir = join(repo, ".worktrees", STORY_FEATURE);
  const checkout = await checkoutOf(dir, `/r/repo/preview/${STORY_FEATURE}/`);
  return { checkout, log: log!, repo };
}

/** Waits for the checkout's Storybook to be ready. */
export async function ready(runner: Previews, checkout: Checkout): Promise<void> {
  await expect.poll(() => runner.state(checkout.base)?.state, WAIT).toBe("ready");
}

/** Whether the process is running. */
export function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
