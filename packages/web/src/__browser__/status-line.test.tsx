// The status line fixed at the window's bottom (layout look's US2, R20) covers nothing the page
// keeps in view at its bottom: the inbox's Commit and Discard, and a session's composer, stay above
// it while the page scrolls; and at the phone's narrowest, 320 px, nothing in it runs past the
// window's edge.
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { commands as browserCommands, page, server } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { agent, atSize, drawn, LIVE, show, startTurn } from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

/** The status line's top edge. */
function lineTop() {
  return screen.getByRole("contentinfo", { name: "Status line" }).getBoundingClientRect().top;
}

/** Whether a control shows whole above the status line. */
function aboveLine(element: Element) {
  const box = element.getBoundingClientRect();
  return box.height > 0 && box.top >= 0 && box.bottom <= lineTop() + 0.5;
}

describe("the bars that stay at the window's bottom", () => {
  atSize("both");

  test("a long inbox with changes to commit keeps Commit and Discard above the status line", async () => {
    const inbox = await commands.readRepo("specs/INBOX.md");
    const notes = Array.from(
      { length: 40 },
      (_, index) => `- A note to scroll past ${index + 1}\n`,
    );
    await commands.writeRepo(`${inbox.trimEnd()}\n${notes.join("")}`, "specs/INBOX.md");
    await show("/inbox", "A note to scroll past 40");
    await screen.findByRole("button", { name: "Commit" }, LIVE);
    window.scrollTo(0, 0);
    await drawn();

    // The page is longer than the window: the bar sticks, it is not at the page's end.
    expect(document.scrollingElement!.scrollHeight).toBeGreaterThan(window.innerHeight * 1.5);
    expect(aboveLine(screen.getByRole("button", { name: "Commit" }))).toBe(true);
    expect(aboveLine(screen.getByRole("button", { name: "Discard" }))).toBe(true);
  });

  test("a session scrolled up keeps its composer's Send above the status line", async () => {
    await show("/f/2026-10-12-cli-tuis/session", "CLI TUIs");
    await startTurn(
      "Plan the CLI.",
      Array.from({ length: 40 }, (_, index) => ({
        text: `Line ${index + 1}.`,
        type: "text" as const,
      })),
    );
    const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
    await within(log).findByText("Line 40.", undefined, LIVE);
    await agent.agentEmit([
      { denials: [], errors: [], interrupted: false, ok: true, type: "result" },
    ]);
    const send = await screen.findByRole("button", { name: "Send" }, LIVE);
    window.scrollTo(0, 0);
    await drawn();

    expect(aboveLine(send)).toBe(true);
    expect(aboveLine(screen.getByRole("textbox", { name: "Message Claude Code" }))).toBe(true);
  });
});

describe("at 320 px", () => {
  atSize("phone");

  test("nothing in the status line runs past the window's edge", async () => {
    const { height, width } = server.config.browser.viewport;
    await page.viewport(320, height);
    try {
      await expect.poll(() => window.innerWidth).toBe(320);
      // A round: the line holds its count and Next, then what needs the human and what runs.
      await show("/f/2026-10-11-web-ui/clarifications-01.md", "Web UI for the workflow files");
      const line = screen.getByRole("contentinfo", { name: "Status line" });
      await expect.poll(() => line.textContent).toMatch(/need you/);
      await drawn();
      const past = Array.from(line.querySelectorAll("*"))
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && (box.left < -0.5 || box.right > window.innerWidth + 0.5);
        })
        .map((element) => element.textContent);
      expect(past).toEqual([]);
      // Whole, not cut: each count's text fits its box.
      for (const text of [/need you/, /running/]) {
        const count = within(line).getByText(text);
        expect(count.scrollWidth).toBeLessThanOrEqual(count.clientWidth + 1);
      }
    } finally {
      await page.viewport(width, height);
    }
  });
});
