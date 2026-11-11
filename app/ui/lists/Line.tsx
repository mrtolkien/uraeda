// What a row of one fact holds: its kind's icon in its kind's hue, its words, and at its end a
// quiet fact, a key, a count, a time. The words wrap rather than cut: a row grows a line before it
// hides a word. Several facts about one thing are a card, never a longer line.
import { Badge, Icon, type IconName, Text } from "../controls";
import type { Tone } from "../tokens";

export type LineProps = {
  /** A count that asks for the human: drawn as a badge in `countTone`. */
  count?: number;
  countTone?: Tone;
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
  return (
    <>
      <If when={props.icon}>{(name) => <Icon colour={props.hue} name={name()} />}</If>
      <Text style={{ flex: 1, minWidth: 0 }} tone={props.quiet === true ? "faint" : "ink"}>
        {props.label}
      </Text>
      <If when={props.meta}>{(meta) => <Text tone={props.metaTone ?? "faint"}>{meta()}</Text>}</If>
      <If when={props.count !== undefined && props.count > 0}>
        <Badge tone={props.countTone ?? "needs"}>{String(props.count)}</Badge>
      </If>
    </>
  );
}
