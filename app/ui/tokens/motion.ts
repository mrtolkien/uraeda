// Motion means a change of state: in slowing down, out speeding up, and nothing moves on its own
// but a view's one main action.

export const motion = {
  in: { duration: 180, curve: [0.05, 0.7, 0.1, 1] as const },
  out: { duration: 120, curve: [0.3, 0, 0.8, 0.15] as const },
  /** How far an overlay rises as it fades in. */
  rise: 8,
  /** How long a pressed button takes to come back. */
  press: 90,
  /** A breath of the main action, and of a running line that breathes. */
  breath: 6000,
  /** A run starting draws its line, and a run ending fades it. */
  runDraw: 700,
  runFade: 1200,
  caretTrail: 480,
  /** What moves existing content glides. */
  glide: 200,
};
