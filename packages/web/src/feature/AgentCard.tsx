// The feature's agent, neutral beside "Next": idle or working, its task while it works, its last
// run, Stop while it works, and the one way into its session.
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { type SVGProps, useState } from "react";
import { useFateClient } from "react-fate";
import type { TaskProgress } from "uraeda-binding";
import type { SessionStatus } from "uraeda-server/fate";
import { useAgent } from "../data.ts";
import { refusal } from "../errors.ts";
import { stepLabel } from "../labels.ts";
import { statusStyles } from "../Question.tsx";
import { useRepoPath } from "../routes.tsx";
import { useTurn } from "../sessionData.ts";
import { sessionPath } from "../sessions.ts";
import { StatusMark } from "../StatusMark.tsx";
import { SessionView } from "../views.ts";
import { clearPending, markPending } from "../writes/store.ts";
import { cardStyles } from "./NextCard.tsx";
import { duration } from "./times.ts";

/** What the card reads of the feature's session, when it has one. */
export type AgentSession = {
  id: string;
  status: SessionStatus;
  statusLabel: string;
  statusReason?: string | null;
  subagents: Array<unknown>;
  turns: Array<string>;
};

/** A crescent moon, Lucide's `moon`: an agent with nothing to do. */
function Moon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden
      fill="none"
      height="1em"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width="1em"
      {...props}
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

/**
 * The agent's state: working, or what of its own runs needs the human, a failed or stopped run or a
 * blocked action, with its mark; otherwise idle and muted, whatever the feature waits on.
 */
function State({ session }: { session?: AgentSession }) {
  const own =
    session &&
    (session.status === "working" ||
      session.status === "attention" ||
      session.statusReason === "blocked");
  if (!own) {
    return (
      <HStack align="center" gap={2}>
        <Icon color="secondary" icon={Moon} size="sm" />
        <Text color="secondary">Idle</Text>
      </HStack>
    );
  }
  return (
    <HStack align="center" gap={2}>
      <StatusMark label={session.statusLabel} status={session.status} />
      <Text weight={session.status === "working" ? "bold" : undefined}>{session.statusLabel}</Text>
    </HStack>
  );
}

/** "Last run: Plan · done · 12 min": the session's latest turn, and the sub-agents at work. */
function LastRun({ id, subagents }: { id: string; subagents: number }) {
  const turn = useTurn(id, true);
  if (!turn) {
    return null;
  }
  const what =
    turn.kind === "workflow"
      ? stepLabel(turn.step ?? "")
      : turn.kind === "allow"
        ? "Retry"
        : "Chat";
  // How long an ended turn ran; a running one's time would stand still between updates.
  const time =
    turn.startedAt && turn.endedAt
      ? duration((Date.parse(turn.endedAt) - Date.parse(turn.startedAt)) / 1000)
      : undefined;
  const working =
    subagents > 0 ? `${subagents} ${subagents === 1 ? "sub-agent" : "sub-agents"} working` : "";
  return (
    <Text color="secondary" type="supporting">
      {[`Last run: ${what}`, turn.state, time, working].filter(Boolean).join(" · ")}
    </Text>
  );
}

/** Stop, while the session works, and why it was refused. */
function Stop({ folder, id }: { folder: string; id: string }) {
  const fate = useFateClient();
  const [error, setError] = useState<string>();
  const stop = async () => {
    setError(undefined);
    markPending(folder, "Stopping…");
    // The turn ends once the agent answers the interrupt: its live update brings the state.
    const result = await fate.mutations.session.stop({ input: { session: id }, view: SessionView });
    if (result.error) {
      clearPending(folder);
      setError(refusal(result.error).message);
    }
  };
  return (
    <>
      <HStack>
        <Button clickAction={stop} label="Stop" size="sm" variant="destructive" />
      </HStack>
      {error && <span {...stylex.props(statusStyles.error)}>{error}</span>}
    </>
  );
}

/**
 * The agent's card: its state, the task's progress while it works, its last run, Stop while it
 * works, and "Open the session", or that the agent is not on this machine.
 */
export function AgentCard({
  folder,
  progress,
  session,
}: {
  folder: string;
  progress?: TaskProgress | null;
  session?: AgentSession;
}) {
  const agent = useAgent();
  const here = useRepoPath();
  const working = session?.status === "working";
  const latest = session?.turns.at(-1);
  return (
    <section aria-label="Agent" {...stylex.props(cardStyles.fill)}>
      <Card padding={4} xstyle={cardStyles.fill}>
        <VStack gap={3}>
          <State session={session} />
          {working && progress && (
            <ProgressBar
              formatValueLabel={(value: number, max: number) => `${value}/${max}`}
              hasValueLabel
              label={`Task ${progress.position} of ${progress.total}: ${progress.title}`}
              max={progress.total}
              value={progress.position}
            />
          )}
          {session && latest !== undefined && (
            <LastRun id={latest} subagents={session.subagents.length} />
          )}
          {working && session && <Stop folder={folder} id={session.id} />}
          {agent?.available === false && (
            <Text color="secondary" type="supporting">
              {agent.name} is not available on this machine.
            </Text>
          )}
          <HStack>
            <Button
              href={here(sessionPath(folder))}
              label="Open the session"
              size="sm"
              variant="secondary"
            />
          </HStack>
        </VStack>
      </Card>
    </section>
  );
}
