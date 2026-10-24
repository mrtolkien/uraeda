// A decision's change as a ledger: its intent, then "Rules", each part not kept first and the kept
// ones folded under "N rules unchanged", then the other sections folded under "Why, alternatives,
// consequences", with their count of changed parts for a decision changed. With `full`, as on the
// decision's own page, every section shows, nothing folded, each part in the file's order, marked
// in place.
import { Heading } from "@astryxdesign/core/Heading";
import { VStack } from "@astryxdesign/core/VStack";
import { type ReactNode, useId } from "react";
import type { DecisionChange, PartChange, SectionChange } from "uraeda-binding";
import { type Context, foldKeyOf } from "./context.ts";
import { Fold, holdsAny, Part } from "./Rows.tsx";

/** What a ledger draws a decision's sections with: its context, but the section's own. */
export type LedgerContext = Omit<Context, "heading" | "intent">;

/** The other sections' fold's label, before its count. */
const OTHERS = "Why, alternatives, consequences";

/** "1 rule unchanged", "3 parts unchanged": the label of a section's kept parts. */
function keptLabel(count: number, rules: boolean) {
  const noun = rules ? "rule" : "part";
  return `${count} ${noun}${count === 1 ? "" : "s"} unchanged`;
}

/**
 * A section's rows: in the intent, or with `full`, every part in the file's order; elsewhere the
 * parts not kept first, then the kept ones, folded under their count unless the decision is
 * `whole`.
 */
function sectionRows(section: SectionChange, context: Context): ReactNode {
  const row = (part: PartChange, index: number) => (
    <Part context={context} key={index} part={part} />
  );
  // The intent, and every section on the decision's own page, keep the file's order.
  if (context.intent || context.full) {
    return section.parts.map(row);
  }
  const moved = section.parts.filter((part) => part.kind !== "kept");
  const kept = section.parts.filter((part) => part.kind === "kept");
  return (
    <>
      {moved.map(row)}
      {kept.length > 0 &&
        (context.whole ? (
          kept.map((part, index) => row(part, moved.length + index))
        ) : (
          <Fold
            foldKey={foldKeyOf(context, "kept")}
            held={holdsAny(context, context.heading, kept)}
            label={keptLabel(kept.length, section.title === "Rules")}
          >
            {kept.map(row)}
          </Fold>
        ))}
    </>
  );
}

/** A section: its heading, but the intent's, then its rows, as a group named by the heading. */
function Section({
  context,
  id,
  section,
}: {
  context: LedgerContext;
  id: string | undefined;
  section: SectionChange;
}) {
  const headingId = useId();
  const intent = section.title === "";
  const rows = sectionRows(section, {
    ...context,
    heading: section.title || context.title,
    intent,
  });
  if (intent) {
    return <VStack gap={1}>{rows}</VStack>;
  }
  return (
    <div aria-labelledby={headingId} role="group">
      <VStack gap={1}>
        <Heading id={id ?? headingId} level={4}>
          <span id={headingId}>{section.title}</span>
        </Heading>
        {rows}
      </VStack>
    </div>
  );
}

/** The count of parts not kept in `sections`. */
const changedIn = (sections: ReadonlyArray<SectionChange>) =>
  sections.reduce((sum, s) => sum + s.parts.filter((p) => p.kind !== "kept").length, 0);

/**
 * A decision's change as a ledger: its intent and its rules, then its other sections folded; with
 * `full`, every section in the file's order. A section's heading takes `sectionId`'s anchor.
 */
export function Ledger({
  change,
  context,
  sectionId,
}: {
  change: DecisionChange;
  context: LedgerContext;
  sectionId?: (title: string) => string | undefined;
}) {
  const section = (s: SectionChange) => (
    <Section context={context} id={sectionId?.(s.title)} key={s.title} section={s} />
  );
  if (context.full) {
    return change.sections.map(section);
  }
  const first = change.sections.filter((s) => s.title === "" || s.title === "Rules");
  const others = change.sections.filter((s) => s.title !== "" && s.title !== "Rules");
  const label = context.whole ? OTHERS : `${OTHERS} · ${changedIn(others)} changed`;
  return (
    <>
      {first.map(section)}
      {others.length > 0 && (
        <Fold
          foldKey={`decision:${context.name}:others`}
          held={others.some((s) => holdsAny(context, s.title, s.parts))}
          label={label}
        >
          {others.map(section)}
        </Fold>
      )}
    </>
  );
}
