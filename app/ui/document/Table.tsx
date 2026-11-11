// A table of a document: its cells in one grid, so columns line up across rows, as wide as their
// words up to the room the document has, wrapping down to a floor each, then scrolling sideways
// inside itself: never the page. Its header bold over a line, its rows over quiet lines, each cell
// aligned as the file says. The screen's mark hangs under each row.
import { type JSX, Scroll, Text, View } from "nsh";
import type { Block } from "../../store/protocol";
import { tokens } from "../tokens";
import type { Read } from "./Blocks";
import { DocumentContext } from "./context";
import { cell } from "./look";
import { Spans } from "./Spans";

/** About a character's width in the table's words, in points: half its size, a little over. */
const CHARACTER = 0.55;
/** A cell's room on each side, and over and under. */
const PAD = { x: 12, y: 6 };

/** The plain words of a cell. */
const words = (block: Block) => block.spans.map((span) => span.text).join("");

/**
 * Each column's floor, in points: about half its widest cell's words, between 6 and 18 of the
 * table's characters, or its widest whole when that is narrower, so a short column never wraps.
 */
function floors(rows: ReadonlyArray<ReadonlyArray<Block>>, columns: number): Array<number> {
  const size = tokens.type.size * CHARACTER;
  return Array.from({ length: columns }, (_, column) => {
    const widest = Math.max(1, ...rows.map((cells) => words(cells[column] ?? cells[0]!).length));
    const half = Math.min(18, Math.max(6, Math.ceil(widest / 2)));
    return Math.ceil(Math.min(widest, half) * size) + 2 * PAD.x;
  });
}

const ALIGN: Record<string, "left" | "center" | "right"> = {
  center: "center",
  left: "left",
  right: "right",
};

function Cell(props: { block: Block | undefined; header: boolean; last: boolean }) {
  return (
    <View
      style={{
        borderBottomColor: props.header ? tokens.role.rule : tokens.role.ruleQuiet,
        borderBottomWidth: props.last ? 0 : 1,
        paddingHorizontal: PAD.x,
        paddingVertical: PAD.y,
      }}
    >
      <Text
        style={[
          cell(),
          props.header ? { fontWeight: "700" } : {},
          { textAlign: ALIGN[props.block?.align ?? ""] ?? "left" },
        ]}
      >
        {props.block === undefined ? "" : <Spans spans={props.block.spans} />}
      </Text>
    </View>
  );
}

export function Table(props: { block: Block; read: Read }) {
  const hands = DocumentContext();
  const rows = props.read.children(props.block.id);
  const cells = rows.map((row) => props.read.children(row.id));
  const columns = Math.max(1, ...cells.map((row) => row.length));
  const least = floors(cells, columns);
  // The room it has: from the prose's edge to the document's right edge.
  const room = () => Math.max(0, hands.width() - hands.inset());
  const grid: Array<JSX.Element> = [];
  rows.forEach((row, at) => {
    const last = at === rows.length - 1;
    for (let column = 0; column < columns; column += 1) {
      grid.push(<Cell block={cells[at]![column]} header={row.header === true} last={last} />);
    }
    const mark = hands.mark?.(row);
    if (mark !== undefined) {
      grid.push(<View style={{ gridColumn: `1 / ${columns + 1}` }}>{mark}</View>);
    }
  });
  return (
    <Scroll horizontal style={{ flexGrow: 0 }} testID={`table-${props.block.id}`}>
      <View
        style={{
          display: "grid",
          gridTemplateColumns: least.map((floor) => `minmax(${floor}px, auto)`).join(" "),
          justifyContent: "start",
          width: Math.max(
            room(),
            least.reduce((sum, floor) => sum + floor, 0),
          ),
        }}
      >
        {grid}
      </View>
    </Scroll>
  );
}
