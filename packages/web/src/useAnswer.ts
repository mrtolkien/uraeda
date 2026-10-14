import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { QuestionItem } from "uraeda-binding";
import { refusal } from "./errors.ts";
import { useTextField } from "./fields/useTextField.ts";
import { useCommentSaves } from "./QuestionComment.tsx";
import { useSave } from "./useSave.ts";
import { FileView } from "./views.ts";

/** Where questions put what they still have to save, so Submit saves it first. */
export const PendingSaves = createContext<Set<() => Promise<boolean>>>(new Set());

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
  if (!text) {
    return picked;
  }
  // A comment starting with a code block starts below the letters, as its fence must.
  return /^(```|~~~)/.test(text) ? `${picked}:\n\n${text}` : `${picked}: ${text}`;
}

/** An answer: its letters, and its comment. */
type Answer = { comment: string; letters: ReadonlyArray<string> };

/** Whether two answers pick the same letters. */
const sameLetters = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) =>
  a.length === b.length && a.every((letter, index) => letter === b[index]);

/**
 * A question's answer as the page shows it, its letters and its comment, and how it saves. The
 * comment is a field of the unsaved store, `<path>#<id>`, over the comment the file holds: a tap on
 * an option or "Does not apply" saves at once with the comment as saved, the comment typed saves
 * with its button or Ctrl+Enter, its images at once with the text as typed, and Submit what is
 * still unsaved.
 */
export function useAnswer(question: QuestionItem, folder: string, path: string) {
  const fate = useFateClient();
  const field = useTextField(`${path}#${question.id}`, question.comment);
  const [letters, setLetters] = useState<ReadonlyArray<string>>(question.letters);
  // The letters as last picked, and the comment as last saved or read, for the saves, which run
  // after the page drew: a tap saves its letters with the comment as saved then, not as typed.
  const picked = useRef<ReadonlyArray<string>>(question.letters);
  const savedComment = useRef(question.comment);
  const run = async (value: Answer, previous: string) => {
    const result = await fate.mutations.answer.save({
      input: {
        comment: value.comment,
        folder,
        letters: [...value.letters],
        previous,
        question: question.id,
      },
      view: FileView,
    });
    if (result.error) {
      return { message: refusal(result.error).message, ok: false as const };
    }
    const saved = result.result?.current.items.clarifications?.questions.find(
      (q) => q.id === question.id,
    );
    savedComment.current = value.comment;
    return { ok: true as const, saved: saved?.answer ?? composed(value.letters, value.comment) };
  };
  const save = useSave<Answer>(run, question.answer);
  const { flush, idle, settle, write } = save;
  /** Saves the answer `value()` gives, after the saves before it; resolves with whether it did. */
  const send = (value: () => Answer) => write((previous) => run(value(), previous));
  // Letters changed elsewhere replace these when nothing of the answer waits to be saved; the
  // comment shows the file's unless it holds unsaved text.
  useEffect(() => {
    if (idle()) {
      savedComment.current = question.comment;
      if (!sameLetters(picked.current, question.letters)) {
        picked.current = question.letters;
        setLetters(question.letters);
      }
    }
    settle(question.answer);
  }, [question.answer, question.letters, question.comment, idle, settle]);
  const comments = useCommentSaves({
    commit: async (comment) => {
      const ok = await send(() => ({ comment, letters: picked.current }));
      if (ok) {
        field.saved(comment);
      }
      return ok;
    },
    flush,
    pending: useContext(PendingSaves),
    unsaved: () => field.unsavedNow()?.text,
  });

  /** Sets the letters, and saves them with the comment as saved. */
  const pick = (next: ReadonlyArray<string>, comment?: string) => {
    picked.current = next;
    setLetters(next);
    void send(() => ({ comment: comment ?? savedComment.current, letters: next }));
  };
  return {
    field,
    letters,
    /** Marks a follow-up as not applying, its comment typed dropped: its answer is "-". */
    notApplying: () => {
      field.discard();
      pick([], "-");
    },
    /** Keeps the text with its images, and saves the answer with it once they are added. */
    onImages: (text: string, added: boolean) => {
      field.change(text);
      if (added) {
        void comments.save(text);
      }
    },
    onSettled: comments.onSettled,
    /** Saves the comment as typed, with the letters. */
    saveComment: () => {
      if (field.dirty) {
        void comments.save(field.text);
      }
    },
    state: save.state,
    /** Toggles an option's letter. */
    toggle: (letter: string) =>
      pick(
        letters.includes(letter)
          ? letters.filter((l) => l !== letter)
          : [...letters, letter].sort(),
      ),
  };
}
