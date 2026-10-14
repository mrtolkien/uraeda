import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { QuestionItem } from "uraeda-binding";
import { refusal } from "./errors.ts";
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
  return text ? `${picked}: ${text}` : picked;
}

/**
 * A question's answer as the page shows it, its letters and its comment, and how it saves: a tap on
 * an option or "Does not apply" saves at once, the comment with its button, its images at once, and
 * Submit what is still unsaved.
 */
export function useAnswer(question: QuestionItem, folder: string) {
  const fate = useFateClient();
  const [letters, setLetters] = useState<ReadonlyArray<string>>(question.letters);
  const [comment, setComment] = useState(question.comment);
  // The comment as last saved or read: a comment typed since is a draft, which its button saves.
  const [savedComment, setSavedComment] = useState(question.comment);
  const save = useSave<{ comment: string; letters: ReadonlyArray<string> }>(
    async (value, previous) => {
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
        return { message: refusal(result.error).message, ok: false };
      }
      const saved = result.result?.current.items.clarifications?.questions.find(
        (q) => q.id === question.id,
      );
      setSavedComment(value.comment);
      return { ok: true, saved: saved?.answer ?? composed(value.letters, value.comment) };
    },
    question.answer,
  );
  const { flush, idle, schedule, settle } = save;
  const dirty = comment !== savedComment;
  // The answer as last drawn, for the effects and Submit, which run after it.
  const local = useRef({ comment, dirty, letters });
  useEffect(() => {
    local.current = { comment, dirty, letters };
  }, [comment, dirty, letters]);
  // An answer changed elsewhere replaces this one when nothing of it waits to be saved, and no
  // comment is being written.
  useEffect(() => {
    const shown = composed(local.current.letters, local.current.comment);
    if (idle() && !local.current.dirty && question.answer.trim() !== shown) {
      setLetters(question.letters);
      setComment(question.comment);
      setSavedComment(question.comment);
    }
    settle(question.answer);
  }, [question.answer, question.letters, question.comment, idle, settle]);
  const { commit, onImages, onSettled } = useCommentSaves({
    flush,
    initial: question.comment,
    local,
    pending: useContext(PendingSaves),
    schedule,
    setComment,
  });

  /** Toggles an option's letter, and saves the answer. */
  const toggle = (letter: string) => {
    const next = letters.includes(letter)
      ? letters.filter((l) => l !== letter)
      : [...letters, letter].sort();
    setLetters(next);
    commit({ comment, letters: next });
  };
  /** Marks a follow-up as not applying, and saves it. */
  const notApplying = () => {
    setLetters([]);
    setComment("-");
    commit({ comment: "-", letters: [] });
  };
  return {
    comment,
    dirty,
    letters,
    notApplying,
    onImages,
    onSettled,
    /** Saves the comment as typed, with the letters. */
    saveComment: () => commit({ comment, letters }),
    setComment,
    state: save.state,
    toggle,
  };
}
