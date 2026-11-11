// The outline: a file's headings, its parts and theirs, one row each, the part the reader is in
// lit. `Enter` or a press brings the heading to the reader's top, and the focus with it.
import { View } from "nsh";
import type { Block, FileView } from "../../store/protocol";
import { focusPane, PaneScroll, usePane } from "../../ui/layout";
import { createCursor, Empty, Line, List } from "../../ui/lists";
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
    <List
      cursor={cursor}
      empty={
        <Empty
          icon="list"
          title="No parts"
          words="The file has no heading under its title: it reads as one part."
        />
      }
      onOpen={open}
      openLabel="go to the part"
      row={(id) => {
        const heading = () => byId().get(id());
        const lit = () => here() !== undefined && String(here()) === id();
        return (
          <View
            style={{
              alignItems: "center",
              flex: 1,
              flexDirection: "row",
              gap: 8,
              paddingLeft: (heading()?.level ?? 2) > 2 ? 20 : 0,
            }}
          >
            <Line
              current={lit()}
              icon={lit() ? "circle-dot" : "minus"}
              label={plain(heading()?.spans ?? [])}
              quiet={!lit() && (heading()?.level ?? 2) > 2}
            />
          </View>
        );
      }}
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
