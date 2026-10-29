// The palette's entries and their ranking: the constitution's principles, then the decisions, each
// found by its name or its first sentence, the best match first, so a few letters and Enter open
// any of them (SC-005 of the layout look).
import type { Ledger } from "uraeda-server/fate";
import { type LedgerPrinciple, rulesOf } from "./ConstitutionRegion.tsx";
import { DESTINATIONS } from "../destinations.ts";
import type { PickerItem } from "../keys/pickerSources.ts";
import type { LedgerDecision } from "./model.ts";
import { decisionIcon } from "../theme/icons.ts";
import { plain } from "../Spans.tsx";

/** An entry of the palette: a principle or a decision, at its address in the repository. */
export type JumpEntry =
  | {
      kind: "principle";
      /** `/decisions/constitution/<slug>`. */
      path: string;
      /** Its heading and its rules as plain lines: the constitution's file text is not served. */
      preview: string;
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
      /** Its file as written, the frontmatter too. */
      preview: string;
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
    const rules = constitution ? rulesOf(constitution, principle) : [];
    const first = rules[0];
    return {
      kind: "principle",
      path: "/decisions/constitution",
      preview: [
        `### ${principle.number}. ${principle.title}`,
        "",
        ...rules.map((rule) => `- ${plain(rule.spans)}`),
      ].join("\n"),
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
      preview: decision.text,
      summary: decision.summary,
      title: decision.title,
    })),
  ];
}

/** What a query is ranked against: a title, a numeral some have, and a first sentence. */
export type Searchable = { numeral?: string; summary: string | null; title: string };

/**
 * How well an item matches a query, lower first, or undefined when it does not: a principle's
 * numeral or its whole title, the title's start, a word's start in it, anywhere in it, then in its
 * first sentence.
 */
function rank({ numeral, summary, title: name }: Searchable, query: string): number | undefined {
  const title = name.toLowerCase();
  if (numeral?.toLowerCase() === query || title === query) {
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
  return summary?.toLowerCase().includes(query) ? 4 : undefined;
}

/** The items a query matches, the best first, ties in the list's order; all of them for none. */
export function searchRanked<T>(
  items: ReadonlyArray<T>,
  query: string,
  read: (item: T) => Searchable,
): Array<T> {
  const wanted = query.trim().toLowerCase();
  if (wanted === "") {
    return [...items];
  }
  return items
    .map((item, index) => ({ index, item, rank: rank(read(item), wanted) }))
    .filter((found): found is typeof found & { rank: number } => found.rank !== undefined)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((found) => found.item);
}

const searchable = (entry: JumpEntry): Searchable => ({
  numeral: entry.kind === "principle" ? entry.principle.number : undefined,
  summary: entry.summary,
  title: entry.title,
});

/** The entries a query matches, the best first, ties in the list's order; all of them for none. */
export function searchEntries(entries: ReadonlyArray<JumpEntry>, query: string): Array<JumpEntry> {
  return searchRanked(entries, query, searchable);
}

/**
 * An entry as the key picker holds it: a principle by its numeral, a decision by its icon. Its id is
 * its own: every principle opens the constitution's one address, so the address is no id.
 */
export function pickerItemOf(entry: JumpEntry): PickerItem {
  return {
    icon:
      entry.kind === "principle" ? DESTINATIONS.decisions.icon : decisionIcon(entry.decision.icon),
    id: entry.kind === "principle" ? `${entry.path}#${entry.principle.number}` : entry.path,
    kind: "decisions",
    mark: entry.kind === "principle" ? entry.principle.number : undefined,
    path: entry.path,
    preview: entry.preview,
    summary: entry.summary,
    title: entry.title,
  };
}
