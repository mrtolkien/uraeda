// A button that is an icon: a bar's, a row's, a pane's title's. It has no frame at rest, so a row
// of them stays quiet, and becomes a tube under the pointer, with the focus, or pressed. Its
// label is what screen readers say, the tip under the pointer, and the key map's word for its
// key: a tip is never the only place it lives.
import { type StyleProp, type ViewStyle } from "nsh";
import { Button as Base } from "nsh/base";
import { pressHeight } from "./Button";
import { type IconName, Icon } from "./Icon";
import { buttonLooks, disabledLook, toneOf } from "./look";
import { type PressProps, pressable } from "./press";
import { registerKey } from "../keys/registry";
import { Tooltip } from "../surfaces";
import { tokens } from "../tokens";

export type IconButtonProps = PressProps & {
  /** Its icon's colour at rest, for a state it marks: a pane that waits on the human. */
  colour?: string;
  /** Red under the pointer, for what removes. */
  danger?: boolean;
  icon: IconName;
  /** Its key, declared in the registry with its label. */
  keys?: string;
  /** What it does, in words: "Delete the row". */
  label: string;
  /** A toggle that is on: its icon in the accent, on a faint block. */
  selected?: boolean;
  /** No tip now, while what it opened covers where the tip would be: a menu's list. */
  tipOff?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function IconButton(props: IconButtonProps) {
  const press = pressable(props);
  const variant = () => (props.danger === true ? "danger" : "tube");
  const looks = () => {
    const tube = buttonLooks(variant(), false);
    const side = pressHeight();
    return {
      ...tube,
      disabled: { ...disabledLook(), borderColor: "transparent" },
      rest: {
        alignItems: "center",
        backgroundColor: props.selected === true ? tokens.key.fill : "transparent",
        backgroundImage: "none",
        borderColor: "transparent",
        borderWidth: 1,
        boxShadow: "none",
        height: side,
        justifyContent: "center",
        width: side,
      } satisfies ViewStyle,
    };
  };
  const colour = () => {
    if (props.disabled === true) {
      return tokens.role.inkFaint;
    }
    if (props.selected === true || press.state() === "hover" || press.state() === "focus") {
      return toneOf(variant());
    }
    return props.colour ?? tokens.role.inkQuiet;
  };
  if (props.keys !== undefined && props.state === undefined) {
    registerKey({
      keys: props.keys,
      label: props.label,
      run: press.press,
      when: () => !press.isOff(),
    });
  }
  return (
    <Tooltip off={props.tipOff} text={props.label}>
      <Base
        accessibilityLabel={props.label}
        activeStyle={press.active(looks())}
        disabled={press.isOff()}
        focusStyle={press.focusStyle(looks())}
        hoverStyle={press.hover(looks())}
        onPress={press.press}
        ref={press.ref}
        selected={props.selected === true}
        style={[press.style(looks()), props.style]}
        testID={props.testID}
      >
        <Icon colour={colour()} name={props.icon} />
      </Base>
    </Tooltip>
  );
}
