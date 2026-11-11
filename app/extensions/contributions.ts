// The one list of what the extensions add to the app, built in and the owner's together, for a
// repository: the rail's places, the leader's keys, Home's panes, the New page's sections, the status
// line's items, the transcript's item renderers, and the settings' sections. The built-ins come
// first, in their order (`builtins/index.ts`), then the owner's, by name, as the record
// `Extensions` lists them. Only the extensions on in the repository are in it: turning one off takes
// all its parts away at once.
//
// A built-in's parts are its declaration's (`builtins/`); an owner's, what its page declared, kept on
// the device by the page's version (`declared.ts`): a page whose declarations are not known yet adds
// nothing until `ReadDeclarations` ran it once.
import { BUILT_INS, type BuiltIn, type BuiltInHomePane, type BuiltInPlace } from "./builtins";
import { declaredBy } from "./declared";
import type { Declarations, Key, StatusItem } from "./page";
import { connection, record } from "../store";
import type { ExtensionRow } from "../store/protocol";
import type { Route } from "../store/routes";

/** An extension's row, as far as where it is on goes. */
type OnRow = Pick<ExtensionRow, "name" | "on" | "onAll">;

/**
 * Whether `name` is on in `repo`, by its row: on everywhere, or there by name. A built-in that is no
 * extension, Sessions, is always on. Until the rows are read, the built-ins are on and the owner's
 * off, so none of the owner's flashes in a repository it is off in; an owner's without a row,
 * removed, is off.
 */
export function isOnIn(rows: ReadonlyArray<OnRow> | undefined, name: string, repo: string) {
  const builtIn = BUILT_INS.find((one) => one.name === name);
  if (builtIn?.always === true) return true;
  if (rows === undefined) return builtIn !== undefined;
  const row = rows.find((one) => one.name === name);
  return row !== undefined && (row.onAll || row.on.includes(repo));
}

/**
 * The rows of the extensions, read for `repo`: `undefined` until they come, and with no connection,
 * as the gallery's scenes draw a transcript.
 */
export const rowsIn = (repo: string) =>
  connection() === undefined ? undefined : record("Extensions", { repo })()?.extensions;

/** Whether the extension `name` is on in `repo`, read as a signal. */
export const isOn = (name: string, repo: string) => isOnIn(rowsIn(repo), name, repo);

/** An owner's extension whose page can be drawn: on in the repository, with a page built. */
export const paged = (rows: ReadonlyArray<ExtensionRow> | undefined, repo: string) =>
  (rows ?? []).filter(
    (row) => !row.isBuiltIn && row.pageVersion !== null && isOnIn(rows, row.name, repo),
  );

/** The parts of one extension on in the repository. */
export type Contribution =
  | { builtIn: BuiltIn; kind: "built-in"; name: string; title: string }
  | {
      declared: Declarations;
      kind: "owner";
      name: string;
      row: ExtensionRow;
      title: string;
    };

/** Every extension on in `repo`, with its parts: the built-ins first, in order, then the owner's. */
export function contributionsIn(repo: string): ReadonlyArray<Contribution> {
  const rows = rowsIn(repo);
  const builtIns = BUILT_INS.filter((one) => isOnIn(rows, one.name, repo)).map(
    (builtIn): Contribution => ({
      builtIn,
      kind: "built-in",
      name: builtIn.name,
      title: rows?.find((row) => row.name === builtIn.name)?.title ?? builtIn.title,
    }),
  );
  const owners = paged(rows, repo).flatMap((row): Contribution[] => {
    const declared = declaredBy(row.name, row.pageVersion);
    return declared === undefined
      ? []
      : [{ declared, kind: "owner", name: row.name, row, title: row.title || row.name }];
  });
  return [...builtIns, ...owners];
}

/** The built-in that owns a page of the app, if any: its places' pages, and the pages it names. */
export function ownerOfPage(page: Route["page"]): BuiltIn | undefined {
  return BUILT_INS.find(
    (one) => one.pages.includes(page) || one.places.some((place) => place.pages.includes(page)),
  );
}

/** A place of the one list, as the rail and the leader show it. */
export type PlaceOf =
  | { extension: string; kind: "built-in"; place: BuiltInPlace }
  | {
      count?: string;
      extension: string;
      icon: string;
      id: string;
      key?: string;
      kind: "owner";
      row: ExtensionRow;
      title: string;
    };

/** The places of the extensions on in `repo`, in the list's order. */
export function placesOf(repo: string): ReadonlyArray<PlaceOf> {
  return contributionsIn(repo).flatMap((one): PlaceOf[] =>
    one.kind === "built-in"
      ? one.builtIn.places.map((place) => ({ extension: one.name, kind: "built-in", place }))
      : one.declared.places.map((place) => ({
          ...place,
          extension: one.name,
          kind: "owner",
          row: one.row,
        })),
  );
}

/** A pane of Home from the list: a built-in's kind of pane, or an owner's part. */
export type HomePaneOf =
  | { extension: string; kind: "built-in"; pane: BuiltInHomePane }
  | {
      extension: string;
      kind: "owner";
      pane: Declarations["homePanes"][number];
      row: ExtensionRow;
    };

/** Home's panes of the extensions on in `repo`, in the list's order. */
export function homePanesOf(repo: string): ReadonlyArray<HomePaneOf> {
  return contributionsIn(repo).flatMap((one): HomePaneOf[] =>
    one.kind === "built-in"
      ? one.builtIn.homePanes.map((pane) => ({ extension: one.name, kind: "built-in", pane }))
      : one.declared.homePanes.map((pane) => ({
          extension: one.name,
          kind: "owner",
          pane,
          row: one.row,
        })),
  );
}

/** The parts of one kind that only an owner's page draws, each with its extension's row. */
type OwnerPart<K extends keyof Declarations> = Declarations[K][number] & { row: ExtensionRow };

function ownerParts<K extends "newSections" | "settingsSections" | "itemRenderers">(
  repo: string,
  kind: K,
): ReadonlyArray<OwnerPart<K>> {
  return contributionsIn(repo).flatMap((one) =>
    one.kind === "owner"
      ? (one.declared[kind] as ReadonlyArray<Declarations[K][number]>).map((part) =>
          Object.assign({}, part, { row: one.row }),
        )
      : [],
  );
}

/** The New page's sections of the owner's extensions on in `repo`. */
export const newSectionsOf = (repo: string) => ownerParts(repo, "newSections");

/** The settings' sections of the owner's extensions on in `repo`. */
export const settingsSectionsOf = (repo: string) => ownerParts(repo, "settingsSections");

/** What draws the items of the tool `tool` in `repo`: the first extension's that declared one. */
export const rendererOf = (repo: string, tool: string) =>
  ownerParts(repo, "itemRenderers").find((one) => one.tool === tool);

/** The status line's items of the extensions on in `repo`, each with its extension. */
export function statusItemsOf(
  repo: string,
): ReadonlyArray<{ item: Omit<StatusItem, "view">; row: ExtensionRow }> {
  return contributionsIn(repo).flatMap((one) =>
    one.kind === "owner" ? one.declared.statusItems.map((item) => ({ item, row: one.row })) : [],
  );
}

/** A key under the leader, as the registry spells it: "y" is "space y". */
export const leaderKeys = (keys: string) => (keys.startsWith("space ") ? keys : `space ${keys}`);

/** The leader's keys of one extension of the list, each run by the app or sent to the page. */
export type KeysOf = {
  extension: string;
  title: string;
  /** The built-ins' keys, which run in the app. */
  run: ReadonlyArray<Key>;
  /** An owner's keys, which its page runs. */
  sent: ReadonlyArray<Omit<Key, "run">>;
  row?: ExtensionRow;
};

/** The leader's keys of each extension on in `repo`, its places' keys aside. */
export function keysOf(repo: string): ReadonlyArray<KeysOf> {
  return contributionsIn(repo).map((one) =>
    one.kind === "built-in"
      ? { extension: one.name, run: one.builtIn.keys, sent: [], title: one.title }
      : { extension: one.name, row: one.row, run: [], sent: one.declared.keys, title: one.title },
  );
}
