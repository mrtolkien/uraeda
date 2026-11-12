// The points an agent settled without the human, under each its comments, and a comment of the
// human's: "Check these" before the questions, the rest at the round's end. A feature's round
// takes comments on its points (`settled.comment`), each saved with its button or Ctrl+Enter and
// kept on the device until then; a round of the default branch reads them only. By keys, `J` and
// `K` move a cursor from point to point, and the point at the cursor takes `Enter` to comment and
// `s` to ask the agent, its keys shown on its buttons.
import { signal, untracked, View, type ViewRef } from "nsh";
import type {
  Block,
  Document as Tree,
  FileView,
  RoundItems,
  SettledComment,
  SettledGroup,
} from "../../store/protocol";
import { Button, Refusal, Text } from "../../ui/controls";
import { registerKey } from "../../ui/keys";
import { RevealContext } from "../../ui/layout/here";
import { Bar } from "../../ui/lists";
import { TextField, unsavedText } from "../../ui/text";
import { type Ask, quoted } from "../session";
import { askOf, fieldKey, type RoundArgs, type Saves, settledField, targetOf } from "./saves";

/** The quote of a settled point, as the agent is asked about it. */
const pointQuote = (path: string, subject: string) =>
  quoted(`About the settled point of ${path}:`, [subject]);

/** Which point's field is open, by round: one at a time. */
const opened = signal<Readonly<Record<string, string | null>>>({});

/** The point at the keys' cursor, by round: its list item's block. */
const cursors = signal<Readonly<Record<string, number | null>>>({});

/** The blocks of the points in the groups `kept` keeps, in the file's order. */
export function pointsIn(
  round: RoundItems,
  document: Tree,
  kept: (group: SettledGroup) => boolean,
): ReadonlyArray<number> {
  const tops = new Set(round.settledGroups.filter(kept).flatMap((group) => group.blocks));
  const topOf = (id: number) => {
    let block = document.blocks[id];
    while (block !== undefined && block.parent !== null) block = document.blocks[block.parent];
    return block?.id;
  };
  return round.settledPoints
    .map((point) => point.block)
    .filter((block) => tops.has(topOf(block) ?? -1));
}

/** `J` and `K` move the cursor among `points`, those the part of the round shown draws. */
export function settledCursor(args: RoundArgs, points: () => ReadonlyArray<number>) {
  const move = (by: number) => {
    const all = points();
    if (all.length === 0) return false;
    const index = all.indexOf(untracked(cursors)[args.id] ?? -1);
    const next =
      index === -1
        ? by > 0
          ? all[0]
          : all.at(-1)
        : all[Math.max(0, Math.min(all.length - 1, index + by))];
    cursors.update((held) => ({ ...held, [args.id]: next ?? null }));
    return undefined;
  };
  // A round of the default branch takes no comment on its points: nothing to move to.
  const when = () => targetOf(args).kind === "feature";
  registerKey([
    {
      hint: "J K",
      hintLabel: "point",
      keys: "J",
      label: "Next settled point",
      run: () => move(1),
      when,
    },
    { keys: "K", label: "Previous settled point", run: () => move(-1), when },
  ]);
}

function Comment(props: {
  args: RoundArgs;
  ask: Ask | undefined;
  path: string;
  saves: Saves;
  subject: string;
}) {
  const text = unsavedText(fieldKey(props.args, props.path, settledField(props.subject)), () => "");
  const refusal = signal<string | null>(null);
  const close = () => opened.update((all) => ({ ...all, [props.args.id]: null }));
  const save = async () => {
    if (text.text().trim() === "" || text.pending()) return;
    refusal.set(null);
    const { saves, subject } = props;
    // The comment leaves its field as it is saved, which closes unless more was typed meanwhile.
    const done = await text.send((typed) => saves.settled(subject, typed.trim()));
    if (done.ok) {
      if (!text.dirty()) close();
    } else if (done.why !== null) {
      refusal.set(`Not saved: ${done.why} Your text stays on this device.`);
    }
  };
  // It opens whole in view, its buttons too, never under the status line at the pane's foot.
  const reveal = RevealContext();
  const shown = (view: ViewRef) => {
    if (reveal !== null) queueMicrotask(() => reveal(view));
  };
  return (
    <View ref={shown} style={{ gap: 6, paddingTop: 6 }}>
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
          pending={text.pending()}
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
  const save = async () => {
    if (pending() || text.pending()) return;
    // Saved blank, the comment goes: nothing typed is dropped with it.
    if (text.text().trim() === "") {
      text.discard();
      editing.set(false);
      remove();
      return;
    }
    refusal.set(null);
    const { comment, saves } = props;
    const saved = await text.save((typed) => saves.reword(comment, typed.trim()));
    if (!saved.ok) {
      refusal.set(`Not saved: your text stays on this device. ${saved.why}`);
    } else if (!text.dirty()) {
      // What was typed while it was saved keeps the field open.
      editing.set(false);
    }
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
          onSave={() => void save()}
          rows={{ max: 8, min: 2 }}
          testID="settled-edit"
          value={text.text()}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            icon="check"
            label="Save the change"
            onPress={() => void save()}
            pending={pending() || text.pending()}
          />
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
    const here = () => cursors()[props.args.id] === block.id;
    return (
      <View style={{ gap: 4, paddingLeft: 8, paddingTop: 4 }}>
        <If when={here()}>
          <View style={{ bottom: 0, left: 0, position: "absolute", top: 0, width: 2 }}>
            <Bar />
          </View>
        </If>
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
                <PointButtons
                  ask={asks()}
                  here={here()}
                  onAsk={() => asks()?.(pointQuote(props.file().path, shown().subject))}
                  onComment={() =>
                    opened.update((all) => ({ ...all, [props.args.id]: shown().subject }))
                  }
                />
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

/**
 * A point's two buttons: at the cursor, with their keys, declared while it holds the cursor alone,
 * so no two points bind the same key.
 */
function PointButtons(props: {
  ask: Ask | undefined;
  here: boolean;
  onAsk: () => void;
  onComment: () => void;
}) {
  const buttons = (keyed: boolean) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Button
        icon="message-square"
        keys={keyed ? "Enter" : undefined}
        label="Comment on this point"
        onPress={props.onComment}
      />
      <If when={props.ask}>
        <Button
          icon="message-circle-question"
          keys={keyed ? "s" : undefined}
          label="Ask the agent"
          onPress={props.onAsk}
        />
      </If>
    </View>
  );
  return (
    <If when={props.here} else={buttons(false)}>
      {buttons(true)}
    </If>
  );
}
