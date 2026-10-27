// A feature's or a change's sessions, in a pane of the Home's column: the latest first, each with its status, its
// running sub-agents, and when it started; the latest's task and last run, Stop for a working one,
// and "New session", which opens a new session in its worktree, on its own page.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { Suspense, useState } from "react";
import { useFateClient } from "react-fate";
import type { TaskProgress } from "uraeda-binding";
import { useAgent } from "../data.ts";
import { refusal } from "../errors.ts";
import { stepLabel } from "../labels.ts";
import { Pane } from "../layout/Pane.tsx";
import { StatusText } from "../fields/StatusText.tsx";
import { navigate, sessionIdPath, useRepoPath } from "../routes.tsx";
import { useSession, useTurn } from "../sessionData.ts";
import { sessionPath } from "../sessions.ts";
import { StatusMark } from "../StatusMark.tsx";
import { SessionView } from "../views.ts";
import { clearPending, markPending } from "../writes/store.ts";
import { clock, day, duration } from "./times.ts";
import { CardRow } from "../sidebar/CardRow.tsx";
import { Empty } from "../layout/Empty.tsx";

const styles = stylex.create({
  subagent: { paddingInlineStart: spacingVars["--spacing-6"] },
});

type SessionData = NonNullable<ReturnType<typeof useSession>>;

/** "Last run: Plan · done · 12 min": the session's latest turn, a step, a retry, or a message. */
function LastRun({ id }: { id: string }) {
  const turn = useTurn(id, true);
  if (!turn) {
    return null;
  }
  const what =
    turn.kind === "workflow"
      ? stepLabel(turn.step ?? "")
      : turn.kind === "allow"
        ? "Retry"
        : "Message";
  // How long an ended turn ran; a running one's time would stand still between updates.
  const time =
    turn.startedAt && turn.endedAt
      ? duration((Date.parse(turn.endedAt) - Date.parse(turn.startedAt)) / 1000)
      : undefined;
  return (
    <Text color="secondary" type="supporting">
      {[`Last run: ${what}`, turn.state, time].filter(Boolean).join(" · ")}
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
      {error && <StatusText tone="error">{error}</StatusText>}
    </>
  );
}

/** What the row of a session reads beside its session. */
type RowProps = { folder: string; latest: boolean; progress?: TaskProgress | null };

/**
 * A session's row: its link with its status, title, and start, the latest's to the feature's
 * session and an earlier one's to its own page, its running sub-agents under it,
 * then, for the latest, the task while it works and its last run, and Stop while it works.
 */
function Row({
  folder,
  latest,
  progress,
  session,
  title,
}: RowProps & { session: SessionData; title: string }) {
  const here = useRepoPath();
  const working = session.status === "working";
  const last = session.turns.at(-1);
  const started = `${day(session.startedAt)}, ${clock(session.startedAt)}`;
  return (
    <VStack gap={1}>
      <CardRow
        endContent={
          <Text color="secondary" type="supporting">
            {started}
          </Text>
        }
        // The latest opens as the feature's session, which "Next" hands runs to.
        href={here(latest ? sessionPath(folder) : sessionIdPath(session.id))}
        icon={<StatusMark label={session.statusLabel} status={session.status} />}
        isSelected={false}
        label={title}
        name={`${session.statusLabel} ${title} ${started}`}
      />
      {session.subagents.map((subagent) => (
        <HStack align="center" gap={2} key={subagent.id} xstyle={styles.subagent}>
          <StatusMark isSubagent label="Working" small status="working" />
          <Text color="secondary" maxLines={1} type="supporting">
            {subagent.description}
          </Text>
        </HStack>
      ))}
      {latest && working && progress && (
        <ProgressBar
          label={`Task ${progress.position} of ${progress.total}: ${progress.title}`}
          max={progress.total}
          value={progress.position}
        />
      )}
      {latest && last !== undefined && <LastRun id={last} />}
      {working && <Stop folder={folder} id={session.id} />}
    </VStack>
  );
}

/** A session titled by its first turn: a workflow turn's step, else "Session". */
function TitledByTurn({ turn, ...props }: RowProps & { session: SessionData; turn: string }) {
  const first = useTurn(turn);
  const title = first?.kind === "workflow" && first.step ? stepLabel(first.step) : "Session";
  return <Row {...props} title={title} />;
}

/**
 * A session of the list, by its ID: titled by its own title, a chat's it was, else by its first
 * turn, since its `title` is its feature's.
 */
function SessionItem({ id, ...props }: RowProps & { id: string }) {
  const session = useSession(id);
  if (!session) {
    return null;
  }
  const first = session.turns[0];
  return session.name === null && first !== undefined ? (
    <TitledByTurn {...props} session={session} turn={first} />
  ) : (
    <Row {...props} session={session} title={session.name ?? "Session"} />
  );
}

/** "New session": opens a new session of the folder on its own page, or says why it could not. */
function NewSession({ folder }: { folder: string }) {
  const fate = useFateClient();
  const here = useRepoPath();
  const [error, setError] = useState<string>();
  const start = async () => {
    setError(undefined);
    const created = await fate.mutations.session.new({ input: { folder }, view: SessionView });
    const id = (created.result as { id: string } | undefined)?.id;
    if (created.error || id === undefined) {
      setError(created.error ? refusal(created.error).message : "The session did not start.");
      return;
    }
    navigate(here(sessionIdPath(id)), { created: true });
  };
  return (
    <>
      <Button clickAction={start} label="New session" size="sm" variant="secondary" />
      {error && <StatusText tone="error">{error}</StatusText>}
    </>
  );
}

/**
 * The sessions' pane, titled with their count: its sessions, the latest first, "New session", and
 * that the agent is not on this machine.
 */
export function SessionsPane({
  folder,
  progress,
  sessions,
}: {
  folder: string;
  progress?: TaskProgress | null;
  sessions: ReadonlyArray<string>;
}) {
  const agent = useAgent();
  return (
    <Pane count={sessions.length} title="Sessions">
      <VStack gap={3}>
        {sessions.length === 0 && <Empty>No session yet.</Empty>}
        {sessions.map((id, index) => (
          <Suspense fallback={null} key={id}>
            <SessionItem folder={folder} id={id} latest={index === 0} progress={progress} />
          </Suspense>
        ))}
        {agent?.available !== false && <NewSession folder={folder} />}
        {agent?.available === false && (
          <Text color="secondary" type="supporting">
            {agent.name} is not available on this machine.
          </Text>
        )}
      </VStack>
    </Pane>
  );
}
