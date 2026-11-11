// What the shaders of the surfaces share, in WGSL. A `.wgsl` file cannot be imported: Native
// Shell's bundler reads every import as JavaScript, so each shader is a string in a module.

/** A value in 0..1 for the pixel a point is in: the same on every GPU, where `fract(sin())` is not. */
export const HASH = /* wgsl */ `
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
