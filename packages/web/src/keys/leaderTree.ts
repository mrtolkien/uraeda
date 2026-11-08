// The leader's tree as data: the bindings of Uraeda's own places, and of New and Find, as pure
// builders over the actions they run, so a test reads their icons and labels without a page. The
// places come from `destinations.ts`, which the navigation column and the phone's tabs read too, so
// a place is drawn the same everywhere (UI components): a place's icon and label are never written
// here. The extensions' places and keys, the built-ins' among them, the inbox's, the priorities',
// the decisions', and Git's, come from the registry (`useExtensionKeys`).
import { NEW_FEATURE_HREF } from "uraeda-server/hrefs";
import { DESTINATIONS, type Destination } from "../destinations.ts";
import { KIND_ICONS } from "./kinds.ts";
import type { PickerKind } from "./pickerSources.ts";
import type { Binding } from "./store.ts";

/** The key of each of Uraeda's own places, after `Space` or `g`: Sessions is a built-in's. */
const PLACES: ReadonlyArray<readonly [key: string, place: Destination]> = [
  ["h", DESTINATIONS.home],
  [",", DESTINATIONS.settings],
];

/** The places' keys after `prefix`, "space" for the leader menu's and "g" for the go keys. */
export function placeBindings(prefix: string, go: (path: string) => void): Array<Binding> {
  return PLACES.map(([key, place]) => ({
    icon: place.icon,
    keys: `${prefix} ${key}`,
    label: place.label,
    run: () => go(place.path),
  }));
}

/**
 * `g n`: the New page, as the go keys' one more place. Not one of `PLACES`: `Space n` is the New
 * keys' group, so only the go keys can take `n` for the page.
 */
export function goNewBinding(go: (path: string) => void): Binding {
  return {
    icon: DESTINATIONS.new.icon,
    keys: "g n",
    label: DESTINATIONS.new.label,
    run: () => go(DESTINATIONS.new.path),
  };
}

/**
 * The kinds `Space f` finds that are no extension's, by their key, as the picker's sources name
 * them: the built-ins add notes (`n`), priorities (`p`), and decisions (`d`).
 */
const FIND: ReadonlyArray<readonly [key: string, kind: PickerKind, label: string]> = [
  ["f", "features", "Features"],
  ["c", "changes", "Changes"],
  ["s", "sessions", "Sessions"],
];

/** `Space Space`, find anything, and `Space f` with a key per kind. */
export function findBindings(open: (kind: PickerKind | "all") => void): Array<Binding> {
  return [
    { icon: "search", keys: "space space", label: "Find anything…", run: () => open("all") },
    ...FIND.map(([key, kind, label]) => ({
      icon: KIND_ICONS[kind],
      keys: `space f ${key}`,
      label,
      run: () => open(kind),
    })),
  ];
}

/**
 * `Space n`: a session, a change, and a feature, the pages the New page's cards lead to. The
 * built-ins add a note (`n`) and a proposal (`p`), the forms of the column's buttons.
 */
export function newBindings(go: (path: string) => void): Array<Binding> {
  return [
    {
      icon: KIND_ICONS.sessions,
      keys: "space n s",
      label: "Session",
      run: () => go("/new"),
    },
    {
      icon: KIND_ICONS.changes,
      keys: "space n c",
      label: "Change",
      run: () => go("/new?kind=change"),
    },
    {
      icon: KIND_ICONS.features,
      keys: "space n f",
      label: "Feature",
      run: () => go(NEW_FEATURE_HREF),
    },
  ];
}
