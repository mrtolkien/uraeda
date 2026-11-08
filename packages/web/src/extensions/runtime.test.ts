// The page runtime's own logic, its fetch, registry, and shared modules injected: which version of
// a page ends registered, its CSS, and what an evaluated bundle may import.
import { afterEach, expect, test } from "vite-plus/test";
import { type PageBundle, pageActivation } from "./evaluate.ts";
import { createRegistry, type Place } from "./registry.ts";
import { type PageDeps, type PageRow, syncPages } from "./runtime.ts";
import type { SharedModules } from "./shared.ts";

const page = { pageMarker: true };
const shared: SharedModules = (specifier) => (specifier === "uraeda/page" ? page : undefined);

/** A bundle whose entry registers a place titled `title`, with `css`. */
const bundleOf = (version: number, title: string, css = ""): PageBundle => ({
  css,
  entry: "page.tsx",
  imports: {},
  modules: {
    "page.tsx": `__exports.default = (api) => api.place({ component: () => null, icon: "uraeda:list", id: "p", title: ${JSON.stringify(title)} });`,
  },
  version,
});

/** A fetch whose answers the test gives, each by the request's order. */
function controlledFetch() {
  const calls: Array<PromiseWithResolvers<Response>> = [];
  const fetch = (() => {
    const call = Promise.withResolvers<Response>();
    calls.push(call);
    return call.promise;
  }) as unknown as typeof globalThis.fetch;
  const answer = (index: number, body: PageBundle | null) =>
    calls[index].resolve(
      body === null
        ? new Response("gone", { status: 500 })
        : new Response(JSON.stringify(body), { status: 200 }),
    );
  return { answer, calls, fetch };
}

function setup() {
  const registry = createRegistry();
  const reports: Array<[string, number, string]> = [];
  const http = controlledFetch();
  const deps: PageDeps = {
    fetch: http.fetch,
    registry,
    report: (name, version, message) => void reports.push([name, version, message]),
    shared: async () => shared,
  };
  const titles = () => registry.list("place", () => true).map((place: Place) => place.title);
  return { deps, http, registry, reports, titles };
}

const row = (name: string, pageVersion: number | null): PageRow => ({
  name,
  pageVersion,
  title: name,
});

/** Lets the fetches answered so far, and their JSON, run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

let last: PageDeps | undefined;
afterEach(() => {
  if (last) {
    syncPages([], last);
  }
});

test("of two quick versions, the stale fetch is dropped", async () => {
  const { deps, http, reports, titles } = setup();
  last = deps;
  syncPages([row("quick", 1)], deps);
  syncPages([row("quick", 2)], deps);
  http.answer(1, bundleOf(2, "Second"));
  await settle();
  http.answer(0, bundleOf(1, "First"));
  await settle();
  expect(titles()).toEqual(["Second"]);
  expect(reports).toEqual([]);
});

/** The CSS of the extension `styled` in the document. */
const styles = () =>
  [...document.head.querySelectorAll('style[data-extension="styled"]')].map(
    (style) => style.textContent,
  );

test("a version's CSS replaces the last one's, and goes with the extension", async () => {
  const { deps, http } = setup();
  last = deps;
  syncPages([row("styled", 1)], deps);
  http.answer(0, bundleOf(1, "Styled", ".a{}"));
  await settle();
  expect(styles()).toEqual([".a{}"]);
  syncPages([row("styled", 2)], deps);
  http.answer(1, bundleOf(2, "Styled", ".b{}"));
  await settle();
  expect(styles()).toEqual([".b{}"]);
  syncPages([], deps);
  expect(styles()).toEqual([]);
});

test("an extension removed while its page is fetched registers nothing", async () => {
  const { deps, http, reports, titles } = setup();
  last = deps;
  syncPages([row("gone", 1)], deps);
  syncPages([], deps);
  http.answer(0, bundleOf(1, "Gone"));
  await settle();
  expect(titles()).toEqual([]);
  expect(reports).toEqual([]);
});

// Break: `>=` between versions, as before, which kept version 3 after the server restarted.
test("an older version, after the server restarted, is loaded", async () => {
  const { deps, http, titles } = setup();
  last = deps;
  syncPages([row("restarted", 3)], deps);
  http.answer(0, bundleOf(3, "Before"));
  await settle();
  syncPages([row("restarted", 1)], deps);
  expect(http.calls).toHaveLength(2);
  http.answer(1, bundleOf(1, "After"));
  await settle();
  expect(titles()).toEqual(["After"]);
});

// Break: a failed fetch left the version wanted, which no later sync asked for again.
test("a failed fetch is reported, and tried again at the next sync", async () => {
  const { deps, http, reports, titles } = setup();
  last = deps;
  syncPages([row("flaky", 1)], deps);
  http.answer(0, null);
  await settle();
  expect(reports).toEqual([["flaky", 1, "its page could not be fetched: 500"]]);
  syncPages([row("flaky", 1)], deps);
  expect(http.calls).toHaveLength(2);
  http.answer(1, bundleOf(1, "Flaky"));
  await settle();
  expect(titles()).toEqual(["Flaky"]);
});

test("a bundle throwing as it registers leaves the other extension's place", async () => {
  const { deps, http, reports, titles } = setup();
  last = deps;
  syncPages([row("fine", 1), row("broken", 1)], deps);
  http.answer(0, bundleOf(1, "Fine"));
  http.answer(1, {
    ...bundleOf(1, "Broken"),
    modules: {
      "page.tsx": `__exports.default = (api) => { api.place({ component: () => null, icon: "uraeda:list", id: "p", title: "Broken" }); throw new Error("no wiki"); };`,
    },
  });
  await settle();
  expect(titles()).toEqual(["Fine"]);
  expect(reports).toEqual([["broken", 1, "no wiki"]]);
});

/** The activation of a bundle of `modules`, its entry `page.tsx`, its imports as `imports`. */
const activation = (
  modules: Record<string, string>,
  imports: Record<string, Record<string, string>> = {},
) => pageActivation({ css: "", entry: "page.tsx", imports, modules, version: 1 }, shared);

const exporting = (value: string) => `__exports.default = ${value};`;

test("a bare import other than the shared modules is refused, and says which it can", () => {
  expect(() => activation({ "page.tsx": `__import("lodash");` })).toThrow(
    `page.tsx: "lodash" cannot be imported: a page imports only React, StyleX, Astryx, uraeda/page, and its own files`,
  );
  let got: unknown;
  activation({
    "page.tsx": `const page = __import("uraeda/page"); ${exporting("(api) => api.got(page)")}`,
  })({ got: (value: unknown) => (got = value) });
  expect(got).toBe(page);
});

// Break: a relative import joined against the importing file's path, as before, which missed a
// link inside the folder the server had resolved to the file it links to.
test("a relative import is the file the server resolved it to, never one out of the bundle", () => {
  let got: unknown;
  activation(
    {
      "lib/index.tsx": `__exports.title = "Lib";`,
      "lib/title.ts": `__exports.title = "Linked";`,
      "page.tsx": `const lib = __import("./lib"), alias = __import("./alias"); ${exporting("(api) => api.got([lib.title, alias.title])")}`,
    },
    { "page.tsx": { "./alias": "lib/title.ts", "./lib": "lib/index.tsx" } },
  )({ got: (value: unknown) => (got = value) });
  expect(got).toEqual(["Lib", "Linked"]);
  expect(() => activation({ "page.tsx": `__import("../outside");` })).toThrow(
    `page.tsx: "../outside" is not a file of the page`,
  );
  expect(() =>
    activation({ "page.tsx": `__import("./gone");` }, { "page.tsx": { "./gone": "gone.ts" } }),
  ).toThrow(`page.tsx: "./gone" is not a file of the page`);
});

/** A bundle whose activation registers two unload callbacks, and throws when `throws`. */
const unloading = (version: number, throws = false): PageBundle => ({
  css: "",
  entry: "page.tsx",
  imports: {},
  modules: {
    "page.tsx": `__exports.default = (api) => {
  const log = (globalThis.unloads ??= []);
  api.onUnload(() => log.push("first ${version}"));
  api.onUnload(() => log.push("second ${version}"));
  ${throws ? `throw new Error("broken");` : ""}
};`,
  },
  version,
});

// Break: `onUnload`'s callbacks never run, or in the order registered.
test("a version's onUnload callbacks run as it unloads, the last first", async () => {
  const { deps, http } = setup();
  last = deps;
  const log: Array<string> = [];
  (globalThis as { unloads?: Array<string> }).unloads = log;
  syncPages([row("timers", 1)], deps);
  http.answer(0, unloading(1));
  await settle();
  expect(log).toEqual([]);
  syncPages([row("timers", 2)], deps);
  http.answer(1, unloading(2, true));
  await settle();
  // Version 1 unloaded for 2, and 2, which threw, undone at once.
  expect(log).toEqual(["second 1", "first 1", "second 2", "first 2"]);
  syncPages([], deps);
  expect(log).toHaveLength(4);
  delete (globalThis as { unloads?: Array<string> }).unloads;
});
