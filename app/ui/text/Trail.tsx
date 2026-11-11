// The caret's trail when it jumps, as the design language's motion asks: drawn over the field,
// from the caret's box before the jump to its box after, closing on the caret in
// `motion.caretTrail`. The field tells a jump only when the caret moved more than one cell with no
// edit, so typing draws none. With reduced motion, or the token off, nothing is drawn.
import { createAnimatedValue, effect, reduceMotion, Shader, untracked } from "nsh";
import type { CaretTrail } from "uraeda/native";
import { tokens } from "../tokens";
import { TRAIL } from "./trail.wgsl";

const WHOLE = {
  bottom: 0,
  left: 0,
  pointerEvents: "none",
  position: "absolute",
  right: 0,
  top: 0,
} as const;

const box = (at: CaretTrail["from"]) => [at.x, at.y, at.width, at.height];

/** Whether a field draws the trail: the token says so, and motion is not reduced. */
export const trails = () => tokens.light.caretTrail && !reduceMotion();

/** The trail of the field's last jump, in the mode's colour: nothing before the first. */
export function Trail(props: { jump: CaretTrail | null; tone: string }) {
  const t = createAnimatedValue(1);
  effect(() => {
    if (props.jump === null) {
      return;
    }
    untracked(() => {
      t.set(0);
      void t.timing(1, { duration: tokens.motion.caretTrail, easing: "linear" });
    });
  });
  return (
    <If when={props.jump}>
      {(jump) => (
        <Shader
          source={TRAIL}
          style={WHOLE}
          uniforms={{ now: box(jump().to), t, tone: props.tone, was: box(jump().from) }}
        />
      )}
    </If>
  );
}
