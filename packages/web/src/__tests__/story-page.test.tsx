// The story page (US5 of the feature page): a story linked inside a sentence opens on a page of
// its own, in the live window; the old Storybook address, without a story, opens the feature's
// page, or Home for the main checkout's; and no column links Storybook (SC-005).
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { addChange, addStoryFeature, STORIES_FILE, STORY_FEATURE } from "uraeda-binding/test-utils";
import { atRepo, atWidth, fixtureRepo, quiet, renderPage, sent } from "./helpers.tsx";

const RECURRING = "2026-10-06-recurring-tasks";
const CHANGE = "2026-10-16-centred-x";
const NO_WORKTREE = "This feature has no worktree, so its stories cannot run here.";

beforeEach(() => atWidth(1440));

afterEach(() => {
  vi.useRealTimers();
});

/** A feature with a story, a preview decision, and no worktree, so no Storybook runs. */
function repoWithStories() {
  const repo = fixtureRepo();
  addStoryFeature(repo, { worktree: false });
  return repo;
}

const storyAddress = (name: string) =>
  `/f/${STORY_FEATURE}/storybook?story=${encodeURIComponent(`${STORIES_FILE}#${name}`)}`;

test("a story linked in a sentence opens on a page of its own, in the live window", async () => {
  await renderPage(storyAddress("Dragging"), repoWithStories(), { agent: true });

  expect(await screen.findByRole("figure", { name: "Dragging" })).toBeTruthy();
  expect(await screen.findByText(NO_WORKTREE)).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Open in Storybook" })).toBeNull();
  expect(window.location.pathname + window.location.search).toBe(atRepo(storyAddress("Dragging")));
});

test("the Storybook address of a feature opens its page", async () => {
  await renderPage(`/f/${RECURRING}/storybook`, fixtureRepo(), { agent: true });

  expect(await screen.findByRole("heading", { name: "Recurring tasks" })).toBeTruthy();
  expect(window.location.pathname).toBe(atRepo(`/f/${RECURRING}`));
});

test("the main checkout's Storybook address opens Home", async () => {
  await renderPage("/storybook", fixtureRepo(), { agent: true });

  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/")));
});

/** The reads of the test feature's story the page sent so far. */
const storyReads = () =>
  sent.filter((body) => body.includes('"type":"Story"') && body.includes(STORY_FEATURE)).length;

test("a story page is asked for again every 5 minutes, so its Storybook is not left idle", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  await renderPage(storyAddress("Dragging"), repoWithStories(), { agent: true });
  expect(await screen.findByText(NO_WORKTREE)).toBeTruthy();
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

test.each([
  ["session", STORY_FEATURE, undefined],
  ["change", CHANGE, { "proposal.md": "# Centre the x in failure circles\n" }],
])("the %s's column does not link Storybook", async (_kind, folder, files) => {
  const repo = repoWithStories();
  if (files) {
    addChange(repo, folder, files);
  }

  await renderPage(`/f/${folder}/session`, repo, { agent: true });

  // The column lists no file since the feature page took them: its Activity tab, once drawn.
  const column = within(await screen.findByRole("complementary", { name: "The session's column" }));
  await column.findByRole("tab", { name: /^Activity/ });
  expect(column.queryByRole("link", { name: "Storybook" })).toBeNull();
});
