// US4 of the UI iteration flow: the stories an agent links in its messages. A story link alone in
// its paragraph shows the story live, from the feature's worktree in its session (US4.1) and from
// the main checkout in a chat (US4.2); a comment on it goes to the composer, unsent (US4.3); and a
// story link inside a sentence opens Uraeda's Storybook page (US4.4). A message shows its stories
// once it ends, not while it streams.
import { screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { atRepo, atSize, commands, LIVE, repository, startTurn } from "./helpers.tsx";

atSize("desktop");

const FEATURE = "2026-10-20-sidebar-resize";
const SESSION = `/f/${FEATURE}/session`;
const LABEL = "Dragging the handle";
const DESKTOP = `${LABEL}, desktop`;
const LINK = `[${LABEL}](/packages/web/src/SidebarHandle.stories.tsx#Dragging)`;
/** How long the fake preview may take to start and its story to load, on a loaded machine. */
const READY = { interval: 100, timeout: 20_000 };

/** The embed of the story the agent linked, once its message shows. */
const embed = () => screen.findByRole("figure", { name: LABEL }, LIVE);

/** The conversation's log. */
const log = () => screen.findByRole("log", { name: "Conversation" });

/** The composer's text field. */
const composer = () => screen.getByRole("textbox", { name: "Message Claude Code" });

/** The composer's text, as the human reads it, line by line. */
const composerText = () => (composer() as HTMLElement).innerText.trim();

/** The `src` of the embed's desktop frame, once its Storybook is ready and the frame on screen. */
async function frameSource() {
  const frame = await within(await embed()).findByTitle(DESKTOP, {}, READY);
  await expect.poll(() => frame.getAttribute("src")).not.toBeNull();
  return frame.getAttribute("src");
}

test("a story link alone in an agent's message shows the story (US4.1)", async () => {
  await commands.addStoryFeature();

  await startTurn("Show me", [{ text: `I wrote the stories.\n\n${LINK}`, type: "text" }], SESSION);

  expect(await frameSource()).toBe(
    `/r/${encodeURIComponent(repository())}/preview/${await commands.frameSecret()}/${FEATURE}/iframe.html?id=sidebarhandle--dragging&viewMode=story`,
  );
});

test("a chat on the main checkout shows its story from main (US4.2)", async () => {
  await commands.addStoryFeature();

  await startTurn("Show me", [{ text: LINK, type: "text" }], "/chats/new");

  expect(await frameSource()).toMatch(
    new RegExp(
      `^/r/${encodeURIComponent(repository())}/preview/${await commands.frameSecret()}/main/iframe\\.html\\?`,
    ),
  );
});

test("a comment on a story in the chat goes to the composer, unsent (US4.3)", async () => {
  await commands.addStoryFeature();
  await startTurn("Show me", [{ text: `I wrote the stories.\n\n${LINK}`, type: "text" }], SESSION);
  await expect.poll(() => commands.frameText(DESKTOP), READY).toContain("Dragging");
  await userEvent.fill(composer(), "Also, the colours.");

  await userEvent.click(
    await within(await embed()).findByRole("button", { name: "Pick an element" }, READY),
  );
  await commands.frameClick(DESKTOP, "separator");
  await screen.findByText(`Comment on ${LABEL}, desktop, separator`);
  await userEvent.keyboard("Larger hit area.");
  await userEvent.keyboard("{Control>}{Enter}{/Control}");

  await expect
    .poll(composerText)
    .toBe(
      "Also, the colours.\nStory SidebarHandle.stories.tsx#Dragging, desktop, separator: Larger hit area.",
    );
  expect(screen.queryByRole("form", { name: "Comment" })).toBeNull();
  expect(await commands.agentSent()).toHaveLength(1);
});

test("a story link inside a sentence opens Uraeda's Storybook page (US4.4)", async () => {
  await commands.addStoryFeature();

  await startTurn(
    "Show me",
    [
      {
        text: "See [the handle](/packages/web/src/SidebarHandle.stories.tsx#Dragging) now.",
        type: "text",
      },
    ],
    SESSION,
  );

  const log = await screen.findByRole("log", { name: "Conversation" });
  await expect
    .poll(() => within(log).queryByRole("link", { name: "the handle" })?.getAttribute("href"), LIVE)
    .toBe(
      atRepo(`/f/${FEATURE}/storybook?story=packages/web/src/SidebarHandle.stories.tsx%23Dragging`),
    );
  expect(screen.queryByRole("figure")).toBeNull();
});

test("a message shows its stories once it ends, not while it streams", async () => {
  await commands.addStoryFeature();
  const sentence = "I wrote the stories.\n\n";
  // The streamed text ends at the link's `)`: a link alone in its paragraph, for now.
  await startTurn("Show me", [{ text: `${sentence}${LINK}`, type: "textDelta" }], SESSION);
  // Once the link is known as a story's: a figure in its place, or the link to its Storybook page.
  await expect
    .poll(
      async () =>
        screen.queryByRole("figure") !== null ||
        /\/storybook\?story=/.test(
          within(await log())
            .queryByRole("link", { name: LABEL })
            ?.getAttribute("href") ?? "",
        ),
      LIVE,
    )
    .toBe(true);
  expect(screen.queryByRole("figure")).toBeNull();

  await commands.agentEmit([
    { text: " is ready.", type: "textDelta" },
    { text: `${sentence}${LINK} is ready.`, type: "text" },
  ]);
  await screen.findByText(/is ready\./, {}, LIVE);
  // No embed, though the session's page has started its Storybook already: a story's record read
  // while the message streams, without an embed, would go unseen here.
  expect(screen.queryByRole("figure")).toBeNull();

  // A message that ends with a story link alone in a paragraph shows it.
  await commands.agentEmit([{ text: LINK, type: "text" }]);
  expect(await embed()).toBeTruthy();
});
