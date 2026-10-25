// How a read-only document selects blocks to ask the agent about: tapping selects a block's lines,
// tapping more extends the selection, and under the last block tapped sit "Ask the agent" and
// "Clear". No review writes comments here, so there is no comment field, only the quote.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { useState } from "react";
import type { Block } from "uraeda-binding";
import type { useFile } from "../data.ts";
import { quoteOfRange } from "../reviewQuote.ts";
import type { Selection } from "../Selection.tsx";
import type { Range } from "../useCommentDraft.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

/** The selected lines, and the block tapped last, under which the buttons show. */
type Selected = { last: number; range: Range };

/** The selection once `block` is tapped: its lines added to those selected, the heading the first's. */
function extended(selected: Selected | undefined, block: Block): Selected {
  const { range } = selected ?? {};
  const tapped = { end: block.endLine, heading: block.heading ?? "", start: block.startLine };
  if (!range) {
    return { last: block.id, range: tapped };
  }
  return {
    last: block.id,
    range: {
      end: Math.max(range.end, tapped.end),
      heading: tapped.start < range.start ? tapped.heading : range.heading,
      start: Math.min(range.start, tapped.start),
    },
  };
}

/**
 * The selection of `file`'s document: none without `ask` (no agent to ask, so nothing taps).
 * With it, "Ask the agent" calls `ask` with the quote of the selected lines and clears it.
 */
export function useAskSelection(
  file: File,
  ask: ((quote: string) => void) | undefined,
): Selection | undefined {
  const [selected, setSelected] = useState<Selected>();
  if (!ask) {
    return undefined;
  }
  const clear = () => setSelected(undefined);
  return {
    after: (block) =>
      selected?.last === block.id && (
        <HStack gap={2}>
          <Button
            label="Ask the agent"
            onClick={() => {
              ask(quoteOfRange(file, file.current.text, selected.range));
              clear();
            }}
          />
          <Button label="Clear" onClick={clear} variant="ghost" />
        </HStack>
      ),
    isSelected: (block) =>
      selected !== undefined &&
      block.startLine >= selected.range.start &&
      block.endLine <= selected.range.end,
    onTap: (block) => setSelected((was) => extended(was, block)),
  };
}
