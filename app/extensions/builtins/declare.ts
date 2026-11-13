// What a built-in extension declares: the same parts as an owner's page (`../page.tsx`), `place`,
// `homePane`, `key`, `statusItem`, as data the app reads directly, since a built-in's screen is the
// app's own code (ruling R7). Only what draws a part differs: a place names the app's pages and
// where a press goes, and a home pane the kind of pane its screen declared, where an owner's part
// gives its page's `view`. The one list of every extension's parts is `../contributions.ts`.
import type { Route } from "../../store/routes";
import type { IconName } from "../../ui/controls";
import type { HomePane, Key, Place, StatusItem } from "../page";

/** A built-in's place: an owner's, with the app's pages it holds and where a press goes. */
export type BuiltInPlace = Omit<Place, "view" | "count" | "icon"> & {
  icon: IconName;
  /** The key after `g`, and after `Space` too. */
  key: string;
  /** The pages it holds: the rail lights it while one of them shows. */
  pages: ReadonlyArray<Route["page"]>;
  /** Where a press goes, in the repository shown. */
  to: Route;
  /** Where the phone's bar puts it: on the bar unless given, or in the `…`'s menu. */
  onPhone?: "more";
  /** What waits there, after its title. */
  count?: (repo: string) => number | undefined;
};

/** A built-in's pane of Home: an owner's, drawn by the kind of pane its screen declared. */
export type BuiltInHomePane = Omit<HomePane, "view" | "column"> & {
  column: 0 | 1;
  /** The kind of pane, taking `{ repo }`: `home-inbox`. */
  kind: string;
};

/** A built-in extension: its name, as the record `Extensions` has its row, and its parts. */
export type BuiltIn = {
  name: string;
  title: string;
  /** No extension: on everywhere, with no row and no switch, as Sessions. */
  always?: boolean;
  places: ReadonlyArray<BuiltInPlace>;
  homePanes: ReadonlyArray<BuiltInHomePane>;
  keys: ReadonlyArray<Key>;
  statusItems: ReadonlyArray<StatusItem>;
  /**
   * The pages it owns besides its places' pages, as the previews' story and mockup: while it is off
   * in a repository, each answers that it is off, with the way to turn it on.
   */
  pages: ReadonlyArray<Route["page"]>;
};

/** A built-in's declaration, the parts it does not give left empty. */
export function builtIn(
  declared: Pick<BuiltIn, "name" | "title"> & Partial<Omit<BuiltIn, "name" | "title">>,
): BuiltIn {
  return { homePanes: [], keys: [], pages: [], places: [], statusItems: [], ...declared };
}
