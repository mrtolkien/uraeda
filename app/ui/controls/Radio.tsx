// Radios: one of a few options, each with words of its own, where a segmented control would cut
// them short. Square, as every corner: a box with a square dot when picked, which tells it from a
// checkbox's tick. The group is one target of the refusal, under its last option.
import { View } from "nsh";
import { Radio as Base, RadioGroup } from "nsh/base";
import { type ChoiceProps, ChoiceLabel, choiceLooks, markColours } from "./choice";
import type { Option } from "./Options";
import { type PressState, pressable } from "./press";
import { Text } from "./Text";
import { Under } from "./Under";
import { tokens } from "../tokens";

export type RadioProps<Value extends string> = Omit<ChoiceProps, "state"> & {
  onChange: (next: Value) => void;
  options: ReadonlyArray<Option<Value>>;
  /** Draws its options in a state, still: the gallery's. */
  state?: PressState;
  value: Value | null;
};

function One<Value extends string>(props: {
  disabled: boolean;
  first?: boolean;
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
        return props.state;
      },
    },
    () => props.onPick(),
  );
  const colours = () => markColours(props.picked, props.disabled);
  return (
    <Base
      accessibilityLabel={props.option.label}
      activeStyle={press.active(choiceLooks())}
      checked={props.picked}
      disabled={press.isOff()}
      focusStyle={press.focusStyle(choiceLooks())}
      hoverStyle={press.hover(choiceLooks())}
      onChange={press.press}
      ref={press.ref}
      style={press.style(choiceLooks())}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: props.disabled ? "transparent" : tokens.control.well,
          borderColor: colours().edge,
          borderStyle: props.disabled ? "dashed" : "solid",
          borderWidth: 1,
          height: tokens.control.box,
          justifyContent: "center",
          width: tokens.control.box,
        }}
      >
        <If when={props.picked}>
          <View
            style={{
              backgroundColor: props.disabled ? colours().mark : tokens.control.on,
              height: tokens.control.dot,
              width: tokens.control.dot,
            }}
          />
        </If>
      </View>
      <ChoiceLabel disabled={props.disabled} label={props.option.label} />
      <If when={props.option.hint}>
        {(hint) => (
          <Text size="under" tone="faint">
            {hint()}
          </Text>
        )}
      </If>
    </Base>
  );
}

export function Radio<Value extends string>(props: RadioProps<Value>) {
  return (
    <Under hint={props.hint} refusal={props.refusal}>
      <RadioGroup style={{ gap: 0 }} testID={props.testID}>
        <Each of={props.options}>
          {(option, at) => (
            <One
              disabled={props.disabled === true || option().disabled === true}
              first={props.first === true && at() === 0}
              onPick={() => props.onChange(option().value)}
              option={option()}
              picked={props.value === option().value}
              state={props.state}
            />
          )}
        </Each>
      </RadioGroup>
      <If when={props.pending === true}>
        <Text size="under" tone="faint">
          saving…
        </Text>
      </If>
    </Under>
  );
}
