// The spec's components: "A query counts as a view, and an embed on screen asks again every 5
// minutes", so the Storybook of a page left open is not stopped after 30 minutes without a view
// (SC-005's other side). The Storybook page counts as a view too, and asks again as an embed does
// (review focus 4).
import { act, cleanup, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { addStoryFeature, STORY_FEATURE } from "uraeda-binding/test-utils";
import { fixtureRepo, quiet, renderPage, sent } from "./helpers.tsx";

afterEach(() => {
  vi.useRealTimers();
});

/** The reads of the test feature's story the page sent so far. */
const storyReads = () =>
  sent.filter((body) => body.includes('"type":"Story"') && body.includes(STORY_FEATURE)).length;

test("a story on screen is asked for again every 5 minutes, so its Storybook is not left idle", async () => {
  const repo = fixtureRepo();
  // Without a worktree, the story's record runs nothing: only its reads are counted.
  addStoryFeature(repo, { worktree: false });
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  await renderPage(`/f/${STORY_FEATURE}/spec.md`, repo);
  expect(
    await screen.findByText("This feature has no worktree, so its stories cannot run here."),
  ).toBeTruthy();
  await quiet();
  const first = storyReads();
  expect(first).toBeGreaterThan(0);

  await act(() => vi.advanceTimersByTime(5 * 60_000));
  await quiet();

  expect(storyReads()).toBe(first + 1);

  cleanup();
  await act(() => vi.advanceTimersByTime(10 * 60_000));
  await quiet();

  expect(storyReads()).toBe(first + 1);
});

/** The reads of the test feature's Storybook the page sent so far. */
const previewReads = () =>
  sent.filter((body) => body.includes('"type":"Preview"') && body.includes(STORY_FEATURE)).length;

test("the Storybook page is asked for again every 5 minutes, so its Storybook is not left idle", async () => {
  const repo = fixtureRepo();
  // Without a worktree, the page's record runs nothing: only its reads are counted.
  addStoryFeature(repo, { worktree: false });
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  await renderPage(`/f/${STORY_FEATURE}/storybook`, repo);
  expect(
    await screen.findByText("This feature has no worktree, so its stories cannot run here."),
  ).toBeTruthy();
  await quiet();
  const first = previewReads();
  expect(first).toBeGreaterThan(0);

  await act(() => vi.advanceTimersByTime(5 * 60_000));
  await quiet();

  expect(previewReads()).toBe(first + 1);

  cleanup();
  await act(() => vi.advanceTimersByTime(10 * 60_000));
  await quiet();

  expect(previewReads()).toBe(first + 1);
});
