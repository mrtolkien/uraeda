import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import { useFateClient } from "react-fate";
import { useAgent, useSession } from "./data.ts";
import { statusStyles } from "./Question.tsx";
import { navigate } from "./routes.tsx";
import { costText, SessionStatus } from "./SessionPage.tsx";
import { startRun } from "./sessions.ts";
import { SessionView } from "./views.ts";

/** What the panel needs of the feature: its step, and its session. */
type Feature = {
  folder: string;
  step: { name: string; waitsOn: string };
  session: string | null;
};

/** The session's status and cost, Stop while it works, and the panel's buttons. */
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
  const working = session.status === "working";
  return (
    <>
      <SessionStatus status={session.status} label={session.statusLabel} />
      {session.costUsd != null && (
        <Text type="supporting" color="secondary">
          {costText(session.costUsd)}
        </Text>
      )}
      {working && (
        <HStack gap={2}>
          <Button variant="destructive" label="Stop" clickAction={stop} />
        </HStack>
      )}
      {actions(session.status === "failed" || session.statusLabel === "Stopped")}
    </>
  );
}

/**
 * A feature's agent: its session's status, Stop while it works, "Open the session", and "Start the
 * agent" or "Try again" when the feature waits on an agent.
 *
 * TEMPORARY: task 10 reworks it, with the latest turn, and "Start the agent" opening the session
 * with the workflow's message instead of sending it.
 */
export function AgentPanel({ feature }: { feature: Feature }) {
  const fate = useFateClient();
  const agent = useAgent();
  const [message, setMessage] = useState<string>();
  const waitsOnAgent =
    feature.step.waitsOn === "agent" && !["none", "done"].includes(feature.step.name);
  const canStart = Boolean(agent?.available) && waitsOnAgent;
  if (!feature.session && !canStart) {
    return null;
  }
  const start = async () => {
    setMessage(undefined);
    const result = await startRun(fate, { folder: feature.folder, trigger: "manual" });
    if (result.ok) {
      navigate(`/f/${feature.folder}/session`);
    } else {
      setMessage(result.message);
    }
  };
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
      {message && <span {...stylex.props(statusStyles.error)}>{message}</span>}
    </VStack>
  );
}
