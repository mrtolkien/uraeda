// What moves existing content glides for about 200 ms, eased, never jumps: a reorder, an insert, a
// fold. `glide()` says the next change of the layout glides, and is called just before the change,
// in the same turn. With reduced motion asked for, the change lands at once.
import { LayoutAnimation, reduceMotion } from "nsh";
import { tokens } from "../tokens";

export function glide() {
  if (reduceMotion()) {
    return;
  }
  const duration = tokens.motion.glide;
  LayoutAnimation.configureNext({
    create: { duration, property: "opacity", type: "easeInEaseOut" },
    delete: { duration: tokens.motion.out.duration, property: "opacity", type: "easeIn" },
    duration,
    update: { duration, type: "easeInEaseOut" },
  });
}
