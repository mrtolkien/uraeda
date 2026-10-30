// A feature's or a change's sessions, in a pane of its page, under "Next": the latest first, each
// with its status, its running sub-agents, and when it started; the latest's task and last run;
// and "New session", which opens a new session's page, the session created with its first message.
// A working one stops from its own page. `s` opens its session, or a picker of them when there are
// several, and `S` opens a new one.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { Suspense, useState } from "react";
import type { TaskProgress } from "uraeda-binding";
import { useAgent } from "../data.ts";
import { progressText, stepLabel } from "../labels.ts";
import { Pane } from "../layout/Pane.tsx";
import { KeyPicker } from "../keys/KeyPicker.tsx";
import type { PickerItem } from "../keys/pickerSources.ts";
import { useKeys } from "../keys/registry.tsx";
import { navigate, sessionIdPath, useRepoPath } from "../routes.tsx";
import { useNavigation, useSession, useTurn } from "../sessionData.ts";
import { sessionCard } from "../sidebar/cards.ts";
import { sessionPath } from "../sessions.ts";
import { StatusMark } from "../StatusMark.tsx";
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
        <ProgressBar label={progressText(progress)} max={progress.total} value={progress.done} />
      )}
      {latest && last !== undefined && <LastRun id={last} />}
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

/**
 * The page of a new session of the folder, which its first message creates: "New session" and `S`
 * open it, and leaving it before sending makes none.
 */
const newSessionPath = (folder: string) => `${sessionPath(folder)}?new`;

/**
 * The keys of the feature's sessions: `s` opens its session, the latest, as its row does, or with
 * several, a picker of them, the latest first; `S` opens a new one, as "New session" does.
 */
function useSessionKeys(
  folder: string,
  sessions: ReadonlyArray<string>,
  start: (() => void) | undefined,
) {
  const here = useRepoPath();
  const rows = useNavigation().sessionList?.rows ?? [];
  const [isPicking, setPicking] = useState(false);
  // Drawn from its first opening on: the page's focus is its own until then.
  const [isDrawn, setDrawn] = useState(false);
  const items = sessions.flatMap((id, index): Array<PickerItem> => {
    const row = rows.find((one) => one.id === id);
    if (!row) {
      return [];
    }
    // The latest opens as the feature's session, as its row does.
    const path = index === 0 ? sessionPath(folder) : sessionIdPath(id);
    const started = `${day(row.startedAt)}, ${clock(row.startedAt)}`;
    return [
      {
        card: sessionCard(row),
        icon: "uraeda:terminal",
        id: path,
        kind: "sessions",
        path,
        preview: [row.statusLabel, started].join("\n"),
        title: `${started} · ${row.statusLabel}`,
      },
    ];
  });
  useKeys([
    ...(sessions.length > 0
      ? [
          {
            hint: "s",
            keys: "s",
            label: sessions.length > 1 ? "sessions" : "session",
            run: () => {
              if (sessions.length === 1) {
                navigate(here(sessionPath(folder)));
              } else {
                setDrawn(true);
                setPicking(true);
              }
            },
          },
        ]
      : []),
    ...(start ? [{ hint: "S", keys: "S", label: "new session", run: start }] : []),
  ]);
  return (
    isDrawn && (
      <KeyPicker
        isOpen={isPicking}
        items={items}
        onClose={() => setPicking(false)}
        onPick={(item) => {
          setPicking(false);
          navigate(here(item.path));
        }}
        title="Open a session"
      />
    )
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
  const here = useRepoPath();
  const canStart = agent?.available !== false;
  const start = () => navigate(here(newSessionPath(folder)));
  const picker = useSessionKeys(folder, sessions, canStart ? start : undefined);
  return (
    <Pane count={sessions.length} title="Sessions">
      <VStack gap={3}>
        {sessions.length === 0 && <Empty>No session yet.</Empty>}
        {sessions.map((id, index) => (
          <Suspense fallback={null} key={id}>
            <SessionItem folder={folder} id={id} latest={index === 0} progress={progress} />
          </Suspense>
        ))}
        {canStart && (
          <HStack>
            <Button
              href={here(newSessionPath(folder))}
              label="New session"
              size="sm"
              variant="secondary"
            />
          </HStack>
        )}
        {agent?.available === false && (
          <Text color="secondary" type="supporting">
            {agent.name} is not available on this machine.
          </Text>
        )}
      </VStack>
      {picker}
    </Pane>
  );
}
