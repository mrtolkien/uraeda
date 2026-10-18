// A link in a diagram opens in a new tab, and never replaces the app's page: the diagram is part of
// the page, so a plain link would take the reader away from their place and their unsaved work.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { Diagram } from "../Diagram.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("a link in a diagram opens in a new tab, without the app's page as its opener", async () => {
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  render(
    <Diagram source={'flowchart LR\n  a[Docs] --> b\n  click a "https://example.dev/docs"'} />,
  );

  const link = await screen.findByRole("link", { name: /Docs/ }, { timeout: 10_000 });
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  link.dispatchEvent(click);

  expect(click.defaultPrevented).toBe(true);
  expect(open).toHaveBeenCalledWith("https://example.dev/docs", "_blank", "noopener,noreferrer");
});
