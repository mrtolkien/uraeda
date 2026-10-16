// US1 of the UI iteration flow: a story link alone in its paragraph shows the story live, from the
// branch's Storybook, at a phone and a desktop width (US1.1, US1.2, US1.5), in Uraeda's colour mode
// (US1.4), in every workflow file (US1.6), with one Storybook for every page (US1.7, SC-001), and
// through a listed host name (SC-006). The embed's states and edge cases: a failed start, a missing
// story, no worktree, a story that never reports its height, a frame Storybook reloads, a malformed
// size, no preview decision, and story links that do not embed. Frames load only once on screen, and
// a feature's page starts its Storybook before any story is embedded.
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { atRepo, atSize, commands, LIVE, repository, show } from "./helpers.tsx";

const FEATURE = "2026-10-20-sidebar-resize";
const SPEC = `/f/${FEATURE}/spec.md`;
const PROPOSAL = `/f/${FEATURE}/proposal.md`;
const STORIES = "packages/web/src/SidebarHandle.stories.tsx";
const LABEL = "Dragging the handle";
const PHONE = `${LABEL}, phone`;
const DESKTOP = `${LABEL}, desktop`;
const FRAME = async (name: string) =>
  `/r/${encodeURIComponent(name)}/preview/${await commands.frameSecret()}/${FEATURE}/iframe.html?id=sidebarhandle--dragging&viewMode=story`;
/** How long the fake preview may take to start and its story to load, on a loaded machine. */
const READY = { interval: 100, timeout: 20_000 };

/** The embed of the test feature's story, by its label. */
const embed = () => screen.getByRole("figure", { name: LABEL });

/** Waits until a frame shows its story. */
async function storyShown(title: string, options = READY) {
  await expect.poll(() => commands.frameText(title), options).toContain("Dragging");
}

/** The texts of the embed's live regions, which a screen reader says as they change. */
const statuses = () =>
  within(embed())
    .queryAllByRole("status")
    .map((region) => region.textContent);

/** A frame's height on the page, in px. */
const heightOf = (title: string) => screen.getByTitle(title).getBoundingClientRect().height;

describe("on a desktop", () => {
  atSize("desktop");

  test("a story link alone starts the branch's Storybook, and shows the story at both widths (US1.1)", async () => {
    await commands.addStoryFeature({ preview: { delay: 1500 } });
    await show(SPEC, "Resize the sidebar");

    expect(await within(embed()).findByText("Starting Storybook for this branch…")).toBeTruthy();
    // Said, as it changes, to a screen reader too.
    expect(statuses()).toContain("Starting Storybook for this branch…");
    const phone = await within(embed()).findByTitle(PHONE, {}, READY);
    const desktop = within(embed()).getByTitle(DESKTOP);
    // On screen, the frames load as soon as the observer sees them.
    await expect
      .poll(() => [phone.getAttribute("src"), desktop.getAttribute("src")])
      .toEqual([await FRAME(repository()), await FRAME(repository())]);
    expect(phone.getAttribute("sandbox")).toBe("allow-scripts allow-popups");
    expect(desktop.getAttribute("sandbox")).toBe("allow-scripts allow-popups");
    await storyShown(DESKTOP);
    await storyShown(PHONE);
    expect(phone.getBoundingClientRect().width).toBe(402);
    expect(desktop.getBoundingClientRect().width).toBeLessThan(1440);
    expect(desktop.getBoundingClientRect().right).toBeLessThanOrEqual(
      embed().getBoundingClientRect().right,
    );
    const [start] = await commands.previewStarts();
    expect(start.cwd).toMatch(/\.worktrees\/2026-10-20-sidebar-resize\/packages\/web$/);
    expect(start.base).toBe(
      `/r/${encodeURIComponent(repository())}/preview/${await commands.frameSecret()}/${FEATURE}/`,
    );
  });

  test("Desktop, Phone, and Both choose the widths, and the story runs in each (US1.2)", async () => {
    await commands.addStoryFeature();
    await show(SPEC, "Resize the sidebar");
    await storyShown(DESKTOP);
    const column = embed().getBoundingClientRect().width;

    await userEvent.click(within(embed()).getByRole("radio", { name: "Desktop" }));

    expect(within(embed()).queryByTitle(PHONE)).toBeNull();
    // The desktop width alone, scaled to the whole column.
    await expect
      .poll(() => within(embed()).getByTitle(DESKTOP).getBoundingClientRect().width)
      .toBeGreaterThan(column - 50);
    await storyShown(DESKTOP);
    await commands.frameClick(DESKTOP, "button", "Hide the sidebar");
    await expect.poll(() => commands.frameText(DESKTOP)).toContain("Clicked 1 time");

    await userEvent.click(within(embed()).getByRole("radio", { name: "Phone" }));

    expect(within(embed()).queryByTitle(DESKTOP)).toBeNull();
    expect(within(embed()).getByTitle(PHONE).getBoundingClientRect().width).toBe(402);
    await storyShown(PHONE);
    await commands.frameClick(PHONE, "button", "Hide the sidebar");
    await expect.poll(() => commands.frameText(PHONE)).toContain("Clicked 1 time");

    await userEvent.click(within(embed()).getByRole("radio", { name: "Both" }));

    expect(within(embed()).getByTitle(PHONE)).toBeTruthy();
    expect(within(embed()).getByTitle(DESKTOP)).toBeTruthy();
  });

  test("a second page uses the running Storybook, ready within 2 seconds (US1.7, SC-001)", async () => {
    await commands.addStoryFeature();
    await show(SPEC, "Resize the sidebar");
    await storyShown(DESKTOP);

    await show(PROPOSAL, "Long feature names are cut");

    await storyShown(DESKTOP, { interval: 50, timeout: 2000 });
    await storyShown(PHONE, { interval: 50, timeout: 2000 });
    expect(await commands.previewStarts()).toHaveLength(1);
  });
});

describe("on a desktop, as embeds load", () => {
  atSize("desktop");

  test("a feature's page starts its Storybook, so its spec's story is ready once opened", async () => {
    await commands.addStoryFeature();
    await show(`/f/${FEATURE}`, "Sidebar resize");

    // No story is embedded on the feature's page.
    expect(screen.queryByRole("figure", { name: LABEL })).toBeNull();
    await expect.poll(() => commands.previewStarts(), READY).toHaveLength(1);
    await show(SPEC, "Resize the sidebar");
    await storyShown(DESKTOP);
    expect(await commands.previewStarts()).toHaveLength(1);
  });

  test("an embed below the window loads its frames only once scrolled to, its Storybook started at once", async () => {
    await commands.addStoryFeature();
    await page.viewport(1440, 300);
    try {
      await show(SPEC, "Resize the sidebar");
      const phone = await within(embed()).findByTitle(PHONE, {}, READY);
      const desktop = within(embed()).getByTitle(DESKTOP);
      expect(embed().getBoundingClientRect().top).toBeGreaterThan(window.innerHeight);
      expect([phone.getAttribute("src"), desktop.getAttribute("src")]).toEqual([null, null]);
      expect(await commands.previewStarts()).toHaveLength(1);

      embed().scrollIntoView();

      await expect.poll(() => phone.getAttribute("src")).toBe(await FRAME(repository()));
      expect(desktop.getAttribute("src")).toBe(await FRAME(repository()));
      await storyShown(PHONE);
      // Once loaded, a frame stays loaded when scrolled away.
      window.scrollTo(0, 0);
      await storyShown(DESKTOP);
      expect(phone.getAttribute("src")).toBe(await FRAME(repository()));
    } finally {
      await page.viewport(1440, 900);
    }
  });
});

describe("on a desktop, the frames and their messages", () => {
  atSize("desktop");

  test("the story is drawn in Uraeda's colour mode, and follows it (US1.4)", async () => {
    window.localStorage.setItem("uraeda.theme", "dark");
    await commands.addStoryFeature();
    await show(SPEC, "Resize the sidebar");
    await storyShown(DESKTOP);
    await expect.poll(() => commands.frameAttribute(DESKTOP, "html", "data-mode")).toBe("dark");
    await expect.poll(() => commands.frameAttribute(PHONE, "html", "data-mode")).toBe("dark");

    const theme = screen.getByRole("radiogroup", { name: "Theme" });
    await userEvent.click(within(theme).getByRole("radio", { name: "Light" }));

    await expect.poll(() => commands.frameAttribute(DESKTOP, "html", "data-mode")).toBe("light");
    await expect.poll(() => commands.frameAttribute(PHONE, "html", "data-mode")).toBe("light");
  });

  test("after Storybook reloads a frame, it gets the colour mode again (review focus 2)", async () => {
    window.localStorage.setItem("uraeda.theme", "dark");
    await commands.addStoryFeature();
    await show(SPEC, "Resize the sidebar");
    await expect
      .poll(() => commands.frameAttribute(DESKTOP, "html", "data-mode"), READY)
      .toBe("dark");

    // A reloaded story starts without a mode, as the fake preview's page does.
    await commands.frameReload(DESKTOP);

    await expect.poll(() => commands.frameAttribute(DESKTOP, "html", "data-mode")).toBe("dark");
  });

  test("a size that is not a number above 0 is ignored (review focus 6)", async () => {
    await commands.addStoryFeature();
    await show(SPEC, "Resize the sidebar");
    await expect
      .poll(() => commands.frameAttribute(PHONE, "html", "data-mode"), READY)
      .toBe("light");
    const before = heightOf(PHONE);

    // Each malformed size, then a `ready`, whose answer, the mode sent again, comes after them.
    await commands.frameRun(
      PHONE,
      `document.documentElement.dataset.mode = "none";
      for (const height of [-1, 0, "300", null, Infinity, NaN]) {
        window.parent.postMessage({ uraeda: "size", height }, "*");
      }
      window.parent.postMessage({ uraeda: "ready" }, "*");`,
    );

    await expect.poll(() => commands.frameAttribute(PHONE, "html", "data-mode")).toBe("light");
    expect(heightOf(PHONE)).toBe(before);
  });

  test("a story that never reports its height is 560 px tall", async () => {
    await commands.addStoryFeature({ preview: { mode: "no-pick" } });
    await show(SPEC, "Resize the sidebar");

    await storyShown(PHONE);

    expect(heightOf(PHONE)).toBe(560);
  });

  test("a story as tall as its window stops growing at 900 px (edge case)", async () => {
    await commands.addStoryFeature();
    const worktree = `.worktrees/${FEATURE}`;
    const stories = await commands.readRepo(`${worktree}/${STORIES}`);
    await commands.writeRepo(`${stories}export const FullHeight = {};\n`, `${worktree}/${STORIES}`);
    const proposal = `${worktree}/specs/${FEATURE}/proposal.md`;
    const text = await commands.readRepo(proposal);
    await commands.writeRepo(`${text}\n[Full height](/${STORIES}#FullHeight)\n`, proposal);
    await show(PROPOSAL, "Long feature names are cut");
    await expect
      .poll(() => commands.frameText("Full height, phone"), READY)
      .toContain("FullHeight");

    // The story's root follows the frame's height: each size it reports grows the frame again.
    await expect.poll(() => heightOf("Full height, phone"), READY).toBeGreaterThanOrEqual(900);
    expect(heightOf("Full height, phone")).toBe(900);
  });

  test("through a listed host name, the embed works as through 127.0.0.1 (SC-006)", async () => {
    await commands.addStoryFeature();

    const text = await commands.openThroughHost(SPEC, DESKTOP, "Channel open");

    expect(text).toContain("Dragging");
    expect(text).toContain("Channel open");
  });
});

describe("on a desktop, the embed among other windows and boxes", () => {
  atSize("desktop");

  test("a size from any window other than one of the embed's frames is ignored (edge case)", async () => {
    await commands.addStoryFeature();
    // A second embed on the page, the proposal's, as on disk in the worktree.
    const proposal = `.worktrees/${FEATURE}/specs/${FEATURE}/proposal.md`;
    const text = await commands.readRepo(proposal);
    await commands.writeRepo(`${text}\n[Thin line](/${STORIES}#ThinLine)\n`, proposal);
    await show(PROPOSAL, "Long feature names are cut");
    for (const title of [PHONE, "Thin line, phone"]) {
      await expect
        .poll(() => commands.frameAttribute(title, "html", "data-mode"), READY)
        .toBe("light");
    }
    const before = heightOf(PHONE);
    expect(before).not.toBe(300);

    // The page itself: the embed's listener reads it before this one, added after it.
    const seen = new Promise((resolve) =>
      window.addEventListener("message", resolve, { once: true }),
    );
    window.postMessage({ height: 300, uraeda: "size" }, "*");
    await seen;
    expect(heightOf(PHONE)).toBe(before);

    // The other embed's frame: its own embed takes it, and this one does not.
    await commands.frameRun(
      "Thin line, phone",
      `window.parent.postMessage({ uraeda: "size", height: 300 }, "*");`,
    );
    await expect.poll(() => heightOf("Thin line, phone")).toBe(300);
    expect(heightOf(PHONE)).toBe(before);
  });

  test("in a pane too narrow for both widths, Both shows the phone's alone, within the pane", async () => {
    await commands.addStoryFeature();
    // The main checkout's draft embeds the story, and opens in a pane beside the priorities.
    const draft = "specs/drafts/git-listener.md";
    const text = await commands.readRepo(draft);
    await commands.writeRepo(`${text}\n[${LABEL}](/${STORIES}#Dragging)\n`, draft);
    await show("/priorities/git-listener", "So agents start without me.");

    const phone = await within(embed()).findByTitle(PHONE, {}, READY);
    await storyShown(PHONE);
    expect(within(embed()).getByRole("radio", { checked: true, name: "Both" })).toBeTruthy();
    expect(within(embed()).queryByTitle(DESKTOP)).toBeNull();
    expect(phone.getBoundingClientRect().right).toBeLessThanOrEqual(
      embed().getBoundingClientRect().right,
    );
  });
});

describe("on the phone", () => {
  atSize("phone");

  test("on the phone, the embed is as wide as the page, at the phone width, with named icons (US1.5)", async () => {
    await commands.addStoryFeature();
    await show(SPEC, "Resize the sidebar");

    const phone = await within(embed()).findByTitle(PHONE, {}, READY);
    await storyShown(PHONE);
    expect(phone.getBoundingClientRect().width).toBe(window.innerWidth);
    expect(within(embed()).queryByTitle(DESKTOP)).toBeNull();
    expect(within(embed()).queryByRole("radio")).toBeNull();
    const open = within(embed()).getByRole("link", { name: "Open in Storybook" });
    expect(open.textContent).not.toContain("Open in Storybook");
  });
});

test("an approved spec and a proposal embed their stories (US1.6, other workflow files)", async () => {
  await commands.addStoryFeature({ specStatus: "approved" });
  await show(SPEC, "Resize the sidebar");
  await storyShown(PHONE);

  await show(PROPOSAL, "Long feature names are cut");

  await storyShown(PHONE);
});

test("each state says why the story does not show", async () => {
  await commands.addStoryFeature({ preview: { mode: "fail" } });
  await show(SPEC, "Resize the sidebar");
  expect(
    await within(embed()).findByText(
      "Storybook did not start: Error: Cannot find module 'storybook'",
      {},
      READY,
    ),
  ).toBeTruthy();

  expect(statuses()).toContain("Storybook did not start: Error: Cannot find module 'storybook'");

  await userEvent.click(within(embed()).getByRole("button", { name: "Try again" }));

  await expect.poll(async () => (await commands.previewStarts()).length, READY).toBe(2);
  expect(
    await within(embed()).findByText(
      "Storybook did not start: Error: Cannot find module 'storybook'",
    ),
  ).toBeTruthy();
});

test("a story the branch does not have says so, with Open in Storybook", async () => {
  await commands.addStoryFeature();
  // The proposal, as on disk in the worktree, links an export the stories file does not have.
  const proposal = `.worktrees/${FEATURE}/specs/${FEATURE}/proposal.md`;
  await commands.writeRepo(
    (await commands.readRepo(proposal)).replace(`${STORIES}#Dragging`, `${STORIES}#Missing`),
    proposal,
  );
  await show(PROPOSAL, "Long feature names are cut");

  expect(
    await within(embed()).findByText(`No story “Missing” in ${STORIES} on this branch.`, {}, READY),
  ).toBeTruthy();
  expect(within(embed()).getByRole("link", { name: "Open in Storybook" })).toBeTruthy();
});

test("a feature without a worktree says its stories cannot run", async () => {
  await commands.addStoryFeature({ worktree: false });
  await show(SPEC, "Resize the sidebar");

  expect(
    await within(embed()).findByText(
      "This feature has no worktree, so its stories cannot run here.",
      {},
      LIVE,
    ),
  ).toBeTruthy();
  expect(await commands.previewStarts()).toEqual([]);
});

test("without a preview decision, a story link is a plain link (edge case)", async () => {
  await commands.addStoryFeature({ preview: false });
  await show(PROPOSAL, "Long feature names are cut");

  const link = screen.getByRole("link", { name: LABEL });
  expect(link.getAttribute("href")).toBe(atRepo(`/raw/${STORIES}`));
  expect(screen.queryByRole("figure")).toBeNull();
});

test("a story link in a list item, or without an export, is a link (edge case)", async () => {
  await commands.addStoryFeature({ specStatus: "approved" });
  await show(SPEC, "Resize the sidebar");

  const mockups = screen.getAllByRole("link", { name: LABEL });
  expect(mockups.map((link) => link.getAttribute("href"))).toEqual([
    atRepo(`/f/${FEATURE}/storybook?story=${STORIES}%23Dragging`),
  ]);
  const file = screen.getByRole("link", { name: "the stories file" });
  expect(file.getAttribute("href")).toBe(atRepo(`/raw/${STORIES}`));
});
