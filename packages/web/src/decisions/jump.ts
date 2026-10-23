// The palette's entries and their ranking: the constitution's principles, then the decisions, each
// found by its name or its first sentence, the best match first, so a few letters and Enter open
// any of them (SC-005 of the layout look).
import type { Ledger } from "uraeda-server/fate";
import { type LedgerPrinciple, rulesOf } from "./ConstitutionRegion.tsx";
import type { LedgerDecision } from "./model.ts";
import { plain } from "../Spans.tsx";

/** An entry of the palette: a principle or a decision, at its address in the repository. */
export type JumpEntry =
  | {
      kind: "principle";
      /** `/decisions/constitution/<slug>`. */
      path: string;
      principle: LedgerPrinciple;
      /** Its first rule, which its row in the list shows. */
      summary: string | null;
      title: string;
    }
  | {
      decision: LedgerDecision;
      kind: "decision";
      /** `/decisions/<name>`. */
      path: string;
      /** Its intent's first sentence. */
      summary: string | null;
      title: string;
    };

/** The ledger, as the palette reads it. */
type LedgerData = Pick<Ledger, "constitution">;

/** The entries in the list's order: the principles, highest first, then the decisions as sorted. */
export function jumpEntries(
  ledger: LedgerData,
  decisions: ReadonlyArray<LedgerDecision>,
): Array<JumpEntry> {
  const { constitution } = ledger;
  const principles: Array<JumpEntry> = (constitution?.principles ?? []).map((principle) => {
    const first = constitution && rulesOf(constitution, principle)[0];
    return {
      kind: "principle",
      path: `/decisions/constitution/${principle.slug}`,
      principle,
      summary: first ? plain(first.spans) : null,
      title: principle.title,
    };
  });
  return [
    ...principles,
    ...decisions.map((decision): JumpEntry => ({
      decision,
      kind: "decision",
      path: `/decisions/${decision.name}`,
      summary: decision.summary,
      title: decision.title,
    })),
  ];
}

/**
 * How well an entry matches a query, lower first, or undefined when it does not: a principle's
 * numeral or its whole title, the title's start, a word's start in it, anywhere in it, then in its first sentence.
 */
function rank(entry: JumpEntry, query: string): number | undefined {
  const title = entry.title.toLowerCase();
  const numeral = entry.kind === "principle" && entry.principle.number.toLowerCase() === query;
  if (numeral || title === query) {
    return 0;
  }
  if (title.startsWith(query)) {
    return 1;
  }
  if (title.split(/[\s-]+/).some((word) => word.startsWith(query))) {
    return 2;
  }
  if (title.includes(query)) {
    return 3;
  }
  return entry.summary?.toLowerCase().includes(query) ? 4 : undefined;
}

/** The entries a query matches, the best first, ties in the list's order; all of them for none. */
export function searchEntries(entries: ReadonlyArray<JumpEntry>, query: string): Array<JumpEntry> {
  const wanted = query.trim().toLowerCase();
  if (wanted === "") {
    return [...entries];
  }
  return entries
    .map((entry, index) => ({ entry, index, rank: rank(entry, wanted) }))
    .filter((found): found is typeof found & { rank: number } => found.rank !== undefined)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((found) => found.entry);
}
