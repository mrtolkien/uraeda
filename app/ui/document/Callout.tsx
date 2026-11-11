// A callout, `> [!IMPORTANT]`, stands out without shouting: a bar of its kind's colour down its
// left edge, on a faint block of it, its icon and title in that colour over its text. A quote is
// the bar alone, quieter, its text in the quote's colour.
import { type JSX, Text, View } from "nsh";
import type { Block, CalloutKind } from "../../store/protocol";
import { Icon, type IconName } from "../controls";
import { type Tone, tokens } from "../tokens";
import { prose } from "./look";
import { Spans } from "./Spans";

const KINDS: Record<CalloutKind, { icon: IconName; title: string; tone: Tone }> = {
  caution: { icon: "circle-alert", title: "Caution", tone: "danger" },
  important: { icon: "flag", title: "Important", tone: "needs" },
  note: { icon: "info", title: "Note", tone: "info" },
  question: { icon: "message-circle-question", title: "Question", tone: "needs" },
  tip: { icon: "lightbulb", title: "Tip", tone: "done" },
  warning: { icon: "triangle-alert", title: "Warning", tone: "caution" },
};

export function Callout(props: { block: Block; children?: JSX.Element }) {
  const kind = KINDS[props.block.calloutKind ?? "note"];
  const colour = () => tokens.control.tone(kind.tone);
  return (
    <View
      role="summary"
      style={{
        backgroundColor: tokens.control.tint(colour()),
        borderColor: colour(),
        borderLeftWidth: 2,
        gap: 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Icon colour={colour()} name={kind.icon} />
        <Text style={[prose(colour()), { fontWeight: "700" }]}>
          {props.block.spans.length > 0 ? <Spans spans={props.block.spans} /> : kind.title}
        </Text>
      </View>
      {props.children}
    </View>
  );
}

export function Quote(props: { children?: JSX.Element }) {
  return (
    <View style={{ borderColor: tokens.role.rule, borderLeftWidth: 2, paddingLeft: 14 }}>
      {props.children}
    </View>
  );
}
