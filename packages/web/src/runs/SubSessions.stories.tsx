// Sub-sessions' mockups (spec of Run options): the session's Sub-agents pane listing the sub-sessions
// Uraeda started, three implementers and two reviewers in mixed states, each a card, in a wide
// pane, at the session's column's width, and on the phone; an agent's own sub-agents as the same
// cards; and a sub-session's page,
// the session's view, its bar in place of the composer, while it works and once done. All read the
// building feature's sub-sessions that Storybook's server keeps (`samples/subSessions.ts`).
import { Icon } from "@astryxdesign/core/Icon";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { FEATURE_PAGES } from "../../.storybook/checkouts.ts";
import { atMostWidth, PHONE } from "../../.storybook/widthClass.ts";
import { inRepositoryFolder } from "../../.storybook/inRepositoryFolder.tsx";
import { useFeature } from "../data.ts";
import { Pane } from "../layout/Pane.tsx";
import { SubagentsPanel } from "../session/SubagentsPanel.tsx";
import { useSession } from "../sessionData.ts";
import { SessionPane } from "../SessionView.tsx";
import { StatusMark } from "../StatusMark.tsx";
import { useDraft } from "../useDraft.ts";
import { AgentCard, AgentCards, Times, Unit } from "./AgentCard.tsx";
import type { SubSessionState } from "./subSessions.ts";

/** The building feature's session, which started the sub-sessions. */
function useBuildSession(): string | undefined {
  return useFeature(FEATURE_PAGES.working)?.sessions[0];
}

/** The Sub-agents pane of the build's session, as the session's column draws it. */
function SubagentsPane() {
  const id = useBuildSession();
  return (
    <Pane title="Sub-agents">
      <SubagentsPanel session={id} />
    </Pane>
  );
}

const styles = stylex.create({
  // The session's column, at the width it opens at: a pane's least, 400 px.
  column: { maxWidth: "var(--size-pane-min)" },
});

/** The same pane as narrow as the session's side column, where a card's lines wrap. */
function SubagentsColumn() {
  return (
    <div {...stylex.props(styles.column)}>
      <SubagentsPane />
    </div>
  );
}

/** When the stories' own sub-agents started, and the time their cards read against. */
const STARTED = "2026-10-17T15:09:00Z";
const NOW = Date.parse("2026-10-17T15:21:40Z");

/** An agent's own sub-agents, a chat's: one at work, one done, with the facts they have. */
function OwnSubagents() {
  return (
    <Pane title="Sub-agents">
      <AgentCards label="The session's sub-agents" order={["a", "b"]}>
        <AgentCard
          duration="12 min"
          isWorking
          line={<Unit>14 calls · reading src/tasks/repeat.ts</Unit>}
          mark={<StatusMark isSubagent label="Working" small status="working" />}
          rowKey="a"
          title="Find where the due date is computed"
        >
          <Times ending="running" now={NOW} startedAt={STARTED} />
        </AgentCard>
        <AgentCard
          duration="4 min 10 s"
          isWorking={false}
          line={<Unit>9 calls · ran the tests</Unit>}
          mark={<Icon color="secondary" icon="uraeda:badge-check" label="Done" size="sm" />}
          rowKey="b"
          title="Check the upgrade of saved dates"
        >
          <Times
            ending={{ at: Date.parse("2026-10-17T15:13:10Z") }}
            now={NOW}
            startedAt={STARTED}
          />
        </AgentCard>
      </AgentCards>
    </Pane>
  );
}

/** The page of the build's first sub-session in `state`. */
function SubSessionPage({ parent, state }: { parent: string; state: SubSessionState }) {
  // A session page's draft, which the bar never writes: the page holds one as any session's does.
  const draft = useDraft(undefined);
  const sub = useSession(parent)?.subSessions.find((each) => each.state === state);
  if (sub === undefined) {
    return null;
  }
  return <SessionPane draft={draft} id={sub.id} title={sub.about} />;
}

/** The page of a sub-session of the build's session, once the feature is read. */
function OfBuild({ state }: { state: SubSessionState }) {
  const id = useBuildSession();
  return id === undefined ? null : <SubSessionPage parent={id} state={state} />;
}

const meta = {
  component: SubagentsPane,
  decorators: [inRepositoryFolder],
  parameters: { layout: "padded" },
  title: "Run options/Sub-sessions",
} satisfies Meta<typeof SubagentsPane>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The Sub-agents pane: 3 implementers, working, done, and failed, then 2 reviewers, as cards. */
export const SubagentsPaneMixed: Story = {};

/** The same at the session's column's width: a card's parts wrap whole, none cut. */
export const SubagentsPaneColumn: Story = { render: () => <SubagentsColumn /> };

/** The same on the phone: the title's line, then every other line at the card's full width. */
export const SubagentsPanePhone: Story = { beforeEach: atMostWidth(PHONE) };

/** An agent's own sub-agents, as the same cards: what each does, its start, and its time. */
export const OwnSubagentsPane: Story = { render: () => <OwnSubagents /> };

/** A sub-session at work: its transcript, no composer, Stop, and the way back to the build. */
export const SubSessionWorking: Story = {
  parameters: { layout: "fullscreen" },
  render: () => <OfBuild state="working" />,
};

/** A sub-session done: its transcript and its bar, without Stop. */
export const SubSessionDone: Story = {
  parameters: { layout: "fullscreen" },
  render: () => <OfBuild state="done" />,
};
