// What a list shows while it has no row: never an empty space. Its title says what is not there,
// its words say why, naming the cause ("No session ran in this repository yet."), and its action,
// when there is one, is the way to the first row.
import { View } from "nsh";
import { Button, Icon, type IconName, Text } from "../controls";

export type EmptyProps = {
  /** The way to the first row: "New session". */
  action?: { label: string; icon?: IconName; keys?: string; run: () => void };
  icon?: IconName;
  testID?: string;
  /** What is not there: "No sessions". */
  title: string;
  /** Why, naming the cause, and what brings one. */
  words?: string;
};

export function Empty(props: EmptyProps) {
  return (
    <View
      style={{ alignItems: "flex-start", gap: 4, paddingHorizontal: 8, paddingVertical: 12 }}
      testID={props.testID}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Icon name={props.icon ?? "square-dashed"} />
        <Text bold tone="quiet">
          {props.title}
        </Text>
      </View>
      <If when={props.words}>{(words) => <Text tone="faint">{words()}</Text>}</If>
      <If when={props.action}>
        {(action) => (
          <View style={{ paddingTop: 8 }}>
            <Button
              icon={action().icon}
              keys={action().keys}
              label={action().label}
              onPress={() => action().run()}
              variant="tube"
            />
          </View>
        )}
      </If>
    </View>
  );
}
