// R32: a change made while a place is kept joins it only when it keeps the same place. A tapped
// block's place is never put back as a story frame's place, kept at the same time.
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { keepPlace } from "../keepPlace.ts";

/** The frames requested, run by `draw`. */
let frames: Array<FrameRequestCallback> = [];

/** Places on screen, in px from the window's top: a story frame's bottom, and a block below it. */
const page = { block: 0, frame: 0 };

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.spyOn(window, "scrollBy").mockImplementation(((options: ScrollToOptions) => {
    page.block -= options.top ?? 0;
    page.frame -= options.top ?? 0;
  }) as typeof window.scrollBy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Runs the frames requested so far, then lets the keeps waiting on them go on. */
async function draw() {
  for (const callback of frames.splice(0)) {
    callback(0);
  }
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

const frameBottom = () => page.frame;
const blockTop = () => page.block;

test("a tap while a story frame's place is kept keeps the tapped block's place", async () => {
  page.frame = -200;
  page.block = 300;
  // A frame above the window grows by 100 px: the block below it moves down with it.
  void keepPlace(frameBottom, () => {
    page.frame += 100;
    page.block += 100;
  });
  // In the same frame, a block is tapped where it shows now, and the form above it leaves.
  const tapped = page.block;
  void keepPlace(blockTop, () => {
    page.block -= 50;
  });

  await draw();
  await draw();
  await draw();

  expect(Math.abs(page.block - tapped)).toBeLessThanOrEqual(4);
});

test("changes made while the same place is kept put it back once", async () => {
  page.frame = -200;
  page.block = 300;
  const before = page.block;
  for (const grow of [100, 40, 20]) {
    void keepPlace(frameBottom, () => {
      page.frame += grow;
      page.block += grow;
    });
  }

  await draw();
  await draw();
  await draw();

  expect(page.block).toBe(before);
});
