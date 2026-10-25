// The entries of "Contents" on a document's page: one per `##` section, in the file's order.
import type { DataModelItems, Document } from "uraeda-binding";
import { planParts, sectionId } from "../planParts.ts";
import type { Entry } from "../spec/SpecContents.tsx";

/** The entries of a document: each `##` section, its pane's id the heading's anchor, no counts. */
export function documentEntries(document: Document): Array<Entry> {
  return planParts(document, undefined).sections.map(({ heading }) => ({
    id: sectionId(heading),
    label: heading.heading ?? "",
    nested: false,
  }));
}

/** The entries of a data model: each entity's pane, its id the section's anchor. */
export function dataModelEntries(model: DataModelItems): Array<Entry> {
  return model.sections.map((section) => ({
    id: section.anchor,
    label: section.title,
    nested: false,
  }));
}
