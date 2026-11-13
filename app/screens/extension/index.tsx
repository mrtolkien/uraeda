// The extensions' pages: an owner's place, `/e/<name>/<id>…`, a pane of its own in the main stack;
// the panes the extensions add to Home and to the New page, from the one list
// (`app/extensions/contributions.ts`); and, for a page whose extension is off in the repository,
// built in or the owner's, the pane that says so, with the way to turn it on, in place of the page's
// own (`offPlace`, which the frame asks before the page's place).
import { partKind } from "./kinds";
import { Off } from "./Off";
import {
  homePanesOf,
  isOn,
  newSectionsOf,
  ownerOfPage,
  placesOf,
  rowsIn,
} from "../../extensions/contributions";
import type { Route } from "../../store";
import { definePane, definePlace, type Place, type Placed, paneKey } from "../../ui/layout";

export { ExtensionKeys, declareExtensionKeys, keyProblem } from "./keys";

export const off = definePane<{ name: string; repo: string }>({
  icon: "plug",
  kind: "extension-off",
  stack: "main",
  title: "Off here",
  view: (props) => <Off name={props.args.name} repo={props.args.repo} />,
});

/** An owner's place: its first segment after the extension's name is the place's id. */
definePlace("extension", (route) => {
  const id = route.rest.split("/")[0] || route.name;
  if (route.repo === undefined) return [];
  const found = placesOf(route.repo).find(
    (one) => one.kind === "owner" && one.extension === route.name && one.id === id,
  );
  const named = found?.kind === "owner" ? found.icon : undefined;
  return [partKind(route.name, "place", id, "main", named)({ repo: route.repo })];
});

/** The extension a page belongs to: an owner's place's, or the built-in that holds the page. */
function ownerOf(route: Route): string | undefined {
  if (route.page === "extension") return route.name;
  return ownerOfPage(route.page)?.name;
}

/**
 * The page that says the route's extension is off in its repository, in place of the route's own:
 * none while it is on, or while the extensions are not read yet, or for an extension with no row,
 * whose place says it is gone.
 */
export function offPlace(route: Route): Place | undefined {
  const name = ownerOf(route);
  const repo = route.repo;
  if (name === undefined || repo === undefined) return undefined;
  const rows = rowsIn(repo);
  const known = rows?.some((row) => row.name === name) ?? false;
  if (!known || isOn(name, repo)) return undefined;
  return { main: [off({ name, repo })], side: [] };
}

/** A pane of a kind a screen declared, by its name, taking `{ repo }`. */
const paneOf = (kind: string, repo: string) => ({
  args: { repo },
  closes: false,
  key: paneKey(kind, { repo }),
  kind,
});

/** Home's panes of the extensions on in `repo`: column 0 in the main stack, 1 in the side one. */
export function homePanesIn(repo: string): ReadonlyArray<Placed> {
  return homePanesOf(repo).map((one) => {
    const stack = (one.pane.column ?? 1) === 0 ? "main" : "side";
    const pane =
      one.kind === "built-in"
        ? paneOf(one.pane.kind, repo)
        : partKind(one.extension, "homePane", one.pane.id, stack, one.pane.icon)({ repo });
    return { pane, stack };
  });
}

/** The New page's sections of the owner's extensions on in `repo`, in the side stack. */
export function newSectionsIn(repo: string): ReadonlyArray<Placed> {
  return newSectionsOf(repo).map((one) =>
    partKind(one.row.name, "newSection", one.id, "side", "plug")({ repo }),
  );
}
