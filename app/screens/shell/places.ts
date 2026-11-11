// The app's places, as the rail, the phone's bar, and the leader's tree show them: the shell's own,
// Home first and New and Settings last, which are no extensions, and between them the places of the
// extensions on in the repository shown, built in and the owner's, from the one list
// (`app/extensions/contributions.ts`). Turning an extension off takes its place and its keys away.
// `g <key>` goes to a built-in's place, and so does `Space <key>`, but for New, whose `Space n` is
// the New group of the leader's menu; an owner's place has its `Space` key alone. On the phone's
// bar, the places visited most are one tap away, the others wait in its `…`, and New ends it.
import { BUILT_INS } from "../../extensions/builtins";
import { type PlaceOf, placesOf } from "../../extensions/contributions";
import { record, type Route } from "../../store";
import { type IconName, iconNamed } from "../../ui/controls";

export type Place = {
  icon: IconName;
  /** The keys that go there, the rail's first: `g i`, then `space i`. */
  keys: ReadonlyArray<string>;
  label: string;
  /** Whether the route shown is one of its pages: the rail lights it then. */
  holds: (route: Route) => boolean;
  /** Where a press goes, in the repository shown. */
  to: Route;
  /** What waits there, after its label. */
  count?: () => number | undefined;
  /** Where the phone's bar puts it (`RailPlace`): the bar, the `…`'s menu, or after the `…`. */
  onPhone?: "more" | "end";
};

/** A place of the shell, by the pages it holds. */
function shellPlace(
  place: Omit<Place, "holds" | "keys"> & { key: string; goOnly?: boolean },
  pages: ReadonlyArray<Route["page"]>,
): Place {
  const { goOnly, key, ...rest } = place;
  return {
    ...rest,
    holds: (route) => pages.includes(route.page),
    keys: goOnly === true ? [`g ${key}`] : [`g ${key}`, `space ${key}`],
  };
}

const HOME = shellPlace({ icon: "house", key: "h", label: "Home", to: { page: "home" } }, ["home"]);
const NEW = shellPlace(
  { goOnly: true, icon: "plus", key: "n", label: "New", onPhone: "end", to: { page: "new" } },
  ["new"],
);
const SETTINGS = shellPlace(
  { icon: "settings", key: ",", label: "Settings", onPhone: "more", to: { page: "settings" } },
  ["settings"],
);

/** The count an owner's place names, a record of its extension whose value is a number. */
function countOf(repo: string, extension: string, name: string) {
  const value = record("ExtensionRecord", { extension, name, repo })()?.value;
  return typeof value === "number" ? value : undefined;
}

/** A place of the list, as the rail shows it. */
function shown(repo: string, one: PlaceOf): Place {
  if (one.kind === "built-in") {
    const { count, pages, ...place } = one.place;
    return {
      count: count && (() => count(repo)),
      holds: (route) => pages.includes(route.page),
      icon: place.icon,
      keys: [`g ${place.key}`, `space ${place.key}`],
      label: place.title,
      onPhone: place.onPhone,
      to: place.to,
    };
  }
  const named = one.count;
  return {
    count: named === undefined ? undefined : () => countOf(repo, one.extension, named),
    holds: (route) =>
      route.page === "extension" &&
      route.name === one.extension &&
      route.rest.split("/")[0] === one.id,
    icon: iconNamed(one.icon, "plug"),
    keys: one.key === undefined ? [] : [`space ${one.key}`],
    label: one.title,
    onPhone: "more",
    to: { name: one.extension, page: "extension", rest: one.id },
  };
}

/** The places of `repo`, in the rail's order: Home, the extensions' places, New, and Settings. */
export function placesIn(repo: string | undefined): ReadonlyArray<Place> {
  const extensions = repo === undefined ? [] : placesOf(repo).map((one) => shown(repo, one));
  return [HOME, ...extensions, NEW, SETTINGS];
}

/** Every place a page can belong to, whether its extension is on or not: the shell's, the built-ins'. */
const KNOWN: ReadonlyArray<{ label: string; pages: ReadonlyArray<Route["page"]> }> = [
  { label: "Home", pages: ["home"] },
  ...BUILT_INS.flatMap((one) => one.places.map(({ pages, title }) => ({ label: title, pages }))),
  { label: "New", pages: ["new"] },
  { label: "Settings", pages: ["settings"] },
];

/** The name of the place a page belongs to, if any. */
export const placeOfPage = (page: Route["page"]): string | undefined =>
  KNOWN.find((place) => place.pages.includes(page))?.label;
