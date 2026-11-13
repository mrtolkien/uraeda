// What a row of one fact holds: its kind's icon in its kind's hue, its words, and at its end a
// quiet fact, a key, a count, a time. The words get the row's width first: the fact stays beside
// them while both fit on one line, and goes to the end of a second line when they do not, so a
// title is never squeezed into a column by its state, and wraps only at the row's full width, as
// the phone's rule has it for every text of more than one line. A row grows a line before it
// hides a word. Several facts about one thing are a card, never a longer line.
import { View } from "nsh";
import { Badge, Icon, type IconName, Text } from "../controls";
import { type Tone, tokens } from "../tokens";

export type LineProps = {
  /** A count that asks for the human: drawn as a badge in `countTone`. */
  count?: number;
  countTone?: Tone;
  /** What is open now, the place shown or the item read: its icon and words in the accent. */
  current?: boolean;
  /** Its kind's hue, a colour of the tokens: the quiet ink unless given. */
  hue?: string;
  icon?: IconName;
  label: string;
  /** A quiet fact at its end: "gs", "6/9", "+84". */
  meta?: string;
  metaTone?: Tone;
  /** Done, or gone by: its words faint. */
  quiet?: boolean;
};

export function Line(props: LineProps) {
  const current = () => props.current === true;
  const hasEnd = () => props.meta !== undefined || (props.count ?? 0) > 0;
  return (
    <View style={{ alignItems: "flex-start", flex: 1, flexDirection: "row", gap: 8, minWidth: 0 }}>
      <If when={props.icon}>
        {(name) => (
          // On the first line's middle, however many lines the words take.
          <View style={{ height: tokens.type.line, justifyContent: "center" }}>
            <Icon colour={current() ? tokens.row.current : props.hue} name={name()} />
          </View>
        )}
      </If>
      <View
        style={{
          alignItems: "center",
          columnGap: 8,
          flex: 1,
          flexDirection: "row",
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        <Text
          bold={current()}
          colour={current() ? tokens.row.current : undefined}
          style={{ flexBasis: "auto", flexGrow: 1, flexShrink: 1, minWidth: 0 }}
          tone={props.quiet === true ? "faint" : "ink"}
        >
          {props.label}
        </Text>
        <If when={hasEnd()}>
          <View
            style={{
              alignItems: "center",
              columnGap: 8,
              flexDirection: "row",
              flexShrink: 1,
              flexWrap: "wrap",
              marginLeft: "auto",
              minWidth: 0,
            }}
          >
            <If when={props.meta}>
              {(meta) => (
                // A long fact wraps inside the row, never past the pane's edge, and stays a fact:
                // two lines at most.
                <Text
                  lines={2}
                  style={{ flexShrink: 1, minWidth: 0 }}
                  tone={props.metaTone ?? "faint"}
                >
                  {meta()}
                </Text>
              )}
            </If>
            <If when={props.count !== undefined && props.count > 0}>
              <Badge tone={props.countTone ?? "needs"}>{String(props.count)}</Badge>
            </If>
          </View>
        </If>
      </View>
    </View>
  );
}
