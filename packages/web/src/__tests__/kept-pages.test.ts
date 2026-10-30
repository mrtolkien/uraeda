// A page kept in memory and shown again: drawn from memory, and read again from the server behind
// only when it was off screen longer than the live bus replays a change (R4, R17).
import { expect, test, vi } from "vite-plus/test";
import { type PageRequest, readAhead, show } from "../readAhead.ts";
import { FeatureView } from "../views.ts";

/** A fate client that records the modes of its requests. */
function client() {
  const modes: Array<string> = [];
  const fate = {
    request: (_request: unknown, options?: { mode?: string }) => {
      modes.push(options?.mode ?? "cache-first");
      return Promise.resolve({});
    },
    retain: () => ({ dispose: () => {} }),
  };
  return { fate: fate as unknown as Parameters<typeof show>[0], modes };
}

const page = (id: string): PageRequest => ({ feature: { id, view: FeatureView } });

test.each([
  { away: 1000, expected: [], what: "back within the replay window" },
  { away: 3000, expected: ["network-only"], what: "back after it" },
])("a kept page shown again $what", ({ away, expected }) => {
  const now = vi.spyOn(performance, "now").mockReturnValue(0);
  const { fate, modes } = client();
  const hide = show(fate, page("a"));
  expect(modes).toEqual([]);
  hide();

  now.mockReturnValue(away);
  show(fate, page("a"));

  expect(modes).toEqual(expected);
  now.mockRestore();
});

test("a page read ahead long before it is shown is read again behind", () => {
  const now = vi.spyOn(performance, "now").mockReturnValue(0);
  const { fate, modes } = client();
  readAhead(fate, page("b"));

  now.mockReturnValue(5000);
  show(fate, page("b"));

  expect(modes).toEqual(["cache-first", "network-only"]);
  now.mockRestore();
});
