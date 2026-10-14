/**
 * The screenshots' views of image attachments: the editor, a proposal, the lightbox, a review, a
 * round, and a chat, each with its images.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright";
import type { FakeAdapter } from "uraeda-server/testing";
import { type Each, here, settle, show, SPEC, wait } from "./shots.ts";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const ROUND = "/f/2026-10-11-web-ui/clarifications-01.md";
const DRAFT = "specs/drafts/login-banner/proposal.md";
const LEAD = "When the password is wrong, the banner covers the login button:";

/** A file of `fixtures/images/`, under the name the human gives it. */
const fixtureImage = (fixture: string, name = fixture) => ({
  data: readFileSync(join(root, "fixtures/images", fixture)).toString("base64"),
  name,
});

/** A proposal's text, with the paragraph that leads to the image, and its link when given. */
const proposalText = (title: string, link = "") =>
  `# ${title}\n\n## What\n\n${LEAD}\n\n${link ? `${link}\n\n` : ""}## Why\n\nUsers miss the button.\n`;

/**
 * Drags images over an element of the page, then drops them on it, or holds them over it, as
 * before a drop: the drop hint shows.
 */
async function dragImages(
  page: Page,
  selector: string,
  files: Array<{ data: string; name: string }>,
  hold = false,
) {
  await page
    .locator(selector)
    .first()
    .evaluate(
      (element, { files, hold }) => {
        const data = new DataTransfer();
        const types: Record<string, string> = { png: "image/png", svg: "image/svg+xml" };
        for (const { data: base64, name } of files) {
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          data.items.add(new File([bytes], name, { type: types[name.split(".").at(-1)!] ?? "" }));
        }
        const init = { bubbles: true, cancelable: true, dataTransfer: data };
        element.dispatchEvent(new DragEvent("dragenter", init));
        element.dispatchEvent(new DragEvent("dragover", init));
        if (!hold) {
          element.dispatchEvent(new DragEvent("drop", init));
        }
      },
      { files, hold },
    );
}

/**
 * Saves an image next to a markdown file, as "Add image" does, through the repository's routes at
 * `base`, `<server>/r/<name>`: its link.
 */
async function attach(base: string, path: string, fixture: string, name: string) {
  const body = new FormData();
  body.append("file", new Blob([readFileSync(join(root, "fixtures/images", fixture))]), name);
  const query = `path=${encodeURIComponent(path)}&name=${encodeURIComponent(name)}`;
  const response = await fetch(`${base}/attach?${query}`, { body, method: "POST" });
  const answer = (await response.json()) as { error?: string; link?: string };
  if (!answer.link) {
    throw new Error(answer.error ?? `HTTP ${response.status}`);
  }
  return answer.link;
}

/** Waits for the images of the page to load. */
async function imagesLoaded(page: Page) {
  await page.waitForFunction(() =>
    [...document.querySelectorAll("img")].every((one) => one.complete && one.naturalWidth > 0),
  );
  await settle(page);
}

/** The draft, written anew: a folder, with no image. */
function freshDraft(repo: string) {
  rmSync(join(repo, "specs/drafts/login-banner"), { force: true, recursive: true });
  mkdirSync(join(repo, "specs/drafts/login-banner"), { recursive: true });
  writeFileSync(join(repo, DRAFT), proposalText("Login error banner"));
}

/** The draft's text field, its cursor after the paragraph that leads to the image. */
async function editDraft(page: Page, repo: string) {
  freshDraft(repo);
  await show(page, `/edit/${DRAFT}`, "Login error banner");
  await page.getByRole("button", { name: "Edit" }).click();
  const field = page.getByRole("textbox", { name: "Text" });
  await field.evaluate((element: HTMLTextAreaElement, lead) => {
    const at = element.value.indexOf(lead) + lead.length;
    element.focus();
    element.setSelectionRange(at, at);
  }, LEAD);
  return field;
}

/**
 * The editor: a screenshot dropped at the cursor, its alt text selected, and another file dragged
 * over; a file that is no image, refused under the field; and the draft's preview, with the image.
 */
async function editorShots(each: Each, repo: string, base: string) {
  await each("editor-image", async ({ page }) => {
    await editDraft(page, repo);
    await dragImages(page, "textarea", [fixtureImage("desktop.png", "login.png")]);
    await page.getByText("Added login.webp").first().waitFor();
    await dragImages(page, "textarea", [fixtureImage("phone.png", "shot.png")], true);
    await page.getByText("Drop to add to proposal.md").waitFor();
    await settle(page);
  });
  await each("image-refused", async ({ page }) => {
    await editDraft(page, repo);
    await dragImages(page, "textarea", [fixtureImage("drawing.svg", "diagram.svg")]);
    await page
      .getByText(/diagram\.svg is not one/)
      .first()
      .waitFor();
    await settle(page);
  });
  await each("editor-preview", async ({ page }) => {
    freshDraft(repo);
    const link = await attach(base, DRAFT, "desktop.png", "login.png");
    writeFileSync(join(repo, DRAFT), proposalText("Login error banner", link));
    await show(page, `/edit/${DRAFT}`, "Login error banner");
    await page.getByRole("img", { name: "login" }).waitFor();
    await imagesLoaded(page);
  });
}

/** A feature's proposal with a screenshot, and the screenshot open full screen. */
async function proposalShots(each: Each, repo: string, base: string) {
  const proposal = "specs/2026-10-13-plan-review/proposal.md";
  const link = await attach(base, proposal, "desktop.png", "login.png");
  writeFileSync(
    join(repo, ".worktrees/2026-10-13-plan-review", proposal),
    proposalText("Plan review", link),
  );
  const showProposal = async (page: Page) => {
    await show(page, "/f/2026-10-13-plan-review/proposal.md", LEAD);
    await page.getByRole("img", { name: "login" }).waitFor();
    await imagesLoaded(page);
  };
  await each("proposal-image", ({ page }) => showProposal(page));
  await each("lightbox", async ({ page }) => {
    await showProposal(page);
    await page.getByRole("img", { name: "login" }).click();
    await page.getByRole("dialog").waitFor();
    await settle(page);
  });
}

/** A review's general comment holding a screenshot's link, and another file dragged over. */
async function reviewShots(each: Each) {
  await each("review-image", async ({ page }) => {
    await show(page, SPEC, "Complete a repeating task");
    await dragImages(page, "body", [fixtureImage("phone.png", "shot.png")]);
    const field = page.getByRole("textbox", { name: "Comment text" });
    await page.waitForFunction(() =>
      [...document.querySelectorAll("textarea")].some((one) => one.value.includes("(images/")),
    );
    await dragImages(page, "body", [fixtureImage("phone.png", "shot.png")], true);
    await page.getByText("Drop to add to the comment").first().waitFor();
    await field.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await settle(page);
  });
}

/**
 * A round's answer holding a dropped screenshot's link: the round's file as the fixture's each
 * time, once its worktree holds it.
 */
async function roundShots(each: Each, repo: string) {
  const file = "specs/2026-10-11-web-ui/clarifications-01.md";
  const round = join(repo, ".worktrees/2026-10-11-web-ui", file);
  const answers = readFileSync(
    join(root, "fixtures/repo/branches/2026-10-11-web-ui", file),
    "utf8",
  );
  const resetRound = () => {
    if (existsSync(round)) {
      writeFileSync(round, answers);
      rmSync(join(dirname(round), "images"), { force: true, recursive: true });
    }
  };
  await each("round-image", async ({ page }) => {
    resetRound();
    await show(page, ROUND, "How does your iPhone reach the server?");
    const field = page.locator("#Q3").getByRole("textbox", { name: "Comment" });
    await field.click();
    await dragImages(page, "#Q3 textarea", [fixtureImage("phone.png", "screen.png")]);
    await page
      .locator("#Q3")
      .getByText(/^Added /)
      .waitFor();
    await field.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await settle(page);
  });
  resetRound();
}

/** Picks two screenshots in a session's composer, and waits for them to be saved. */
async function pickImages(page: Page) {
  const files = ["phone.png", "desktop.png"].map((name) => join(root, "fixtures/images", name));
  await page.locator('input[type="file"]').setInputFiles(files);
  await page
    .getByRole("button", { name: /^Remove / })
    .nth(1)
    .waitFor();
  await page.waitForFunction(
    () => !document.querySelector('button[aria-label="Send"]')?.hasAttribute("disabled"),
  );
}

/** A new chat whose message holds two screenshots, answered by the agent: its path. */
async function chatWithImages(first: Page, adapter: FakeAdapter) {
  await show(first, "/chats/new", "New chat");
  const sent = adapter.sent.length;
  await pickImages(first);
  await first
    .getByRole("textbox", { name: "Message Claude Code" })
    .fill("The login button overlaps the error banner on the phone.");
  await first.getByRole("button", { name: "Send" }).first().click();
  while (adapter.sent.length === sent) {
    await wait(50);
  }
  adapter.emit({ id: adapter.sent.at(-1)!.id, type: "accepted" });
  adapter.emit({
    id: "r1",
    input: {},
    kind: "read",
    name: "Read",
    target: "phone.webp",
    type: "toolStart",
  });
  adapter.emit({ id: "r1", isError: false, output: "", type: "toolEnd" });
  adapter.emit({
    text: "The red **Sign in** button sits under the banner, because the banner is positioned absolutely.",
    type: "text",
  });
  adapter.emit({ denials: [], errors: [], interrupted: false, ok: true, type: "result" });
  await first.waitForURL(/\/chats\/(?!new)/);
  return here(first);
}

/** A chat whose message holds two screenshots, and two more in the composer, for the next one. */
async function chatShots(each: Each, first: Page, adapter: FakeAdapter) {
  const chat = await chatWithImages(first, adapter);
  await each("chat-images", async ({ page }) => {
    await show(page, chat, "Sign in");
    await pickImages(page);
    await imagesLoaded(page);
  });
}

/**
 * The views of image attachments, the repository's routes at `base`, `<server>/r/<name>`, and its
 * folder at `repo`.
 */
export async function takeImages(
  each: Each,
  first: Page,
  adapter: FakeAdapter,
  repo: string,
  base: string,
) {
  await editorShots(each, repo, base);
  await proposalShots(each, repo, base);
  await reviewShots(each);
  await roundShots(each, repo);
  await chatShots(each, first, adapter);
}
