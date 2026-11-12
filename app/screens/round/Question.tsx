// One question of a round, with everything needed to answer it in view: its context drawn by the
// document renderer, an example, why it matters, its options as cards with their pros and cons,
// the recommended one marked and why, and a comment. A letter's key picks that option alone and
// goes on; a press on a card toggles it, for an answer of several letters, and stays. The pick
// shows at once and is saved in its turn; the comment is kept on the device as it is typed and
// saved after a pause, as the field leaves, or with Ctrl+Enter. Nothing is submitted here.
import { cleanup, type JSX, signal, untracked, View } from "nsh";
import type { Choice, FileView, QuestionItem } from "../../store/protocol";
import { Button, Heading, Kbd, Refusal, sent, Text } from "../../ui/controls";
import { Document, type DocumentHands, Phrase } from "../../ui/document";
import { TextField, type TextFieldRef, unsavedText } from "../../ui/text";
import { isNarrow } from "../../ui/width";
import { tokens } from "../../ui/tokens";
import { Option } from "./Option";
import { quoted } from "../session";
import { askOf, fieldKey, type RoundArgs, type Saves } from "./saves";
import { lead } from "./words";

/** The letters a key picks, `a` to `f`: `g` starts a sequence, so an option G is pressed. */
export const LETTERS = ["a", "b", "c", "d", "e", "f"] as const;

/** How long typing rests before the comment is saved. */
const PAUSE = 1200;

/** What a screen adds under an option of a question, as the decisions check its candidates. */
export type OptionExtra = (question: QuestionItem, choice: Choice) => JSX.Element | undefined;

/** What the round's keys do to the question shown: set by the question as it is drawn. */
export type QuestionHands = {
  ask?: () => false | undefined;
  comment?: () => void;
  pick?: (key: string) => false | undefined;
};

export type QuestionProps = {
  args: RoundArgs;
  file: () => FileView;
  hands: QuestionHands;
  /** How the document's links, images, and embeds go. */
  links: DocumentHands;
  onNext: () => void;
  /** What the screen adds under an option. */
  optionExtra?: OptionExtra;
  question: () => QuestionItem;
  /** Where the question stands among those asked: "Question 3 of 12". */
  place: string;
  saves: Saves;
};

const sorted = (letters: ReadonlyArray<string>) => letters.toSorted();

export function Question(props: QuestionProps) {
  const q = props.question;
  const document = () => props.file().current.document;
  const comment = unsavedText(fieldKey(props.args, props.file().path, q().id), () => q().comment);
  const commentRefusal = signal<string | null>(null);
  const letters = sent<ReadonlyArray<string>>(
    () => q().letters,
    (next) => props.saves.answer(q(), { comment: comment.text(), letters: next }),
  );
  let field: TextFieldRef | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const saveComment = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (!untracked(comment.dirty)) return;
    commentRefusal.set(null);
    const [question, picked] = [untracked(q), untracked(letters.value)];
    void comment
      .save((text) => props.saves.answer(question, { comment: text, letters: picked }))
      .then((done) => {
        if (!done.ok) {
          commentRefusal.set(`Not saved: ${done.why} Your text stays on this device.`);
        }
      });
  };
  // Leaving the question saves what was typed: it is on the device until it is in the file.
  cleanup(saveComment);

  const pick = (letter: string, next: boolean) => {
    letters.set([letter]);
    if (next) props.onNext();
  };
  const toggle = (letter: string) => {
    const now = letters.value();
    letters.set(
      now.includes(letter) ? now.filter((one) => one !== letter) : sorted([...now, letter]),
    );
  };
  const keyed = () =>
    q().options.filter((option) =>
      (LETTERS as ReadonlyArray<string>).includes(option.letter.toLowerCase()),
    );
  props.hands.pick = (key) => {
    const option = keyed().find((one) => one.letter.toLowerCase() === key);
    if (option === undefined) return false;
    pick(option.letter, true);
    return undefined;
  };
  props.hands.comment = () => field?.focus();
  // The agent's view on this question, in the feature's session beside the round.
  const asks = askOf(props.args);
  const ask = () => {
    const to = asks();
    if (to === undefined) return false;
    to(quoted(`About ${q().id} of ${props.file().path}:`, [q().title]));
    return undefined;
  };
  props.hands.ask = ask;

  return (
    <View style={{ gap: 14, maxWidth: tokens.type.measure * tokens.type.prose }}>
      <View style={{ gap: 4 }}>
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Text style={{ flex: 1 }} tone="faint">
            {props.place}
          </Text>
          <If when={asks() !== undefined}>
            <Button
              icon="message-circle-question"
              label="Ask the agent"
              onPress={() => void ask()}
              testID="ask-question"
            />
          </If>
        </View>
        <Heading level={2}>{`${q().id}: ${q().title}`}</Heading>
        <If when={q().parentLetter}>
          {(letter) => (
            <Text tone="quiet">{`A follow-up: it applies because ${q().parent} is answered ${letter()}.`}</Text>
          )}
        </If>
      </View>
      <If when={q().context.length > 0}>
        <Document
          align="start"
          document={document()}
          ids={q().context}
          image={props.links.image}
          onLink={props.links.onLink}
          override={props.links.override}
        />
      </If>
      <If when={q().exampleText.length > 0}>
        <Phrase spans={[lead("Example: "), ...q().exampleText]} />
      </If>
      <If when={q().whyText.length > 0}>
        <Phrase spans={[lead("Why it matters: "), ...q().whyText]} />
      </If>
      <View style={{ gap: 8 }}>
        <Each of={q().options}>
          {(option) => (
            <Option
              choice={option()}
              document={document()}
              extra={props.optionExtra?.(q(), option())}
              hands={props.links}
              onPick={() => toggle(option().letter)}
              picked={letters.value().includes(option().letter)}
            />
          )}
        </Each>
        <If when={letters.refusal()}>
          {(words) => <Refusal words={`Not saved: ${words()} The pick went back.`} />}
        </If>
        <If when={!isNarrow() && keyed().length > 0}>
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Each of={keyed()}>{(option) => <Kbd keys={option().letter.toLowerCase()} />}</Each>
            <Text tone="quiet">picks it and goes on, a press adds a letter,</Text>
            <Kbd keys="i" />
            <Text tone="quiet">
              {asks() === undefined ? "writes a comment." : "writes a comment,"}
            </Text>
            <If when={asks() !== undefined}>
              <Kbd keys="s" />
              <Text tone="quiet">asks the agent, beside.</Text>
            </If>
          </View>
        </If>
      </View>
      <TextField
        hint={
          comment.dirty()
            ? "Kept on this device, and saved as you pause"
            : q().options.length === 0
              ? "The answer, in your words"
              : "Optional: what the agent should know beyond the letter"
        }
        label={q().options.length === 0 ? "Answer" : "Comment"}
        onBlur={saveComment}
        onChange={(value) => {
          comment.change(value);
          if (timer !== undefined) clearTimeout(timer);
          timer = setTimeout(saveComment, PAUSE);
        }}
        onSave={saveComment}
        placeholder={q().options.length === 0 ? "Your answer" : "A comment for the agent, if any"}
        ref={(made) => {
          field = made;
        }}
        refusal={commentRefusal()}
        rows={{ max: 12, min: 2 }}
        testID="round-comment"
        value={comment.text()}
      />
    </View>
  );
}
