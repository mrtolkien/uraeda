// US1.1, US1.2, and SC-002: "New change", in the sidebar, opens a composer that starts a change and
// its agent in two clicks and the typing, with its images in the change's proposal. The composer's
// edge cases: Start disabled while it is empty, a taken name refused under the slug field with the
// text kept, and the text kept after leaving the page (R2). The page passes the UI checks at both
// sizes, in light and dark.
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import {
  agent,
  atRepo,
  atSize,
  checkLayout,
  drawn,
  image,
  LIVE,
  paste,
  show,
  colorScheme,
} from "./helpers.tsx";

const TITLE = "Centre the x in failure circles";
const BODY = "In failures the x sits low in its circle.";
/** The start of the change's first run, as the server writes it. */
const RUN = "/uraeda Continue the change specs/changes/";
/** The page's line under its heading. */
const INTRO = "Describe the bug or the change. The first line is its title.";

atSize("both");

afterEach(() => {});

/** Opens the navigation, from the phone's menu, and clicks one of its links. */
async function openFromNavigation(name: string) {
  if (window.innerWidth < 768) {
    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  }
  const search = await screen.findByRole("searchbox", { name: "Search sessions" });
  const nav = search.closest("dialog") ?? search.closest("nav")!;
  await userEvent.click(within(nav as HTMLElement).getByRole("link", { name }));
}

/** Opens "New change" from Home, by the sidebar's row. */
async function newChange() {
  await show("/", "Needs you");
  await openFromNavigation("New change");
  await screen.findByRole("heading", { level: 1, name: "New change" }, LIVE);
  return screen.findByRole("textbox", { name: "Message Claude Code" }, LIVE);
}

/** Types the title, a blank line, and the body, as the human does. */
async function typeChange(box: HTMLElement) {
  await userEvent.click(box);
  await userEvent.keyboard(TITLE);
  await userEvent.keyboard("{Shift>}{Enter}{Enter}{/Shift}");
  await userEvent.keyboard(BODY);
}

/** The slug field. */
function slug() {
  return screen.getByRole("textbox", { name: "Slug" }) as HTMLInputElement;
}

/** The started change's folder, once its page opens. */
async function opened() {
  const page = new RegExp(`^${atRepo("/f/")}(\\d{4}-\\d{2}-\\d{2}-[a-z0-9-]+)$`);
  await expect.poll(() => page.test(window.location.pathname), LIVE).toBe(true);
  return page.exec(window.location.pathname)![1];
}

// US1.1, SC-002
test("a typed change starts with its agent, in two clicks", async () => {
  const box = await newChange();
  expect(screen.getByText(INTRO)).toBeTruthy();
  await typeChange(box);
  // The core's proposal for the whole text (R1, R14).
  await expect.poll(() => slug().value, LIVE).toBe("centre-x");

  await userEvent.click(screen.getByRole("button", { name: "Start the change" }));

  const folder = await opened();
  expect(folder).toMatch(/-centre-x$/);
  await screen.findByRole("heading", { level: 1, name: TITLE }, LIVE);
  await expect
    .poll(async () => (await agent.agentSent()).at(-1)?.text.startsWith(`${RUN}${folder}/`), LIVE)
    .toBe(true);
  const proposal = await agent.readRepo(`.worktrees/${folder}/specs/changes/${folder}/proposal.md`);
  expect(proposal).toBe(`# ${TITLE}\n\n${BODY}\n`);
});

describe("on the desktop", () => {
  atSize("desktop");

  // SC-002: Enter in the composer on wide screens.
  test("Enter starts it on a desktop", async () => {
    const box = await newChange();
    await typeChange(box);
    await expect.poll(() => slug().value, LIVE).toBe("centre-x");

    await userEvent.keyboard("{Enter}");

    expect(await opened()).toMatch(/-centre-x$/);
    await screen.findByRole("heading", { level: 1, name: TITLE }, LIVE);
  });
});

// The edge case "An empty composer".
test("Start is disabled while the composer is empty", async () => {
  const box = await newChange();
  const start = screen.getByRole("button", { name: "Start the change" });
  expect(start.hasAttribute("disabled")).toBe(true);

  await userEvent.click(box);
  await userEvent.keyboard(TITLE);
  await expect.poll(() => start.hasAttribute("disabled")).toBe(false);
});

// The edge case "Starting a change when the folder or branch name is taken".
test("a taken slug is refused under the slug field, and the text stays", async () => {
  const first = await newChange();
  await typeChange(first);
  await expect.poll(() => slug().value, LIVE).toBe("centre-x");
  await userEvent.click(screen.getByRole("button", { name: "Start the change" }));
  const folder = await opened();
  await screen.findByRole("heading", { level: 1, name: TITLE }, LIVE);

  await openFromNavigation("New change");
  await screen.findByRole("heading", { level: 1, name: "New change" }, LIVE);
  const box = screen.getByRole("textbox", { name: "Message Claude Code" });
  // Start cleared the text and the slug.
  expect(box.textContent).toBe("");
  expect(slug().value).toBe("");
  await typeChange(box);
  await expect.poll(() => slug().value, LIVE).toBe("centre-x");
  await userEvent.click(screen.getByRole("button", { name: "Start the change" }));

  const refused = await screen.findByText(
    `${folder} exists: choose another slug with --slug`,
    undefined,
    LIVE,
  );
  // Under the slug field, which follows the composer.
  expect(slug().compareDocumentPosition(refused) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  expect(window.location.pathname).toBe(atRepo("/changes/new"));
  expect(box.textContent).toBe(`${TITLE}\n\n${BODY}`);
});

// The edge case "Leaving the composer page before starting" (R2).
test("the text comes back after leaving the page", async () => {
  const box = await newChange();
  await typeChange(box);
  await expect.poll(() => slug().value, LIVE).toBe("centre-x");
  await userEvent.clear(slug());
  await userEvent.type(slug(), "centred-x");

  await openFromNavigation("Priorities");
  await screen.findByRole("heading", { level: 1, name: "Priorities" }, LIVE);
  await openFromNavigation("New change");

  await screen.findByRole("heading", { level: 1, name: "New change" }, LIVE);
  const back = screen.getByRole("textbox", { name: "Message Claude Code" });
  expect(back.textContent).toBe(`${TITLE}\n\n${BODY}`);
  expect(slug().value).toBe("centred-x");
  // The draft editor's notice says nothing true of a page kept as a new chat's is.
  await drawn();
  expect(screen.queryByText(/^Unsaved text restored/)).toBeNull();
});

/** The attachments decision's refusal of an SVG, which the composer shows before any start. */
const SVG_REFUSED = "Only PNG, JPEG, GIF, and WebP images can be added: diagram.svg is not one.";

// US1.2, and the error "An image the core refuses": the composer refuses it as it is added, before
// the change starts, and the change starts with the two others.
test("a change started with two images, and one refused", async () => {
  const box = await newChange();
  paste(
    [
      await image("phone.png", "image.png"),
      await image("drawing.svg", "diagram.svg"),
      await image("desktop.png", "desktop.png"),
    ],
    box,
  );
  // Shown on the page, not only announced.
  await expect
    .poll(
      () =>
        screen
          .queryAllByText(SVG_REFUSED)
          .filter((element) => !element.closest("[data-astryx-live-region]")).length,
      LIVE,
    )
    .toBe(1);
  await expect
    .poll(() => screen.queryAllByRole("button", { name: /^Remove / }).length, LIVE)
    .toBe(2);
  // The refusal started nothing.
  expect(window.location.pathname).toBe(atRepo("/changes/new"));
  expect(await agent.agentSent()).toEqual([]);
  await typeChange(box);
  await expect.poll(() => slug().value, LIVE).toBe("centre-x");
  const start = screen.getByRole("button", { name: "Start the change" });
  await expect.poll(() => start.hasAttribute("disabled"), LIVE).toBe(false);

  await userEvent.click(start);

  const folder = await opened();
  const proposal = await agent.readRepo(`.worktrees/${folder}/specs/changes/${folder}/proposal.md`);
  expect(proposal.trimEnd()).toMatch(
    /!\[Image 1\]\(images\/image-1\.webp\)\s+!\[Image 2\]\(images\/image-2\.webp\)$/,
  );
  // The images themselves, committed in the change's folder, not only their links.
  const images = `specs/changes/${folder}/images`;
  expect(await agent.committedFiles(`.worktrees/${folder}`, images)).toEqual([
    `${images}/image-1.webp`,
    `${images}/image-2.webp`,
  ]);
  // None went to the agent: its run carries no image.
  expect((await agent.agentSent()).at(-1)?.images).toEqual([]);
});

// The edge case "An empty composer": a change's title is text, so images alone are not one.
test("images alone do not enable Start", async () => {
  const box = await newChange();
  paste([await image("phone.png", "image.png")], box);
  // Saved: the thumbnail shows the saved chat image, not the file's own preview.
  await expect
    .poll(() => document.querySelector('img[src*="/chat-images/"]') !== null, LIVE)
    .toBe(true);

  expect(screen.getByRole("button", { name: "Start the change" }).hasAttribute("disabled")).toBe(
    true,
  );
});

const MODES = (["light", "dark"] as const).map((mode) => ({ mode }));

// The UI checks on "New change", holding a change's text, its slug proposed.
test.each(MODES)("New change, in $mode", async ({ mode }) => {
  await colorScheme(mode);
  await show("/changes/new", "New change");
  expect(document.documentElement.getAttribute("data-theme")).toBe(mode);
  await typeChange(await screen.findByRole("textbox", { name: "Message Claude Code" }, LIVE));
  await expect.poll(() => slug().value, LIVE).toBe("centre-x");
  await drawn();
  await checkLayout();
});
