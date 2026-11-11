// One question of the triage: the notes it covers and what the agent found, why it matters, the
// options with their pros and cons, the recommended one first, and a comment. A letter's key picks
// its option and goes on to the next question; a press picks it and stays, for a comment. Each
// answer is saved as it is made, never submitted: the comment typed is kept on the device until
// it is saved, as the field leaves or the human goes on.
import { signal, View } from "nsh";
import { call, navigate } from "../../store";
import type { Choice, Document as Tree, QuestionItem } from "../../store/protocol";
import { Heading, Kbd, Text } from "../../ui/controls";
import { isNarrow } from "../../ui/width";
import { Document } from "../../ui/document";
import { SelectableCard } from "../../ui/lists";
import { TextField, type TextFieldRef, unsavedKey, unsavedText } from "../../ui/text";
import { plain } from "../inbox/model";
import { TRIAGE_ID } from "./chat";

/** The words under an option: its pros, its cons, and why it is recommended, one per line. */
function wordsOf(choice: Choice, document: Tree): string {
  const text = (id: number | null) =>
    id === null ? "" : plain(document.blocks[id]?.spans ?? []).replace(/^\[(pro|con)\]\s*/, "");
  return [
    ...choice.pros.map((id) => `+ ${text(id)}`),
    ...choice.cons.map((id) => `− ${text(id)}`),
    ...(choice.why === null ? [] : [text(choice.why)]),
  ].join("\n");
}

const pickable = (letter: string) =>
  (LETTERS as ReadonlyArray<string>).includes(letter.toLowerCase());

/** What the triage's keys do to the question shown: set by the question as it is drawn. */
export type QuestionHands = { comment?: () => void; pick?: (key: string) => false | undefined };

/** The letters a key picks, `a` to `f`: `g` is a sequence, so an option G has none. */
export const LETTERS = ["a", "b", "c", "d", "e", "f"] as const;

export type QuestionProps = {
  /** The round's hash as last read or written: what an answer is saved over. */
  base: () => string;
  document: Tree;
  /** Hears the round's hash after a save. */
  onBase: (hash: string) => void;
  /** Goes on to the next question, after a pick by key. */
  onNext: () => void;
  /** What the pane's keys reach of the question shown. */
  hands: QuestionHands;
  /** Says why its answer was not saved, or `null` once one is: the pane shows it wherever it is. */
  onRefused: (words: string | null) => void;
  question: QuestionItem;
  /** Why its last answer was not saved. */
  refusal: string | null;
  repo: string;
};

export function Question(props: QuestionProps) {
  const q = () => props.question;
  const comment = unsavedText(
    unsavedKey(props.repo, `specs/INBOX-TRIAGE.md#${props.question.id}`),
    () => q().comment,
  );
  // The pick shown at once, before the round says it back.
  const picked = signal<ReadonlyArray<string> | null>(null);
  const letters = () => picked() ?? q().letters;
  let field: TextFieldRef | undefined;

  const save = async (chosen: ReadonlyArray<string>, text: string) => {
    props.onRefused(null);
    try {
      const saved = await call("defaultRound.answer", {
        base: props.base(),
        comment: text,
        id: TRIAGE_ID,
        letters: [...chosen],
        previous: q().answer,
        question: q().id,
        repo: props.repo,
      });
      props.onBase(saved.hash);
      comment.saved(text);
    } catch (error) {
      // The control goes back to what the round holds, and says why under it.
      picked.set(null);
      props.onRefused((error as Error).message);
    }
  };
  const pick = (letter: string, next: boolean) => {
    picked.set([letter]);
    void save([letter], comment.text().trim());
    if (next) props.onNext();
  };

  // The pane's keys act on the question shown: its letters pick, `i` comments.
  const keyed = () => q().options.filter((option) => pickable(option.letter));
  props.hands.pick = (key) => {
    const option = keyed().find((one) => one.letter.toLowerCase() === key);
    if (option === undefined) return false;
    pick(option.letter, true);
    return undefined;
  };
  props.hands.comment = () => field?.focus();

  return (
    <View style={{ gap: 14 }}>
      <Heading level={2}>{q().title}</Heading>
      <Document
        align="start"
        document={props.document}
        ids={q().context}
        onLink={(link) => {
          if (link.path !== null) navigate({ page: "edit", path: link.path, repo: props.repo });
        }}
      />
      <If when={q().whyText.length > 0}>
        <Text tone="quiet">{`Why it matters: ${plain(q().whyText)}`}</Text>
      </If>
      <View style={{ gap: 8 }}>
        <Each of={q().options}>
          {(option) => (
            <SelectableCard
              onSelect={() => pick(option().letter, false)}
              selected={letters().includes(option().letter)}
              title={`${option().letter}${option().recommended ? " (recommended)" : ""}. ${plain(option().summary)}`}
              words={wordsOf(option(), props.document)}
            />
          )}
        </Each>
        <If when={!isNarrow() && keyed().length > 0}>
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Each of={keyed()}>{(option) => <Kbd keys={option().letter.toLowerCase()} />}</Each>
            <Text tone="quiet">answers and goes on,</Text>
            <Kbd keys="i" />
            <Text tone="quiet">writes a comment.</Text>
          </View>
        </If>
        <If when={props.refusal}>{(words) => <Text tone="danger">{words()}</Text>}</If>
      </View>
      <TextField
        hint={comment.dirty() ? "Saved as you leave the field" : undefined}
        label="Comment"
        onBlur={() => {
          if (comment.dirty()) void save(letters(), comment.text().trim());
        }}
        onChange={comment.change}
        onSave={() => void save(letters(), comment.text().trim())}
        placeholder="A comment for the agent, if any"
        ref={(made) => {
          field = made;
        }}
        rows={{ max: 8, min: 2 }}
        value={comment.text()}
      />
    </View>
  );
}
