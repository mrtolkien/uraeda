// The triage's end, after its last question: the questions still without an answer, each one
// press away, the notes for the agent, and Submit, which commits the answers: a deliberate press,
// never a key typed in a field.
import { signal, View } from "nsh";
import { call } from "../../store";
import type { QuestionItem, RoundItems } from "../../store/protocol";
import { Button, Heading, Text } from "../../ui/controls";
import { TextField, unsavedKey, unsavedText } from "../../ui/text";
import { TRIAGE_ID } from "./chat";

export type TriageEndProps = {
  base: () => string;
  onBase: (hash: string) => void;
  /** Opens a question still without an answer. */
  onOpen: (id: string) => void;
  questions: ReadonlyArray<QuestionItem>;
  repo: string;
  round: RoundItems;
};

export function TriageEnd(props: TriageEndProps) {
  const notes = unsavedText(
    unsavedKey(props.repo, "specs/INBOX-TRIAGE.md#notes"),
    () => props.round.notes ?? "",
  );
  const refusal = signal<string | null>(null);
  const pending = signal(false);
  const blank = () => props.questions.filter((q) => q.answer.trim() === "");
  const saveNotes = async () => {
    if (!notes.dirty()) return;
    const text = notes.text().trim();
    const saved = await call("defaultRound.notes", {
      base: props.base(),
      id: TRIAGE_ID,
      notes: text,
      previous: props.round.notes ?? "",
      repo: props.repo,
    });
    props.onBase(saved.hash);
    notes.saved(text);
  };
  const submit = async () => {
    pending.set(true);
    refusal.set(null);
    try {
      await saveNotes();
      await call("defaultRound.submit", {
        id: TRIAGE_ID,
        previous: props.base(),
        repo: props.repo,
        write: { href: "/inbox/triage", label: "Submitting the inbox triage" },
      });
    } catch (error) {
      refusal.set((error as Error).message);
    }
    pending.set(false);
  };
  return (
    <View style={{ gap: 14 }}>
      <Heading level={2}>Submit the triage</Heading>
      <If
        when={blank().length > 0}
        else={
          <Text>
            Every question has its answer. Submitting commits them, for an agent to apply.
          </Text>
        }
      >
        <View style={{ alignItems: "flex-start", gap: 6 }}>
          <Text>
            {blank().length === 1
              ? "One question has no answer yet:"
              : `${blank().length} questions have no answer yet:`}
          </Text>
          <Each of={blank()}>
            {(q) => (
              <Button icon="arrow-right" label={q().title} onPress={() => props.onOpen(q().id)} />
            )}
          </Each>
        </View>
      </If>
      <TextField
        label="Notes"
        onBlur={() => void saveNotes().catch((error: Error) => refusal.set(error.message))}
        onChange={notes.change}
        onSave={() => void saveNotes().catch((error: Error) => refusal.set(error.message))}
        placeholder="Notes for the agent that applies it, if any"
        rows={{ max: 10, min: 3 }}
        value={notes.text()}
      />
      <View style={{ alignItems: "flex-start", gap: 6 }}>
        <Button
          disabled={blank().length > 0}
          icon="check"
          label="Submit the answers"
          onPress={() => void submit()}
          pending={pending()}
          variant="main"
        />
        <If when={refusal()} else={<Text tone="quiet">It commits INBOX-TRIAGE.md alone.</Text>}>
          {(words) => <Text tone="danger">{words()}</Text>}
        </If>
      </View>
    </View>
  );
}
