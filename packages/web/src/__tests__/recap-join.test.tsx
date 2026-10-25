// Session review focus 1: a recap line joined across pages keeps its place while the page before
// loads, counting its own page's part of the stretch until the rest is in.
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { JoinedStretch } from "../session/RecapLine.tsx";
import type { Stretch } from "../session/stretches.ts";

// The page before never comes in: the line is drawn as it waits.
vi.mock("../sessionData.ts", () => ({
  useTurnLog: () => {
    throw new Promise(() => {});
  },
}));

test("review focus 1: a joined line counts its own page while the page before loads", () => {
  const stretch: Stretch = {
    continued: true,
    items: [{ durationMs: 1000, kind: "thought", seq: 100 }],
    key: "turn:100",
    open: false,
  };

  render(
    <JoinedStretch after={0} stretch={stretch} turn="turn">
      {(whole) => <p>{`${whole.items.length} items from ${whole.key}`}</p>}
    </JoinedStretch>,
  );

  expect(screen.getByText("1 items from turn:100")).toBeTruthy();
});
