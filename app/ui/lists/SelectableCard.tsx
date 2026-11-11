// A card that is a choice: one of a few things the human picks, each needing more words than a
// radio's line, as the kinds of work on the New page. It is a raised surface with its icon, its
// title, and its words; picked, its edge takes the accent and its left edge the bar of light. It
// takes the focus and presses as every control does (`press.ts`): Tab reaches it in a dialog,
// Enter or Space picks it, and its ring shows where the focus is.
import { View } from "nsh";
import { Button as Base } from "nsh/base";
import { Icon, type IconName, type PressState, pressable, Text } from "../controls";
import { Surface } from "../surfaces";
import { tokens } from "../tokens";
import { Bar } from "./Row";

export type SelectableCardProps = {
  disabled?: boolean;
  /** In an overlay, it takes the focus as the overlay opens. */
  first?: boolean;
  hue?: string;
  icon?: IconName;
  onSelect: () => void;
  selected: boolean;
  /** Drawn in one state, still: the gallery's. */
  state?: PressState;
  testID?: string;
  title: string;
  /** What picking it means, at the card's full width. */
  words?: string;
};

/** Its looks: the pointer outlines it in the accent. */
const looks = () => ({
  rest: { alignSelf: "stretch" as const },
  hover: { outlineColor: tokens.control.hotEdge, outlineOffset: -1, outlineWidth: 1 },
});

export function SelectableCard(props: SelectableCardProps) {
  const press = pressable(props, () => props.onSelect());
  const off = () => props.disabled === true;
  return (
    <Base
      accessibilityLabel={props.title}
      activeStyle={press.active(looks())}
      disabled={press.isOff()}
      focusStyle={press.focusStyle(looks())}
      hoverStyle={press.hover(looks())}
      onPress={press.press}
      ref={press.ref}
      selected={props.selected}
      style={press.style(looks())}
      testID={props.testID}
    >
      <Surface
        height="raised"
        style={[
          {
            alignSelf: "stretch",
            borderStyle: off() ? "dashed" : "solid",
            flex: 1,
            gap: 2,
            paddingHorizontal: 10,
            paddingVertical: 8,
          },
          // Only a selected card sets its border: an unset colour is drawn black on GTK.
          props.selected === true ? { borderColor: tokens.light.focus } : null,
        ]}
      >
        <If when={props.selected}>
          <Bar />
        </If>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <If when={props.icon}>
            {(name) => (
              <Icon colour={off() ? tokens.control.disabledInk : props.hue} name={name()} />
            )}
          </If>
          <Text bold tone={off() ? "faint" : "ink"}>
            {props.title}
          </Text>
        </View>
        <If when={props.words}>
          {(words) => <Text tone={off() ? "faint" : "quiet"}>{words()}</Text>}
        </If>
      </Surface>
    </Base>
  );
}
