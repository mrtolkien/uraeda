// An overlay's history entry (`useBackCloses`): closing it goes back over that entry once, however
// it is closed, so the page under it stays.
import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { expect, test, vi } from "vite-plus/test";
import { useBackCloses } from "../layout/useBackCloses.ts";

const holder: { close?: () => void } = {};

function Overlay({ isOpen, label }: { isOpen: boolean; label: string }) {
  const close = useBackCloses(label, isOpen, () => {});
  useEffect(() => {
    holder.close = close;
  }, [close]);
  return null;
}

/** Waits for the Backs under way to land. */
const landed = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));

test("an overlay closed by itself and by its owner at once goes back once: the page stays", async () => {
  window.history.pushState({}, "", "/before");
  window.history.pushState({}, "", "/page");
  // A browser's Back lands in a later task: the entry is still there when the owner closes.
  const go = window.history.back.bind(window.history);
  const back = vi.spyOn(window.history, "back").mockImplementation(() => void setTimeout(go, 0));
  const view = render(<Overlay isOpen label="Pick the effort of Sonnet" />);
  expect(window.history.state).toEqual({ overlay: "Pick the effort of Sonnet" });

  // The label changes while it is open, as the effort picker's does when its model's name arrives.
  view.rerender(<Overlay isOpen label="Pick the effort of Opus" />);
  // A pick closes it from within, and its owner closes it before that Back has landed.
  act(() => {
    holder.close?.();
    view.rerender(<Overlay isOpen={false} label="Pick the effort of Opus" />);
  });
  await landed();

  expect(back).toHaveBeenCalledTimes(1);
  expect(window.location.pathname).toBe("/page");
  back.mockRestore();
});
