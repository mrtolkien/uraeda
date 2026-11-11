// The points an agent settled without the human, under each its comments, and a comment of the
// human's: "Check these" before the questions, the rest at the round's end. A feature's round
// takes comments on its points (`settled.comment`), each saved with its button or Ctrl+Enter and
// kept on the device until then; a round of the default branch reads them only.
import { signal, View } from "nsh";
import type { Block, FileView, RoundItems } from "../../store/protocol";
import { Button, Text } from "../../ui/controls";
import { TextField, unsavedText } from "../../ui/text";
import { fieldKey, type RoundArgs, type Saves, settledField, targetOf } from "./saves";

/** Which point's field is open, by round: one at a time. */
const opened = signal<Readonly<Record<string, string | null>>>({});

function Comment(props: { args: RoundArgs; path: string; saves: Saves; subject: string }) {
  const text = unsavedText(fieldKey(props.args, props.path, settledField(props.subject)), () => "");
  const refusal = signal<string | null>(null);
  const pending = signal(false);
  const close = () => opened.update((all) => ({ ...all, [props.args.id]: null }));
  const save = async () => {
    const words = text.text().trim();
    if (words === "" || pending()) return;
    pending.set(true);
    refusal.set(null);
    try {
      await props.saves.settled(props.subject, words);
      text.discard();
      close();
    } catch (error) {
      refusal.set(`Not saved: ${(error as Error).message} Your text stays on this device.`);
    }
    pending.set(false);
  };
  return (
    <View style={{ gap: 6, paddingTop: 6 }}>
      <TextField
        autoFocus
        label={`Your comment on “${props.subject}”`}
        onChange={text.change}
        onSave={() => void save()}
        placeholder="What the agent should change or keep in mind"
        refusal={refusal()}
        rows={{ max: 8, min: 2 }}
        value={text.text()}
      />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          icon="check"
          label="Save the comment"
          onPress={() => void save()}
          pending={pending()}
        />
        <Button label="Close" onPress={close} />
      </View>
    </View>
  );
}

/**
 * The mark under a block of a round's settled points: a point's comments, and its field, or the
 * press that opens it. Called once per block: what it draws reads the record as it changes.
 */
export function settledMark(props: {
  args: RoundArgs;
  file: () => FileView;
  round: () => RoundItems | null;
  saves: Saves;
}) {
  const takes = () =>
    targetOf(props.args).kind === "feature" && props.file().status === "awaiting-human";
  return (block: Block) => {
    const point = () => props.round()?.settledPoints.find((one) => one.block === block.id);
    if (props.round()?.settledPoints.every((one) => one.block !== block.id) !== false) {
      return undefined;
    }
    const comments = () =>
      props.round()?.settledComments.filter((one) => one.point === block.id) ?? [];
    const open = () => opened()[props.args.id] === point()?.subject;
    return (
      <View style={{ gap: 4, paddingLeft: 4, paddingTop: 4 }}>
        <Each of={comments()}>
          {(comment) => <Text tone="info">{`Your comment: ${comment().text}`}</Text>}
        </Each>
        <If when={takes() ? point() : undefined}>
          {(shown) => (
            <If
              when={open()}
              else={
                <View style={{ alignItems: "flex-start" }}>
                  <Button
                    icon="message-square"
                    label="Comment on this point"
                    onPress={() =>
                      opened.update((all) => ({ ...all, [props.args.id]: shown().subject }))
                    }
                  />
                </View>
              }
            >
              <Comment
                args={props.args}
                path={props.file().path}
                saves={props.saves}
                subject={shown().subject}
              />
            </If>
          )}
        </If>
      </View>
    );
  };
}
