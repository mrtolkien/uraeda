// US5 of the UI iteration flow: Uraeda's Storybook page shows Storybook's own interface for a
// branch, at the story an embed or an inline link names (US1.3, US5.1, US5.2), as tall as the window
// and, on the phone, as wide (US5.4). The feature's page and the session's column, a change's too,
// list it (US4.5, US5.3), only with a preview decision; a story not in the index, and a failed
// Storybook, say so (edge cases).
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { atRepo, atSize, commands, repository, show } from "./helpers.tsx";

const FEATURE = "2026-10-20-sidebar-resize";
const CHANGE = "2026-10-16-centred-x";
const CHANGE_TITLE = "Centre the x in failure circles";
const PAGE = `/f/${FEATURE}/storybook`;
const AT_STORY = "?path=/story/sidebarhandle--dragging";
const BASE = () => `/r/${encodeURIComponent(repository())}/preview/${FEATURE}/`;
/** Storybook's own frame of the story, inside its interface. */
const PREVIEW_FRAME = "storybook-preview-iframe";
/** How long the fake preview may take to start and its story to load, on a loaded machine. */
const READY = { interval: 100, timeout: 20_000 };

/** Waits until Storybook's interface shows the story `Dragging` in its own frame. */
async function storyShown() {
  await expect
    .poll(() => commands.innerFrameText("Storybook", PREVIEW_FRAME), READY)
    .toContain("Dragging");
}

/**
 * Shows a refused Undo's error, which stays above every page until dismissed: a line added to
 * Later, removed by hand before its Undo.
 */
async function undoRefused() {
  await show("/priorities", "Git listener process");
  await userEvent.click(screen.getAllByRole("button", { name: "Add to the priorities" })[0]!);
  await userEvent.type(await screen.findByLabelText("Priority"), "Show the last commit");
  await userEvent.click(screen.getByRole("radio", { name: "Later" }));
  await userEvent.click(screen.getByRole("button", { name: "Add" }));
  const undo = await screen.findByRole("button", { name: "Undo" });
  const priorities = await commands.readRepo();
  await commands.writeRepo(priorities.replace("- Show the last commit\n", ""));
  await userEvent.click(undo);
  await screen.findByText(/^Could not undo/);
}

/** Adds the change `centred-x`, with its proposal, and shows its page's column. */
async function changeColumn() {
  await commands.addChange(CHANGE, { "proposal.md": `# ${CHANGE_TITLE}\n` });
  await show(`/f/${CHANGE}`, CHANGE_TITLE);
  return within(await screen.findByRole("complementary", { name: "Progress" }, READY));
}

describe("on a desktop", () => {
  atSize("desktop");

  test("Open in Storybook opens Uraeda's Storybook page at the story (US1.3, US5.1, US5.2)", async () => {
    await commands.addStoryFeature();
    await show(`/f/${FEATURE}/spec.md`, "Resize the sidebar");

    await userEvent.click(await screen.findByRole("link", { name: "Open in Storybook" }, READY));

    const frame = await screen.findByTitle("Storybook");
    expect(window.location.pathname + window.location.search).toBe(atRepo(PAGE + AT_STORY));
    const crumbs = within(screen.getByRole("navigation", { name: "Breadcrumbs" }));
    expect(crumbs.getByRole("link", { name: "Sidebar resize" })).toBeTruthy();
    expect(within(crumbs.getAllByRole("listitem").at(-1)!).getByText("Storybook")).toBeTruthy();
    expect(frame.getAttribute("src")).toBe(BASE() + AT_STORY);
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts allow-popups");
    expect(frame.getBoundingClientRect().bottom).toBe(window.innerHeight);
    expect(document.documentElement.scrollHeight).toBe(window.innerHeight);
    await storyShown();
  });

  test("the frame still reaches the window's bottom once a banner above it closes (the spec's frame as tall as the window)", async () => {
    await commands.addStoryFeature();
    await undoRefused();

    await show(PAGE, "Storybook");
    const frame = await screen.findByTitle("Storybook", {}, READY);
    expect(frame.getBoundingClientRect().bottom).toBe(window.innerHeight);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    await expect.poll(() => screen.queryByText(/^Could not undo/)).toBeNull();
    await expect.poll(() => frame.getBoundingClientRect().bottom).toBe(window.innerHeight);
  });

  test("the feature's page and the session's column list Storybook (US4.5, US5.3)", async () => {
    await commands.addStoryFeature();
    await show(`/f/${FEATURE}`, "Sidebar resize");
    const row = await screen.findByRole("link", { name: "Storybook" });
    expect(row.getAttribute("href")).toBe(atRepo(PAGE));

    await show(`/f/${FEATURE}/session`, "Feature page");
    const column = await screen.findByRole("link", { name: "Storybook" });
    expect(column.getAttribute("href")).toBe(atRepo(PAGE));
  });

  test("without a preview decision, neither lists Storybook, and it has no page (edge case)", async () => {
    await commands.addStoryFeature({ preview: false });
    await show(`/f/${FEATURE}`, "Sidebar resize");
    expect(screen.queryByRole("link", { name: "Storybook" })).toBeNull();

    await show(`/f/${FEATURE}/session`, "Feature page");
    expect(screen.queryByRole("link", { name: "Storybook" })).toBeNull();

    await show(PAGE, "Nothing here.");
    expect(screen.queryByTitle("Storybook")).toBeNull();
  });

  test("an inline link's story opens at its id (edge case)", async () => {
    await commands.addStoryFeature();
    await show(`${PAGE}?story=packages/web/src/SidebarHandle.stories.tsx%23Dragging`, "Storybook");

    const frame = await screen.findByTitle("Storybook", {}, READY);
    expect(window.location.pathname + window.location.search).toBe(atRepo(PAGE + AT_STORY));
    expect(frame.getAttribute("src")).toBe(BASE() + AT_STORY);
    await storyShown();
  });

  test("an inline link's story not in the index says so, with Open in Storybook (edge case)", async () => {
    await commands.addStoryFeature();
    await show(`${PAGE}?story=packages/web/src/SidebarHandle.stories.tsx%23Missing`, "Storybook");

    expect(
      await screen.findByText(
        "No story “Missing” in packages/web/src/SidebarHandle.stories.tsx on this branch.",
        {},
        READY,
      ),
    ).toBeTruthy();
    const open = screen.getByRole("link", { name: "Open in Storybook" });
    expect(open.getAttribute("href")).toBe(atRepo(PAGE));
  });

  test("a failed Storybook says so, with Try again (edge case)", async () => {
    await commands.addStoryFeature({ preview: { mode: "fail" } });
    await show(PAGE, "Storybook did not start: Error: Cannot find module 'storybook'");
    expect(screen.queryByTitle("Storybook")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await expect.poll(async () => (await commands.previewStarts()).length, READY).toBe(2);
  });
});

describe("a change's column, on a desktop", () => {
  atSize("desktop");

  test("lists Storybook, its checkout having a preview decision (US4.5)", async () => {
    // The decision is on `main`, which the change's branch starts from, in the main checkout the
    // change follows without a worktree.
    await commands.addStoryFeature();
    const column = await changeColumn();
    const row = await column.findByRole("link", { name: "Storybook" }, READY);
    expect(row.getAttribute("href")).toBe(atRepo(`/f/${CHANGE}/storybook`));
  });

  test("without a preview decision, does not list Storybook (edge case)", async () => {
    const column = await changeColumn();
    await column.findByRole("link", { name: "proposal.md" }, READY);
    expect(column.queryByRole("link", { name: "Storybook" })).toBeNull();
  });
});

describe("on the phone", () => {
  atSize("phone");

  test("the page is Storybook's own, the window's width (US5.4)", async () => {
    await commands.addStoryFeature();
    await show(PAGE, "Storybook");

    const frame = await screen.findByTitle("Storybook", {}, READY);
    expect(frame.getBoundingClientRect().width).toBe(window.innerWidth);
    expect(frame.getBoundingClientRect().bottom).toBe(window.innerHeight);
    await expect
      .poll(() => commands.frameText("Storybook"), READY)
      .toContain("SidebarHandle Dragging");
  });
});
