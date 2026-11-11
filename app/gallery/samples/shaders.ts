// The three shaders of the samples, in WGSL. GTK draws no backdrop blur, so glass is a shader that
// reads what is behind its box. The backdrop's wash and grain, and the focused pane's glow, are
// shaders that draw once: they read no clock and nothing behind them.

/** A value in 0..1 for the pixel a point is in: the same on every GPU, where `fract(sin())` is not. */
const HASH = /* wgsl */ `
fn scramble(value: u32) -> u32 {
  var h = value;
  h ^= h >> 16u;
  h *= 0x7feb352du;
  h ^= h >> 15u;
  h *= 0x846ca68bu;
  h ^= h >> 16u;
  return h;
}

fn hash(p: vec2f) -> f32 {
  let cell = bitcast<vec2u>(vec2i(floor(p)));
  return f32(scramble(scramble(cell.x) ^ cell.y)) / 4294967295.0;
}`;

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

/**
 * Glass: what is behind the box, frosted, tinted, and bent at the edge.
 *
 * The frost is one pass of 64 taps on a spiral, turned by a different angle at each pixel: the
 * backdrop comes as one picture at full size, with no smaller copy to blur from, so the taps are
 * apart, and the turn makes their gaps a fine dither in place of ghosts of the text behind.
 */
export const GLASS = /* wgsl */ `
struct Uniforms {
  tint: vec4f,
  rim: vec4f,
  edge: vec4f,
  shadow: vec4f,
  frost: f32,
  edge_frost: f32,
  saturate: f32,
  brightness: f32,
  band: f32,
  pull: f32,
  fringe: f32,
  rim_between: f32,
  thicken: f32,
  line: f32,
  sheen: f32,
  glow: f32,
  grain: f32,
  light: f32,
}
${HASH}

const TAPS: i32 = 64;
const LUMA: vec3f = vec3f(0.2126, 0.7152, 0.0722);

// A turn for the pixel a point is in, which differs from its neighbours' as evenly as a dither's.
fn turn(p: vec2f) -> f32 {
  return fract(52.9829189 * fract(dot(floor(p), vec2f(0.06711056, 0.00583715)))) * 6.2831853;
}

fn behind(at: vec2f) -> vec3f {
  return sample_backdrop(clamp(at / nsh.size, vec2f(0.001), vec2f(0.999))).rgb;
}

// The backdrop around three points, one per colour, blurred by \`sigma\` points.
fn frost(red: vec2f, green: vec2f, blue: vec2f, sigma: f32, spin: f32) -> vec3f {
  let reach = sigma * 2.5;
  var sum = vec3f(0.0);
  var weight = 0.0;
  for (var i = 0; i < TAPS; i++) {
    let radius = sqrt((f32(i) + 0.5) / f32(TAPS)) * reach;
    let angle = f32(i) * 2.39996323 + spin;
    let offset = vec2f(cos(angle), sin(angle)) * radius;
    let w = exp(-0.5 * radius * radius / (sigma * sigma));
    sum += vec3f(behind(red + offset).r, behind(green + offset).g, behind(blue + offset).b) * w;
    weight += w;
  }
  return sum / weight;
}

fn shade(uv: vec2f) -> vec4f {
  let size = nsh.size;
  let p = uv * size;
  let half = size * 0.5;
  let q = p - half;

  // The bent band. Its direction comes from a box with rounded corners, twice the band wide, so
  // the lens does not tear along a corner's diagonal; the shape stays square.
  let band = min(uniforms.band, min(size.x, size.y) / 3.0);
  let corner = min(band * 2.0, min(half.x, half.y));
  let w = abs(q) - (half - vec2f(corner));
  let depth = corner - length(max(w, vec2f(0.0))) - min(max(w.x, w.y), 0.0);
  var outward = vec2f(0.0, sign(q.y));
  if (w.x > 0.0 && w.y > 0.0) {
    outward = normalize(w) * sign(q);
  } else if (w.x > w.y) {
    outward = vec2f(sign(q.x), 0.0);
  }
  let near = clamp(1.0 - depth / band, 0.0, 1.0);
  let bend = near * near * uniforms.pull * band;

  // The edge is sharper than the middle, and its colours part.
  let sigma = max(uniforms.frost * mix(1.0, uniforms.edge_frost, near), 0.5);
  let spin = turn(p * nsh.scale);
  let inward = -outward * bend;
  var rgb = frost(p + inward, p + inward * (1.0 - uniforms.fringe), p + inward * (1.0 - 2.0 * uniforms.fringe), sigma, spin);

  // Colour survives the tint.
  rgb = clamp(mix(vec3f(dot(rgb, LUMA)), rgb, uniforms.saturate) * uniforms.brightness, vec3f(0.0), vec3f(1.0));
  // The tint thickens where the backdrop is far from it: bright in a dark theme, dark in a light one.
  let luma = dot(rgb, LUMA);
  let far = mix(luma, 1.0 - luma, uniforms.light);
  let strength = clamp(uniforms.tint.a + uniforms.thicken * smoothstep(0.04, 0.5, far), 0.0, 1.0);
  rgb = mix(rgb, uniforms.tint.rgb, strength);

  // Light inside: a sheen from the top, a glow from every edge, a line under the top edge, and a
  // shade above the bottom edge.
  rgb = mix(rgb, vec3f(1.0), uniforms.sheen * clamp(1.0 - uv.y / 0.46, 0.0, 1.0));
  let edge = min(min(p.x, size.x - p.x), min(p.y, size.y - p.y));
  rgb = mix(rgb, vec3f(1.0), uniforms.glow * smoothstep(30.0, 0.0, edge));
  let top = step(1.0, p.y) * step(p.y, 2.0);
  rgb = mix(rgb, vec3f(1.0), uniforms.line * top);
  rgb = mix(rgb, uniforms.shadow.rgb, uniforms.shadow.a * smoothstep(9.0, 0.0, size.y - p.y) * 0.6);
  // The grain is an overlay: it lightens and darkens by a share of what is there, so it stays
  // fine on dark glass, and a blur never shows bands.
  rgb *= 1.0 + (hash(p * nsh.scale + vec2f(71.0, 13.0)) - 0.5) * 2.0 * uniforms.grain;

  // The rim: 1 px, bright at the top left and bottom right corners, dim between. Its brightness
  // comes from where the point is on the box, not from its edge's direction.
  if (edge < 1.0) {
    let along = (uv.x + uv.y) * 0.5;
    var lit = uniforms.rim_between;
    if (along < 0.26) {
      lit = mix(uniforms.rim.a, uniforms.rim_between, along / 0.26);
    } else if (along > 0.64) {
      lit = mix(uniforms.rim_between, uniforms.rim.a * 0.65, (along - 0.64) / 0.36);
    }
    rgb = mix(mix(rgb, uniforms.edge.rgb, uniforms.edge.a), uniforms.rim.rgb, lit);
  }
  return vec4f(rgb, 1.0);
}`;

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
