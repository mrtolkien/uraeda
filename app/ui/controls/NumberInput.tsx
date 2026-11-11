// A number typed or stepped: a field's well, with a step down and a step up at its end. It takes
// what a person types and keeps it in its range itself, before anything is refused; its arrows
// step it while it has the focus, which `nsh/base` gives its own field. A refusal of the value it
// sent shows under it.
import type { ViewRef } from "nsh";
import { NumberInput as Base } from "nsh/base";
import { pressHeight } from "./Button";
import { Icon } from "./Icon";
import { Text, textStyle } from "./Text";
import { Under } from "./Under";
import { focusStop } from "../surfaces/focus";
import { tokens } from "../tokens";

export type NumberInputProps = {
  disabled?: boolean;
  first?: boolean;
  hint?: string;
  /** What it counts, said by screen readers. */
  label: string;
  max?: number;
  min?: number;
  /** A value typed or stepped, once it is a number in its range. */
  onChange: (next: number | null) => void;
  placeholder?: string;
  refusal?: string | null;
  step?: number;
  /** After the number, fainter: "minutes". */
  unit?: string;
  testID?: string;
  value: number | null;
  width?: number;
};

export function NumberInput(props: NumberInputProps) {
  let node: ViewRef | undefined;
  const stop = focusStop(() => node, {
    disabled: () => props.disabled === true,
    first: props.first,
  });
  const step = (name: "minus" | "plus") => (
    <Icon
      colour={props.disabled === true ? tokens.role.inkFaint : tokens.role.inkQuiet}
      name={name}
    />
  );
  const button = {
    alignItems: "center",
    height: pressHeight() - 2,
    justifyContent: "center",
    width: pressHeight() - 2,
  } as const;
  return (
    <Under hint={props.hint} refusal={props.refusal}>
      <Base
        accessibilityLabel={props.label}
        controlsStyle={{ flexDirection: "row" }}
        decrementButton={step("minus")}
        decrementButtonStyle={button}
        disabled={props.disabled === true}
        hoverStyle={{ borderColor: tokens.control.hotEdge }}
        incrementButton={step("plus")}
        incrementButtonStyle={button}
        inputStyle={{
          ...textStyle({ font: "code" }),
          flexGrow: 1,
          paddingHorizontal: 9,
        }}
        max={props.max}
        min={props.min}
        onBlur={stop.onBlur}
        onChange={({ value }) => props.onChange(value)}
        onFocus={stop.onFocus}
        placeholder={props.placeholder}
        ref={(next: ViewRef) => (node = next)}
        step={props.step}
        style={{
          alignItems: "center",
          backgroundColor: props.disabled === true ? "transparent" : tokens.control.well,
          borderColor: stop.focused() ? tokens.light.mode.insert : tokens.control.edge,
          borderStyle: props.disabled === true ? "dashed" : "solid",
          borderWidth: 1,
          boxShadow: tokens.height.recessed.lip,
          flexDirection: "row",
          height: pressHeight(),
          width: props.width ?? 160,
        }}
        suffix={
          props.unit === undefined ? undefined : (
            <Text style={{ paddingRight: 4 }} tone="faint">
              {props.unit}
            </Text>
          )
        }
        testID={props.testID}
        value={props.value}
      />
    </Under>
  );
}
