// The surfaces that are part of a page, each in its states: a well at rest and with the focus in
// each editing mode's colour; a card, and a bar of glass over what scrolls, each with a well in
// it; and a pane at rest, with the focus, running, and waiting on the human.
import { View } from "nsh";
import { busy, icon, mono, tag } from "../samples/parts";
import { Pane, Surface, Well } from "../../ui/surfaces";
import type { Tokens } from "../../ui/tokens";

const MODES = ["normal", "insert", "visual", "replace"] as const;

export function states(v: Tokens, narrow: boolean) {
  const well = { paddingHorizontal: 9, paddingVertical: 5 };
  const column = {
    flexBasis: narrow ? "100%" : "30%",
    flexGrow: 1,
    gap: narrow ? 14 : 22,
  } as const;
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: narrow ? 14 : 22,
        padding: narrow ? 8 : 28,
      }}
    >
      <View style={column}>
        <Pane title="Well" tone={v.role.heading2} body={{ gap: 10 }}>
          <Well style={well}>
            {mono(v, "At rest: shaded under its top edge", { color: v.role.inkFaint })}
          </Well>
          {MODES.map((mode) => (
            <Well focused tone={v.light.mode[mode]} style={well}>
              {mono(v, `With the focus, in ${mode} mode`)}
            </Well>
          ))}
        </Pane>
        <Pane title="Card" tone={v.role.heading3} body={{ gap: 10 }}>
          <Surface height="raised" style={{ gap: 8, padding: 10 }}>
            {mono(v, "Raised: lit on its top edge, opaque")}
            <Well style={well}>{mono(v, "A well in a card", { color: v.role.inkFaint })}</Well>
          </Surface>
        </Pane>
      </View>
      <View style={column}>
        <Pane title="At rest" tone={v.role.heading1} style={{ minHeight: narrow ? 60 : 96 }}>
          {tag(v, "A 1 px edge, which goes round the title.")}
        </Pane>
        <Pane
          focused
          title="With the focus"
          more="· 3"
          icon={(colour) => icon("chat", colour)}
          style={{ minHeight: narrow ? 60 : 96 }}
        >
          {tag(v, "The two lights, and their glow: the keys go here.")}
        </Pane>
        <Pane
          running
          title="Running"
          tone={v.role.lightRunning}
          icon={(colour) => icon("bot", colour)}
          style={{ minHeight: narrow ? 60 : 96 }}
        >
          {tag(v, "A steady line on its top edge.")}
        </Pane>
        <Pane
          needs
          title="Needs you"
          more="· 2"
          icon={(colour) => icon("alert", colour)}
          style={{ minHeight: narrow ? 60 : 96 }}
        >
          {tag(v, "An orange title, and no light.")}
        </Pane>
      </View>
      <View style={column}>
        <Pane
          focused
          needs
          running
          title="Focused, running, needs you"
          style={{ minHeight: narrow ? 60 : 96 }}
        >
          {tag(v, "The focus's light, the run's line, and the title stays orange.")}
        </Pane>
        <Pane title="A pane in a pane" tone={v.role.heading3}>
          <Pane height="raised" title="Card">
            {tag(v, "Raised. Two levels at most.")}
          </Pane>
        </Pane>
        <Pane
          title="A bar that stays"
          tone={v.role.heading2}
          body={{ height: narrow ? 110 : 150, padding: 0 }}
        >
          {busy(v, 6)}
          <Surface
            glass
            height="raised"
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            {mono(v, "Glass")}
            <Well style={{ flexBasis: 0, flexGrow: 1, paddingHorizontal: 8, paddingVertical: 2 }}>
              {mono(v, "A well in glass", { color: v.role.inkFaint })}
            </Well>
          </Surface>
        </Pane>
      </View>
    </View>
  );
}
