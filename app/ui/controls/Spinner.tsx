// Something is under way: a terminal's braille spinner, with the words that say what. A spinner
// is never alone where it is the only thing shown: its `label` names what it waits for, "Loading
// the plan…", and the screen says the cause when it ends otherwise. With reduced motion it is
// still, an ellipsis.
import { cleanup, reduceMotion, signal, View } from "nsh";
import { type Ink, Text } from "./Text";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
/** How long each frame shows, in milliseconds. */
const FRAME = 80;

export type SpinnerProps = {
  /** What it waits for. Without it, the spinner sits beside words that say so: a button's. */
  label?: string;
  testID?: string;
  tone?: Ink;
};

export function Spinner(props: SpinnerProps) {
  const at = signal(0);
  const timer = setInterval(() => at.update((n) => (n + 1) % FRAMES.length), FRAME);
  cleanup(() => clearInterval(timer));
  return (
    <View
      accessibilityLabel={props.label ?? "Working"}
      style={{ alignItems: "center", flexDirection: "row", gap: 8 }}
      testID={props.testID}
    >
      <Text tone={props.tone ?? "accent"}>{reduceMotion() ? "⋯" : FRAMES[at()]}</Text>
      <If when={props.label}>
        {(label) => <Text tone={props.tone === undefined ? "quiet" : props.tone}>{label()}</Text>}
      </If>
    </View>
  );
}
