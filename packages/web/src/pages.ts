// The app's pages, each a chunk of its own, loaded the first time it is drawn. Once the first page
// has drawn, every page's chunk is fetched while the browser is idle, so no navigation waits on one:
// until then, the route's deferral keeps the page before it on screen.
import { type ComponentType, lazy, useEffect } from "react";

/** What fetches each page's chunk: calling it again reads the module already loaded. */
const loaders: Array<() => Promise<unknown>> = [];

/** The page `load` fetches the module of, as a component loaded the first time it is drawn. */
function page<P extends object>(load: () => Promise<ComponentType<P>>) {
  loaders.push(load);
  return lazy(async () => ({ default: await load() }));
}

export const BranchDecisionPage = page(
  async () => (await import("./decisions/BranchDecision.tsx")).BranchDecisionPage,
);
export const CheckPage = page(async () => (await import("./decisions/CheckPage.tsx")).CheckPage);
export const CommitPage = page(async () => (await import("./CommitPage.tsx")).CommitPage);
export const DecisionsPage = page(
  async () => (await import("./decisions/DecisionsPage.tsx")).DecisionsPage,
);
export const EditorPage = page(async () => (await import("./EditorPage.tsx")).EditorPage);
export const FeaturePage = page(
  async () => (await import("./feature/FeaturePage.tsx")).FeaturePage,
);
export const FilePage = page(async () => (await import("./FilePage.tsx")).FilePage);
export const InboxRoute = page(async () => (await import("./pane/DetailRoutes.tsx")).InboxRoute);
export const MockupPage = page(async () => (await import("./MockupPage.tsx")).MockupPage);
export const NewPage = page(async () => (await import("./NewPage.tsx")).NewPage);
export const PrioritiesRoute = page(
  async () => (await import("./pane/DetailRoutes.tsx")).PrioritiesRoute,
);
export const SessionPage = page(async () => (await import("./SessionPage.tsx")).SessionPage);
export const SessionsPage = page(
  async () => (await import("./shell/SessionsPage.tsx")).SessionsPage,
);
export const SettingsPage = page(
  async () => (await import("./settings/SettingsPage.tsx")).SettingsPage,
);
export const StoryPage = page(async () => (await import("./StoryPage.tsx")).StoryPage);
export const TriagePage = page(async () => (await import("./TriagePage.tsx")).TriagePage);

/** Fetches every page's chunk, resolving once all are loaded. */
export async function loadPages() {
  await Promise.all(loaders.map((load) => load()));
}

/**
 * Asks for every page's chunk: one that fails here is fetched again when its page is drawn, which
 * says why.
 */
function loadAll() {
  loadPages().catch(() => {});
}

/** Whether every page's chunk was asked for already. */
let preloaded = false;

/** Fetches every page's chunk, once, while the browser is idle. */
function preloadPages() {
  if (preloaded) {
    return;
  }
  preloaded = true;
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(loadAll);
  } else {
    setTimeout(loadAll, 1);
  }
}

/** Once a page has drawn, fetches every other page's chunk, idle. */
export function usePreloadPages() {
  useEffect(preloadPages, []);
}
