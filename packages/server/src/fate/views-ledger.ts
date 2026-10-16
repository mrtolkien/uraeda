// The data view of the constitution and the decisions: one record, `ledger`, read from the
// default branch and kept live.
import { dataView } from "@nkzw/fate/server";
import type { Constitution, Decision, Ledger } from "uraeda-binding";

/** The fields a decision may lack, sent as null. */
type DecisionOptional = "approvedBy" | "changed" | "icon" | "problem" | "status" | "summary";

/** A decision, each field it lacks sent as null. */
export type DecisionRecord = Omit<Decision, DecisionOptional> & {
  [Key in DecisionOptional]: string | null;
};

/** The constitution, the version line's fields it lacks sent as null. */
export type ConstitutionRecord = Omit<Constitution, "amended" | "ratified" | "version"> & {
  amended: string | null;
  ratified: string | null;
  version: string | null;
};

export type LedgerRecord = {
  /** Null without `specs/CONSTITUTION.md`. */
  constitution: ConstitutionRecord | null;
  decisions: Array<DecisionRecord>;
  id: string;
  problems: Ledger["problems"];
};

export const LEDGER_ID = "ledger";

/**
 * The ledger as it is sent: every optional field, when absent, sent as null, so each has one
 * shape wherever the UI reads it, and the client's cache keeps no field an answer leaves out.
 */
export function sentLedger({ constitution, decisions, problems }: Ledger): LedgerRecord {
  return {
    constitution: constitution
      ? {
          ...constitution,
          amended: constitution.amended ?? null,
          ratified: constitution.ratified ?? null,
          version: constitution.version ?? null,
        }
      : null,
    decisions: decisions.map((decision) => ({
      ...decision,
      approvedBy: decision.approvedBy ?? null,
      changed: decision.changed ?? null,
      icon: decision.icon ?? null,
      problem: decision.problem ?? null,
      status: decision.status ?? null,
      summary: decision.summary ?? null,
    })),
    id: LEDGER_ID,
    problems,
  };
}

export const ledgerDataView = dataView<LedgerRecord>("Ledger")({
  constitution: true,
  decisions: true,
  id: true,
  problems: true,
});
