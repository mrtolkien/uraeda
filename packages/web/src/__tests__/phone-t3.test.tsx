// T3, on an iPhone from the home screen: what is typed, and the button that sends it, stay above
// the keyboard; the phone hints no key; and the priorities are one column there.
import { LayerProvider } from "@astryxdesign/core/Layer";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { scrollAboveKeyboard, useAboveKeyboard } from "../layout/useAboveKeyboard.ts";
import { useUndoToast } from "../layout/useUndoToast.ts";
import { atWidth, fixtureRepo, renderPage } from "./helpers.tsx";

/** A visual viewport the test moves, as a phone's keyboard does as it opens. */
class Viewport extends EventTarget {
  height = window.innerHeight;
  offsetTop = 0;
}

afterEach(() => {
  Reflect.deleteProperty(window, "visualViewport");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  atWidth(1440);
});

test("a box's end scrolls above the keyboard, and only while a keyboard shows", () => {
  const screenHeight = 844;
  // No keyboard: the visual viewport is the window.
  expect(scrollAboveKeyboard(900, { height: 844, offsetTop: 0 }, screenHeight)).toBe(0);
  // A keyboard 336 tall: a Send at 610 rises above it, with a little room.
  expect(scrollAboveKeyboard(610, { height: 508, offsetTop: 0 }, screenHeight)).toBe(110);
  // Already above it: nothing moves.
  expect(scrollAboveKeyboard(400, { height: 508, offsetTop: 0 }, screenHeight)).toBe(0);
  // The visual viewport scrolled down by iOS: what it shows starts lower.
  expect(scrollAboveKeyboard(610, { height: 508, offsetTop: 100 }, screenHeight)).toBe(10);
});

/** A field in a box whose end, its Send, sits at `bottom`, kept above the keyboard. */
function Box({ bottom }: { bottom: number }) {
  const box = useRef<HTMLDivElement>(null);
  useAboveKeyboard(box, true);
  useEffect(() => {
    vi.spyOn(box.current!, "getBoundingClientRect").mockReturnValue({ bottom } as DOMRect);
  }, [bottom]);
  return (
    <div ref={box}>
      {/* oxlint-disable-next-line react/forbid-elements -- a bare field stands for a composer's */}
      <textarea aria-label="Message" />
      {/* oxlint-disable-next-line react/forbid-elements -- a bare button stands for its Send */}
      <button type="button">Send</button>
    </div>
  );
}

// Break: a composer whose Send stayed under the keyboard, as iOS scrolls only the caret into view.
test("while a field of the box is typed in, the keyboard opening scrolls its Send above it", async () => {
  const viewport = new Viewport();
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect() {}
      observe() {}
    },
  );
  const scroll = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  render(<Box bottom={window.innerHeight - 40} />);
  act(() => screen.getByRole("textbox", { name: "Message" }).focus());
  await act(async () => {
    viewport.height = window.innerHeight - 336;
    viewport.dispatchEvent(new Event("resize"));
    await new Promise((done) => requestAnimationFrame(done));
  });
  await waitFor(() => expect(scroll).toHaveBeenCalledWith({ top: 336 - 40 + 8 }));
});

/** A toast with an Undo, as a change the page does not show. */
function Toasting() {
  const toast = useUndoToast();
  useEffect(() => {
    toast("Moved to Later", () => Promise.resolve(undefined));
  }, [toast]);
  return null;
}

/** The toast's Undo, once shown. */
function undo() {
  return waitFor(() => {
    const button = document.querySelector<HTMLButtonElement>("[data-undo] button");
    expect(button).not.toBeNull();
    return button!;
  });
}

// Break: "Undo u" on a touch screen, where no key is hinted.
test("on the phone, the toast's Undo shows no key; on a wide screen it shows `u`", async () => {
  atWidth(402);
  const phone = render(
    <LayerProvider>
      <Toasting />
    </LayerProvider>,
  );
  expect((await undo()).textContent?.trim()).toBe("Undo");
  phone.unmount();

  atWidth(1440);
  render(
    <LayerProvider>
      <Toasting />
    </LayerProvider>,
  );
  await waitFor(async () => expect((await undo()).textContent).toMatch(/Undo\s*u/));
});

// Break: four columns on a phone, scrolled sideways, Next and Later past the screen's edge.
test("on the phone, the priorities are one column until the columns are picked", async () => {
  window.localStorage.removeItem("uraeda:priorities:layout");
  atWidth(402);
  await renderPage("/priorities", fixtureRepo());
  await screen.findByRole("heading", { name: "Priorities" });
  const table = await screen.findByRole("radio", { name: "Table" });
  expect(table.getAttribute("aria-checked")).toBe("true");
  expect(screen.queryByRole("region", { name: "Columns" })).toBeNull();

  await act(async () => {
    fireEvent.click(screen.getByRole("radio", { name: "Columns" }));
  });
  await waitFor(() =>
    expect(screen.getByRole("radio", { name: "Columns" }).getAttribute("aria-checked")).toBe(
      "true",
    ),
  );
  await screen.findByRole("region", { name: "Columns" });
  expect(window.localStorage.getItem("uraeda:priorities:layout")).toBe("columns");
  window.localStorage.removeItem("uraeda:priorities:layout");
});
