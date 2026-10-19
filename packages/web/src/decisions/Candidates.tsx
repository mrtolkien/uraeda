// The candidates of a decisions check's options: each option that edits a decision is drawn under
// its card as the spec page draws a changed decision, from the core's comparison with the active
// decision. A round with no candidates, a feature's or the triage's, draws none.
import { createContext, useContext } from "react";
import type { Candidate } from "uraeda-binding";
import { DecisionCard } from "../spec/DecisionCard.tsx";

/** The round's candidates, provided by `RoundPage`: none outside a decisions check. */
export const CandidatesContext = createContext<ReadonlyArray<Candidate>>([]);

/**
 * The cards of the candidates of an option, `letter` of question `id` (`Q1`, `A`), found by the
 * folder `q1-a` the core named them with, one per decision; nothing for an option with none.
 */
export function CandidateCard({ id, letter }: { id: string; letter: string }) {
  const question = id.toLowerCase();
  const option = letter.toLowerCase();
  const candidates = useContext(CandidatesContext);
  return candidates
    .filter((one) => one.question === question && one.option === option)
    .map(({ change }) => (
      <DecisionCard
        change={change}
        comments={[]}
        crumbs={[`Option ${letter}`]}
        href={undefined}
        id={`${question}-${option}-${change.name}`}
        key={change.name}
        kind={change.kind}
        name={change.name}
        parts={undefined}
        title={change.title}
      />
    ));
}
