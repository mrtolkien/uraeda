// The backdrop: what is under the panes, the darkest colour on screen, with a still wash of the
// theme's two accents and a fine grain. It gives glass something to bend, and the app a room to
// sit in. It never moves: its shader draws once.
import { type JSX, Shader, type StyleProp, type ViewStyle } from "nsh";
import { BACKDROP } from "./backdrop.wgsl";
import { alpha, tokens } from "../tokens";

export function Backdrop(props: { children?: JSX.Element; style?: StyleProp<ViewStyle> }) {
  return (
    <Shader
      source={BACKDROP}
      uniforms={{
        fill: tokens.backdrop.fill,
        wash1: alpha(tokens.backdrop.wash1, tokens.backdrop.wash[0] ?? 0),
        wash2: alpha(tokens.backdrop.wash2, tokens.backdrop.wash[1] ?? 0),
        grain: tokens.backdrop.grain,
      }}
      style={[{ backgroundColor: tokens.backdrop.fill, flex: 1 }, props.style]}
    >
      {props.children}
    </Shader>
  );
}
