// A key, written out where it acts: the one key of the app. By default a chip, the key in the
// accent, bold, on a small dark block tinted with the accent, with no border and no shadow, so
// the letter reads on any surface. `tokens.key.look` picks the variant: `glow`, a lit letter with
// no block, or `cap`, a flat keycap. A sequence, "g h", is a chip per key.
//
// A key shown on a control is a key of the registry: `Button`'s `keys` declares the key it shows.
import { Text, View } from "nsh";
import { written } from "../keys/token";
import { alpha, tokens } from "../tokens";

export type KbdProps = {
  /** The key as it is typed, "j", "mod+k", "Enter", or a sequence, "g h". */
  keys: string;
  /** Its variant, for the gallery's side by side: `tokens.key.look` unless given. */
  look?: "chip" | "glow" | "cap";
  /** On the main button: the letter in the button's text colour, on a faint block. */
  onMain?: boolean;
  /** Its state, drawn as it is asked: the gallery's. A key under the pointer brightens. */
  state?: "rest" | "hover" | "pressed";
};

/** One key's chip. */
function Chip(props: KbdProps & { token: string }) {
  const look = () => props.look ?? tokens.key.look;
  const fill = () => {
    if (props.onMain === true) {
      return tokens.key.onMain;
    }
    if (look() === "glow") {
      return undefined;
    }
    if (look() === "cap") {
      return tokens.height.raised.fill;
    }
    return props.state === "hover"
      ? tokens.key.hot
      : props.state === "pressed"
        ? tokens.key.pressed
        : tokens.key.fill;
  };
  const colour = () => {
    if (props.onMain === true) {
      return tokens.role.onAction;
    }
    return look() === "cap" ? tokens.role.ink : tokens.key.text;
  };
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: fill(),
        borderColor: look() === "cap" ? tokens.role.rule : undefined,
        borderWidth: look() === "cap" && props.onMain !== true ? 1 : 0,
        height: tokens.key.size,
        justifyContent: "center",
        minWidth: tokens.key.size,
        paddingHorizontal: tokens.key.padding - (look() === "cap" ? 1 : 0),
      }}
    >
      <Text
        style={{
          color: colour(),
          fontFamily: tokens.type.body,
          fontSize: tokens.type.under,
          fontWeight: "700",
          lineHeight: tokens.key.size - 2,
          textShadow:
            look() === "glow" && props.onMain !== true
              ? [{ blur: 6, color: alpha(tokens.key.text, 0.7), x: 0, y: 0 }]
              : undefined,
        }}
      >
        {written(props.token)}
      </Text>
    </View>
  );
}

export function Kbd(props: KbdProps) {
  const parts = () => props.keys.split(" ").filter(Boolean);
  return (
    <View style={{ alignItems: "center", flexDirection: "row", flexShrink: 0, gap: 2 }}>
      <Each of={parts()}>{(token: () => string) => <Chip {...props} token={token()} />}</Each>
    </View>
  );
}
