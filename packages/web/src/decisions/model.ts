// TEMPORARY: the shapes the decisions page draws, as plain props, until the core reads the
// constitution and the decisions and the server serves them through fate.

/** One of the constitution's principles. */
export type Principle = {
  /** Its Roman numeral, "IV". */
  numeral: string;
  rationale: string;
  rules: Array<string>;
  title: string;
};

/** The constitution: its principles by priority, and its version line. */
export type Constitution = {
  principles: Array<Principle>;
  /** "Version 1.3.1 · Ratified 2026-10-07 · Last amended 2026-10-14". */
  version: string;
};

/** A decision as the list shows it. */
export type DecisionSummary = {
  approvedBy: string;
  /** Its last change in git, `YYYY-MM-DD`. */
  changed: string;
  slug: string;
  status: string;
  /** The first sentence of its summary. */
  subtitle: string;
  /** Its first H1 heading. */
  title: string;
};

/** A section of an open decision: Rules, Why, Alternatives considered, Consequences, Applies to. */
export type DecisionSection = {
  bullets?: Array<string>;
  heading: string;
  paragraphs?: Array<string>;
};

/** An open decision's content, past its title. */
export type DecisionDocument = {
  sections: Array<DecisionSection>;
  summary: string;
};

/** How the decisions are ordered. */
export type DecisionSort = "latest-first" | "latest-last" | "a-z";

export const SORTS: Array<{ label: string; value: DecisionSort }> = [
  { label: "Latest change first", value: "latest-first" },
  { label: "Latest change last", value: "latest-last" },
  { label: "A to Z", value: "a-z" },
];

/** What is open in the pane: a principle by its numeral, or a decision by its slug. */
export type Selection = { kind: "principle"; numeral: string } | { kind: "decision"; slug: string };

/** One key per item of the page, for its selection and its focus. */
export function selectionKey(selection: Selection): string {
  return selection.kind === "principle"
    ? `principle:${selection.numeral}`
    : `decision:${selection.slug}`;
}

const byTitle = (a: DecisionSummary, b: DecisionSummary) =>
  a.title.localeCompare(b.title, "en", { sensitivity: "base" });

/** The decisions in a sort's order; ties on a date go A to Z. */
export function sortDecisions(
  decisions: Array<DecisionSummary>,
  sort: DecisionSort,
): Array<DecisionSummary> {
  const sorted = [...decisions];
  if (sort === "a-z") {
    return sorted.sort(byTitle);
  }
  const way = sort === "latest-first" ? -1 : 1;
  return sorted.sort((a, b) => way * a.changed.localeCompare(b.changed) || byTitle(a, b));
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

const STATUSES: Record<string, string> = {
  active: "Active",
  proposed: "Proposed",
  superseded: "Superseded",
};

/** A decision's status, as words. */
export function statusLabel(status: string): string {
  return STATUSES[status] ?? status;
}
