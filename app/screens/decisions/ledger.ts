// What the decisions' panes share: the ledger read for a repository, the list's order, kept per
// device, the words a decision's dates are said in, and the route each item opens.
// Nothing here parses a file: the server sends the ledger as the core read it.
import { device, record, type Route, serverDay } from "../../store";
import type { Decision, DecisionChange, Ledger, PartChange } from "../../store/protocol";
import type { Tone } from "../../ui/tokens";
import { plural } from "../../ui/words";

/** How the decisions are ordered, kept on the device. */
export type DecisionSort = "changed-desc" | "changed-asc" | "title";

export const SORTS: ReadonlyArray<{ label: string; value: DecisionSort }> = [
  { label: "Latest change first", value: "changed-desc" },
  { label: "Latest change last", value: "changed-asc" },
  { label: "A to Z", value: "title" },
];

/** The order chosen on this device: the latest change first until another is chosen. */
export const sortChosen = (): DecisionSort => device.get("decisions.sort") ?? "changed-desc";

export const chooseSort = (sort: DecisionSort) => device.set("decisions.sort", sort);

const byTitle = (a: Decision, b: Decision) =>
  a.title.toLowerCase().localeCompare(b.title.toLowerCase());

/** The decisions in a sort's order; ties on a date, and decisions without one, go A to Z. */
export function sorted(decisions: ReadonlyArray<Decision>, sort: DecisionSort): Array<Decision> {
  if (sort === "title") {
    return decisions.toSorted(byTitle);
  }
  const way = sort === "changed-desc" ? -1 : 1;
  return decisions.toSorted(
    (a, b) => way * (a.changed ?? "").localeCompare(b.changed ?? "") || byTitle(a, b),
  );
}

/** The ledger of a repository: `undefined` while it is read. */
export const ledgerOf = (repo: string) => record("Ledger", { repo });

/** A decision of the default branch, by its file's name: `null` when there is none. */
export function decisionIn(ledger: Ledger | undefined, name: string): Decision | null | undefined {
  return ledger === undefined
    ? undefined
    : (ledger.decisions.find((one) => one.name === name) ?? null);
}

/** A `YYYY-MM-DD` date as "16 Oct", or "16 Oct 2025" in another year than the server's today. */
export const shortDate = (date: string, today: number = Date.now()): string =>
  serverDay(date, today);

/** "1 rule", "3 rules". */
export const ruleCount = (count: number) => plural(count, "rule");

/** What is said of a decision that cannot be read, with its cause: nothing of one that can. */
export function unreadableWords(
  decision: Decision,
): { label: string; tone: Tone; why: string } | undefined {
  return decision.unreadable
    ? { label: "Unreadable", tone: "danger", why: "its frontmatter is not valid YAML." }
    : undefined;
}

/** What a branch does to a decision, in words: "Adds it", "Changes it", "Removes it". */
export function changeWords(change: DecisionChange): string {
  switch (change.kind) {
    case "new":
      return "Adds it";
    case "removed":
      return "Removes it";
    default:
      return "Changes it";
  }
}

/** Every part of a change, its sections' together. */
const partsOf = (change: DecisionChange): Array<PartChange> =>
  change.sections.flatMap((section) => section.parts);

/** Whether a branch's decision differs from the merge base's: one it leaves alone does not. */
export function isChanged(change: DecisionChange): boolean {
  return (
    change.kind !== "changed" ||
    !change.compared ||
    change.fields.length > 0 ||
    partsOf(change).some((part) => part.kind !== "kept")
  );
}

/** What a change does, counted: "2 parts added · 1 changed", the fields named; none when nothing. */
export function changeCounts(change: DecisionChange): Array<string> {
  const parts = partsOf(change);
  const count = (kind: string) => parts.filter((part) => part.kind === kind).length;
  const counted = [
    ["added", count("added")],
    ["changed", count("changed")],
    ["removed", count("removed")],
  ] as const;
  const words = counted.filter(([, n]) => n > 0).map(([kind, n]) => `${plural(n, "part")} ${kind}`);
  const fields = change.fields.map(
    (field) => `${field.name}: ${field.before ?? "none"} → ${field.after ?? "none"}`,
  );
  return [...words, ...fields];
}

/** The ids of the list's rows: the constitution, then the decisions. */
export const CONSTITUTION = "constitution";
export const decisionId = (name: string) => `d:${name}`;

/** The row the page shown is about: the list's cursor sits there. */
export function rowOf(route: Route): string | undefined {
  switch (route.page) {
    case "decisions":
    case "constitution":
      return CONSTITUTION;
    case "decision":
    case "branch-decision":
      return decisionId(route.name);
    default:
      return undefined;
  }
}

/** The page a row opens. */
export function routeOf(row: string): Route {
  if (row === CONSTITUTION) {
    return { page: "constitution" };
  }
  return { name: row.slice(2), page: "decision" };
}
