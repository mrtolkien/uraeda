// What a list or a pane shows while it has nothing: never an empty space. Every one says three
// things, in one voice across the app:
//
// - its `title`, what is not here, short, with no full stop: "No sessions yet", "Nothing waits on
//   you", "No setting holds “vim”";
// - its `words`, why, naming the cause, then what brings one, in sentences: "An agent's session
//   starts with its first message.";
// - its `action`, the one thing to do, with its key where it has one: "New session" `S`. A refusal
//   of that action sits under it, in the server's words, never in place of the words above.
import { View } from "nsh";
import { Button, Icon, type IconName, Refusal, Text } from "../controls";

export type EmptyProps = {
  /** The way to the first row: "New session". */
  action?: { label: string; icon?: IconName; keys?: string; run: () => void };
  icon?: IconName;
  /** Why the action was refused, under it: the server's words, and the way out. */
  refusal?: string | null;
  testID?: string;
  /** What is not there, with no full stop: "No sessions yet". */
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
        <Text bold style={{ flexShrink: 1 }} tone="quiet">
          {props.title}
        </Text>
      </View>
      <If when={props.words}>{(words) => <Text tone="faint">{words()}</Text>}</If>
      <If when={props.action}>
        {(action) => (
          <View style={{ gap: 4, paddingTop: 8 }}>
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
      <If when={props.refusal}>{(words) => <Refusal words={words()} />}</If>
    </View>
  );
}
