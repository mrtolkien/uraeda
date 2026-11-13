// The browser's history as the app's (`HistoryAdapter`): each visit is an entry of the tab's
// history, with the visit as its state and the page's address as its address. So the address bar
// names the page shown, a pasted address opens it, Back and Forward move between the app's
// visits, and a reload finds its visit as it was left: its panes' layout, what each pane
// remembers, and where each scroller came to rest, which the browser keeps with the entry.
//
// Native Shell's own entries are off (`web.history: false` in `nsh.json`): its stack and dialogs
// kept entries of their own, which moved the address under the app's.
import { type Entry, entryAt, type HistoryAdapter } from "./history";
import { pathOf } from "./routes";

/** What the adapter needs of the browser's page: its window, the tab's history in it. */
export type BrowserPage = {
  addEventListener(type: "popstate", listener: (event: { state: unknown }) => void): void;
  addEventListener(type: "mouseup", listener: (event: { button: number }) => void): void;
  history: {
    back(): void;
    forward(): void;
    pushState(state: unknown, unused: string, url: string): void;
    replaceState(state: unknown, unused: string, url: string): void;
    readonly state: unknown;
  };
  location: { readonly hash: string; readonly pathname: string; readonly search: string };
};

/** The state of an entry of the app's, under its own key beside whatever else the page keeps. */
type State = { uraeda: Entry };

/** The visit an entry's state holds, when it holds one. */
function visitOf(state: unknown): Entry | undefined {
  if (typeof state !== "object" || state === null || !("uraeda" in state)) return undefined;
  const visit = (state as State).uraeda;
  return typeof visit === "object" && visit !== null && "route" in visit ? visit : undefined;
}

/** The page's address within the app: its path, its query, and its hash. */
const addressOf = (page: BrowserPage) =>
  `${page.location.pathname}${page.location.search}${page.location.hash}`;

/**
 * The tab's history of `page` as the app's. The visit it starts on is the entry's own, as a
 * reload or a Back from another site finds it, or a first visit of the page's address.
 */
export function browserHistory(page: BrowserPage): HistoryAdapter {
  const write = (how: "pushState" | "replaceState", visit: Entry) =>
    page.history[how]({ uraeda: visit } satisfies State, "", pathOf(visit.route));
  return {
    back: () => page.history.back(),
    listen(arrive) {
      page.addEventListener("popstate", (event) => {
        // An entry without a visit is an address typed after a `#`: its first visit.
        const visit = visitOf(event.state) ?? entryAt(addressOf(page));
        if (visitOf(event.state) === undefined) write("replaceState", visit);
        arrive(visit);
      });
      // The mouse's own Back and Forward, which Native Shell keeps from the browser without its
      // entries: they move as the browser's buttons do.
      page.addEventListener("mouseup", (event) => {
        if (event.button === 3) page.history.back();
        if (event.button === 4) page.history.forward();
      });
    },
    push: (visit) => write("pushState", visit),
    replace: (visit) => write("replaceState", visit),
    start: () => visitOf(page.history.state) ?? entryAt(addressOf(page)),
  };
}
