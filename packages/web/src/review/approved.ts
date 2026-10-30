// What an approval shows at once, as fate's `optimistic` result: the file's status, approved, and
// its block's record as the core writes it, "Approved on <today>.", its callout a note. fate shows
// it until the server answers, and takes it back on a refusal.
import type { useFateClient } from "react-fate";
import type { Block, Span } from "uraeda-binding";
import type { useFile } from "../data.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

/** What an approval shows at once, as `review.approve` takes it. */
type Approved = NonNullable<
  Parameters<ReturnType<typeof useFateClient>["mutations"]["review"]["approve"]>[0]["optimistic"]
>;

/** A month or a day of a date, on two digits. */
const pad = (value: number) => String(value).padStart(2, "0");

/** Today's date as the core writes it in a record, `2026-10-30`, by this machine's clock. */
export function today(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A span of plain text. */
const plainSpan = (text: string): Span => ({
  code: false,
  emphasis: false,
  strike: false,
  strong: false,
  text,
});

/**
 * The blocks of `blocks` once approved, as the core's `record_block` leaves them: the first
 * top-level callout an `[!IMPORTANT]` turned a note, its first paragraph the record. None when it
 * has no such block, which the core leaves as it is.
 */
function recorded(blocks: ReadonlyArray<Block>, record: string): Array<Block> | undefined {
  const callout = blocks.find(
    (block) =>
      block.parent == null && block.kind === "callout" && block.calloutKind === "important",
  );
  const paragraph = blocks.find(
    (block) => block.parent === callout?.id && block.kind === "paragraph",
  );
  if (!callout || !paragraph) {
    return undefined;
  }
  return blocks.map((block) =>
    block === callout
      ? { ...block, calloutKind: "note" }
      : block === paragraph
        ? { ...block, spans: [plainSpan(record)] }
        : block,
  );
}

/**
 * The file's record once approved, for fate's `optimistic`: its status, and, from what it holds
 * now, the block's record. What only the core computes, as the text's hash, a spec's time read from
 * its record, the risk tier and the plan review the choices settle, is left to the answer.
 */
export function approvedFile(file: File, on = today()): Approved {
  const { current, id } = file;
  const status = "approved";
  const blocks = recorded(current.document.blocks, `Approved on ${on}.`);
  if (!blocks) {
    return { id, status };
  }
  // fate replaces a field whole. The view reads the record's absent fields as null, as the server
  // sends them: its version is the record's.
  const version = { ...current, document: { ...current.document, blocks } } as Approved["current"];
  return { current: version, id, status };
}
