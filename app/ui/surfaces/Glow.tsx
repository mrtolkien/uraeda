// The light a focused pane emits: two lights, one from each end of its outline, which follow the
// pane's whole shape, its title's tab included. A light theme has one, under the pane, as a tinted
// shadow: glow needs darkness.
//
// It is a shader that draws once, from the distance to the shape. As a `drop-shadow` filter of the
// pane, GTK blurred the whole pane again on some frames of a scroll (ruling R130). Only `Surface`
// draws it: a component gets its light by saying it has the focus.
import { Shader } from "nsh";
import { GLOW } from "./glow.wgsl";
import { alpha, type HeightName, tokens } from "../tokens";

export function Glow(props: {
  /** The height whose light it is: a pane's, at `standard`. */
  height: HeightName;
  /** The tab that stands on the surface's top edge, at its left: its width, and how far it rises. */
  tab?: readonly [width: number, rise: number];
}) {
  const light = () => tokens.height[props.height].glow ?? tokens.height.standard.glow;
  const rise = () => props.tab?.[1] ?? 0;
  return (
    <Shader
      source={GLOW}
      uniforms={{
        first: alpha(tokens.light.focus, light().strength),
        second: alpha(tokens.light.focus2, light().strength),
        title: [props.tab?.[0] ?? 0, rise()],
        reach: light().reach,
        blur: light().blur,
        offset: light().offset,
        single: tokens.mode === "light" ? 1 : 0,
      }}
      style={{
        position: "absolute",
        // Over the surface's border, and its reach beyond.
        left: -1 - light().reach,
        right: -1 - light().reach,
        top: -1 - rise() - light().reach,
        bottom: -1 - light().reach,
        pointerEvents: "none",
      }}
    />
  );
}
