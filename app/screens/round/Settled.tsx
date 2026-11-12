// The points an agent settled without the human, under each its comments, and a comment of the
// human's: "Check these" before the questions, the rest at the round's end. A feature's round
// takes comments on its points (`settled.comment`), each saved with its button or Ctrl+Enter and
// kept on the device until then; a round of the default branch reads them only.
import { signal, View } from "nsh";
import type { Block, FileView, RoundItems, SettledComment } from "../../store/protocol";
import { Button, Refusal, Text } from "../../ui/controls";
import { TextField, unsavedText } from "../../ui/text";
import { type Ask, quoted } from "../session";
import { askOf, fieldKey, type RoundArgs, type Saves, settledField, targetOf } from "./saves";

/** The quote of a settled point, as the agent is asked about it. */
const pointQuote = (path: string, subject: string) =>
  quoted(`About the settled point of ${path}:`, [subject]);

/** Which point's field is open, by round: one at a time. */
const opened = signal<Readonly<Record<string, string | null>>>({});

function Comment(props: {
  args: RoundArgs;
  ask: Ask | undefined;
  path: string;
  saves: Saves;
  subject: string;
}) {
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
        testID="settled-comment"
        value={text.text()}
      />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          icon="check"
          label="Save the comment"
          onPress={() => void save()}
          pending={pending()}
        />
        <If when={props.ask}>
          {(ask) => (
            // The comment's words go to the agent instead, with the point, unsent until sent there.
            <Button
              icon="message-circle-question"
              label="Ask the agent instead"
              onPress={() => {
                ask()(pointQuote(props.path, props.subject), text.text());
                text.discard();
                close();
              }}
            />
          )}
        </If>
        <Button label="Close" onPress={close} />
      </View>
    </View>
  );
}

/**
 * A comment of the human's on a point, with its edit and its removal where the round takes
 * comments. Its edit is in place, its text kept on the device until saved; saved blank, it goes.
 */
function Given(props: {
  args: RoundArgs;
  comment: SettledComment;
  path: string;
  saves: Saves;
  takes: boolean;
}) {
  const refusal = signal<string | null>(null);
  const pending = signal(false);
  const editing = signal(false);
  const key = fieldKey(props.args, props.path, `settled-edit:${props.comment.number}`);
  const text = unsavedText(key, () => props.comment.text);
  const done = (words: string) => (error: Error) => {
    pending.set(false);
    refusal.set(`${words} ${error.message}`);
  };
  const remove = () => {
    pending.set(true);
    refusal.set(null);
    props.saves.unsettle(props.comment).then(() => pending.set(false), done("Not removed:"));
  };
  const save = () => {
    const words = text.text().trim();
    if (pending()) return;
    if (words === "") {
      text.discard();
      editing.set(false);
      remove();
      return;
    }
    pending.set(true);
    refusal.set(null);
    props.saves.reword(props.comment, words).then(() => {
      pending.set(false);
      text.discard();
      editing.set(false);
    }, done("Not saved: your text stays on this device."));
  };
  return (
    <View style={{ gap: 4 }}>
      <If
        when={editing()}
        else={
          <View
            style={{ alignItems: "center", columnGap: 8, flexDirection: "row", flexWrap: "wrap" }}
          >
            <Text
              style={{ flexShrink: 1 }}
              tone="info"
            >{`Your comment: ${props.comment.text}`}</Text>
            <If when={props.takes}>
              <Button icon="pencil-line" label="Edit" onPress={() => editing.set(true)} />
              <Button icon="trash-2" label="Remove" onPress={remove} pending={pending()} />
            </If>
          </View>
        }
      >
        <TextField
          autoFocus
          label={`Your comment on “${props.comment.subject}”`}
          onChange={text.change}
          onQuit={() => editing.set(false)}
          onSave={save}
          rows={{ max: 8, min: 2 }}
          testID="settled-edit"
          value={text.text()}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button icon="check" label="Save the change" onPress={save} pending={pending()} />
          <Button label="Cancel" onPress={() => editing.set(false)} />
        </View>
      </If>
      <If when={refusal()}>{(words) => <Refusal words={words()} />}</If>
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
  const asks = askOf(props.args);
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
        <Each
          key={(comment: SettledComment) => `${comment.number}:${comment.text}`}
          of={comments()}
        >
          {(comment) => (
            <Given
              args={props.args}
              comment={comment()}
              path={props.file().path}
              saves={props.saves}
              takes={takes()}
            />
          )}
        </Each>
        <If when={takes() ? point() : undefined}>
          {(shown) => (
            <If
              when={open()}
              else={
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Button
                    icon="message-square"
                    label="Comment on this point"
                    onPress={() =>
                      opened.update((all) => ({ ...all, [props.args.id]: shown().subject }))
                    }
                  />
                  <If when={asks()}>
                    {(ask) => (
                      <Button
                        icon="message-circle-question"
                        label="Ask the agent"
                        onPress={() => ask()(pointQuote(props.file().path, shown().subject))}
                      />
                    )}
                  </If>
                </View>
              }
            >
              <Comment
                args={props.args}
                ask={asks()}
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
