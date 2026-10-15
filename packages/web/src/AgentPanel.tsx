import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import { useFateClient } from "react-fate";
import { useAgent, useSession, useTurn } from "./data.ts";
import { refusal } from "./errors.ts";
import { stepLabel } from "./labels.ts";
import { statusStyles } from "./Question.tsx";
import { SessionStatus } from "./SessionPage.tsx";
import { useRepoPath } from "./routes.tsx";
import { handOver, sessionPath } from "./sessions.ts";
import { SessionView } from "./views.ts";

/** What the panel needs of the feature: its step, its branch, and its session. */
type Feature = {
  branch?: string | null;
  folder: string;
  session: string | null;
  step: { name: string; waitsOn: string };
};

/** How long a turn ran, or has run so far: `4 min`, or `40 s` under a minute. */
function turnTime(startedAt: string, endedAt: string | null, now = Date.now()) {
  const ms = Math.max(0, (endedAt ? Date.parse(endedAt) : now) - Date.parse(startedAt));
  return ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60_000)} min`;
}

/** A supporting line of parts, joined by dots. */
function Line({ parts }: { parts: Array<string | undefined> }) {
  const shown = parts.filter((part): part is string => Boolean(part));
  return shown.length > 0 ? (
    <Text color="secondary" type="supporting">
      {shown.join(" · ")}
    </Text>
  ) : null;
}

/** How a turn that did not end well ended, for the panel's line. */
const ENDINGS: Partial<Record<string, string>> = { failed: "Failed", stopped: "Stopped" };

/** What the panel's buttons are told of the latest turn. */
type Latest = {
  /** It failed, was stopped, or ended before a human gate: the human reads it and answers. */
  needsAttention: boolean;
  /** It runs the workflow's step, or waits to: starting the agent again would run it twice. */
  runsStep: boolean;
};

/**
 * The session's latest turn, the step it ran or a chat, how it ended when it went wrong, and how
 * long it ran; then `children`, told how it went.
 */
function LatestTurn({ children, id }: { children: (latest: Latest) => ReactNode; id: string }) {
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
      <Line parts={[what, ending, time]} />
      {children({
        needsAttention: ending !== undefined,
        runsStep: turn?.kind === "workflow" && ["queued", "running"].includes(turn.state),
      })}
    </>
  );
}

/**
 * The session's status, its latest turn, Stop while it works, with why when it is refused,
 * and the panel's buttons.
 */
function Summary({ actions, id }: { actions: (latest: Latest) => ReactNode; id: string }) {
  const fate = useFateClient();
  const session = useSession(id);
  const [error, setError] = useState<string>();
  if (!session) {
    return actions({ needsAttention: false, runsStep: false });
  }
  const stop = async () => {
    setError(undefined);
    // The turn ends once the agent answers the interrupt: its live update brings the state.
    const result = await fate.mutations.session.stop({ input: { session: id }, view: SessionView });
    if (result.error) {
      setError(refusal(result.error).message);
    }
  };
  const latest = session.turns.at(-1);
  const rest = (latest: Latest) => (
    <>
      {session.status === "working" && (
        <>
          <HStack gap={2}>
            <Button clickAction={stop} label="Stop" variant="destructive" />
          </HStack>
          {error && <span {...stylex.props(statusStyles.error)}>{error}</span>}
        </>
      )}
      {actions({
        ...latest,
        needsAttention: latest.needsAttention || session.status === "attention",
      })}
    </>
  );
  return (
    <>
      <SessionStatus label={session.statusLabel} status={session.status} />
      {latest === undefined ? (
        rest({ needsAttention: false, runsStep: false })
      ) : (
        <LatestTurn id={latest}>{rest}</LatestTurn>
      )}
    </>
  );
}

/**
 * A feature's agent: its session's status, its latest turn, Stop while it works, "Open
 * the session", and, when the feature waits on an agent, "Review and start the agent", which opens
 * the session with the workflow's message in the composer, unsent: never while the agent runs the
 * step, or waits to, nor when its latest turn needs the human's attention, which they answer in the
 * session. Nothing shows without a session when the agent is not on this machine, or when the
 * feature has no branch.
 */
export function AgentPanel({ feature }: { feature: Feature }) {
  const agent = useAgent();
  const here = useRepoPath();
  const available = Boolean(agent?.available);
  const waitsOnAgent =
    feature.step.waitsOn === "agent" && !["none", "done"].includes(feature.step.name);
  const canStart = available && waitsOnAgent;
  if (!feature.session && (!available || !feature.branch)) {
    return null;
  }
  const start = () => handOver(feature.folder, "manual");
  const actions = ({ needsAttention, runsStep }: Latest) => {
    const offered = canStart && !runsStep && !needsAttention;
    return (
      <HStack gap={2} wrap="wrap">
        <Button
          href={here(sessionPath(feature.folder))}
          label="Open the session"
          variant={offered ? "secondary" : "primary"}
        />
        {offered && (
          <Button clickAction={start} label="Review and start the agent" variant="primary" />
        )}
      </HStack>
    );
  };
  return (
    <VStack aria-label="Agent" as="section" gap={3}>
      <Heading level={2}>Agent</Heading>
      {feature.session ? (
        <Summary actions={actions} id={feature.session} />
      ) : (
        actions({ needsAttention: false, runsStep: false })
      )}
    </VStack>
  );
}
