// The page runtime: the pages of your extensions, fetched from the server as each one's running
// version changes, evaluated, and registered into the app's registry through the same page API as
// the built-ins. Each version's registrations are undone before the next one runs, its CSS
// replaced, and every contribution it registers is drawn inside its extension's boundary, keyed by
// the version. A page that throws registers nothing, and its problem goes to the settings page.
import { type ComponentType, createElement } from "react";
import { pageActivation, type PageBundle } from "./evaluate.ts";
import { ExtensionBoundary } from "./ExtensionBoundary.tsx";
import { type PageApi, pageApi } from "./pageApi.ts";
import type { Registry } from "./registry.ts";
import { type SharedModules, sharedModules } from "./shared.ts";

/** An extension with a page, as the `Extensions` record lists it: its page's running version. */
export type PageRow = { name: string; pageVersion: number | null; title: string };

/** What the runtime fetches and reports through. */
export type PageDeps = {
  fetch: typeof globalThis.fetch;
  registry: Registry;
  /** Reports a problem the page of the extension met at a version, to the settings page. */
  report: (name: string, version: number, message: string) => void;
};

/** The version of each extension's page that is wanted, and the one registered. */
const pages = new Map<string, { registered?: number; style?: HTMLStyleElement; wanted: number }>();

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The fields of a contribution that are components, drawn inside the extension's boundary. */
const COMPONENTS = ["action", "actions", "component", "navRow", "section", "tab"] as const;

/** What draws `Inner` inside the boundary of the version of the extension. */
type Boundary = { name: string; report: (message: string) => void; title: string; version: number };

function bounded(Inner: ComponentType<object>, boundary: Boundary, isInline: boolean) {
  const { name, report, title, version } = boundary;
  return function Bounded(props: object) {
    const children = createElement(Inner, props);
    const own = { children, isInline, name, report, title };
    return createElement(ExtensionBoundary, { ...own, key: version });
  };
}

/** `value` with each component drawn in the boundary, its count's throw an unknown count. */
function guarded<T extends object>(value: T, boundary: Boundary, isInline = false): T {
  const out = { ...value } as Record<string, unknown>;
  for (const field of COMPONENTS) {
    const inner = out[field];
    if (typeof inner === "function" || (typeof inner === "object" && inner !== null)) {
      out[field] = bounded(inner as ComponentType<object>, boundary, isInline);
    }
  }
  const count = out.count;
  if (typeof count === "function") {
    out.count = () => {
      try {
        return count() as unknown;
      } catch (error) {
        boundary.report(messageOf(error));
        return undefined;
      }
    };
  }
  const run = out.run;
  if (typeof run === "function") {
    out.run = () => {
      try {
        run();
      } catch (error) {
        boundary.report(messageOf(error));
      }
    };
  }
  return out as T;
}

/** The page API a version of an extension's page gets: every contribution guarded. */
function guardedApi(api: PageApi, boundary: Boundary): PageApi {
  return {
    homePane: (pane) => api.homePane(guarded(pane, boundary)),
    itemRenderer: (renderer) => api.itemRenderer(guarded(renderer, boundary)),
    key: (key) => api.key(guarded(key, boundary)),
    newSection: (section) => api.newSection(guarded(section, boundary)),
    place: (place) => api.place(guarded(place, boundary)),
    settingsSection: (section) => api.settingsSection(guarded(section, boundary)),
    statusItem: (item) => api.statusItem(guarded(item, boundary, true)),
  };
}

/** Undoes what the extension's page registered, and takes its CSS out. */
function unload(name: string, registry: Registry) {
  const page = pages.get(name);
  registry.remove(name);
  page?.style?.remove();
  pages.delete(name);
}

/** Evaluates `bundle` and registers it, the extension's old version undone first. */
function activate(row: PageRow, bundle: PageBundle, shared: SharedModules, deps: PageDeps) {
  const { name, title } = row;
  const { version } = bundle;
  unload(name, deps.registry);
  const report = (message: string) => deps.report(name, version, message);
  const api = pageApi(name, deps.registry, { title });
  try {
    pageActivation(bundle, shared)(guardedApi(api, { name, report, title, version }));
  } catch (error) {
    api.remove();
    pages.set(name, { registered: version, wanted: version });
    report(messageOf(error));
    return;
  }
  const style = document.createElement("style");
  style.dataset.extension = name;
  style.textContent = bundle.css;
  document.head.append(style);
  pages.set(name, { registered: version, style, wanted: version });
}

/** Fetches the extension's page and registers it, unless another version is wanted meanwhile. */
async function load(row: PageRow, deps: PageDeps, wanted: number) {
  const isWanted = () => pages.get(row.name)?.wanted === wanted;
  let bundle: PageBundle;
  let shared: SharedModules;
  try {
    const path = `/extensions/${encodeURIComponent(row.name)}/page`;
    const [response, modules] = await Promise.all([
      deps.fetch(path, { cache: "no-store" }),
      sharedModules(),
    ]);
    if (!response.ok) {
      throw new Error(`its page could not be fetched: ${response.status}`);
    }
    bundle = (await response.json()) as PageBundle;
    shared = modules;
  } catch (error) {
    if (isWanted()) {
      deps.report(row.name, wanted, messageOf(error));
    }
    return;
  }
  if (isWanted()) {
    activate(row, bundle, shared, deps);
  }
}

/**
 * Brings the registered pages in line with `rows`: an extension whose page's version changed is
 * fetched and registered again; one with no page any more is undone.
 */
export function syncPages(rows: ReadonlyArray<PageRow>, deps: PageDeps): void {
  const withPage = new Map(
    rows.flatMap((row) => (row.pageVersion === null ? [] : [[row.name, row]])),
  );
  for (const name of pages.keys()) {
    if (!withPage.has(name)) {
      unload(name, deps.registry);
    }
  }
  for (const [name, row] of withPage) {
    const page = pages.get(name);
    const version = row.pageVersion!;
    // A bundle fetched may be newer than the record that asked for it: never older.
    if (page !== undefined && (page.wanted >= version || (page.registered ?? 0) >= version)) {
      continue;
    }
    pages.set(name, { ...page, wanted: version });
    void load(row, deps, version);
  }
}
