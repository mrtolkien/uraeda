// The question card picked in round 01 of the clarifications redesign
// (`specs/2026-10-17-redesign-clarifications/clarifications-01.md`): two columns on a wide screen, a
// follow-up its own card after its parent's. Over the fixture's web UI round, its Q1 answered B so
// that its follow-up shows.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useFile } from "./data.ts";
import { QuestionCards, useAnswers } from "./mockups/RoundMockup.tsx";

/** The fixture's web UI round, its questions as cards. */
function WebUiCards() {
  const file = useFile("2026-10-11-web-ui", "clarifications-01.md");
  const { answers, toggle } = useAnswers({ Q1: { letters: ["B"] } });
  const round = file?.current.items.clarifications;
  if (!file || !round) {
    return null;
  }
  return (
    <QuestionCards
      answers={answers}
      document={file.current.document}
      onToggle={toggle}
      questions={round.questions}
    />
  );
}

const meta = {
  component: WebUiCards,
  parameters: { layout: "padded" },
  title: "Mockups/Question cards",
} satisfies Meta<typeof WebUiCards>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Two columns: the question and its context on the left, its options and comment on the right. A
 * follow-up is its own card, after its parent's, joined to it by a line.
 */
export const TwoColumns: Story = {};
