// When a stop is the cursor's (R2): it holds the focus after a key, never after a click, and a real
// mouse move lets it go. A modifier alone is no key: Shift held for a Shift+click is the mouse's.
// Escape clears the cursor only where its stop holds the focus itself, and a stop redrawn after
// Escape stays free.
import { Button } from "@astryxdesign/core/Button";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, expect, test } from "vite-plus/test";
import { useHeld } from "../cursor/held.ts";
import { stopProps } from "../cursor/stops.ts";
import { useCursor } from "../cursor/useCursor.ts";
import { KeysProvider } from "../keys/registry.tsx";
import { click, hold } from "./helpers.tsx";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

/** A stop that says whether the cursor holds it. */
function Stop() {
  const ref = useRef<HTMLDivElement>(null);
  const held = useHeld(ref);
  return (
    <div ref={ref} {...stopProps("pane")} data-testid="stop">
      {held ? "held" : "free"}
    </div>
  );
}

function renderStop() {
  render(
    <KeysProvider>
      <Stop />
    </KeysProvider>,
  );
  return screen.getByTestId("stop");
}

/** Moves the mouse by a pixel, after a first move that only marks where it is. */
function moveMouse() {
  fireEvent.pointerMove(document.body, { clientX: 10, clientY: 10, pointerType: "mouse" });
  fireEvent.pointerMove(document.body, { clientX: 11, clientY: 10, pointerType: "mouse" });
}

test("a stop focused after a key is held, after a click or a modifier is not", async () => {
  const stop = renderStop();
  hold(stop);
  expect(stop.textContent, "a key, then the focus").toBe("held");
  act(() => stop.blur());
  await click(stop);
  act(() => stop.focus());
  expect(stop.textContent, "a press of the mouse, then the focus").toBe("free");
  act(() => {
    stop.blur();
    fireEvent.keyDown(document.body, { key: "Shift" });
    stop.focus();
  });
  expect(stop.textContent, "Shift alone, then the focus").toBe("free");
});

test("a real mouse move lets the held stop go", () => {
  const stop = renderStop();
  hold(stop);
  moveMouse();
  expect(stop.textContent).toBe("free");
  expect(document.activeElement).not.toBe(stop);
});

/** A page with the cursor's keys over two stops, the first redrawn as a new element per `version`. */
function Page({ version }: { version: number }) {
  useCursor();
  return (
    <>
      <div key={version} {...stopProps("block")} data-testid="first" />
      <section {...stopProps("pane")} data-testid="pane">
        <Button label="Inside" />
      </section>
    </>
  );
}

const renderPage = (version: number) =>
  render(
    <KeysProvider>
      <Page version={version} />
    </KeysProvider>,
  );

/** Presses Escape: whether the page's default was left, as no binding of the cursor's ran. */
const escape = () => fireEvent.keyDown(document.body, { key: "Escape" });

test("a held stop redrawn passes the focus on, but not once Escape cleared the cursor", async () => {
  const { rerender } = renderPage(1);
  hold(screen.getByTestId("first"));
  rerender(
    <KeysProvider>
      <Page version={2} />
    </KeysProvider>,
  );
  await act(async () => {});
  expect(document.activeElement, "redrawn while held").toBe(screen.getByTestId("first"));
  escape();
  expect(document.activeElement, "cleared").toBe(document.body);
  rerender(
    <KeysProvider>
      <Page version={3} />
    </KeysProvider>,
  );
  await act(async () => {});
  expect(document.activeElement, "redrawn after Escape").toBe(document.body);
});

test("Escape on a control inside a pane stop is left to the page", () => {
  renderPage(1);
  const inside = screen.getByRole("button", { name: "Inside" });
  hold(inside);
  expect(escape(), "the key's default is left").toBe(true);
  expect(document.activeElement).toBe(inside);
});
