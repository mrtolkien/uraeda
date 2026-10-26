// A story shown full screen is a layer (the Keyboard decision's layer rule): the page's keys do not
// act behind it, and the Escape that leaves it is not also the page's. Without the browser's full
// screen, as on an iPhone, the window is an overlay; pick mode's Escape ends it alone as well.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Button } from "@astryxdesign/core/Button";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { FullScreenButton, LiveWindow, useLiveWindow } from "../LiveWindow.tsx";
import { KeysProvider, useKeys } from "../keys/registry.tsx";
import { useStoryPick } from "../StoryPick.tsx";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const page = { escape: vi.fn(), move: vi.fn() };

/** The page behind: `j` moves, and Escape is its own fallback, as the rail's and a pane's are. */
function Page() {
  useKeys([
    { keys: "j", label: "move", run: () => void page.move() },
    { fallback: true, keys: "Escape", label: "close", run: () => void page.escape() },
  ]);
  const live = useLiveWindow(true);
  return (
    <LiveWindow
      actions={<FullScreenButton screen={live.screen} />}
      label="Story"
      live={live}
      wide
    />
  );
}

function PickPage() {
  useKeys([{ fallback: true, keys: "Escape", label: "close", run: () => void page.escape() }]);
  const pick = useStoryPick();
  return <Button label={pick.picking ? "Picking" : "Pick"} onClick={() => pick.setPicking(true)} />;
}

const press = (key: string) => fireEvent.keyDown(document.body, { key });

test("with the story full screen, the page's keys do not act behind it, and Escape leaves it alone", () => {
  page.escape.mockReset();
  page.move.mockReset();
  render(
    <KeysProvider>
      <Page />
    </KeysProvider>,
  );
  press("j");
  expect(page.move).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
  press("j");
  expect(page.move).toHaveBeenCalledTimes(1);

  act(() => void press("Escape"));
  expect(page.escape).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Full screen" })).toBeTruthy();
  press("j");
  expect(page.move).toHaveBeenCalledTimes(2);
});

test("Escape in pick mode ends it, and is not the page's Escape too", () => {
  page.escape.mockReset();
  render(
    <KeysProvider>
      <PickPage />
    </KeysProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Pick" }));
  expect(screen.getByRole("button", { name: "Picking" })).toBeTruthy();

  act(() => void press("Escape"));

  expect(screen.getByRole("button", { name: "Pick" })).toBeTruthy();
  expect(page.escape).not.toHaveBeenCalled();
});

test("with the browser's own full screen on, the page's keys do not act behind it", () => {
  page.move.mockReset();
  render(
    <KeysProvider>
      <Page />
    </KeysProvider>,
  );
  const figure = screen.getByRole("figure", { name: "Story" });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: figure });
  try {
    press("j");
    expect(page.move).not.toHaveBeenCalled();
  } finally {
    delete (document as { fullscreenElement?: Element }).fullscreenElement;
  }
  press("j");
  expect(page.move).toHaveBeenCalledTimes(1);
});
