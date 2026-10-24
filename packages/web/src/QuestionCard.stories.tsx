// The question cards as the round page draws them: two columns on a wide screen, a follow-up its own
// card after its parent's. Over the clarifications redesign's mockup feature
// (`specs/done/2026-10-17-redesign-clarifications.md`), its Q1 answered B so that its follow-up
// shows, and the questions page's (`specs/2026-10-24-questions-page/`) rounds: the layout-look
// round's Q4 and Q5, and the merge-chats round, its Q2 picked A. Their data comes from Uraeda's
// server in Storybook, through fate.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QUESTIONS_PAGES, ROUND_MOCKUPS } from "../.storybook/checkouts.ts";
import { useFile, useWorkspace } from "./data.ts";
import { QuestionCards } from "./QuestionCards.tsx";
import { RepositoryPathContext } from "./routes.tsx";

/** The mockup feature's round, its questions as cards. */
function RoundCards({ folder }: { folder: string }) {
  const file = useFile(folder, "clarifications-01.md");
  // The fixture's folder, as `App` sets it: what keeps the answers' unsaved text apart.
  const root = useWorkspace()?.root;
  const round = file?.current.items.clarifications;
  if (!file || !round || root === undefined) {
    return null;
  }
  return (
    <RepositoryPathContext value={root}>
      <QuestionCards
        document={file.current.document}
        path={file.path}
        questions={round.questions}
        readOnly={file.status !== "awaiting-human"}
        takes={file.takesImages}
        target={{ folder }}
      />
    </RepositoryPathContext>
  );
}

const meta = {
  args: { folder: ROUND_MOCKUPS.waiting },
  component: RoundCards,
  parameters: { layout: "padded" },
  title: "Mockups/Question cards",
} satisfies Meta<typeof RoundCards>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Two columns: the question and its context on the left, its options and comment on the right. A
 * follow-up is its own card, after its parent's, joined to it by a line.
 */
export const TwoColumns: Story = {};

/**
 * The layout-look round's Q4 and Q5, in the terminal look: the header that stays at the top while
 * its card is on screen, Q4's "Example" in a teal pane and "Why it matters" in a peach one, then
 * each option in one border with its letter and "★ Recommended" in it. On the phone, each pro, con,
 * and why is a box with its sign in its border.
 */
export const ExampleAndWhy: Story = { args: { folder: QUESTIONS_PAGES.layoutLook } };

/**
 * The merge-chats round, its Q2 picked A: option A's border mauve and twice as thick, its letter
 * filled, "picked" beside it, and the follow-up Q2.A after its card.
 */
export const Picked: Story = { args: { folder: QUESTIONS_PAGES.waiting } };
