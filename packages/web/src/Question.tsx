import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { useEffect, useState } from "react";
import { useFateClient } from "react-fate";
import type { Choice, Document, QuestionItem } from "uraeda-binding";
import { Blocks } from "./Blocks.tsx";
import { refusal } from "./errors.ts";
import { Spans } from "./Spans.tsx";
import { type SaveState, useSave } from "./useSave.ts";
import { FileView } from "./views.ts";

/** The answer as the core writes it, to show while it saves. */
export function composed(letters: ReadonlyArray<string>, comment: string) {
  const sorted = [...new Set(letters)].sort();
  const picked =
    sorted.length <= 1
      ? (sorted[0] ?? "")
      : `${sorted.slice(0, -1).join(", ")} and ${sorted.at(-1)}`;
  const text = comment.trim();
  if (!picked) {
    return text;
  }
  return text ? `${picked}: ${text}` : picked;
}

function Status({ state }: { state: SaveState }) {
  switch (state.kind) {
    case "saving":
      return <span className="muted">saving…</span>;
    case "saved":
      return <span className="saved">saved ✓</span>;
    case "error":
      return <span className="not-saved">Not saved: {state.message}</span>;
    default:
      return null;
  }
}

/** A text area as tall as its text. */
export function GrowingTextArea({
  label,
  value,
  onChange,
  placeholder,
  isReadOnly,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isReadOnly?: boolean;
}) {
  const rows = Math.max(2, value.split("\n").length + Math.floor(value.length / 40) + 1);
  return (
    <TextArea
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      isReadOnly={isReadOnly}
    />
  );
}

function Option({
  choice,
  document,
  selected,
  disabled,
  onToggle,
}: {
  choice: Choice;
  document: Document;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const spans = (id: number) => <Spans spans={document.blocks[id]?.spans ?? []} />;
  return (
    <button
      type="button"
      className="option"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
    >
      {choice.recommended && <div className="tag">Recommended</div>}
      <div className="summary">
        <span className="letter">{choice.letter}</span>
        <Spans spans={choice.summary} />
      </div>
      {(choice.pros.length > 0 || choice.cons.length > 0 || choice.why !== undefined) && (
        <ul className="points">
          {choice.pros.map((id) => (
            <li key={id} className="pro">
              {spans(id)}
            </li>
          ))}
          {choice.cons.map((id) => (
            <li key={id} className="con">
              {spans(id)}
            </li>
          ))}
          {choice.why !== undefined && <li className="why">{spans(choice.why)}</li>}
        </ul>
      )}
      {choice.other.length > 0 && <Blocks document={document} ids={choice.other} />}
    </button>
  );
}

/**
 * A question in full: its context, every option with its text, pros, cons, and why, and a comment.
 * A tap on an option toggles its letter; the answer is saved as the human types.
 */
export function Question({
  folder,
  question,
  followUps,
  document,
  readOnly,
}: {
  folder: string;
  question: QuestionItem;
  followUps: ReadonlyArray<QuestionItem>;
  document: Document;
  readOnly: boolean;
}) {
  const fate = useFateClient();
  const [letters, setLetters] = useState<ReadonlyArray<string>>(question.letters);
  const [comment, setComment] = useState(question.comment);
  const save = useSave<{ letters: ReadonlyArray<string>; comment: string }>(
    async (value, previous) => {
      const result = await fate.mutations.answer.save({
        input: {
          folder,
          question: question.id,
          letters: [...value.letters],
          comment: value.comment,
          previous,
        },
        view: FileView,
      });
      if (result.error) {
        return { ok: false, message: refusal(result.error).message };
      }
      const saved = result.result?.current.items.clarifications?.questions.find(
        (q) => q.id === question.id,
      );
      return { ok: true, saved: saved?.answer ?? composed(value.letters, value.comment) };
    },
    question.answer,
  );
  const { settle } = save;
  useEffect(() => settle(question.answer), [question.answer, settle]);

  const toggle = (letter: string) => {
    const next = letters.includes(letter)
      ? letters.filter((l) => l !== letter)
      : [...letters, letter].sort();
    setLetters(next);
    save.schedule({ letters: next, comment }, true);
  };
  const type = (text: string) => {
    setComment(text);
    save.schedule({ letters, comment: text });
  };
  const unclear = question.applies === "unclear";
  const answer = composed(letters, comment);
  const parent = question.parent;

  return (
    <section id={question.id} className={parent ? "follow-up" : undefined}>
      <div className="label">
        {question.id}
        {parent && question.applies === "yes" && ` · because you picked ${question.parentLetter}`}
        {parent && unclear && ` · ${parent} names no option`}
      </div>
      <h2 className="title-l">{question.title}</h2>
      <Blocks document={document} ids={question.context} />
      {question.options.length > 0 && (
        <div className="options">
          {question.options.map((choice) => (
            <Option
              key={choice.letter}
              choice={choice}
              document={document}
              selected={letters.includes(choice.letter)}
              disabled={readOnly}
              onToggle={() => toggle(choice.letter)}
            />
          ))}
        </div>
      )}
      {unclear && !readOnly && (
        <div className="actions" style={{ marginTop: 12 }}>
          <Button
            label="Does not apply"
            onClick={() => {
              setLetters([]);
              setComment("-");
              save.schedule({ letters: [], comment: "-" }, true);
            }}
          />
        </div>
      )}
      {readOnly ? (
        comment && (
          <p className="small" style={{ marginTop: 12 }}>
            {comment}
          </p>
        )
      ) : (
        <div style={{ marginTop: 14 }}>
          <GrowingTextArea label="Comment" value={comment} onChange={type} />
        </div>
      )}
      <div className="answer-line">
        <span className="muted">Answer:</span>
        <span className="value">{answer}</span>
        {!readOnly && <Status state={save.state} />}
      </div>
      {followUps.map((followUp) => (
        <Question
          key={followUp.id}
          folder={folder}
          question={followUp}
          followUps={[]}
          document={document}
          readOnly={readOnly}
        />
      ))}
    </section>
  );
}
