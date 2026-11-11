// The light of a surface: the focused pane's outline and glow, and a running pane's line. Light
// says "the keys go here", and belongs to edges: text never glows.
import { Animated, cleanup, createAnimatedValue, effect, reduceMotion, signal, View } from "nsh";
import { Glow } from "./Glow";
import { fading } from "./presence";
import { type HeightName, mix, tokens } from "../tokens";

/** The mix of the two lights, where a gradient at 45° puts it on a square box's other corners. */
const mid = () => mix(tokens.light.focus, tokens.light.focus2, 0.5);

/** How long a light takes: no time with reduced motion, where lights switch. */
const over = (duration: number) => ({ duration: reduceMotion() ? 0 : duration });

/**
 * The focused surface's light, over its border: its glow, its fill again over the glow, and its
 * outline as four lines of 1 px, each a gradient along itself. `light.focus` is at the bottom
 * left corner and `light.focus2` at the top right, with their mix at the two others, which is
 * where a gradient at 45° puts them on a square box (ruling R130). It glides: it fades in and out
 * as the focus moves, while the content answers at once.
 */
export function Lit(props: {
  fill: string | undefined;
  height: HeightName;
  lip: string | undefined;
  on: boolean;
  tab?: readonly [width: number, rise: number];
}) {
  const light = fading(
    () => props.on,
    () => tokens.light.glide,
  );
  const line = { position: "absolute", pointerEvents: "none" } as const;
  return (
    <If when={light.shown()}>
      <View style={{ ...line, bottom: 0, left: 0, opacity: light.opacity, right: 0, top: 0 }}>
        <Glow height={props.height} tab={props.tab} />
        <View
          style={{
            ...line,
            backgroundColor: props.fill,
            bottom: -1,
            boxShadow: props.lip,
            left: -1,
            right: -1,
            top: -1,
          }}
        />
        <View
          style={{
            ...line,
            backgroundImage: `linear-gradient(0deg, ${tokens.light.focus}, ${mid()})`,
            bottom: -1,
            left: -1,
            top: -1,
            width: 1,
          }}
        />
        <View
          style={{
            ...line,
            backgroundImage: `linear-gradient(90deg, ${mid()}, ${tokens.light.focus2})`,
            height: 1,
            left: -1,
            right: -1,
            top: -1,
          }}
        />
        <View
          style={{
            ...line,
            backgroundImage: `linear-gradient(0deg, ${mid()}, ${tokens.light.focus2})`,
            bottom: -1,
            right: -1,
            top: -1,
            width: 1,
          }}
        />
        <View
          style={{
            ...line,
            backgroundImage: `linear-gradient(90deg, ${tokens.light.focus}, ${mid()})`,
            bottom: -1,
            height: 1,
            left: -1,
            right: -1,
          }}
        />
      </View>
    </If>
  );
}

/**
 * A running surface's line: its top edge in `light.running`, with a short glow, steady. It moves
 * only as the run's state changes: a run starting draws it from left to right, and a run ending
 * turns it green, then fades it. A line that is there as its surface appears does not move.
 */
export function RunLine(props: { on: boolean }) {
  const shown = signal(props.on);
  const ended = signal(false);
  const drawn = createAnimatedValue(1);
  const opacity = createAnimatedValue(1);
  let was = props.on;
  effect(() => {
    const now = props.on;
    if (now === was) {
      return;
    }
    was = now;
    if (now) {
      ended.set(false);
      shown.set(true);
      opacity.set(1);
      drawn.set(0);
      void drawn.timing(1, over(tokens.motion.runDraw));
    } else {
      ended.set(true);
      drawn.set(1);
      void opacity.timing(0, over(tokens.motion.runFade)).then(({ finished }) => {
        if (finished) {
          shown.set(false);
        }
      });
    }
  });
  // A line that breathes goes between full and half strength, for as long as the run.
  const breath = createAnimatedValue(1);
  if (tokens.light.runningMotion === "breathe") {
    const half = tokens.motion.breath / 2;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { duration: half, toValue: 0.5 }),
        Animated.timing(breath, { duration: half, toValue: 1 }),
      ]),
    );
    effect(() => {
      if (shown() && !ended() && !reduceMotion()) {
        void loop.start();
      } else {
        loop.stop();
        breath.set(1);
      }
    });
  }
  cleanup(() => {
    void drawn.stop();
    void opacity.stop();
  });
  return (
    <If when={shown() && tokens.light.runningMotion !== "off"}>
      <View
        style={{
          left: -1,
          opacity: Animated.multiply(opacity, breath),
          pointerEvents: "none",
          position: "absolute",
          right: -1,
          top: -1,
        }}
      >
        <View
          style={{
            backgroundColor: ended() ? tokens.role.added : tokens.light.running,
            boxShadow: ended() ? undefined : tokens.light.runningGlow,
            height: tokens.light.runningWidth,
            transform: [{ scaleX: drawn }],
            transformOrigin: "left",
          }}
        />
      </View>
    </If>
  );
}
