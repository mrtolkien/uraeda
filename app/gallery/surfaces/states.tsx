// The surfaces that are part of a page, each in its states: a well at rest and with the focus in
// each editing mode's colour; a card, and a bar of glass over what scrolls, each with a well in
// it; and a pane at rest, with the focus, running, and waiting on the human.
import { View } from "nsh";
import { Busy, gapOf, Page } from "../parts";
import { Text } from "../../ui/controls";
import { Pane, Surface, Well } from "../../ui/surfaces";
import { tokens } from "../../ui/tokens";

const MODES = ["normal", "insert", "visual", "replace"] as const;
const WELL = { paddingHorizontal: 9, paddingVertical: 2 };

function Note(props: { text: string }) {
  return (
    <Text size="under" tone="faint">
      {props.text}
    </Text>
  );
}

export function states(narrow: boolean) {
  const column = {
    flexBasis: narrow ? "100%" : "30%",
    flexGrow: 1,
    gap: gapOf(narrow) + 14,
  } as const;
  const tall = { minHeight: narrow ? 60 : 88 };
  return (
    <Page narrow={narrow}>
      <View style={column}>
        <Pane body={{ gap: 10 }} height="raised" title="Well" tone={tokens.role.heading2}>
          <Well style={WELL}>
            <Text tone="faint">At rest: shaded under its top edge</Text>
          </Well>
          {MODES.map((mode) => (
            <Well focused style={WELL} tone={tokens.light.mode[mode]}>
              <Text>With the focus, in {mode} mode</Text>
            </Well>
          ))}
        </Pane>
        <Pane body={{ gap: 10 }} height="raised" title="Card" tone={tokens.role.heading3}>
          <Surface height="raised" style={{ gap: 8, padding: 10 }}>
            <Text>Raised: lit on its top edge, opaque</Text>
            <Well style={WELL}>
              <Text tone="faint">A well in a card</Text>
            </Well>
          </Surface>
        </Pane>
      </View>
      <View style={column}>
        <Pane height="raised" style={tall} title="At rest" tone={tokens.role.heading1}>
          <Note text="A 1 px edge, which goes round the title." />
        </Pane>
        <Pane
          focused
          height="raised"
          icon="message-square"
          more="· 3"
          style={tall}
          title="With the focus"
        >
          <Note text="The two lights, and their glow: the keys go here." />
        </Pane>
        <Pane
          height="raised"
          icon="bot"
          running
          style={tall}
          title="Running"
          tone={tokens.light.running}
        >
          <Note text="A steady line on its top edge." />
        </Pane>
        <Pane height="raised" icon="circle-alert" more="· 2" needs style={tall} title="Needs you">
          <Note text="An orange title, and no light." />
        </Pane>
      </View>
      <View style={column}>
        <Pane
          focused
          height="raised"
          needs
          running
          style={tall}
          title="Focused, running, needs you"
        >
          <Note text="The focus's light, the run's line, and the title stays orange." />
        </Pane>
        <Pane
          body={{ height: narrow ? 110 : 150, padding: 0 }}
          height="raised"
          title="A bar that stays"
          tone={tokens.role.heading2}
        >
          <View style={{ flex: 1 }}>
            <Busy times={6} />
            <Surface
              glass
              height="raised"
              style={{
                alignItems: "center",
                flexDirection: "row",
                gap: 8,
                paddingHorizontal: 10,
                paddingVertical: 2,
              }}
            >
              <Text>Glass</Text>
              <Well style={{ ...WELL, flexBasis: 0, flexGrow: 1 }}>
                <Text tone="faint">A well in glass</Text>
              </Well>
            </Surface>
          </View>
        </Pane>
      </View>
    </Page>
  );
}
