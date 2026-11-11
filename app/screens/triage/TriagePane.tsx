// The inbox's triage, `/inbox/triage`: an agent's proposed outcome for each note, as questions the
// human answers one at a time, `n` and `p` between them, then its end, which submits. Where it is
// is kept in the visit; an answer saved goes into the file at once, and a comment typed and not
// saved stays on the device. An answered triage reads its answers, under the way to apply them.
import { computed, effect, signal, untracked, View } from "nsh";
import { record } from "../../store";
import type { FileView } from "../../store/protocol";
import { Banner, Button, Progress, Spinner, Text } from "../../ui/controls";
import { keyScope, registerKey } from "../../ui/keys";
import { PaneScroll, usePane } from "../../ui/layout";
import { Card, Empty } from "../../ui/lists";
import { plain } from "../inbox/model";
import { ORGANIZE_INBOX, startChat, TRIAGE_ID } from "./chat";
import { LETTERS, Question, type QuestionHands } from "./Question";
import { TriageBanner } from "./TriageBanner";
import { TriageEnd } from "./TriageEnd";

/** Where the human is: a question by its id, or the end. */
const END = "end";

function Answering(props: { file: FileView; repo: string }) {
  const pane = usePane();
  const round = () => props.file.current.items.clarifications;
  const asked = computed(() => round()?.questions.filter((q) => q.asked) ?? []);
  const at = pane.remember<string>(
    "at",
    untracked(() => asked().find((q) => q.answer.trim() === "")?.id ?? END),
  );
  const base = signal(untracked(() => props.file.current.document.hash));
  effect(() => base.set(props.file.current.document.hash));
  const refusals = signal<Readonly<Record<string, string>>>({});
  const index = () => {
    const found = asked().findIndex((q) => q.id === at());
    return found === -1 ? asked().length : found;
  };
  const go = (by: number) => {
    const next = Math.max(0, Math.min(asked().length, index() + by));
    at.set(asked()[next]?.id ?? END);
  };
  const shown = () => (at() === END ? [] : [at()]);
  const answered = () => asked().filter((q) => q.answer.trim() !== "").length;
  const elsewhere = () => Object.entries(refusals()).filter(([id]) => id !== at());
  registerKey([
    { hint: "n p", hintLabel: "question", keys: "n", label: "Next question", run: () => go(1) },
    { keys: "p", label: "Previous question", run: () => go(-1) },
  ]);
  // A question's own keys, in a selection's scope so that `b` answers B, not Back, while one is
  // shown: declared once here, as one question replaces another, and acting on the one shown.
  const hands: QuestionHands = {};
  const question = keyScope({ kind: "selection", name: "Question", on: () => at() !== END });
  registerKey(
    [
      ...LETTERS.map((key) => ({
        keys: key,
        label: `Answer ${key.toUpperCase()}, and go on`,
        run: () => hands.pick?.(key) ?? false,
      })),
      { keys: "i", label: "Write a comment", run: () => hands.comment?.() },
    ],
    question,
  );

  return (
    <View style={{ gap: 16 }}>
      <Progress
        label="Inbox triage"
        value={asked().length === 0 ? 1 : answered() / asked().length}
        words={`${answered()} of ${asked().length} answered`}
      />
      <Each of={elsewhere()}>
        {(entry) => (
          <Banner
            action={<Button label="Open it" onPress={() => at.set(entry()[0])} />}
            icon="circle-alert"
            title={`An answer was not saved: ${entry()[1]}`}
            tone="danger"
          />
        )}
      </Each>
      <Each key={(id: string) => id} of={shown()}>
        {(id) => (
          <Question
            base={base}
            document={props.file.current.document}
            hands={hands}
            onBase={(hash) => base.set(hash)}
            onNext={() => go(1)}
            onRefused={(words) => {
              const { [id()]: _, ...rest } = refusals();
              refusals.set(words === null ? rest : { ...rest, [id()]: words });
            }}
            question={asked().find((q) => q.id === id()) ?? asked()[0]!}
            refusal={refusals()[id()] ?? null}
            repo={props.repo}
          />
        )}
      </Each>
      <If when={at() === END ? round() : null}>
        {(items) => (
          <TriageEnd
            base={base}
            onBase={(hash) => base.set(hash)}
            onOpen={(id) => at.set(id)}
            questions={asked()}
            repo={props.repo}
            round={items()}
          />
        )}
      </If>
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
        <Button
          disabled={index() === 0}
          icon="arrow-left"
          label="Previous"
          onPress={() => go(-1)}
        />
        <If when={at() !== END}>
          <Button
            icon="arrow-right"
            label={index() === asked().length - 1 ? "To the end" : "Next"}
            onPress={() => go(1)}
          />
        </If>
      </View>
    </View>
  );
}

/** A triage answered, or in any state but waiting: each question with its answer. */
function Answers(props: { file: FileView }) {
  const asked = () =>
    props.file.current.items.clarifications?.questions.filter((q) => q.asked) ?? [];
  return (
    <View style={{ gap: 8 }}>
      <Each of={asked()}>
        {(q) => (
          <Card
            body={
              <Text tone={q().answer.trim() === "" ? "faint" : "ink"}>
                {q().answer.trim() === ""
                  ? "No answer"
                  : [
                      ...q().letters.map((letter) => {
                        const option = q().options.find((one) => one.letter === letter);
                        return `${letter}. ${option === undefined ? "" : plain(option.summary)}`;
                      }),
                      ...(q().comment.trim() === "" ? [] : [q().comment.trim()]),
                    ].join("\n")}
              </Text>
            }
            icon="message-circle-question"
            title={q().title}
          />
        )}
      </Each>
    </View>
  );
}

/** The triage's pane: the round once read, or why there is none. */
export function TriageView(props: { repo: string }) {
  const file = record("WorkflowFile", { id: TRIAGE_ID, repo: props.repo });
  const refusal = signal<string | null>(null);
  return (
    <PaneScroll style={{ flex: 1 }}>
      <View style={{ gap: 16, paddingBottom: 24 }}>
        <If when={file.error()}>
          {(error) => (
            <Banner icon="circle-alert" title="The triage could not be read" tone="danger">
              <Text>{error().message}</Text>
            </Banner>
          )}
        </If>
        <If when={file() !== undefined} else={<Spinner label="Reading the triage" />}>
          <If
            when={file()}
            else={
              <Empty
                action={{
                  icon: "sparkles",
                  label: "Organize with AI",
                  run: () =>
                    void startChat(props.repo, ORGANIZE_INBOX).catch((error: Error) =>
                      refusal.set(error.message),
                    ),
                }}
                icon="inbox"
                title="No inbox triage waits"
                words={
                  refusal() ??
                  "An agent proposes where each note goes, as questions you answer here. The inbox stays as it is until you do."
                }
              />
            }
          >
            {(shown) => (
              <>
                <If when={shown().status !== "awaiting-human"}>
                  <TriageBanner here repo={props.repo} status={shown().status ?? "answered"} />
                </If>
                <If when={shown().status === "awaiting-human"} else={<Answers file={shown()} />}>
                  <Answering file={shown()} repo={props.repo} />
                </If>
              </>
            )}
          </If>
        </If>
      </View>
    </PaneScroll>
  );
}
