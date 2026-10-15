// The colour mode of a story in Uraeda's own Storybook: the embedding page's, sent as the story's
// frame says it is ready, before its story renders.
import { render, screen } from "@testing-library/react";
import type { Decorator } from "@storybook/react-vite";
import { expect, test, vi } from "vite-plus/test";

test("a story embedded in a page in dark mode renders dark, from the mode sent before it renders", async () => {
  // happy-dom has no `EventSource`, which the preview replaces as it loads.
  vi.stubGlobal("EventSource", class {});
  const { default: preview } = await import("../../.storybook/preview.tsx");
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { mode: "dark", uraeda: "mode" },
      source: window.parent,
    }),
  );

  const [inUraeda] = preview.decorators as Array<Decorator>;
  render(inUraeda!(() => <p>The story</p>, {} as never));

  await screen.findByText("The story");
  expect(document.querySelector('[data-theme="dark"]')).toBeTruthy();
  vi.unstubAllGlobals();
});
