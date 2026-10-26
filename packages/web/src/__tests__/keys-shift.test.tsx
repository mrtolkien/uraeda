// US3 4 and review focus 4, on a list alone: `K J H L` and Shift with the arrows ask for the move of
// the focused row, only where the list can move items; elsewhere nothing takes them, so a bare
// page's keys are not stopped. Their writes on the priorities page are in
// `__browser__/keys-shift.test.tsx`: happy-dom shows every closed popover, which the layer rule
// then takes for an open layer, so a whole page's keys are tested in a real browser.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { KeysProvider } from "../keys/registry.tsx";
import { useListKeys } from "../lists/useListKeys.ts";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

/** A list that cannot move its items: it declares no `onMoveItem`. */
function Rows({
  onMoveItem,
  onSelect = () => {},
}: {
  onMoveItem?: (move: string, index: number) => void;
  onSelect?: (index: number) => void;
}) {
  const { ref } = useListKeys({
    onClose: () => false,
    onEdit: () => false,
    ...(onMoveItem === undefined ? {} : { onMoveItem }),
    onSelect,
    selected: 0,
  });
  return (
    <div>
      <div ref={ref}>
        <div data-row>
          <a href="/one">One</a>
        </div>
        <div data-row>
          <a href="/two">Two</a>
        </div>
      </div>
    </div>
  );
}

const MOVERS: ReadonlyArray<KeyboardEventInit> = [
  { key: "J", shiftKey: true },
  { key: "K", shiftKey: true },
  { key: "H", shiftKey: true },
  { key: "L", shiftKey: true },
  { key: "ArrowDown", shiftKey: true },
  { key: "ArrowUp", shiftKey: true },
  { key: "ArrowLeft", shiftKey: true },
  { key: "ArrowRight", shiftKey: true },
];

test("on a list that cannot move items, the keys do nothing and are left to the page", () => {
  render(
    <KeysProvider>
      <Rows />
    </KeysProvider>,
  );
  const link = screen.getByRole("link", { name: "One" });
  link.focus();
  for (const init of MOVERS) {
    // A key nothing took is not prevented, so a scroll is not this list's to stop.
    expect(fireEvent.keyDown(link, init), JSON.stringify(init)).toBe(true);
  }
  expect(document.activeElement).toBe(link);
});

test("on a list that can, each key asks for its move of the focused row", () => {
  const moves = vi.fn();
  render(
    <KeysProvider>
      <Rows onMoveItem={moves} />
    </KeysProvider>,
  );
  const link = screen.getByRole("link", { name: "Two" });
  link.focus();
  for (const init of MOVERS) {
    fireEvent.keyDown(link, init);
  }
  expect(moves.mock.calls).toEqual([
    ["down", 1],
    ["up", 1],
    ["left", 1],
    ["right", 1],
    ["down", 1],
    ["up", 1],
    ["left", 1],
    ["right", 1],
  ]);
});

test("the list's keys act on a row or the page, not on a control elsewhere or in a text field", () => {
  const moves = vi.fn();
  const selects = vi.fn();
  render(
    <KeysProvider>
      <Rows onMoveItem={moves} onSelect={selects} />
    </KeysProvider>,
  );
  const outside = [document.createElement("button"), document.createElement("input")];
  document.body.append(...outside);
  for (const target of outside) {
    target.focus();
    for (const init of [
      { key: "j" },
      { key: "ArrowDown" },
      { key: "J", shiftKey: true },
      { key: "Enter" },
    ]) {
      fireEvent.keyDown(target, init);
    }
  }
  expect(selects).not.toHaveBeenCalled();
  expect(moves).not.toHaveBeenCalled();

  // On the page, the same keys are the list's.
  fireEvent.keyDown(document.body, { key: "j" });
  fireEvent.keyDown(document.body, { key: "J", shiftKey: true });
  expect(selects).toHaveBeenCalledWith(1);
  expect(moves).toHaveBeenCalledWith("down", 0);
});
