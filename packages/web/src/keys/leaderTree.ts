// The leader's tree as data: the bindings of the places, of New and Find, as pure builders over
// the actions they run, so a test reads their icons and labels without a page. The places come
// from `destinations.ts`, which the navigation column and the phone's tabs read too, so a place is
// drawn the same everywhere (UI coherence): a place's icon and label are never written here.
import { DESTINATIONS, type Destination } from "../destinations.ts";
import { KIND_ICONS } from "./kinds.ts";
import type { PickerKind } from "./pickerSources.ts";
import type { Binding } from "./store.ts";
import { NEW_PROPOSAL_HASH } from "../lists/PrioritiesList.tsx";

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
 * `g c`: the commit page, as the go keys' one more place. Not one of `PLACES`: `Space c` is
 * Continue's, so only the go keys can take `c` for the page.
 */
export function goCommitBinding(go: (path: string) => void): Binding {
  return {
    icon: DESTINATIONS.commit.icon,
    keys: "g c",
    label: DESTINATIONS.commit.label,
    run: () => go(DESTINATIONS.commit.path),
  };
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

/** The forms a New key opens: the inbox's note and the priorities' proposal. */
export type AddForm = "note" | "proposal";

/**
 * `Space n`: a session, a change, a feature (the pages the New page's cards lead to), a note, and
 * a proposal (the forms of the column's buttons).
 */
export function newBindings(
  go: (path: string) => void,
  openForm: (form: AddForm) => void,
): Array<Binding> {
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
      run: () => go("/new?kind=feature"),
    },
    {
      icon: KIND_ICONS.notes,
      keys: "space n n",
      label: "Note (inbox entry)",
      run: () => openForm("note"),
    },
    {
      icon: KIND_ICONS.priorities,
      keys: "space n p",
      label: "Proposal",
      // A new row at the top of Now, as New's Proposal opens it.
      run: () => go(`/priorities${NEW_PROPOSAL_HASH}`),
    },
  ];
}
