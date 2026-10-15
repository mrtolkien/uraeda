// US2 of the UI iteration flow: pick mode and comments on a story embedded in a spec under review.
// "Pick an element", a click in either frame, the text, and Ctrl+Enter write a comment naming the
// story and the element on the embed's line (US2.1–US2.3, SC-002); "Comment" names the story alone
// (US2.4); Escape ends pick mode (US2.5); a Storybook without the pick script offers Comment only
// (US2.6). The edge cases: messages from other windows, a frame reloaded in pick mode (review focus
// 2), the width named only while both show, pending comments under the embed, the Mockups buttons,
// and the phone's icons and sheet (US1.5).
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { atRepo, atSize, commands, drawn, show } from "./helpers.tsx";

const FEATURE = "2026-10-20-sidebar-resize";
const SPEC = `/f/${FEATURE}/spec.md`;
const REVIEW = `.worktrees/${FEATURE}/specs/${FEATURE}/spec-review.md`;
const LABEL = "Dragging the handle";
const PHONE = `${LABEL}, phone`;
const DESKTOP = `${LABEL}, desktop`;
const PICK = "Pick an element";
const HINT = "Click an element to comment on it. Escape to stop.";
/** How long the fake preview may take to start and its story to load, on a loaded machine. */
const READY = { interval: 100, timeout: 20_000 };

/** The embed of the test feature's story, by its label. */
const embed = () => screen.getByRole("figure", { name: LABEL });

/** The comment form, or null when none is open. */
const form = () => screen.queryByRole("form", { name: "Comment" });

/** Waits until a frame shows its story. */
async function storyShown(title: string) {
  await expect.poll(() => commands.frameText(title), READY).toContain("Dragging");
}

/**
 * Adds the test feature, shows its spec under review, and waits for its frames' stories and, with
 * the pick script, for "Pick an element".
 */
async function readyEmbed(options: Parameters<typeof commands.addStoryFeature>[0] = {}) {
  await commands.addStoryFeature(options);
  await show(SPEC, "Resize the sidebar");
  await storyShown(PHONE);
  if (window.innerWidth >= 768) {
    await storyShown(DESKTOP);
  }
}

/**
 * Has a frame post what it posts for an element picked, and waits until the page received it and
 * drew what it changed, if anything.
 */
async function pickedLate(title: string) {
  const seen = new Promise((resolve) =>
    window.addEventListener("message", (event) => {
      if ((event.data as { name?: string } | null)?.name === "Late") {
        resolve(undefined);
      }
    }),
  );
  await commands.frameRun(
    title,
    `parent.postMessage({ uraeda: "picked", role: "button", name: "Late", text: "Late" }, "*")`,
  );
  await seen;
  await drawn();
}

/** Presses "Pick an element", once the frames said they have the pick script. */
async function pick() {
  await userEvent.click(await within(embed()).findByRole("button", { name: PICK }, READY));
}

describe("on a desktop", () => {
  atSize("desktop");

  test("a comment on a picked element takes four actions, and names the story and element (US2.1–US2.3, SC-002)", async () => {
    await readyEmbed();

    await pick(); // 1
    expect(within(embed()).getByText(HINT)).toBeTruthy();
    expect(await commands.frameOutlined(DESKTOP, "button", "Hide the sidebar")).toBe(true);
    await commands.frameClick(PHONE, "button", "Hide the sidebar"); // 2
    expect(
      await screen.findByText("Comment on Dragging the handle, phone, button “Hide the sidebar”"),
    ).toBeTruthy();
    expect(within(embed()).queryByText(HINT)).toBeNull();
    expect(await commands.frameText(PHONE)).toContain("Clicked 0 times");
    await userEvent.keyboard("This should be an icon button."); // 3
    await userEvent.keyboard("{Control>}{Enter}{/Control}"); // 4

    await expect
      .poll(() => commands.readRepo(REVIEW), READY)
      .toContain(
        "Story SidebarHandle.stories.tsx#Dragging, phone, button “Hide the sidebar”: This should be an icon button.",
      );
    // The embed's own line in the spec.
    expect(await commands.readRepo(REVIEW)).toContain(
      '## C1: Line 27, under "US1: Resize the sidebar (P1)"',
    );
  });

  test("Comment without picking names the story alone (US2.4)", async () => {
    await readyEmbed();

    await userEvent.click(within(embed()).getByRole("button", { name: "Comment" }));
    expect(await screen.findByText(`Comment on ${LABEL}`)).toBeTruthy();
    await userEvent.keyboard("Too slow to start dragging.");
    await userEvent.click(within(form()!).getByRole("button", { name: "Add comment" }));

    await expect
      .poll(() => commands.readRepo(REVIEW), READY)
      .toContain("Story SidebarHandle.stories.tsx#Dragging: Too slow to start dragging.");
  });

  test("Escape, inside the story or in the page, ends pick mode (US2.5)", async () => {
    await readyEmbed();
    await pick();

    await commands.framePress(DESKTOP, "Escape");

    await waitFor(() => expect(within(embed()).queryByText(HINT)).toBeNull());
    expect(form()).toBeNull();
    await commands.frameClick(DESKTOP, "button", "Hide the sidebar");
    await expect.poll(() => commands.frameText(DESKTOP)).toContain("Clicked 1 time");

    await pick();
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(within(embed()).queryByText(HINT)).toBeNull());
    await commands.frameClick(PHONE, "button", "Hide the sidebar");
    await expect.poll(() => commands.frameText(PHONE)).toContain("Clicked 1 time");
    expect(form()).toBeNull();
  });

  test("a Storybook without the pick script offers Comment only (US2.6)", async () => {
    await readyEmbed({ preview: { mode: "no-pick" } });

    expect(within(embed()).getByRole("button", { name: "Comment" })).toBeTruthy();
    expect(within(embed()).queryByRole("button", { name: PICK })).toBeNull();
  });

  test("with Desktop alone, a picked element's comment names no width", async () => {
    await readyEmbed();
    await userEvent.click(within(embed()).getByRole("radio", { name: "Desktop" }));
    await pick();

    await commands.frameClick(DESKTOP, "separator");

    expect(await screen.findByText(`Comment on ${LABEL}, separator`)).toBeTruthy();
  });
});

describe("on a desktop, as pick mode ends", () => {
  atSize("desktop");

  test("an element picked after pick mode ended is ignored (US2.5)", async () => {
    await readyEmbed();
    await pick();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(within(embed()).queryByText(HINT)).toBeNull());

    await pickedLate(DESKTOP);
    expect(form()).toBeNull();

    await userEvent.click(within(embed()).getByRole("button", { name: "Comment" }));
    expect(await screen.findByText(`Comment on ${LABEL}`)).toBeTruthy();
    await pickedLate(PHONE);
    expect(screen.getByText(`Comment on ${LABEL}`)).toBeTruthy();
    expect(screen.queryByText(/“Late”/)).toBeNull();
  });

  test("the pick hint is announced in a live region there before pick mode", async () => {
    await readyEmbed();
    const regions = within(embed()).getAllByRole("status");

    await pick();

    expect(regions.some((region) => region.textContent === HINT)).toBe(true);
  });
});

describe("on a desktop, around the embed", () => {
  atSize("desktop");

  test("a message from another window is ignored (edge case)", async () => {
    await readyEmbed();
    await pick();

    // Another frame of the page posts what a frame posts for a picked element.
    const seen = new Promise((resolve) =>
      window.addEventListener("message", (event) => {
        if ((event.data as { name?: string } | null)?.name === "Evil") {
          resolve(undefined);
        }
      }),
    );
    const stranger = document.createElement("iframe");
    stranger.srcdoc = `<script>parent.postMessage({ uraeda: "picked", role: "button", name: "Evil", text: "Evil" }, "*");</script>`;
    document.body.append(stranger);
    await seen;
    // The page draws what the message changed, if anything.
    await drawn();

    expect(form()).toBeNull();
    expect(within(embed()).getByText(HINT)).toBeTruthy();
  });

  test("a frame reloaded during pick mode is in pick mode again (review focus 2)", async () => {
    await readyEmbed();
    await pick();

    await commands.frameReload(PHONE);

    await expect
      .poll(() => commands.frameOutlined(PHONE, "button", "Hide the sidebar"), READY)
      .toBe(true);
    await commands.frameClick(PHONE, "button", "Hide the sidebar");
    expect(
      await screen.findByText("Comment on Dragging the handle, phone, button “Hide the sidebar”"),
    ).toBeTruthy();
  });

  test("a pending comment on the embed shows under it", async () => {
    await readyEmbed();
    await userEvent.click(within(embed()).getByRole("button", { name: "Comment" }));
    await screen.findByText(`Comment on ${LABEL}`);
    await userEvent.keyboard("Too slow to start dragging.");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");

    const text = "Story SidebarHandle.stories.tsx#Dragging: Too slow to start dragging.";
    await screen.findAllByText(text, {}, READY);
    // Under the embed, before the paragraph after it.
    const next = screen.getByText("Why this priority: it is the proposal.");
    const note = screen
      .getAllByRole("group", { name: /^C1 · line \d+$/ })
      .find((group) => group.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING)!;
    expect(within(note).getByText(text)).toBeTruthy();
    expect(within(note).getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(within(note).getByRole("button", { name: "Remove" })).toBeTruthy();
    expect(embed().compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("the Mockups button scrolls to its story's embed (edge case)", async () => {
    await readyEmbed();
    const page = window.location.pathname;
    expect(embed().getBoundingClientRect().top).toBeGreaterThan(200);

    await userEvent.click(screen.getByRole("button", { name: `Open the mockup: ${LABEL}` }));

    await expect.poll(() => embed().getBoundingClientRect().top).toBeLessThan(200);
    expect(embed().getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
    expect(window.location.pathname).toBe(page);
    expect(page).toBe(atRepo(SPEC));
  });

  test("the Mockups button opens the fold holding its story's embed, and scrolls to it (edge case)", async () => {
    await commands.addStoryFeature();
    // The embed moved from US1 into the Details fold, closed when the page opens.
    const path = `specs/${FEATURE}/spec.md`;
    const spec = await commands.readRepo(`.worktrees/${FEATURE}/${path}`);
    const line = "[Dragging the handle](/packages/web/src/SidebarHandle.stories.tsx#Dragging)\n\n";
    const moved = spec.replace(line, "").replace("### Components\n\n", `### Components\n\n${line}`);
    await commands.commitOnBranch(FEATURE, { [path]: moved });
    await show(SPEC, "Resize the sidebar");
    expect(screen.queryByRole("figure", { name: LABEL })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: `Open the mockup: ${LABEL}` }));

    await screen.findByRole("figure", { name: LABEL });
    await expect.poll(() => embed().getBoundingClientRect().top).toBeLessThan(200);
    expect(embed().getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
    expect(window.location.pathname).toBe(atRepo(SPEC));
  });
});

describe("on the phone", () => {
  atSize("phone");

  test("on the phone, the toolbar is three named icons, picking asks for a tap, and the form is a sheet (US1.5)", async () => {
    await readyEmbed();
    // Shown once a frame said it has the pick script.
    const pickButton = await within(embed()).findByRole("button", { name: PICK }, READY);

    const controls = [
      [pickButton, PICK],
      [within(embed()).getByRole("button", { name: "Comment" }), "Comment"],
      [within(embed()).getByRole("link", { name: "Open in Storybook" }), "Open in Storybook"],
    ] as const;
    for (const [control, name] of controls) {
      expect(control.textContent).not.toContain(name);
    }
    await pick();
    expect(within(embed()).getByText("Tap an element to comment on it.")).toBeTruthy();

    await commands.frameClick(PHONE, "button", "Hide the sidebar");

    const sheet = await screen.findByRole("dialog", { name: "Comment" });
    expect(
      within(sheet).getByText("Comment on Dragging the handle, button “Hide the sidebar”"),
    ).toBeTruthy();
  });
});
