// A checkbox: an option ticked or not, or neither for a "select all" over some. A square box,
// filled with the accent and a check when ticked, a bar when mixed. It moves at once; a refusal
// puts it back and says why under it.
import { View } from "nsh";
import { Checkbox as Base } from "nsh/base";
import { type ChoiceProps, ChoiceLabel, choiceLooks, markColours } from "./choice";
import { Icon } from "./Icon";
import { pressable } from "./press";
import { Under } from "./Under";
import { tokens } from "../tokens";

export type CheckboxProps = ChoiceProps & {
  /** Neither ticked nor not: some of what it stands for are. A press ticks it. */
  mixed?: boolean;
  onChange: (next: boolean) => void;
  value: boolean;
};

export function Checkbox(props: CheckboxProps) {
  const press = pressable(props, () => props.onChange(props.mixed === true ? true : !props.value));
  const isOn = () => props.value || props.mixed === true;
  const colours = () => markColours(isOn(), props.disabled === true);
  return (
    <Under hint={props.hint} refusal={props.refusal}>
      <Base
        accessibilityLabel={props.label}
        activeStyle={press.active(choiceLooks())}
        checked={props.value}
        disabled={press.isOff()}
        focusStyle={press.focusStyle(choiceLooks())}
        hoverStyle={press.hover(choiceLooks())}
        indeterminate={props.mixed === true}
        indicator={
          <If
            when={props.mixed === true}
            else={
              <If when={props.value}>
                <Icon colour={colours().mark} name="check" size={tokens.control.box - 4} />
              </If>
            }
          >
            <View
              style={{ backgroundColor: colours().mark, height: 2, width: tokens.control.dot }}
            />
          </If>
        }
        indicatorStyle={{
          alignItems: "center",
          backgroundColor: colours().fill,
          borderColor: colours().edge,
          borderStyle: props.disabled === true ? "dashed" : "solid",
          borderWidth: 1,
          height: tokens.control.box,
          justifyContent: "center",
          width: tokens.control.box,
        }}
        onChange={press.press}
        ref={press.ref}
        style={press.style(choiceLooks())}
        testID={props.testID}
      >
        <ChoiceLabel disabled={props.disabled} label={props.label} pending={props.pending} />
      </Base>
    </Under>
  );
}
