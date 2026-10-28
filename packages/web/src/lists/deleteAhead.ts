// The rows `d` deleted, which go from a list of work at once, before their writes do (see
// `WorkList`).
import { type Dispatch, type SetStateAction, useState } from "react";
import type { WorkRow } from "./Card.tsx";
import { ancestorsAt, nestedRowsEnd, withNested } from "./nesting.ts";
import type { WorkSection } from "./workSection.ts";

/**
 * The rows deleted ahead of their writes, and `sections` without them: a row deleted goes with its
 * nested rows, which follow it in its line's rows.
 */
export function useGone(sections: ReadonlyArray<WorkSection>) {
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  // A row deleted ahead stops being hidden once the file no longer has it.
  if (gone.size > 0) {
    const all = new Set(
      sections.flatMap((section) => withNested(section.rows).map((row) => row.key)),
    );
    if ([...gone].some((key) => !all.has(key))) {
      setGone(new Set([...gone].filter((key) => all.has(key))));
    }
  }
  const without = (rows: ReadonlyArray<WorkRow>) =>
    rows.filter(
      (row, at) =>
        !gone.has(row.key) && !ancestorsAt(rows, at, 1).some((above) => gone.has(above.key)),
    );
  const kept =
    gone.size === 0
      ? sections
      : sections.map((section) => ({
          ...section,
          rows: section.rows
            .filter((row) => !gone.has(row.key))
            .map((row) =>
              row.children === undefined ? row : { ...row, children: without(row.children) },
            ),
        }));
  return { kept, setGone };
}

/**
 * `d`, confirmed: the row goes at once, and the selection to the row after it, or before it; it
 * comes back if the write is refused. `placed` is each section's rows as they show.
 */
export function deleteAheadOf(
  onDelete: (row: WorkRow) => Promise<boolean | void> | void,
  placed: ReadonlyArray<{ rows: ReadonlyArray<WorkRow> }>,
  pick: (key: string) => void,
  setGone: Dispatch<SetStateAction<ReadonlySet<string>>>,
) {
  return (row: WorkRow) => {
    const section = placed.find((one) => one.rows.some((other) => other.key === row.key));
    const lines = section?.rows.filter((other) => !other.isAdd) ?? [];
    const at = lines.findIndex((other) => other.key === row.key);
    // The row after it and its nested rows, which go with it, or else the one before it.
    const after = nestedRowsEnd(lines, at);
    const next = lines[after] ?? lines[at - 1] ?? section?.rows.find((other) => other.isAdd);
    setGone((before) => new Set([...before, row.key]));
    if (next) {
      pick(next.key);
      // With the focus, once drawn: the question gave it back to the row that went.
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(
            `[data-row-key="${CSS.escape(next.key)}"] :is([data-row-link] button, a[href])`,
          )
          ?.focus({ preventScroll: true }),
      );
    }
    // Written, the file no longer has it; refused, it comes back. Either way it is hidden no more:
    // a row that took its key since is another row.
    void Promise.resolve(onDelete(row)).then((isDeleted) => {
      if (isDeleted !== undefined) {
        setGone((before) => new Set([...before].filter((key) => key !== row.key)));
      }
    });
  };
}
