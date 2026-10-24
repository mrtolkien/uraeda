/**
 * The ids of a round's parts on its page, which the outline's rows jump to: the block, a free
 * context, the points to check, the settled groups, and the notes. The context's parts with a
 * heading keep their heading's anchor, and a question its id.
 */
export const PART_IDS = {
  behaviour: "behaviour",
  check: "check-these",
  context: "context",
  hood: "under-the-hood",
  notes: "notes",
  summary: "summary",
} as const;
