// A segmented control: one of two to five short options, each seen at once, cut in one well. The
// picked one stands up a step, its words bold, with a line of light under it. It moves at once; a
// refusal puts it back and says why under it.
import { View } from "nsh";
import { Button as Base } from "nsh/base";
import { pressHeight } from "./Button";
import { Icon } from "./Icon";
import type { Option } from "./Options";
import { type Looks, type PressState, pressable } from "./press";
import { Text } from "./Text";
import { Under } from "./Under";
import { tokens } from "../tokens";

export type SegmentedProps<Value extends string> = {
  disabled?: boolean;
  first?: boolean;
  hint?: string;
  /** What it chooses, said by screen readers. */
  label: string;
  onChange: (next: Value) => void;
  options: ReadonlyArray<Option<Value>>;
  pending?: boolean;
  refusal?: string | null;
  /** Draws its segments in a state, still: the gallery's. */
  state?: PressState;
  testID?: string;
  value: Value;
};

function looks(picked: boolean, last: boolean): Looks {
  return {
    disabled: {},
    focus: {},
    hover: picked ? {} : { backgroundColor: tokens.control.tint(tokens.role.action) },
    pressed: { backgroundColor: tokens.height.recessed.fillIn.deeper },
    rest: {
      alignItems: "center",
      backgroundColor: picked ? tokens.height.raised.fill : "transparent",
      borderColor: tokens.role.ruleQuiet,
      borderRightWidth: last ? 0 : 1,
      flexDirection: "row",
      gap: 6,
      height: pressHeight() - 2,
      justifyContent: "center",
      paddingHorizontal: 12,
    },
  };
}

function Segment<Value extends string>(props: {
  disabled: boolean;
  first: boolean;
  last: boolean;
  onPick: () => void;
  option: Option<Value>;
  picked: boolean;
  state?: PressState;
}) {
  const press = pressable(
    {
      get disabled() {
        return props.disabled;
      },
      first: props.first,
      get state() {
        return props.picked ? undefined : props.state;
      },
    },
    () => props.onPick(),
  );
  const ink = () => {
    if (props.disabled) {
      return "faint" as const;
    }
    return props.picked ? ("ink" as const) : ("quiet" as const);
  };
  return (
    <Base
      accessibilityLabel={props.option.label}
      activeStyle={press.active(looks(props.picked, props.last))}
      disabled={press.isOff()}
      focusStyle={press.focusStyle(looks(props.picked, props.last))}
      hoverStyle={press.hover(looks(props.picked, props.last))}
      onPress={press.press}
      ref={press.ref}
      role="tab"
      selected={props.picked}
      style={press.style(looks(props.picked, props.last))}
    >
      <If when={props.option.icon}>
        {(icon) => <Icon colour={props.picked ? tokens.role.action : undefined} name={icon()} />}
      </If>
      <Text bold={props.picked} lines={1} tone={ink()}>
        {props.option.label}
      </Text>
      <If when={props.picked && !props.disabled}>
        <View
          style={{
            backgroundColor: tokens.light.focus,
            bottom: 0,
            height: 2,
            left: 0,
            position: "absolute",
            right: 0,
          }}
        />
      </If>
    </Base>
  );
}

export function Segmented<Value extends string>(props: SegmentedProps<Value>) {
  return (
    <Under hint={props.hint} refusal={props.refusal}>
      <View
        accessibilityLabel={props.label}
        role="tablist"
        style={{
          alignSelf: "flex-start",
          backgroundColor: tokens.control.well,
          borderColor: props.disabled === true ? tokens.control.disabledEdge : tokens.control.edge,
          borderStyle: props.disabled === true ? "dashed" : "solid",
          borderWidth: 1,
          boxShadow: tokens.height.recessed.lip,
          flexDirection: "row",
          maxWidth: "100%",
        }}
        testID={props.testID}
      >
        <Each of={props.options}>
          {(option, at) => (
            <Segment
              disabled={props.disabled === true || option().disabled === true}
              first={props.first === true && option().value === props.value}
              last={at() === props.options.length - 1}
              onPick={() => {
                if (option().value !== props.value) {
                  props.onChange(option().value);
                }
              }}
              option={option()}
              picked={option().value === props.value}
              state={props.state}
            />
          )}
        </Each>
      </View>
      <If when={props.pending === true}>
        <Text size="under" tone="faint">
          saving…
        </Text>
      </If>
    </Under>
  );
}
