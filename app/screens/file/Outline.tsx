// The outline: a file's headings, its parts and theirs, one row each, the part the reader is in
// lit, drawn by the library's `Outline`. `Enter` or a press brings the heading to the reader's
// top, and the focus with it.
import type { Block, FileView } from "../../store/protocol";
import { focusPane, PaneScroll, usePane } from "../../ui/layout";
import { createCursor, Outline as OutlineList } from "../../ui/lists";
import { jumpTo, topBlock } from "./place";
import { type FileArgs, plain, shownOf, WithFile } from "./read";
import { readerPane } from "./panes";

/** The headings an outline lists: the parts and their groups, the title aside. */
const outlined = (blocks: ReadonlyArray<Block>) =>
  blocks.filter(
    (block) => block.kind === "heading" && (block.level ?? 0) >= 2 && (block.level ?? 0) <= 3,
  );

/** The heading the reader is in: the last at or before the block at its top. */
export function headingAtTop(headings: ReadonlyArray<Block>, top: number) {
  return headings.findLast((heading) => heading.id <= top);
}

function Headings(props: { args: FileArgs; file: () => FileView }) {
  const kept = usePane().remember<string | null>("at", null);
  const headings = () => outlined(shownOf(props.file()).document.blocks);
  const byId = () => new Map(headings().map((heading) => [String(heading.id), heading]));
  const rows = () => headings().map((heading) => ({ id: String(heading.id) }));
  const here = () => headingAtTop(headings(), topBlock(props.args)())?.id;
  const cursor = createCursor(rows, {
    initial: kept() ?? undefined,
    onChange: (id) => kept.set(id ?? null),
  });
  const open = (id: string) => {
    jumpTo(props.args, Number(id));
    focusPane(readerPane(props.args));
  };
  return (
    <OutlineList
      cursor={cursor}
      emptyWords="The file has no heading under its title: it reads as one part."
      heading={(id) => {
        const heading = byId().get(id);
        return heading === undefined
          ? undefined
          : { id, level: heading.level ?? 2, title: plain(heading.spans) };
      }}
      here={() => {
        const id = here();
        return id === undefined ? undefined : String(id);
      }}
      onOpen={open}
      top={2}
    />
  );
}

/** The pane "Outline". */
export function Outline(props: { args: FileArgs }) {
  return (
    <PaneScroll style={{ flex: 1 }}>
      <WithFile args={props.args} beside>
        {(file) => <Headings args={props.args} file={file} />}
      </WithFile>
    </PaneScroll>
  );
}
