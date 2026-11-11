// A link: words that lead elsewhere, in the link role, underlined so colour is not the only sign.
// `href` opens an address outside the app; `onPress` goes to a place of the app. It takes the
// focus in an overlay, where Enter follows it.
import { type JSX, openUrl } from "nsh";
import { Link as Base } from "nsh/base";
import { type Looks, type PressState, pressable } from "./press";
import { type Size, Text } from "./Text";
import { tokens } from "../tokens";

export type LinkProps = {
  children: JSX.Element;
  disabled?: boolean;
  /** An address outside the app, opened by the system. */
  href?: string;
  /** A place of the app: who draws the link goes there. */
  onPress?: () => void;
  size?: Size;
  state?: PressState;
  testID?: string;
};

const looks = (): Looks => ({
  hover: { backgroundColor: tokens.control.tint(tokens.role.link) },
  rest: { alignSelf: "flex-start" },
});

export function Link(props: LinkProps) {
  // Enter on a link the focus is on follows it, as a press does.
  const follow = () => {
    if (props.href === undefined) {
      props.onPress?.();
    } else {
      void openUrl(props.href);
    }
  };
  const press = pressable(props, follow);
  return (
    <Base
      activeStyle={press.active(looks())}
      disabled={press.isOff()}
      focusStyle={press.focusStyle(looks())}
      href={props.href}
      hoverStyle={press.hover(looks())}
      onPress={props.href === undefined ? press.press : undefined}
      ref={press.ref}
      style={press.style(looks())}
      testID={props.testID}
    >
      <Text
        size={props.size}
        style={{ textDecorationLine: "underline" }}
        tone={props.disabled === true ? "faint" : "link"}
      >
        {props.children}
      </Text>
    </Base>
  );
}
