// The spec's components: "A query counts as a view, and an embed on screen asks again every 5
// minutes", so the Storybook of a page left open is not stopped after 30 minutes without a view
// (SC-005's other side). The Storybook page counts as a view too, and asks again as an embed does
// (review focus 4).
import { act, cleanup, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { FateClient } from "react-fate";
import { afterEach, expect, test, vi } from "vite-plus/test";
import {
  addStoryFeature,
  commitOnBranch,
  git,
  STORIES_FILE,
  STORY_FEATURE,
} from "uraeda-binding/test-utils";
import { useStillViewed } from "../data.ts";
import { navigate } from "../routes.tsx";
import { StoryView } from "../views.ts";
import { atRepo, fixtureRepo, quiet, renderPage, sent } from "./helpers.tsx";

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

/** The reads of a feature's story the page sent so far, by the feature's folder. */
const readsOf = (folder: string) =>
  sent.filter((body) => body.includes('"type":"Story"') && body.includes(`"${folder}:`)).length;

test("each feature's embed asks again for its own story, at the same place of the same link", async () => {
  const repo = fixtureRepo();
  addStoryFeature(repo, { worktree: false });
  // A second feature whose spec embeds the same story, at the same block.
  const other = "2026-10-21-sidebar-again";
  git(repo, "branch", other, "main");
  const spec = git(repo, "show", `${STORY_FEATURE}:specs/${STORY_FEATURE}/spec.md`);
  commitOnBranch(repo, other, { [`specs/${other}/spec.md`]: spec });
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  await renderPage(`/f/${STORY_FEATURE}/spec.md`, repo);
  expect(
    await screen.findByText("This feature has no worktree, so its stories cannot run here."),
  ).toBeTruthy();

  await act(async () => navigate(atRepo(`/f/${other}/spec.md`)));
  await quiet();
  await waitFor(() => expect(readsOf(other)).toBeGreaterThan(0));
  expect(
    await screen.findByText("This feature has no worktree, so its stories cannot run here."),
  ).toBeTruthy();
  await quiet();
  const [first, before] = [readsOf(STORY_FEATURE), readsOf(other)];
  await act(() => vi.advanceTimersByTime(5 * 60_000));
  await quiet();

  expect([readsOf(STORY_FEATURE), readsOf(other)]).toEqual([first, before + 1]);
});

/** A fate client that only counts the requests it is sent again: the hook's own. */
function countingClient() {
  const request = vi.fn((_request: unknown, _options: unknown) => Promise.resolve({}));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <FateClient client={{ request } as never}>{children}</FateClient>
  );
  return { request, wrapper };
}

/** A request of one story, by its id. */
const askFor = (id: string) => ({ story: { id, view: StoryView } });

/** The ids each request asked again held, in order. */
const askedIds = (request: ReturnType<typeof countingClient>["request"]) =>
  request.mock.calls.map(([sent]) => Object.values(sent as Record<string, { id: string }>)[0]!.id);

test("an embed that shows another story asks again for the one it shows", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const { request, wrapper } = countingClient();
  const { rerender } = renderHook(({ id }) => useStillViewed(askFor(id)), {
    initialProps: { id: `a:${STORIES_FILE}#Dragging` },
    wrapper,
  });

  rerender({ id: `b:${STORIES_FILE}#Dragging` });
  await act(() => vi.advanceTimersByTime(5 * 60_000));

  expect(askedIds(request)).toEqual([`b:${STORIES_FILE}#Dragging`]);
});

test("an embed of a page left hidden does not ask again until it shows (SC-005)", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const { request, wrapper } = countingClient();
  renderHook(() => useStillViewed(askFor(`a:${STORIES_FILE}#Dragging`)), {
    wrapper,
  });
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");

  await act(() => vi.advanceTimersByTime(35 * 60_000));

  expect(request).not.toHaveBeenCalled();
  visibility.mockReturnValue("visible");
  await act(() => vi.advanceTimersByTime(5 * 60_000));
  expect(request).toHaveBeenCalledTimes(1);
  visibility.mockRestore();
});
