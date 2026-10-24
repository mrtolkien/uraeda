// A decision's sections, as its ledger draws them: each section's parts, unchanged ones folded behind
// their count and removed ones behind theirs, and which sections a card shows.
import { Badge } from "@astryxdesign/core/Badge";
import { Heading } from "@astryxdesign/core/Heading";
import { VStack } from "@astryxdesign/core/VStack";
import { type ReactNode, useId } from "react";
import type { DecisionChange, PartChange, SectionChange } from "uraeda-binding";
import { type Context, foldKeyOf } from "./context.ts";
import { Fold, Part } from "./Rows.tsx";

/**
 * A section's parts in order: a run of unchanged ones folded behind "N unchanged", but in the
 * intent, which shows whole; the removed ones last, behind "N removed".
 */
function sectionRows(section: SectionChange, context: Context) {
  const rows: Array<ReactNode> = [];
  let kept: Array<PartChange> = [];
  const flush = () => {
    if (kept.length > 0) {
      const label = `${kept.length} unchanged`;
      const key = `kept-${rows.length}`;
      rows.push(
        <Fold
          context={context}
          foldKey={foldKeyOf(context, key)}
          key={key}
          label={label}
          parts={kept}
        />,
      );
    }
    kept = [];
  };
  section.parts.forEach((part, index) => {
    if (context.whole || (part.kind === "kept" && (context.full || context.intent))) {
      rows.push(<Part context={context} key={index} part={part} />);
    } else if (part.kind === "kept") {
      kept.push(part);
    } else if (part.kind !== "removed") {
      flush();
      rows.push(<Part context={context} key={index} part={part} />);
    }
  });
  flush();
  const removed = context.whole ? [] : section.parts.filter((part) => part.kind === "removed");
  if (removed.length > 0) {
    const label = <Badge label={`${removed.length} removed`} variant="error" />;
    rows.push(
      <Fold
        context={context}
        foldKey={foldKeyOf(context, "removed")}
        key="removed"
        label={label}
        parts={removed}
      />,
    );
  }
  return rows;
}

/** A section: its heading, but the intent's, then its parts, as a group named by the heading. */
export function Section({
  context,
  id,
  section,
}: {
  context: Omit<Context, "heading" | "intent">;
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
    return <VStack gap={2}>{rows}</VStack>;
  }
  return (
    <div aria-labelledby={headingId} role="group">
      <VStack gap={2}>
        <Heading id={id ?? headingId} level={4}>
          <span id={headingId}>{section.title}</span>
        </Heading>
        {rows}
      </VStack>
    </div>
  );
}

/**
 * The sections a card shows: every one when `full`; else, for a decision new or removed whole, or
 * not compared, its intent and its rules; for a changed one, its intent and each section with a
 * part not kept.
 */
export function shownSections(change: DecisionChange, whole: boolean, full: boolean) {
  return change.sections.filter(
    (section) =>
      full ||
      section.title === "" ||
      (whole ? section.title === "Rules" : section.parts.some((p) => p.kind !== "kept")),
  );
}
