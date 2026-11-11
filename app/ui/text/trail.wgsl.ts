// The caret's trail: a thin wedge of the mode's colour from where the caret was to where it is,
// which closes on the caret as `t` goes from 0 to 1. Its tail runs after its head, so the wedge
// shortens toward the caret, and it fades as it closes: a hint of motion, never a smear.

export const TRAIL = /* wgsl */ `
struct Uniforms {
  from: vec4f,
  to: vec4f,
  tone: vec4f,
  t: f32,
}

fn shade(uv: vec2f) -> vec4f {
  let p = uv * nsh.size;
  let head = uniforms.to.xy + uniforms.to.zw * 0.5;
  let start = uniforms.from.xy + uniforms.from.zw * 0.5;
  let eased = 1.0 - pow(1.0 - uniforms.t, 3.0);
  let tail = mix(start, head, eased);
  let along = head - tail;
  let length2 = max(dot(along, along), 0.0001);
  let s = clamp(dot(p - tail, along) / length2, 0.0, 1.0);
  // Thin at the tail, the caret's half height at the head.
  let half = mix(0.5, max(uniforms.to.w * 0.5, 1.0), s);
  let away = distance(p, tail + along * s) - half;
  let edge = 1.0 - smoothstep(-0.75, 0.75, away);
  let alpha = edge * (0.15 + 0.45 * s) * (1.0 - uniforms.t);
  return vec4f(uniforms.tone.rgb, uniforms.tone.a * alpha);
}`;
