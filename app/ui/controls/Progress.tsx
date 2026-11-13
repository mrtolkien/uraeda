// How far something is: its words and its share, over a thin bar in the accent. A share known;
// what has none is a `Spinner` with its words.
import { View } from "nsh";
import { Progress as Base } from "nsh/base";
import { Text } from "./Text";
import { tokens } from "../tokens";

export type ProgressProps = {
  /** What progresses: "Importing sessions". */
  label: string;
  /** What is done, from 0 to 1. */
  value: number;
  /** In place of the share: "12 of 40". */
  words?: string;
  testID?: string;
};

export function Progress(props: ProgressProps) {
  const share = () => Math.min(1, Math.max(0, props.value));
  return (
    <View style={{ gap: 4 }} testID={props.testID}>
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
        <Text lines={1} style={{ flexShrink: 1 }} tone="quiet">
          {props.label}
        </Text>
        <Text tone="ink">{props.words ?? `${Math.round(share() * 100)}%`}</Text>
      </View>
      <Base
        accessibilityLabel={props.label}
        indicatorStyle={{
          backgroundColor: tokens.role.action,
          height: "100%",
          transitionDuration: tokens.motion.glide,
          transitionProperty: "width",
        }}
        trackStyle={{
          backgroundColor: tokens.control.well,
          borderColor: tokens.control.edge,
          borderWidth: 1,
          height: 6,
        }}
        value={share() * 100}
      />
    </View>
  );
}
