// The inbox's last action, over its notes: what it did, where the note went when it left the
// inbox, and Undo. It stays until another action, or its undo: no dead end, and no question asked
// before an action that Undo takes back.
import { View } from "nsh";
import { navigate } from "../../store";
import { Banner, Button, Text } from "../../ui/controls";
import { lastDone, undoLast, undoRefusal } from "./actions";

export function LastAction(props: { repo: string }) {
  // Read inside, not as the `If`'s value: one action replacing another keeps the banner and its
  // Undo, whose key would be declared twice for a moment if they were made again.
  const done = () => (lastDone()?.repo === props.repo ? lastDone() : null);
  return (
    <If when={done() !== null}>
      <Banner
        action={
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <If when={done()?.went}>
              {(went) => (
                <Button
                  icon="arrow-right"
                  label={went().label}
                  onPress={() => navigate(went().to)}
                />
              )}
            </If>
            <Button icon="undo-2" keys="u" label="Undo" onPress={() => void undoLast()} />
          </View>
        }
        icon="circle-check"
        title={done()?.label ?? ""}
        tone="done"
      >
        <If when={undoRefusal()}>{(words) => <Text tone="danger">{words()}</Text>}</If>
      </Banner>
    </If>
  );
}
