// The question cards of the clarifications redesign
// (`specs/done/2026-10-17-redesign-clarifications.md`), as the round page draws them: two columns
// on a wide screen, a follow-up its own card after its parent's. Over the round page's mockup
// feature, its Q1 answered B so that its follow-up shows; its data comes from Uraeda's server in
// Storybook, through fate.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ROUND_MOCKUPS } from "../.storybook/checkouts.ts";
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
