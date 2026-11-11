// Where the run map's cursor stands, and where its keys take it. A row of the map is its track, the
// six steps with the joints between them, then its roles, the implementers, each reviewer, the
// reviewer to add, and where reviews happen. A change runs one step, its fix: its map is that step
// and its reviewers. In a row, `h` `l` go along it and `j` `k` between the track and the roles; in
// a column, every place is one list, which `j` `k` go along.
import type { RunOptions } from "../../store/protocol";
import { type Place, placeKey, reviewersOf, STEPS } from "./options";

/** A feature's map, or a change's start: its fix and its reviewers alone. */
export type MapKind = "feature" | "change";

/** The map's rows, in order: its track, then its roles. */
export function rowsOf(own: RunOptions, over: RunOptions | null, kind: MapKind): Place[][] {
  const reviewers = reviewersOf(own, over).map(
    (_, index) => ({ index, kind: "reviewer" }) as const,
  );
  if (kind === "change") {
    return [[{ kind: "step", step: "build" }], [...reviewers, { kind: "add" }]];
  }
  const track: Place[] = STEPS.flatMap((step, index) =>
    index === 0
      ? [{ kind: "step", step } as const]
      : [{ index, kind: "joint" } as const, { kind: "step", step } as const],
  );
  return [track, [{ kind: "implementers" }, ...reviewers, { kind: "add" }, { kind: "depth" }]];
}

/** The place a key names, else the first one. */
export function placeAt(rows: Place[][], key: string | null): Place {
  return rows.flat().find((place) => placeKey(place) === key) ?? rows[0]![0]!;
}

/** A move of the cursor. */
export type Move = "left" | "right" | "down" | "up";

/**
 * Where `move` takes the cursor from `key`: a place's key, or `undefined` at the map's edge, where
 * the key goes on to the page's.
 */
export function moved(
  rows: Place[][],
  key: string | null,
  move: Move,
  column: boolean,
): string | undefined {
  if (column) {
    const all = rows.flat().map(placeKey);
    const at = Math.max(0, all.indexOf(key ?? ""));
    const step = move === "down" ? 1 : move === "up" ? -1 : 0;
    return step === 0 ? undefined : all[at + step];
  }
  const row = Math.max(
    0,
    rows.findIndex((places) => places.some((place) => placeKey(place) === key)),
  );
  const places = rows[row]!;
  const at = Math.max(
    0,
    places.findIndex((place) => placeKey(place) === key),
  );
  switch (move) {
    case "left":
      return at === 0 ? undefined : placeKey(places[at - 1]!);
    case "right":
      return at === places.length - 1 ? undefined : placeKey(places[at + 1]!);
    case "down":
    case "up": {
      const to = rows[row + (move === "down" ? 1 : -1)];
      if (to === undefined) return undefined;
      // The place under, or over, the same share of the row: the build's implementers under it.
      const share = places.length === 1 ? 0 : at / (places.length - 1);
      return placeKey(to[Math.round(share * (to.length - 1))]!);
    }
  }
}
