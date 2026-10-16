// The decisions' order, chosen in the page and kept in the browser, and the date a row shows.
import { useState } from "react";
import type { Ledger } from "uraeda-server/fate";

/** A decision, as the ledger sends it. */
export type LedgerDecision = Ledger["decisions"][number];

/** How the decisions are ordered. */
export type DecisionSort = "changed-desc" | "changed-asc" | "title";

export const SORTS: Array<{ label: string; value: DecisionSort }> = [
  { label: "Latest change first", value: "changed-desc" },
  { label: "Latest change last", value: "changed-asc" },
  { label: "A to Z", value: "title" },
];

/** Where the page keeps its order. */
const SORT_KEY = "uraeda:decisions:sort";

const isSort = (value: string | null): value is DecisionSort =>
  SORTS.some((sort) => sort.value === value);

/** The decisions' order, the latest change first until another is chosen, kept in the browser. */
export function useDecisionSort(): [DecisionSort, (sort: DecisionSort) => void] {
  const [sort, setSort] = useState<DecisionSort>(() => {
    try {
      const stored = window.localStorage.getItem(SORT_KEY);
      return isSort(stored) ? stored : "changed-desc";
    } catch {
      // No storage, as in a private window: the latest change first.
      return "changed-desc";
    }
  });
  const choose = (next: DecisionSort) => {
    setSort(next);
    try {
      window.localStorage.setItem(SORT_KEY, next);
    } catch {
      // No storage: the choice lasts until the page closes.
    }
  };
  return [sort, choose];
}

const byTitle = (a: LedgerDecision, b: LedgerDecision) =>
  a.title.localeCompare(b.title, "en", { sensitivity: "base" });

/** The decisions in a sort's order; ties on a date, and decisions without one, go A to Z. */
export function sortDecisions(
  decisions: ReadonlyArray<LedgerDecision>,
  sort: DecisionSort,
): Array<LedgerDecision> {
  const sorted = [...decisions];
  if (sort === "title") {
    return sorted.sort(byTitle);
  }
  const way = sort === "changed-desc" ? -1 : 1;
  return sorted.sort(
    (a, b) => way * (a.changed ?? "").localeCompare(b.changed ?? "") || byTitle(a, b),
  );
}

const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** A `YYYY-MM-DD` date as "Oct 16". */
export function shortDate(date: string): string {
  return SHORT_DATE.format(new Date(`${date}T00:00:00Z`));
}
