// A status: a small square in its tone, and the words that say it. The words are never left out
// where the status matters: a colour alone says nothing to who cannot tell it.
import { View } from "nsh";
import { Text } from "./Text";
import { type Tone, tokens } from "../tokens";

export type StatusDotProps = {
  /** What the status is, in words: "Running", "Waits on you". */
  label?: string;
  testID?: string;
  tone: Tone;
};

export function StatusDot(props: StatusDotProps) {
  return (
    <View
      accessibilityLabel={props.label}
      style={{ alignItems: "center", flexDirection: "row", gap: 6 }}
      testID={props.testID}
    >
      <View
        style={{
          backgroundColor: tokens.control.tone(props.tone),
          flexShrink: 0,
          height: tokens.control.status,
          width: tokens.control.status,
        }}
      />
      <If when={props.label}>{(label) => <Text tone="quiet">{label()}</Text>}</If>
    </View>
  );
}
