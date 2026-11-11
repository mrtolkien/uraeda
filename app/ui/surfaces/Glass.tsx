// Glass: what is behind a box, frosted, tinted, and bent at its edge. It says "this floats over
// something you can still feel", and is never a background for reading.
//
// Where the platform draws a blur of what is behind a view, glass is the platform's: Apple's own
// material where there is one, a backdrop blur elsewhere. GTK draws neither, so there it is the
// shader of `glass.wgsl.ts`, which reads the picture Native Shell takes of what is behind the box.
// No caller knows which: a later client maps a height to its system's material here, and nowhere
// else. Only `Surface` draws glass: every other component gets it by sitting at a height.
import { type JSX, platform, Shader, type StyleProp, View, type ViewStyle } from "nsh";
import { GLASS } from "./glass.wgsl";
import { alpha, tokens } from "../tokens";

/** Whether the platform draws no blur of what is behind a view: the shader then draws the glass. */
const needsShader = platform.os === "linux";

export function Glass(props: {
  children?: JSX.Element;
  /** The line under its rim: an overlay's unless given, as a bar's quiet rule. */
  edge?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  if (!needsShader) {
    return (
      <View
        testID={props.testID}
        style={[
          {
            backdropFilter: `blur(${tokens.glass.frost}px) saturate(${tokens.glass.saturate}) brightness(${tokens.glass.brightness})`,
            backgroundColor: alpha(tokens.glass.tint, tokens.glass.strength),
            borderColor: alpha(tokens.glass.rim, tokens.glass.rimBetween),
            borderWidth: 1,
            glassEffect: "regular",
          },
          props.style,
        ]}
      >
        {props.children}
      </View>
    );
  }
  return (
    <Shader
      testID={props.testID}
      source={GLASS}
      uniforms={{
        tint: alpha(tokens.glass.tint, tokens.glass.strength),
        rim: alpha(tokens.glass.rim, tokens.glass.rimCorner),
        edge: props.edge ?? tokens.height.overlay.border,
        shadow: alpha(tokens.black, tokens.glass.shade),
        frost: tokens.glass.frost,
        edge_frost: tokens.glass.edgeFrost,
        saturate: tokens.glass.saturate,
        brightness: tokens.glass.brightness,
        band: tokens.glass.band,
        pull: tokens.glass.pull,
        fringe: tokens.glass.fringe,
        rim_between: tokens.glass.rimBetween,
        thicken: tokens.glass.thicken,
        line: tokens.glass.line,
        sheen: tokens.glass.sheen,
        glow: tokens.glass.glow,
        grain: tokens.glass.grain,
        light: tokens.mode === "light" ? 1 : 0,
      }}
      style={props.style}
    >
      {props.children}
    </Shader>
  );
}
