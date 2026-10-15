// Stories and previews in fate: a story link's record starts its checkout's Storybook, turns ready
// live, and names its frame; a checkout's record restarts it; features and the workspace say whether
// they have a preview; and an agent's link is checked through the core.
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { addStoryFeature, previewStarts, STORY_FEATURE } from "uraeda-binding/test-utils";
import { byId, type Data, fixtureRepo, mutate, testApp } from "./helpers.ts";
import { connect, subscribe } from "./live-stream.ts";

const STORY = `${STORY_FEATURE}:packages/web/src/SidebarHandle.stories.tsx#Dragging`;
const MAIN_STORY = "main:packages/web/src/SidebarHandle.stories.tsx#Dragging";
const FIELDS = ["state", "frame", "storybook", "error"];
/** How long a test waits for the fake preview, which starts in well under a second. */
const WAIT = { interval: 50, timeout: 10_000 };

type App = Awaited<ReturnType<typeof testApp>>["app"];

/** A live subscription to one record: `arrival` resolves once an update holds the text. */
async function liveUpdates(app: App, name: string, type: string, id: string) {
  const stream = await connect(app, name, "preview");
  expect(await stream.arrival("connected", 5000)).toBeDefined();
  await subscribe(app, name, "preview", { entityId: id, select: ["id", ...FIELDS], type });
  return {
    arrival: (text: string) => stream.arrival(text, WAIT.timeout),
    close: () => stream.close(),
  };
}

/** The record's state once it is no longer starting. */
async function settled(app: App, type: string, id: string): Promise<Record<string, Data>> {
  await expect
    .poll(async () => (await byId(app, type, [id], FIELDS))[0]?.state, WAIT)
    .not.toBe("starting");
  return (await byId(app, type, [id], FIELDS))[0]!;
}

test("a story's first read starts its Storybook, and turns ready live (US1.1)", async () => {
  const repo = fixtureRepo();
  addStoryFeature(repo);
  const { app, name } = await testApp(repo);
  const updates = await liveUpdates(app, name, "Story", STORY);

  const [first] = await byId(app, "Story", [STORY], FIELDS);

  expect(first.state).toBe("starting");
  expect(await updates.arrival('"state":"ready"'), "no live update to ready").toBeDefined();
  await updates.close();
  const [ready] = await byId(app, "Story", [STORY], FIELDS);
  expect(ready).toMatchObject({
    error: null,
    frame: `/r/${name}/preview/${STORY_FEATURE}/iframe.html?id=sidebarhandle--dragging&viewMode=story`,
    state: "ready",
    storybook: `/f/${STORY_FEATURE}/storybook?path=/story/sidebarhandle--dragging`,
  });
});

test("an export not in the index is missing", async () => {
  const repo = fixtureRepo();
  addStoryFeature(repo);
  const { app } = await testApp(repo);
  const missing = STORY.replace("#Dragging", "#Missing");

  expect(await settled(app, "Story", missing)).toMatchObject({
    error: null,
    frame: null,
    state: "missing",
  });
});

test("a feature without a worktree has no story to run", async () => {
  const repo = fixtureRepo();
  const { log } = addStoryFeature(repo, { worktree: false });
  const { app, name, previews } = await testApp(repo);

  const [story] = await byId(app, "Story", [STORY], FIELDS);

  expect(story).toMatchObject({ frame: null, state: "none" });
  const [preview] = await byId(app, "Preview", [STORY_FEATURE], ["state", "base"]);
  expect(preview).toMatchObject({ base: null, state: "none" });
  expect(previews.state(`/r/${name}/preview/${STORY_FEATURE}/`)).toBeUndefined();
  expect(previews.state(`/r/${name}/preview/main/`)).toBeUndefined();
  expect(previewStarts(log!)).toEqual([]);
});

test("a Storybook that fails gives its last line", async () => {
  const repo = fixtureRepo();
  addStoryFeature(repo, { preview: { mode: "fail" } });
  const { app } = await testApp(repo);

  expect(await settled(app, "Story", STORY)).toMatchObject({
    error: "Storybook did not start: Error: Cannot find module 'storybook'",
    frame: null,
    state: "failed",
  });
  const [preview] = await byId(app, "Preview", [STORY_FEATURE], ["state", "error"]);
  expect(preview).toMatchObject({
    error: "Storybook did not start: Error: Cannot find module 'storybook'",
    state: "failed",
  });
});

test("preview.restart starts it again", async () => {
  const repo = fixtureRepo();
  const { log } = addStoryFeature(repo, { preview: { mode: "fail" } });
  const { app } = await testApp(repo);
  expect((await settled(app, "Preview", STORY_FEATURE)).state).toBe("failed");

  const restarted = await mutate(app, "preview.restart", { folder: STORY_FEATURE }, [
    "id",
    "state",
    "error",
  ]);

  expect(restarted.data).toMatchObject({ error: null, id: STORY_FEATURE, state: "starting" });
  await expect.poll(() => previewStarts(log!).length, WAIT).toBe(2);
});

test("the main checkout's stories run at main", async () => {
  const repo = fixtureRepo();
  const { log } = addStoryFeature(repo);
  const { app, name } = await testApp(repo);

  expect(await settled(app, "Story", MAIN_STORY)).toMatchObject({
    frame: `/r/${name}/preview/main/iframe.html?id=sidebarhandle--dragging&viewMode=story`,
    state: "ready",
    storybook: "/storybook?path=/story/sidebarhandle--dragging",
  });
  const [preview] = await byId(app, "Preview", ["main"], ["state", "base"]);
  expect(preview).toMatchObject({ base: `/r/${name}/preview/main/`, state: "ready" });
  expect(previewStarts(log!).map(({ cwd }) => cwd)).toEqual([join(repo, "packages/web")]);
});

/** Whether the test feature, and the workspace, have a preview, with the feature built so. */
async function flags(options: Parameters<typeof addStoryFeature>[1]) {
  const repo = fixtureRepo();
  addStoryFeature(repo, options);
  const { app } = await testApp(repo);
  const [feature] = await byId(app, "Feature", [STORY_FEATURE], ["preview"]);
  const [workspace] = await byId(app, "Workspace", ["workspace"], ["preview"]);
  return { feature: feature.preview, workspace: workspace.preview };
}

test("a feature and the workspace say whether they have a preview", async () => {
  expect(await flags({})).toEqual({ feature: true, workspace: true });
  expect(await flags({ preview: false })).toEqual({ feature: false, workspace: false });
  // A feature without a worktree follows the main checkout's decision (R7).
  expect(await flags({ worktree: false })).toEqual({ feature: true, workspace: true });
});

test("an agent's link is checked through the core", async () => {
  const repo = fixtureRepo();
  const { log } = addStoryFeature(repo);
  const { app, name, previews } = await testApp(repo);
  const link = "/packages/web/src/SidebarHandle.stories.tsx#Dragging";

  const hrefs = await byId(app, "StoryHref", [link, "https://example.com/x"], ["path", "export"]);

  expect(hrefs).toEqual([
    { export: "Dragging", id: link, path: "packages/web/src/SidebarHandle.stories.tsx" },
    { export: null, id: "https://example.com/x", path: null },
  ]);
  expect(previews.state(`/r/${name}/preview/${STORY_FEATURE}/`)).toBeUndefined();
  expect(previews.state(`/r/${name}/preview/main/`)).toBeUndefined();
  expect(previewStarts(log!)).toEqual([]);
});
