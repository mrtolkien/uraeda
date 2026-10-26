// The leader's tree as data: the bindings of the places, of New and Find, as pure builders over
// the actions they run, so a test reads their icons and labels without a page. The places come
// from `destinations.ts`, which the navigation column and the phone's tabs read too, so a place is
// drawn the same everywhere (UI coherence): a place's icon and label are never written here.
import { DESTINATIONS, type Destination } from "../destinations.ts";
import { KIND_ICONS } from "./kinds.ts";
import type { PickerKind } from "./pickerSources.ts";
import type { Binding } from "./store.ts";

/** The key of each place, after `Space` or `g`. */
const PLACES: ReadonlyArray<readonly [key: string, place: Destination]> = [
  ["h", DESTINATIONS.home],
  ["i", DESTINATIONS.inbox],
  ["p", DESTINATIONS.priorities],
  ["d", DESTINATIONS.decisions],
  ["s", DESTINATIONS.sessions],
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

/** The kinds `Space f` finds, by their key, as the picker's sources name them. */
const FIND: ReadonlyArray<readonly [key: string, kind: PickerKind, label: string]> = [
  ["f", "features", "Features"],
  ["c", "changes", "Changes"],
  ["s", "sessions", "Sessions"],
  ["d", "decisions", "Decisions"],
  ["n", "notes", "Notes"],
  ["p", "priorities", "Priorities"],
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

/** The forms a New key opens: the inbox's note and the priorities' line. */
export type AddForm = "note" | "priority";

/**
 * `Space n`: a session, a change, a feature (the pages the New page's cards lead to), a note, and
 * a priority (the forms of the column's buttons).
 */
export function newBindings(
  go: (path: string) => void,
  openForm: (form: AddForm) => void,
): Array<Binding> {
  return [
    {
      icon: DESTINATIONS.sessions.icon,
      keys: "space n s",
      label: "Session",
      run: () => go("/new"),
    },
    {
      icon: "uraeda:git-compare",
      keys: "space n c",
      label: "Change",
      run: () => go("/new?kind=change"),
    },
    {
      icon: "uraeda:step-spec",
      keys: "space n f",
      label: "Feature",
      run: () => go("/new?kind=feature"),
    },
    {
      icon: "uraeda:pencil",
      keys: "space n n",
      label: "Note (inbox entry)",
      run: () => openForm("note"),
    },
    {
      icon: DESTINATIONS.priorities.icon,
      keys: "space n p",
      label: "Priority",
      run: () => openForm("priority"),
    },
  ];
}
