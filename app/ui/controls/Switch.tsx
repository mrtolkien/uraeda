// A switch: a setting on or off, which takes effect at once. A square track with a square thumb,
// filled with the accent when on. It moves the moment it is touched; a refusal puts it back and
// says why under it (`sent.ts`).
import { Switch as Base } from "nsh/base";
import { type ChoiceProps, ChoiceLabel, choiceLooks, markColours } from "./choice";
import { pressable } from "./press";
import { Under } from "./Under";
import { feltChoice } from "../native";
import { tokens } from "../tokens";

export type SwitchProps = ChoiceProps & {
  /** Asks for the value a press gives: the owner shows it, `sent`'s `set`. */
  onChange: (next: boolean) => void;
  value: boolean;
};

const size = () => tokens.control.switch;

export function Switch(props: SwitchProps) {
  const press = pressable(props, () => {
    feltChoice();
    props.onChange(!props.value);
  });
  const colours = () => markColours(props.value, props.disabled === true);
  const travel = () => size().width - 2 - size().thumb - 2 * size().inset;
  return (
    <Under hint={props.hint} refusal={props.refusal}>
      <Base
        accessibilityLabel={props.label}
        activeStyle={press.active(choiceLooks())}
        checked={props.value}
        disabled={press.isOff()}
        focusStyle={press.focusStyle(choiceLooks())}
        hoverStyle={press.hover(choiceLooks())}
        onChange={press.press}
        ref={press.ref}
        style={press.style(choiceLooks())}
        testID={props.testID}
        thumbStyle={{
          backgroundColor: colours().mark,
          height: size().thumb,
          transitionDuration: tokens.motion.glide,
          transitionProperty: "translate",
          translate: [props.value ? travel() : 0, 0],
          width: size().thumb,
        }}
        trackStyle={{
          backgroundColor: colours().fill,
          borderColor: colours().edge,
          borderStyle: props.disabled === true ? "dashed" : "solid",
          borderWidth: 1,
          height: size().height,
          justifyContent: "center",
          paddingHorizontal: size().inset,
          transitionDuration: tokens.motion.glide,
          transitionProperty: "background-color, border-color",
          width: size().width,
        }}
      >
        <ChoiceLabel disabled={props.disabled} label={props.label} pending={props.pending} />
      </Base>
    </Under>
  );
}
