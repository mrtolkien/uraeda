// What a contribution of an extension's page draws when it throws: its extension's title and the
// message, in its own place, reported; a place's count, the shell's fallback, reported once.
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { CountIn } from "./CountIn.tsx";
import { ExtensionBoundary } from "./ExtensionBoundary.tsx";
import { createRegistry } from "./registry.ts";
import { type PageDeps, syncPages } from "./runtime.ts";

function Throwing(): never {
  throw new Error("the wiki fell over");
}

/** Keeps React's logged errors of the throws below out of the test's output. */
const quietly = <T,>(run: () => T): T => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    return run();
  } finally {
    spy.mockRestore();
  }
};

test("a contribution that throws says '<title>: <message>', and is reported", () => {
  const reports: Array<string> = [];
  quietly(() =>
    render(
      <ExtensionBoundary name="wiki" report={(message) => reports.push(message)} title="Wiki">
        <Throwing />
      </ExtensionBoundary>,
    ),
  );
  expect(screen.getByText("Wiki: the wiki fell over")).toBeTruthy();
  expect(reports).toEqual(["the wiki fell over"]);
});

test("a place's count that throws draws the fallback, reported once in its version", async () => {
  const registry = createRegistry();
  const reports: Array<[string, number, string]> = [];
  const bundle = {
    css: "",
    entry: "page.tsx",
    imports: {},
    modules: {
      "page.tsx": `__exports.default = (api) => api.place({ component: () => null, count: () => { throw new Error("no count"); }, icon: "uraeda:list", id: "p", title: "Counted" });`,
    },
    version: 1,
  };
  const deps: PageDeps = {
    fetch: (async () => new Response(JSON.stringify(bundle))) as unknown as typeof fetch,
    registry,
    report: (name, version, message) => void reports.push([name, version, message]),
    shared: async () => () => undefined,
  };
  syncPages([{ name: "counted", pageVersion: 1, title: "Counted" }], deps);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const [place] = registry.list("place", () => true);
  const Count = () => <>{String(place.count!())}</>;
  quietly(() =>
    render(
      <>
        {[1, 2].map((each) => (
          <CountIn count={place.count!} fallback={<span>none</span>} key={each}>
            <Count />
          </CountIn>
        ))}
      </>,
    ),
  );
  expect(screen.getAllByText("none")).toHaveLength(2);
  expect(reports).toEqual([["counted", 1, "no count"]]);
  syncPages([], deps);
});
