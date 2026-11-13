// The light a focused pane emits, as a shader that draws once: it reads no clock and nothing
// behind it.

/**
 * The glow of the focused pane: two lights, one from each end of its outline, which follow the
 * pane's whole shape, its title included. The view is the pane's box and its title's rise, grown
 * by `reach` on every side.
 *
 * As a `filter: drop-shadow()` of the pane, GTK drew the same picture, and blurred the whole pane
 * again on some frames of a scroll: up to 4.5 ms more. This one is drawn once.
 */
export const GLOW = /* wgsl */ `
struct Uniforms {
  first: vec4f,
  second: vec4f,
  title: vec2f,
  reach: f32,
  blur: f32,
  offset: f32,
  single: f32,
}

fn box(p: vec2f, low: vec2f, high: vec2f) -> f32 {
  let q = abs(p - (low + high) * 0.5) - (high - low) * 0.5;
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0);
}

// How far a point is outside the pane's shape: its title's tab, and its body under it.
fn outside(p: vec2f) -> f32 {
  let size = nsh.size - vec2f(2.0 * uniforms.reach);
  let tab = box(p, vec2f(0.0), uniforms.title);
  let body = box(p, vec2f(0.0, uniforms.title.y), size);
  return min(tab, body);
}

// The share of a light left at a distance: a shadow's edge, blurred.
fn light(distance: f32) -> f32 {
  return 0.5 * (1.0 - tanh(1.7 * distance / max(uniforms.blur, 0.01)));
}

fn shade(uv: vec2f) -> vec4f {
  let p = uv * nsh.size - vec2f(uniforms.reach);
  let step = vec2f(-uniforms.offset, uniforms.offset);
  let a = uniforms.first.a * light(outside(p - step * mix(1.0, 0.0, uniforms.single) - vec2f(0.0, uniforms.offset) * uniforms.single));
  let b = uniforms.second.a * light(outside(p + step)) * (1.0 - uniforms.single);
  let alpha = a + b - a * b;
  let rgb = (uniforms.first.rgb * a + uniforms.second.rgb * b) / max(a + b, 0.0001);
  // It fades out before the view's edge, so the view's box never shows.
  let edge = min(min(uv.x, 1.0 - uv.x) * nsh.size.x, min(uv.y, 1.0 - uv.y) * nsh.size.y);
  return vec4f(rgb, alpha * smoothstep(0.0, 6.0, edge));
}`;
