import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { ReactNode } from "react";
import { useFateClient } from "react-fate";
import { useAgent, useSession, useTurn } from "./data.ts";
import { stepLabel } from "./labels.ts";
import { costText, SessionStatus } from "./SessionPage.tsx";
import { handOver } from "./sessions.ts";
import { SessionView } from "./views.ts";

/** What the panel needs of the feature: its step, its branch, and its session. */
type Feature = {
  folder: string;
  branch?: string | null;
  step: { name: string; waitsOn: string };
  session: string | null;
};

/** How long a turn ran, or has run so far: `4 min`, or `40 s` under a minute. */
export function turnTime(startedAt: string, endedAt: string | null, now = Date.now()) {
  const ms = Math.max(0, (endedAt ? Date.parse(endedAt) : now) - Date.parse(startedAt));
  return ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60_000)} min`;
}

/** A supporting line of parts, joined by dots. */
function Line({ parts }: { parts: Array<string | undefined> }) {
  const shown = parts.filter((part): part is string => Boolean(part));
  return shown.length > 0 ? (
    <Text type="supporting" color="secondary">
      {shown.join(" · ")}
    </Text>
  ) : null;
}

/** How a turn that did not end well ended, for the panel's line. */
const ENDINGS: Partial<Record<string, string>> = { failed: "Failed", stopped: "Stopped" };

/**
 * The session's latest turn, the step it ran or a chat, how it ended when it went wrong, and how
 * long it ran, with the cost; then `children`, told whether the turn failed or was stopped.
 */
function LatestTurn({
  id,
  cost,
  children,
}: {
  id: string;
  cost?: string;
  children: (endedBadly: boolean) => ReactNode;
}) {
  const turn = useTurn(id);
  const what = !turn
    ? undefined
    : turn.kind === "workflow"
      ? `Run: ${stepLabel(turn.step ?? "")}`
      : turn.kind === "allow"
        ? "Retry"
        : "Chat";
  const ending = turn ? ENDINGS[turn.state] : undefined;
  const time = turn?.startedAt ? turnTime(turn.startedAt, turn.endedAt) : undefined;
  return (
    <>
      <Line parts={[what, ending, time, cost]} />
      {children(ending !== undefined)}
    </>
  );
}

/** The session's status, its latest turn and cost, Stop while it works, and the panel's buttons. */
function Summary({ id, actions }: { id: string; actions: (endedBadly: boolean) => ReactNode }) {
  const fate = useFateClient();
  const session = useSession(id);
  if (!session) {
    return actions(false);
  }
  const stop = async () => {
    // The turn ends once the agent answers the interrupt: its live update brings the state.
    await fate.mutations.session.stop({ input: { session: id }, view: SessionView });
  };
  const latest = session.turns.at(-1);
  const cost = session.costUsd == null ? undefined : costText(session.costUsd);
  const rest = (endedBadly: boolean) => (
    <>
      {session.status === "working" && (
        <HStack gap={2}>
          <Button variant="destructive" label="Stop" clickAction={stop} />
        </HStack>
      )}
      {actions(endedBadly || session.status === "failed")}
    </>
  );
  return (
    <>
      <SessionStatus status={session.status} label={session.statusLabel} />
      {latest === undefined ? (
        <>
          <Line parts={[cost]} />
          {rest(false)}
        </>
      ) : (
        <LatestTurn id={latest} cost={cost}>
          {rest}
        </LatestTurn>
      )}
    </>
  );
}

/**
 * A feature's agent: its session's status, its latest turn, its cost, Stop while it works, "Open
 * the session", and, when the feature waits on an agent, "Start the agent" or "Try again", which
 * open the session with the workflow's message in the composer, unsent. Nothing shows without a
 * session when the agent is not on this machine, or when the feature has no branch.
 */
export function AgentPanel({ feature }: { feature: Feature }) {
  const agent = useAgent();
  const available = Boolean(agent?.available);
  const waitsOnAgent =
    feature.step.waitsOn === "agent" && !["none", "done"].includes(feature.step.name);
  const canStart = available && waitsOnAgent;
  if (!feature.session && (!available || !feature.branch)) {
    return null;
  }
  const start = () => handOver(feature.folder, "manual");
  const actions = (endedBadly: boolean) => (
    <HStack gap={2} wrap="wrap">
      <Button
        variant={canStart ? "secondary" : "primary"}
        label="Open the session"
        href={`/f/${feature.folder}/session`}
      />
      {canStart && (
        <Button
          variant="primary"
          label={endedBadly ? "Try again" : "Start the agent"}
          clickAction={start}
        />
      )}
    </HStack>
  );
  return (
    <VStack as="section" gap={3} aria-label="Agent">
      <Heading level={2}>Agent</Heading>
      {feature.session ? <Summary id={feature.session} actions={actions} /> : actions(false)}
    </VStack>
  );
}
