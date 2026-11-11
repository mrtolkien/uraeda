// The backdrop's shader: it draws once, and reads no clock and nothing behind it.
import { HASH } from "./hash.wgsl";

/** The backdrop: the theme's darkest colour, a still wash of its two accents, and a fine grain. */
export const BACKDROP = /* wgsl */ `
struct Uniforms {
  fill: vec4f,
  wash1: vec4f,
  wash2: vec4f,
  grain: f32,
}
${HASH}

// A wash is full at its heart and gone at 70% of its radius.
fn wash(uv: vec2f, heart: vec2f, radius: vec2f) -> f32 {
  return clamp(1.0 - length((uv - heart) / radius) / 0.7, 0.0, 1.0);
}

fn shade(uv: vec2f) -> vec4f {
  var rgb = uniforms.fill.rgb;
  rgb = mix(rgb, uniforms.wash1.rgb, uniforms.wash1.a * wash(uv, vec2f(0.12, 0.08), vec2f(0.6, 0.55)));
  rgb = mix(rgb, uniforms.wash2.rgb, uniforms.wash2.a * wash(uv, vec2f(0.92, 0.96), vec2f(0.55, 0.6)));
  rgb = mix(rgb, uniforms.wash2.rgb, uniforms.wash2.a * wash(uv, vec2f(0.7, 0.2), vec2f(0.4, 0.35)));
  // The grain also keeps the wash from showing bands.
  rgb += (hash(uv * nsh.size * nsh.scale) - 0.5) * uniforms.grain * 0.2;
  return vec4f(rgb, 1.0);
}`;
