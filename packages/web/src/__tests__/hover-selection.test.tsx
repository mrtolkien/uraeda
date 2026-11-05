// Hovering a row of a list moves the selection there only once the pointer moves: a row the page
// scrolls under a still pointer, as `j` scrolls a long list, takes nothing from the keys.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { KeysProvider } from "../keys/registry.tsx";
import { WorkList, type WorkRow } from "../lists/WorkList.tsx";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const row = (key: string): WorkRow => ({ href: `/p/${key}`, key, lines: [], text: key });

const selected = () =>
  document.querySelector<HTMLElement>("[data-row-key][aria-current='true']")?.dataset.rowKey;

/** A mouse's move over the row `key`, with the pointer at `x`, `y` in the window. */
const moveOver = (key: string, x: number, y: number) =>
  act(() => {
    const control = screen.getByRole("button", { name: key });
    // What a browser sends as the page scrolls under the pointer: `movementX` filled in, the
    // pointer where it was.
    fireEvent.pointerMove(control, { clientX: x, clientY: y, movementX: 3, pointerType: "mouse" });
  });

test("a key's selection stays under a still pointer, and follows the pointer once it moves", () => {
  render(
    <KeysProvider>
      <WorkList
        sections={[{ id: "next", rows: ["a", "b", "c"].map(row), title: "Next", tone: "neutral" }]}
        selected="a"
      />
    </KeysProvider>,
  );
  // The pointer rests over `c`.
  moveOver("c", 40, 90);
  moveOver("c", 40, 90);
  act(() => screen.getByRole("button", { name: "a" }).focus());
  act(() => void fireEvent.keyDown(document.activeElement ?? document.body, { key: "j" }));
  expect(selected()).toBe("b");

  // The list scrolls `a` under the still pointer: the selection stays.
  moveOver("a", 40, 90);
  expect(selected()).toBe("b");

  // The pointer moves: the selection follows it.
  moveOver("a", 42, 91);
  expect(selected()).toBe("a");
});
