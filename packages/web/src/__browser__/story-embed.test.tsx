// US1 of the UI iteration flow: a story link alone in its paragraph shows the story live, from the
// branch's Storybook, at the desktop's width, or the phone's when chosen, in one frame a change of
// width never reloads, framed as a phone's screen at its width; the phone's alone on a narrow screen
// (US1.1, US1.2, US1.5). Full screen fills the screen, and in a
// document's column it grows into the space beside it. It is shown in Uraeda's colour mode
// (US1.4), in every workflow file (US1.6), with one Storybook for every page (US1.7, SC-001), and
// through a listed host name (SC-006). The embed's states and edge cases: a failed start, a missing
// story, no worktree, a story that never reports its height, a frame Storybook reloads, a malformed
// size, no preview decision, and story links that do not embed. Frames load only once on screen, and
// a feature's page starts its Storybook before any story is embedded.
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { atRepo, atSize, colorScheme, commands, LIVE, repository, show } from "./helpers.tsx";

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

/**
 * Shows the test feature's spec, its story's embed scrolled into view, as the reader scrolls to its
 * story: what you approve and the decisions come first on the spec page.
 */
async function showSpec() {
  await show(SPEC, "Resize the sidebar");
  embed().scrollIntoView({ block: "center" });
}

/** Waits until a frame shows its story. */
async function storyShown(title: string, options = READY) {
  await expect.poll(() => commands.frameText(title), options).toContain("Dragging");
}

/** The texts of the embed's live regions, which a screen reader says as they change. */
const statuses = () =>
  within(embed())
    .queryAllByRole("status")
    .map((region) => region.textContent);

/** Shows the embed's story at the phone's width, as its Phone option does on a wide screen. */
async function atPhoneWidth() {
  await userEvent.click(within(embed()).getByRole("radio", { name: "Phone" }));
  await storyShown(PHONE);
}

/** A frame's height on the page, in px. */
const heightOf = (title: string) => screen.getByTitle(title).getBoundingClientRect().height;

describe("on a desktop", () => {
  atSize("desktop");

  test("a story link alone starts the branch's Storybook, and shows the story at the desktop's width (US1.1)", async () => {
    await commands.addStoryFeature({ preview: { delay: 1500 } });
    await showSpec();

    expect(await within(embed()).findByText("Starting Storybook for this branch…")).toBeTruthy();
    // Said, as it changes, to a screen reader too.
    expect(statuses()).toContain("Starting Storybook for this branch…");
    const desktop = await within(embed()).findByTitle(DESKTOP, {}, READY);
    expect(within(embed()).queryByTitle(PHONE)).toBeNull();
    expect(within(embed()).getByRole("radio", { checked: true, name: "Desktop" })).toBeTruthy();
    expect(within(embed()).queryByRole("radio", { name: "Both" })).toBeNull();
    // On screen, the frame loads as soon as the observer sees it.
    await expect.poll(() => desktop.getAttribute("src")).toBe(await FRAME(repository()));
    expect(desktop.getAttribute("sandbox")).toBe("allow-scripts allow-popups");
    await storyShown(DESKTOP);
    expect(desktop.getBoundingClientRect().width).toBeLessThanOrEqual(1440);
    expect(desktop.getBoundingClientRect().right).toBeLessThanOrEqual(
      embed().getBoundingClientRect().right,
    );
    const [start] = await commands.previewStarts();
    expect(start.cwd).toMatch(/\.worktrees\/2026-10-20-sidebar-resize\/packages\/web$/);
    expect(start.base).toBe(
      `/r/${encodeURIComponent(repository())}/preview/${await commands.frameSecret()}/${FEATURE}/`,
    );
  });

  test("Phone and Desktop resize the one frame, which keeps its story as it is, unreloaded (US1.2)", async () => {
    await commands.addStoryFeature();
    await showSpec();
    await storyShown(DESKTOP);
    const frame = within(embed()).getByTitle(DESKTOP);
    // The desktop width, scaled to the whole embed.
    expect(frame.getBoundingClientRect().width).toBeGreaterThan(
      embed().getBoundingClientRect().width - 50,
    );
    await commands.frameClick(DESKTOP, "button", "Hide the sidebar");
    await expect.poll(() => commands.frameText(DESKTOP)).toContain("Clicked 1 time");

    await userEvent.click(within(embed()).getByRole("radio", { name: "Phone" }));

    expect(within(embed()).getByTitle(PHONE)).toBe(frame);
    await expect.poll(() => frame.getBoundingClientRect().width).toBe(402);
    // The same page, not loaded again: its click is still counted.
    expect(await commands.frameText(PHONE)).toContain("Clicked 1 time");
    await commands.frameClick(PHONE, "button", "Hide the sidebar");
    await expect.poll(() => commands.frameText(PHONE)).toContain("Clicked 2 times");

    await userEvent.click(within(embed()).getByRole("radio", { name: "Desktop" }));

    expect(within(embed()).getByTitle(DESKTOP)).toBe(frame);
    expect(await commands.frameText(DESKTOP)).toContain("Clicked 2 times");
  });
});

describe("on a desktop, the embed's sizes", () => {
  atSize("desktop");

  test("at the phone's width, the story is centred, framed as a phone's screen, on its own background", async () => {
    await commands.addStoryFeature();
    await showSpec();
    await storyShown(DESKTOP);
    const frame = within(embed()).getByTitle(DESKTOP);
    const stage = frame.parentElement!.parentElement!;
    const desktopBackground = getComputedStyle(stage).backgroundColor;

    await atPhoneWidth();

    const box = frame.getBoundingClientRect();
    const around = stage.getBoundingClientRect();
    expect(Math.abs(box.left - around.left - (around.right - box.right))).toBeLessThan(2);
    expect(
      Number.parseFloat(getComputedStyle(frame.parentElement!).borderTopWidth),
    ).toBeGreaterThan(0);
    expect(getComputedStyle(stage).backgroundColor).not.toBe(desktopBackground);
  });

  test("Full screen shows the story on the whole screen, and leaves it", async () => {
    await commands.addStoryFeature();
    await showSpec();
    await storyShown(DESKTOP);
    if (!document.fullscreenEnabled) {
      // A browser without full screen for an element offers none.
      expect(within(embed()).queryByRole("button", { name: "Full screen" })).toBeNull();
      return;
    }

    await userEvent.click(within(embed()).getByRole("button", { name: "Full screen" }));

    await expect.poll(() => document.fullscreenElement).toBe(embed());
    const frame = within(embed()).getByTitle(DESKTOP);
    await expect
      .poll(() => frame.getBoundingClientRect().height)
      .toBeGreaterThan(window.innerHeight - 150);
    expect(within(embed()).queryByRole("separator")).toBeNull();
    expect(within(embed()).getByRole("button", { name: "Leave full screen" })).toBeTruthy();

    // Left by the browser, as Escape does: the test's driver cannot reach into the full screen of its
    // own frame, and the embed follows.
    await document.exitFullscreen();

    expect(await within(embed()).findByRole("button", { name: "Full screen" })).toBeTruthy();
    expect(within(embed()).getByRole("separator", { name: `Resize ${LABEL}` })).toBeTruthy();
  });

  test("in a document's column, the embed grows into the empty space beside it", async () => {
    // A window wide enough for empty space beside the column whatever the fonts, which size it.
    await page.viewport(1920, 1080);
    try {
      await commands.addStoryFeature();
      await showSpec();
      await storyShown(DESKTOP);
      const column = embed().parentElement!.getBoundingClientRect();

      await expect.poll(() => embed().getBoundingClientRect().width).toBeGreaterThan(column.width);
      const grown = embed().getBoundingClientRect();
      expect(grown.width).toBeLessThanOrEqual(1440 + 34);
      // Never past the page's own inset, nor over the sidebar.
      const sidebar = screen.getAllByRole("link", { name: "Home" })[0]!.getBoundingClientRect();
      expect(grown.left).toBeGreaterThan(sidebar.right);
      expect(grown.right).toBeLessThanOrEqual(window.innerWidth);
    } finally {
      await page.viewport(1440, 900);
    }
  });

  test("a second page uses the running Storybook, ready within 2 seconds (US1.7, SC-001)", async () => {
    await commands.addStoryFeature();
    await showSpec();
    await storyShown(DESKTOP);

    await show(PROPOSAL, "Long feature names are cut");

    await storyShown(DESKTOP, { interval: 50, timeout: 2000 });
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
    await showSpec();
    await storyShown(DESKTOP);
    expect(await commands.previewStarts()).toHaveLength(1);
  });

  test("an embed below the window loads its frames only once scrolled to, its Storybook started at once", async () => {
    await commands.addStoryFeature();
    await page.viewport(1440, 300);
    try {
      await show(SPEC, "Resize the sidebar");
      const desktop = await within(embed()).findByTitle(DESKTOP, {}, READY);
      expect(embed().getBoundingClientRect().top).toBeGreaterThan(window.innerHeight);
      expect(desktop.getAttribute("src")).toBeNull();
      expect(await commands.previewStarts()).toHaveLength(1);

      embed().scrollIntoView();

      await expect.poll(() => desktop.getAttribute("src")).toBe(await FRAME(repository()));
      await storyShown(DESKTOP);
      // Once loaded, a frame stays loaded when scrolled away.
      window.scrollTo(0, 0);
      await storyShown(DESKTOP);
      expect(desktop.getAttribute("src")).toBe(await FRAME(repository()));
    } finally {
      await page.viewport(1440, 900);
    }
  });
});

/**
 * Picks a theme in the settings' Appearance, reached from the sidebar, then goes back to the page
 * it left.
 */
async function pickThemeInSettings(mode: "Dark" | "Light" | "System") {
  const nav = within(screen.getByRole("navigation", { name: "Side navigation" }));
  await userEvent.click(nav.getByRole("link", { name: "Settings" }));
  await userEvent.click(await screen.findByRole("link", { name: /^Appearance/ }));
  const theme = await screen.findByRole("radiogroup", { name: "Theme" });
  await userEvent.click(within(theme).getByRole("radio", { name: mode }));
  window.history.go(-2);
}

describe("on a desktop, the frames and their messages", () => {
  atSize("desktop");

  test("the story is drawn in Uraeda's colour mode, and follows it (US1.4)", async () => {
    await colorScheme("dark");
    await commands.addStoryFeature();
    await showSpec();
    await storyShown(DESKTOP);
    await expect.poll(() => commands.frameAttribute(DESKTOP, "html", "data-mode")).toBe("dark");

    await pickThemeInSettings("Light");
    await storyShown(DESKTOP);

    await expect.poll(() => commands.frameAttribute(DESKTOP, "html", "data-mode")).toBe("light");
  });

  test("after Storybook reloads a frame, it gets the colour mode again (review focus 2)", async () => {
    await colorScheme("dark");
    await commands.addStoryFeature();
    await showSpec();
    await expect
      .poll(() => commands.frameAttribute(DESKTOP, "html", "data-mode"), READY)
      .toBe("dark");

    // A reloaded story starts without a mode, as the fake preview's page does.
    await commands.frameReload(DESKTOP);

    await expect.poll(() => commands.frameAttribute(DESKTOP, "html", "data-mode")).toBe("dark");
  });

  test("a size that is not a number above 0 is ignored (review focus 6)", async () => {
    await commands.addStoryFeature();
    await showSpec();
    await storyShown(DESKTOP);
    await atPhoneWidth();
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
    await showSpec();
    await storyShown(DESKTOP);

    await atPhoneWidth();

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
      .poll(() => commands.frameText("Full height, desktop"), READY)
      .toContain("FullHeight");
    const full = screen.getByRole("figure", { name: "Full height" });
    full.scrollIntoView();
    await userEvent.click(within(full).getByRole("radio", { name: "Phone" }));
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
    for (const label of [LABEL, "Thin line"]) {
      const other = screen.getByRole("figure", { name: label });
      other.scrollIntoView();
      await expect
        .poll(() => commands.frameAttribute(`${label}, desktop`, "html", "data-mode"), READY)
        .toBe("light");
      await userEvent.click(within(other).getByRole("radio", { name: "Phone" }));
      await expect
        .poll(() => commands.frameAttribute(`${label}, phone`, "html", "data-mode"), READY)
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

  test("in a pane, the desktop's width is scaled to the pane", async () => {
    await commands.addStoryFeature();
    // The main checkout's draft embeds the story, and opens in a pane beside the priorities.
    const draft = "specs/drafts/git-listener.md";
    const text = await commands.readRepo(draft);
    await commands.writeRepo(`${text}\n[${LABEL}](/${STORIES}#Dragging)\n`, draft);
    await show("/priorities/git-listener", "So agents start without me.");

    const desktop = await within(embed()).findByTitle(DESKTOP, {}, READY);
    await storyShown(DESKTOP);
    expect(within(embed()).getByRole("radio", { checked: true, name: "Desktop" })).toBeTruthy();
    expect(desktop.getBoundingClientRect().right).toBeLessThanOrEqual(
      embed().getBoundingClientRect().right,
    );
  });
});

describe("on the phone", () => {
  atSize("phone");

  test("on the phone, the embed is as wide as the page, at the phone width, with named icons (US1.5)", async () => {
    await commands.addStoryFeature();
    await showSpec();

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
  await showSpec();
  // The desktop's width on a wide screen, the phone's on a narrow one.
  const shown = window.innerWidth >= 768 ? DESKTOP : PHONE;
  await storyShown(shown);

  await show(PROPOSAL, "Long feature names are cut");

  await storyShown(shown);
});

test("each state says why the story does not show", async () => {
  await commands.addStoryFeature({ preview: { mode: "fail" } });
  await showSpec();
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
  await showSpec();

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
  await showSpec();

  const mockups = screen.getAllByRole("link", { name: LABEL });
  expect(mockups.map((link) => link.getAttribute("href"))).toEqual([
    atRepo(`/f/${FEATURE}/storybook?story=${STORIES}%23Dragging`),
  ]);
  const file = screen.getByRole("link", { name: "the stories file" });
  expect(file.getAttribute("href")).toBe(atRepo(`/raw/${STORIES}`));
});
