// A round's end: the points settled without the human, the notes for the agent, the questions
// still without an answer, each one press away, and the submit, the round's one main action. It
// says what it commits and what follows, and is pressed, never typed: Enter in the notes is a new
// line. Pressed while a question has no answer, it says which, and goes to the first one left: the
// workflow goes on only once every question is answered. It saves the notes first, and submits
// nothing while they are not saved: a round never goes without its notes. By keys, `i` writes the
// notes, and `c` asks first, in the shared confirmation, saying what it commits (rule 2).
import { cleanup, signal, untracked, View } from "nsh";
import { record } from "../../store";
import type { FileView, QuestionItem, RoundItems } from "../../store/protocol";
import { Button, Confirm, Heading, Refusal, Text } from "../../ui/controls";
import { Document, type DocumentHands } from "../../ui/document";
import { registerKey } from "../../ui/keys";
import { readUnsaved, TextField, type TextFieldRef, unsavedText } from "../../ui/text";
import { answered, askedOf, type Position } from "./position";
import { fieldKey, type RoundArgs, type Saves, type Target, targetOf } from "./saves";
import { pointsIn, settledCursor, settledMark } from "./Settled";
import { idsWords, questions } from "./words";

/** How long typing rests before the notes are saved. */
const PAUSE = 1200;

/** What a submit commits and what follows, by the round. */
function said(target: Target, file: FileView) {
  if (target.kind === "default") {
    const after =
      target.id === "decisions-check"
        ? "for an agent to apply to the decisions"
        : "for an agent to apply to the inbox";
    return `Commits ${file.name} on the default branch, ${after}. Nothing starts before you ask.`;
  }
  return file.resumable
    ? `Commits ${file.name} on the feature's branch. Continuing keeps the spec as approved and goes on with the implementation; revising sends the answers to the spec first.`
    : `Commits ${file.name} on the feature's branch. The agent goes on once you start its next run, from here or the feature's page.`;
}

/** Where a write is named in the queue, and the page it opens. */
function writeOf(target: Target, title: string) {
  if (target.kind === "default") {
    return target.id === "decisions-check"
      ? { href: "/decisions/check", label: "Submitting the decisions check" }
      : { href: "/inbox/triage", label: "Submitting the inbox triage" };
  }
  return {
    href: `/f/${target.folder}/${target.name}`,
    label: `Committing the answers of ${title}`,
  };
}

export type EndProps = {
  args: RoundArgs;
  file: () => FileView;
  links: DocumentHands;
  position: Position;
  round: () => RoundItems;
  saves: Saves;
};

export function End(props: EndProps) {
  const target = targetOf(props.args);
  const path = () => props.file().path;
  const notes = unsavedText(fieldKey(props.args, path(), "notes"), () => props.round().notes ?? "");
  const notesRefusal = signal<string | null>(null);
  const refusal = signal<string | null>(null);
  const pending = signal(false);
  const feature =
    target.kind === "feature" ? record("Feature", { id: target.folder, repo: target.repo }) : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let notesField: TextFieldRef | undefined;
  const asking = signal(false);

  /** Saves the notes as they are now: says whether the file holds them. */
  const saveNotes = async (): Promise<boolean> => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (!untracked(notes.dirty)) return true;
    notesRefusal.set(null);
    const done = await notes.save((text) => props.saves.notes(text.trim()));
    if (!done.ok) notesRefusal.set(`Not saved: ${done.why} Your notes stay on this device.`);
    return done.ok;
  };
  cleanup(() => void saveNotes());

  // A question with an answer typed and not saved yet is answered: the submit saves it first.
  const typed = (question: QuestionItem) =>
    (readUnsaved(fieldKey(props.args, path(), question.id))?.text.trim() ?? "") !== "" ||
    props.saves.holds(question.id);
  const asked = () => askedOf(props.round());
  const blank = () => asked().filter((question) => !answered(question) && !typed(question));
  const others = () => props.round().settledGroups.filter((group) => group.kind !== "check");
  settledCursor(props.args, () =>
    pointsIn(props.round(), props.file().current.document, (group) => group.kind !== "check"),
  );

  const submit = async (resumes: boolean) => {
    if (pending()) return;
    const left = blank();
    if (left.length > 0) {
      refusal.set(
        `${idsWords(left.map((question) => question.id))} ${left.length === 1 ? "has" : "have"} no answer yet: the agent goes on only once every question has one.`,
      );
      props.position.go(left[0]!.id);
      return;
    }
    pending.set(true);
    refusal.set(null);
    try {
      if (!(await saveNotes())) {
        throw new Error("your notes could not be saved, as said under them.");
      }
      await props.saves.submit({
        resumes,
        write: writeOf(target, untracked(() => feature?.()?.title) ?? props.file().name),
      });
    } catch (error) {
      refusal.set(`Not submitted: ${(error as Error).message} Your answers are saved.`);
    }
    pending.set(false);
  };

  const count = () => questions(asked().length).replace(/question(s?)/, "answer$1");
  const resumes = () => target.kind === "feature" && props.file().resumable;
  const act = () =>
    resumes()
      ? "Commit and continue implementing"
      : `${target.kind === "feature" ? "Commit" : "Submit"} ${count()}`;
  registerKey([
    { hint: "i", hintLabel: "notes", keys: "i", label: "Write the notes", run: () => notesField?.focus() },
    {
      hint: "c",
      hintLabel: "commit",
      keys: "c",
      label: "Commit the answers, after a confirmation",
      // A question left has nothing to confirm: the submit says which, and goes to it.
      run: () => (blank().length > 0 ? void submit(false) : asking.set(true)),
    },
  ]);
  return (
    <View style={{ gap: 16 }}>
      <If when={others().length > 0}>
        <View style={{ gap: 8 }}>
          <Heading level={2}>Settled without you</Heading>
          <Text tone="quiet">
            What the agent decided by itself. Comment on a point it got wrong.
          </Text>
          <Document
            align="start"
            document={props.file().current.document}
            ids={others().flatMap((group) => [group.heading].concat(group.blocks))}
            image={props.links.image}
            mark={settledMark({
              args: props.args,
              file: props.file,
              round: props.round,
              saves: props.saves,
            })}
            onLink={props.links.onLink}
          />
        </View>
      </If>
      <TextField
        hint={notes.dirty() ? "Kept on this device, and saved as you pause" : undefined}
        label="Notes"
        onBlur={() => void saveNotes()}
        onChange={(value) => {
          notes.change(value);
          if (timer !== undefined) clearTimeout(timer);
          timer = setTimeout(() => void saveNotes(), PAUSE);
        }}
        onSave={() => void saveNotes()}
        placeholder="Anything else the agent should know, for the whole round"
        ref={(made) => {
          notesField = made;
        }}
        refusal={notesRefusal()}
        rows={{ max: 10, min: 3 }}
        testID="round-notes"
        value={notes.text()}
      />
      <View style={{ gap: 8 }}>
        <Heading level={2}>Submit</Heading>
        <If
          when={blank().length > 0}
          else={<Text>{`Every question has its answer. ${said(target, props.file())}`}</Text>}
        >
          <View style={{ alignItems: "flex-start", gap: 6 }}>
            <Text>
              {`${questions(blank().length)} ${blank().length === 1 ? "has" : "have"} no answer yet:`}
            </Text>
            <Each of={blank()}>
              {(question) => (
                <Button
                  icon="arrow-right"
                  label={`${question().id}: ${question().title}`}
                  onPress={() => props.position.go(question().id)}
                />
              )}
            </Each>
          </View>
        </If>
        <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <If
            when={target.kind === "feature" && props.file().resumable}
            else={
              <Button
                icon="check"
                label={target.kind === "feature" ? `Commit ${count()}` : `Submit ${count()}`}
                onPress={() => void submit(false)}
                pending={pending()}
                testID="round-submit"
                variant="main"
              />
            }
          >
            <Button
              icon="play"
              label="Commit and continue implementing"
              onPress={() => void submit(true)}
              pending={pending()}
              testID="round-submit"
              variant="main"
            />
            <Button
              icon="file-pen-line"
              label="Commit and revise the spec"
              onPress={() => void submit(false)}
              pending={pending()}
            />
          </If>
        </View>
        <If when={refusal()}>{(words) => <Refusal testID="round-refusal" words={words()} />}</If>
        <Confirm
          icon={resumes() ? "play" : "check"}
          keys="c"
          label={act()}
          onClose={() => asking.set(false)}
          onConfirm={() => void submit(resumes())}
          open={asking()}
          testID="round-confirm"
          title={`${act()}?`}
          words={said(target, props.file())}
        />
      </View>
    </View>
  );
}
