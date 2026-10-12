// US8 scenarios 3 and 5: a run's view opens in a pane beside the feature page on a wide screen, a
// page of its own on a narrow one, and its log follows the end while the human is there. The run
// view passes the layout checks at both sizes, in light and dark (SC-003).
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { commands as browserCommands } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import {
  checkAccessibility,
  checkAlignment,
  checkControlHeights,
  checkMeasure,
  checkPage,
  checkTextSizes,
  show,
} from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

const CLI = "2026-10-12-cli-tuis";

afterEach(() => {
  window.localStorage.removeItem("uraeda.theme");
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 500));

/** What scrolls the log: the pane beside the feature page, or the window. */
function scroller() {
  const pane = document.querySelector<HTMLElement>('section[aria-label="Detail"]');
  return pane ?? document.scrollingElement!;
}

/** Whether an element's bottom is in view, in what scrolls it. */
function inView(element: Element) {
  const box = scroller();
  const bottom =
    box === document.scrollingElement ? window.innerHeight : box.getBoundingClientRect().bottom;
  return element.getBoundingClientRect().bottom <= bottom + 1;
}

test("a running run's view: beside the feature page or a page, following its end (US8 3, 5)", async () => {
  await commands.takeRepo();
  try {
    await show(`/f/${CLI}`, "Start the agent");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start the agent" }));
    });
    await screen.findByRole("button", { name: "Stop" });
    await commands.agentEmit(
      Array.from({ length: 40 }, (_, index) => ({
        type: "text" as const,
        text: `Line ${index + 1} of what the agent read.`,
      })),
    );

    await act(async () => {
      fireEvent.click(await screen.findByRole("link", { name: /Plan · Working on Plan/ }));
    });

    const log = await screen.findByRole("log", { name: "Run log" });
    await within(log).findByText("Line 40 of what the agent read.");
    await settle();
    const wide = window.innerWidth >= 768;
    // On a wide screen, the feature page stays beside the view, usable; on a narrow one, the view
    // is the page.
    expect(Boolean(screen.queryByRole("list", { name: "Files" }))).toBe(wide);
    checkPage();
    checkTextSizes();
    checkControlHeights();
    checkMeasure();
    checkAlignment();
    await checkAccessibility();

    // At the end, a new line comes into view.
    const box = scroller();
    box.scrollTo(0, box.scrollHeight);
    await settle();
    await commands.agentEmit([{ type: "text", text: "The newest line." }]);
    const newest = await within(log).findByText("The newest line.");
    await expect.poll(() => inView(newest)).toBe(true);

    // Scrolled up, the view stays where it is.
    box.scrollTo(0, 0);
    await settle();
    await commands.agentEmit([{ type: "text", text: "One more line." }]);
    await within(log).findByText("One more line.");
    await settle();
    expect(box.scrollTop).toBe(0);

    if (wide) {
      await act(async () => {
        fireEvent.click(
          within(screen.getByRole("region", { name: "Detail" })).getByRole("button", {
            name: "Close",
          }),
        );
      });
      await waitFor(() => expect(window.location.pathname).toBe(`/f/${CLI}`));
      expect(screen.queryByRole("log", { name: "Run log" })).toBeNull();
    }
  } finally {
    await commands.agentFinish(1, "ended by the test");
    await settle();
    await commands.releaseRepo();
  }
});

test("a run's view, in dark (SC-003)", async () => {
  await commands.takeRepo();
  try {
    window.localStorage.setItem("uraeda.theme", "dark");
    await show(`/f/${CLI}`, "Start the agent");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start the agent" }));
    });
    await screen.findByRole("button", { name: "Stop" });
    await commands.agentEmit([
      { type: "text", text: "Reading **the answers**." },
      { type: "toolStart", id: "a", name: "Read", input: { file_path: "spec.md" } },
      { type: "toolEnd", id: "a", isError: false, output: "# Spec" },
      { type: "toolStart", id: "b", name: "Bash", input: { command: "vp run ready" } },
    ]);
    await commands.agentFinish(1, "The tests failed.");
    await act(async () => {
      fireEvent.click(await screen.findByRole("link", { name: /^Plan · / }, { timeout: 10_000 }));
    });
    await screen.findByRole("log", { name: "Run log" });
    await settle();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    checkPage();
    checkTextSizes();
    checkControlHeights();
    checkAlignment();
    await checkAccessibility();
  } finally {
    await commands.releaseRepo();
  }
});
