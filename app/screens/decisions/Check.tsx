// The decisions check, `specs/DECISIONS-CHECK.md`, at `/decisions/check`: a round of questions an
// agent asks about the decisions, answered on the default branch like the inbox's triage. Its
// frame is here: while it waits, the round answered one question at a time, as every round is
// (`app/screens/round/`), each option's candidate decisions under the option; once answered, its
// head with its state, then its file, each question's answer under its heading, read-only. With no
// check, "Review with AI" asks an agent for one; once answered, "Apply the answers" asks an agent to
// apply them: each through the continue dialog (`Errand.tsx`).
import { View } from "nsh";
import { record } from "../../store";
import type { Block, Candidate, FileView, QuestionItem } from "../../store/protocol";
import { StatusDot, Text } from "../../ui/controls";
import { Document } from "../../ui/document";
import { definePane } from "../../ui/layout";
import { Answering, roundAction, roundMains, roundQuestionsPane } from "../round";
import { Empty } from "../../ui/lists";
import { changeCounts, checkWords } from "./ledger";
import { follow } from "./links";
import { ErrandButton, useErrand } from "./Errand";
import { Column, pastTitle, Reading, Title } from "./Reader";
import { plural } from "../../ui/words";

/** The id the record `WorkflowFile` reads the check by. */
const CHECK_ID = "decisions-check";

const questionsOf = (file: FileView): ReadonlyArray<QuestionItem> =>
  file.current.items.clarifications?.questions ?? [];

const isAnswered = (question: QuestionItem) =>
  question.letters.length > 0 || question.answer.trim() !== "";

/** "2 of 3 questions answered", of the questions asked now. */
function progress(file: FileView): string {
  const asked = questionsOf(file).filter((question) => question.asked);
  const answered = asked.filter(isAnswered).length;
  return `${answered} of ${plural(asked.length, "question")} answered`;
}

/** A question's answer, read-only, under its heading. */
function Answer(props: { question: QuestionItem }) {
  const words = () => {
    const question = props.question;
    if (!question.asked) {
      return {
        text: "Not asked now: it follows an answer to another question.",
        tone: "faint" as const,
      };
    }
    if (!isAnswered(question)) {
      return { text: "Not answered yet.", tone: "needs" as const };
    }
    const letters = question.letters.join(", ");
    const comment = question.comment.trim();
    const picked = letters === "" ? "" : `Option ${letters}`;
    return {
      text: `Your answer: ${[picked, comment].filter((part) => part !== "").join(" · ")}`,
      tone: "done" as const,
    };
  };
  return (
    <Text size="under" tone={words().tone}>
      {words().text}
    </Text>
  );
}

/** The decisions an option would add or change, under the option. */
function Candidates(props: { candidates: ReadonlyArray<Candidate> }) {
  return (
    <View style={{ gap: 2 }}>
      <Each of={props.candidates}>
        {(candidate) => (
          <Text size="under" tone="caution">
            {[
              `${candidate().change.kind === "new" ? "Adds" : "Changes"} the decision ${candidate().change.title}`,
              ...changeCounts(candidate().change),
            ].join(" · ")}
          </Text>
        )}
      </Each>
    </View>
  );
}

/** The mark under a block of the check: a question's answer, or an option's candidates. */
function markOf(file: FileView, block: Block) {
  const questions = questionsOf(file);
  const asked = questions.find((question) => question.headingBlock === block.id);
  if (asked !== undefined) {
    return <Answer question={asked} />;
  }
  for (const question of questions) {
    const choice = question.options.find((option) => option.block === block.id);
    if (choice !== undefined) {
      return candidatesOf(file, question, choice.letter);
    }
  }
  return undefined;
}

/** The candidates under an option of the check, as its round's cards show them. */
function candidatesOf(file: FileView, question: QuestionItem, letter: string) {
  const candidates = file.candidates.filter(
    (one) => one.question === question.id.toLowerCase() && one.option === letter.toLowerCase(),
  );
  return candidates.length === 0 ? undefined : <Candidates candidates={candidates} />;
}

function CheckReader(props: { repo: string }) {
  const read = record("WorkflowFile", { id: CHECK_ID, repo: props.repo });
  return (
    <If
      when={read()?.status === "awaiting-human" ? read() : null}
      else={<CheckRead repo={props.repo} />}
    >
      {(file) => (
        <Answering
          args={{ id: CHECK_ID, repo: props.repo }}
          file={file}
          optionExtra={(question, choice) => candidatesOf(file(), question, choice.letter)}
        />
      )}
    </If>
  );
}

/** No check on the default branch: Review with AI asks an agent for one, `r` or its press. */
function NoCheck(props: { repo: string }) {
  const errand = useErrand(props.repo, "check-decisions");
  return (
    <>
      <Empty
        action={{
          icon: "message-circle-question",
          keys: "r",
          label: errand.label,
          run: errand.open,
        }}
        icon="message-circle-question"
        title="No decisions check waits"
        words="specs/DECISIONS-CHECK.md is not on the default branch. Review with AI asks an agent to write one, and its questions wait here for your answers."
      />
      {errand.dialog}
    </>
  );
}

function CheckRead(props: { repo: string }) {
  const read = record("WorkflowFile", { id: CHECK_ID, repo: props.repo });
  return (
    <Column>
      <If when={read() !== undefined} else={<Reading error={read.error()?.message} />}>
        <If when={read()} else={<NoCheck repo={props.repo} />}>
          {(file) => (
            <>
              <View style={{ gap: 6 }}>
                <Title icon="message-circle-question" title="Decisions check" />
                <StatusDot
                  label={`${checkWords(file().status).label} · ${progress(file())}`}
                  tone={checkWords(file().status).tone}
                />
                <Text tone="faint">
                  An agent's questions about the constitution and the decisions. Its answers are
                  committed on the default branch, then an agent applies them to the decisions.
                </Text>
                <If when={file().status === "answered"}>
                  <ErrandButton errand="apply-decisions-check" repo={props.repo} />
                </If>
              </View>
              <Document
                document={file().current.document}
                ids={pastTitle(file().current.document)}
                mark={(block) => markOf(file(), block)}
                onLink={(link) => follow(link)}
              />
            </>
          )}
        </If>
      </If>
    </Column>
  );
}

export const checkPane = definePane<{ repo: string }>({
  action: (args) => roundAction({ id: CHECK_ID, repo: args.repo }),
  icon: "message-circle-question",
  kind: "decisions-check",
  mark: ({ repo }) => ({
    needs: record("Ledger", { repo })()?.decisionsCheck === "awaiting-human",
  }),
  stack: "main",
  title: "Decisions check",
  view: (props) => <CheckReader repo={props.args.repo} />,
});

roundMains.set(CHECK_ID, (args) => checkPane({ repo: args.repo }));

/** The check's questions beside it, while it waits. */
export const checkQuestions = (repo: string) => roundQuestionsPane({ id: CHECK_ID, repo });
