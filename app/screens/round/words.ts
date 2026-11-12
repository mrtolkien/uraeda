// What a round says of itself, in words: a question's answer in a few words, how far the round is
// answered, and the words of its own a view sets among the file's. Pure: the record holds the
// facts, these only say them.
import type { QuestionItem, Span } from "../../store/protocol";
import { plain } from "../file/read";
import { answered } from "./position";
import { plural } from "../../ui/words";

/** Words of a view's own, as a span among the file's. */
export const lead = (text: string, strong = true): Span => ({
  code: false,
  emphasis: false,
  image: null,
  link: null,
  strike: false,
  strong,
  text,
});

/** "1 question", "3 questions". */
export const questions = (count: number) => plural(count, "question");

/** "Q3", "Q3 and Q5", "Q1, Q3, and Q5". */
export function idsWords(ids: ReadonlyArray<string>): string {
  if (ids.length <= 1) return ids[0] ?? "";
  if (ids.length === 2) return `${ids[0]} and ${ids[1]}`;
  return `${ids.slice(0, -1).join(", ")}, and ${ids.at(-1)}`;
}

/** A question's answer in a few words, as the list of questions says it: "B, weekly presets". */
export function answerWords(question: QuestionItem): string {
  if (!answered(question)) return "No answer yet";
  const options = question.letters.map((letter) => {
    const option = question.options.find((one) => one.letter === letter);
    return option === undefined ? letter : `${letter}. ${plain(option.summary)}`;
  });
  const said = [...options, question.comment.trim()].filter((part) => part !== "").join(" · ");
  return said === "" ? question.answer.trim() : said;
}

/** Whether the answer picks the option the round recommends, alone. */
export function followsRecommendation(question: QuestionItem): boolean {
  const recommended = question.options.filter((option) => option.recommended);
  return (
    recommended.length > 0 &&
    question.letters.length === recommended.length &&
    recommended.every((option) => question.letters.includes(option.letter))
  );
}
