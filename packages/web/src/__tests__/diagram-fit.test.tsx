// A diagram fits its room (`useDiagramDraw`): much wider, it is drawn again for the room and shows
// that layout once in; within a tenth of it, it is scaled down, neither drawn again nor said to
// scroll; and a new source never shows the last one's fitted picture. happy-dom lays nothing out:
// the diagram's box is given its room, and Pele's draws their widths, by source and `maxWidth`.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { Diagram } from "../Diagram.tsx";

/** Each source's natural width, and its width laid out for a `maxWidth`. */
const WIDTHS: Record<string, { fitted: number; natural: number }> = {
  "flowchart LR\n  a --> b": { fitted: 600, natural: 900 },
  "flowchart LR\n  c --> d": { fitted: 610, natural: 950 },
  "flowchart LR\n  near": { fitted: 500, natural: 526 },
};

/** The draws held back, by source and `maxWidth`, that a test lets through. */
let held: Map<string, () => void>;

const renderAsync = vi.hoisted(() =>
  vi.fn(async (source: string, { maxWidth }: { maxWidth?: number }) => {
    const width = maxWidth === undefined ? WIDTHS[source]!.natural : WIDTHS[source]!.fitted;
    const key = `${source}@${maxWidth ?? "natural"}`;
    if (held.has(key)) {
      await new Promise<void>((resolve) => held.set(key, resolve));
    }
    return { height: 100, svg: `<svg data-drawn="${key}"></svg>`, type: "flowchart", width };
  }),
);

vi.mock("pele/lazy", () => ({ renderAsync }));

/** The room every diagram's box has, in px. */
let room = 640;

beforeEach(() => {
  held = new Map();
  renderAsync.mockClear();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ height: 0, left: 0, top: 0, width: room }) as DOMRect,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** What the diagram shows: its draw's source and `maxWidth`, none while drawing. */
const shown = () => document.querySelector("[data-drawn]")?.getAttribute("data-drawn");

// Break: show the natural layout once a fitted one is drawn, or draw again with the exact room.
test("a diagram much wider than its room shows Pele's layout for it", async () => {
  room = 643;
  render(<Diagram source={"flowchart LR\n  a --> b"} />);

  await vi.waitFor(() => expect(shown()).toBe("flowchart LR\n  a --> b@640"));
  expect(renderAsync).toHaveBeenCalledWith(
    "flowchart LR\n  a --> b",
    expect.objectContaining({ maxWidth: 640 }),
  );
  expect(screen.queryByRole("region")).toBeNull();
});

// Break: run the fit draw within a tenth of the room, or drop the tolerance from `scrolls`.
test("a diagram within a tenth of its room is scaled down, not drawn again", async () => {
  room = 485;
  render(<Diagram source={"flowchart LR\n  near"} />);

  await screen.findByRole("group", { name: "Flowchart diagram" });
  expect(shown()).toBe("flowchart LR\n  near@natural");
  expect(renderAsync).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("region")).toBeNull();
});

// Break: keep a fitted draw without its source, so the last one's picture shows for the new one.
test("a new source never shows the last one's fitted picture", async () => {
  room = 640;
  const view = render(<Diagram source={"flowchart LR\n  a --> b"} />);
  await vi.waitFor(() => expect(shown()).toBe("flowchart LR\n  a --> b@640"));

  held.set("flowchart LR\n  c --> d@640", () => {});
  view.rerender(<Diagram source={"flowchart LR\n  c --> d"} />);
  await vi.waitFor(() =>
    expect(renderAsync).toHaveBeenCalledWith(
      "flowchart LR\n  c --> d",
      expect.objectContaining({ maxWidth: 640 }),
    ),
  );
  expect(shown()).toBeUndefined();

  held.get("flowchart LR\n  c --> d@640")!();
  await vi.waitFor(() => expect(shown()).toBe("flowchart LR\n  c --> d@640"));
});
