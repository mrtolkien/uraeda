// The round page, as the app draws it: the clarifications redesign's mockup features' rounds
// (`specs/done/2026-10-17-redesign-clarifications.md`, `fixtures/round-mockup/`), and the questions
// page's (`specs/done/2026-10-24-questions-page.md`), over its spec's rounds, `fixtures/round-merge-chats/`
// and `fixtures/round-layout-look/`, with its column of Outline, Notes, and Session, and the inbox's
// triage. Built by `.storybook/fixture.ts`: their data comes from Uraeda's server in Storybook,
// through fate, on the fake agent.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { QUESTIONS_PAGES, ROUND_MOCKUPS } from "../.storybook/checkouts.ts";
import { inRepositoryFolder } from "../.storybook/inRepositoryFolder.tsx";
import { FilePage } from "./FilePage.tsx";
import { TriagePage } from "./TriagePage.tsx";

const meta = {
  args: { folder: ROUND_MOCKUPS.waiting, name: "clarifications-01.md" },
  component: FilePage,
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Mockups/Round page",
} satisfies Meta<typeof FilePage>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A round waiting for answers: the verdict, the context's parts, the questions with a diagram, Q1
 * answered B so that its follow-up shows, then the settled points.
 */
export const Waiting: Story = {};

/**
 * Q1 answered with a comment alone: no letter is picked, and its follow-up does not show, with
 * nothing to mark.
 */
export const CommentOnly: Story = { args: { folder: ROUND_MOCKUPS.commentOnly } };

/**
 * The merge-chats round waiting for answers, in titled panes: the block with its verdict's badge,
 * the context's panes with Today folded, "Check these" before the questions, Q2 answered A so that
 * Q2.A shows, and the settled points. Beside it on wide and semi-wide screens, the round's column
 * with the Outline open; on the phone, the status line's count and Notes.
 */
export const QuestionsWaiting: Story = { args: { folder: QUESTIONS_PAGES.waiting } };

/**
 * "Ask the agent" on Q2: the column's Session tab opens, its composer holding Q2's quote, and the
 * round stays where it is. On the phone, asking opens the session's page instead.
 */
export const QuestionsSessionAsked: Story = {
  args: { folder: QUESTIONS_PAGES.waiting },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findAllByText("Where does a new chat work?");
    const card = within(canvasElement.querySelector<HTMLElement>("#Q2")!);
    await userEvent.click(card.getAllByRole("button", { name: "Ask the agent" })[0]!);
  },
};

/** The column's Notes tab open, its field the same note the round's end shows. */
export const QuestionsNotes: Story = {
  args: { folder: QUESTIONS_PAGES.waiting },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    await userEvent.click(await page.findByRole("tab", { name: /^Notes/ }));
  },
};

/** The merge-chats round answered: read-only, every question A, its note, and no column. */
export const QuestionsAnswered: Story = { args: { folder: QUESTIONS_PAGES.answered } };

/**
 * The inbox's triage, on the default branch: its free context one pane, and its column of Outline
 * and Notes, with no Session and no "Ask".
 */
export const Triage: Story = { render: () => <TriagePage /> };
