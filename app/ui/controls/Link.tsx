// A link: words that lead elsewhere, in the link role, underlined so colour is not the only sign.
// `href` opens an address outside the app; `onPress` goes to a place of the app. It takes the
// focus in an overlay, where Enter follows it.
import { type JSX, openUrl } from "nsh";
import { Link as Base } from "nsh/base";
import { type Looks, type PressState, pressable } from "./press";
import { type Size, Text } from "./Text";
import { tokens } from "../tokens";
import { isNarrow } from "../width";

export type LinkProps = {
  /** A link on its own, not inside a sentence: a thumb's size on a phone, its words in its middle. */
  alone?: boolean;
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

const looks = (alone: boolean): Looks => ({
  hover: { backgroundColor: tokens.control.tint(tokens.role.link) },
  rest:
    alone && isNarrow()
      ? {
          alignSelf: "flex-start",
          justifyContent: "center",
          minHeight: tokens.control.touch,
          paddingHorizontal: 6,
        }
      : { alignSelf: "flex-start" },
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
      activeStyle={press.active(looks(props.alone === true))}
      disabled={press.isOff()}
      focusStyle={press.focusStyle(looks(props.alone === true))}
      href={props.href}
      hoverStyle={press.hover(looks(props.alone === true))}
      onPress={props.href === undefined ? press.press : undefined}
      ref={press.ref}
      style={press.style(looks(props.alone === true))}
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
