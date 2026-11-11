// A list: each item's marker in a column of its own, its text beside it, so a wrapped line hangs
// under the text, never under the marker. A bullet on a wide document and a dash on a narrow one;
// a number, right-aligned, for an ordered list; a box for a task; a typed item's sign in its
// colour. The screen's mark hangs under each item.
import { Text, View } from "nsh";
import type { Block } from "../../store/protocol";
import { Icon } from "../controls";
import { tokens } from "../tokens";
import { WIDTHS } from "../width";
import { Blocks, type Read } from "./Blocks";
import { DocumentContext } from "./context";
import { prose } from "./look";
import { Spans } from "./Spans";

/** A typed item's sign, and the role it is drawn in. */
const SIGNS: Record<string, { sign: string; colour: () => string }> = {
  ask: { colour: () => tokens.role.needsYou, sign: "?" },
  con: { colour: () => tokens.role.removed, sign: "−" },
  important: { colour: () => tokens.role.caution, sign: "!" },
  note: { colour: () => tokens.role.context, sign: "&" },
  pro: { colour: () => tokens.role.added, sign: "+" },
  question: { colour: () => tokens.role.needsYou, sign: "?" },
  warning: { colour: () => tokens.role.caution, sign: "⚠" },
};

/** A task's box: empty, or with Lucide's check, on the first line's middle. */
function TaskBox(props: { checked: boolean }) {
  const size = tokens.control.box;
  return (
    <View
      role="checkbox"
      accessibilityState={{ checked: props.checked }}
      style={{
        alignItems: "center",
        backgroundColor: props.checked ? tokens.control.on : tokens.control.well,
        borderColor: props.checked ? tokens.control.on : tokens.control.edge,
        borderWidth: 1,
        height: size,
        justifyContent: "center",
        marginTop: (tokens.type.proseLine - size) / 2,
        width: size,
      }}
    >
      {props.checked ? <Icon colour={tokens.control.onMark} name="check" size={12} /> : null}
    </View>
  );
}

function Marker(props: { item: Block; list: Block; index: number }) {
  const hands = DocumentContext();
  const item = props.item;
  if (item.marker === "task") return <TaskBox checked={item.checked === true} />;
  const typed = item.marker === null ? undefined : SIGNS[item.marker];
  const words = () => {
    if (props.list.ordered === true) return `${(props.list.start ?? 1) + props.index}.`;
    if (typed !== undefined) return typed.sign;
    return hands.width() > 0 && hands.width() < WIDTHS.semiWide ? "–" : "•";
  };
  return (
    <Text
      style={[
        prose(typed?.colour() ?? tokens.role.inkQuiet),
        typed === undefined ? {} : { fontWeight: "700" },
        { textAlign: "right", userSelect: "none" },
      ]}
    >
      {words()}
    </Text>
  );
}

function Item(props: { index: number; item: Block; list: Block; read: Read }) {
  const hands = DocumentContext();
  const item = props.item;
  const inner = props.read.children(item.id).map((child) => child.id);
  const mark = hands.mark?.(item);
  // A number takes the room of its widest; a sign or a bullet one character.
  const room = props.list.ordered === true ? 30 : 20;
  return (
    <View testID={`block-${item.id}`}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ alignItems: "flex-end", width: room }}>
          <Marker index={props.index} item={item} list={props.list} />
        </View>
        <View style={{ flexBasis: 0, flexGrow: 1, minWidth: 0 }}>
          {item.spans.length > 0 ? (
            <Text style={prose()}>
              <Spans spans={item.spans} />
            </Text>
          ) : null}
          {inner.length > 0 ? (
            <View style={{ marginTop: item.spans.length > 0 ? 6 : 0 }}>
              <Blocks ids={inner} read={props.read} />
            </View>
          ) : null}
        </View>
      </View>
      {mark}
    </View>
  );
}

export function List(props: { block: Block; read: Read }) {
  const items = () => props.read.children(props.block.id);
  return (
    <View style={{ gap: 4 }}>
      {items().map((item, index) => (
        <Item index={index} item={item} list={props.block} read={props.read} />
      ))}
    </View>
  );
}
