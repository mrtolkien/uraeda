// Where a round opens, when this device kept no place for it: at its first question left, chosen
// once. Answering that question by a press saves it, and the record then names another first
// question left: the round must stay where the human is reading. A walk by touch found it moving.
import { signal } from "nsh";
import { expect, test } from "nsh/test";
import type { QuestionItem, RoundItems } from "../../store/protocol";
import { positionOf } from "./position";

const question = (id: string, answer: string) =>
  ({ answer, asked: true, id }) as unknown as QuestionItem;

const roundOf = (answers: Record<string, string>) =>
  ({
    questions: Object.entries(answers).map(([id, answer]) => question(id, answer)),
  }) as unknown as RoundItems;

test("an answer saved never moves the round from the question shown", () => {
  const round = signal<RoundItems | null>(null);
  const position = positionOf({ id: `test/clarifications-${Date.now()}.md`, repo: "t" }, round);
  round.set(roundOf({ Q1: "B", "Q1.B": "", Q2: "" }));
  expect(position.at()).toBe("Q1.B");
  round.set(roundOf({ Q1: "B", "Q1.B": "A", Q2: "" }));
  expect(position.at()).toBe("Q1.B");
  // A step goes on from there, and the device keeps it.
  position.step(1);
  expect(position.at()).toBe("Q2");
});
