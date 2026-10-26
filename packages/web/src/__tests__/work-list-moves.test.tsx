// US3 4, on a `WorkList` alone: the keys that move the focused card ask `onMove` for the move a drop
// would, one at a time (R9): a second key pressed before the first is written waits for it, and its
// target is read from the list as the first left it. The card moved is the focused one, not the
// selected one. Their writes on the priorities page are in `__browser__/keys-shift.test.tsx`.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { KeysProvider } from "../keys/registry.tsx";
import { WorkList, type WorkRow, type WorkSection } from "../lists/WorkList.tsx";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const row = (key: string): WorkRow => ({ href: `/p/${key}`, key, lines: [], text: key });

/** One movable section holding the rows `keys`, in order. */
const sectionOf = (keys: ReadonlyArray<string>): ReadonlyArray<WorkSection> => [
  { id: "next", rows: keys.map(row), title: "Next", tone: "neutral" },
];

function list(keys: ReadonlyArray<string>, onMove: Parameters<typeof WorkList>[0]["onMove"]) {
  return (
    <KeysProvider>
      <WorkList onMove={onMove} sections={sectionOf(keys)} selected="a" />
    </KeysProvider>
  );
}

const focus = (name: string) => {
  const link = screen.getByRole("link", { name });
  link.focus();
  return link;
};

test("a second move key waits for the first move's write, and reads the list as it left it", async () => {
  const writes: Array<() => void> = [];
  const onMove = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        writes.push(resolve);
      }),
  );
  const { rerender } = render(list(["a", "b", "c"], onMove));
  const link = focus("a");

  fireEvent.keyDown(link, { key: "J", shiftKey: true });
  fireEvent.keyDown(link, { key: "J", shiftKey: true });
  expect(onMove.mock.calls).toEqual([["a", "next", 1]]);

  // The first write lands: the list is drawn in the order it wrote, then the second key moves.
  rerender(list(["b", "a", "c"], onMove));
  writes[0]();
  await waitFor(() => expect(onMove).toHaveBeenCalledTimes(2));
  expect(onMove.mock.calls[1]).toEqual(["a", "next", 2]);
  writes[1]();
});

test("a move that is refused does not stop the keys after it", async () => {
  const onMove = vi.fn().mockRejectedValueOnce(new Error("refused")).mockResolvedValue(undefined);
  render(list(["a", "b", "c"], onMove));
  const link = focus("a");

  fireEvent.keyDown(link, { key: "J", shiftKey: true });
  await waitFor(() => expect(onMove).toHaveBeenCalledTimes(1));
  fireEvent.keyDown(link, { key: "J", shiftKey: true });

  await waitFor(() => expect(onMove).toHaveBeenCalledTimes(2));
});

test("the key moves the focused card, not the selected one", () => {
  const onMove = vi.fn();
  render(list(["a", "b", "c"], onMove));
  // `a` is selected; the Tab key put the focus on `c`.
  const link = focus("c");

  fireEvent.keyDown(link, { key: "K", shiftKey: true });

  expect(onMove).toHaveBeenCalledWith("c", "next", 1);
});

test("+ and - move the selection like j and k", () => {
  render(list(["a", "b", "c"], vi.fn()));
  const first = focus("a");

  fireEvent.keyDown(first, { key: "+" });
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "b" }));
  fireEvent.keyDown(document.activeElement as Element, { key: "-" });
  expect(document.activeElement).toBe(first);
});
