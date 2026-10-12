import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Code } from "@astryxdesign/core/Code";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { Timer } from "@astryxdesign/core/Timer";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useFateClient } from "react-fate";
import { useRun, useRunner } from "./data.ts";
import { refusal } from "./errors.ts";
import { stepLabel } from "./labels.ts";
import { Paragraph } from "./layout/Paragraph.tsx";
import { statusStyles } from "./Question.tsx";
import { usePathname } from "./routes.tsx";
import { startRun } from "./runs.ts";
import { RunView } from "./views.ts";

type Run = NonNullable<ReturnType<typeof useRun>>;

const styles = stylex.create({
  // A failure's reason keeps its line breaks, and a long path wraps instead of running off screen,
  // within the reading measure.
  reason: {
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    maxWidth: "var(--size-reading-measure)",
  },
  // A blocked command or its rule, whole, wrapped anywhere.
  wrap: { overflowWrap: "anywhere" },
});

/** What the panel needs of the feature: its step, and its runs, newest first. */
type Feature = {
  folder: string;
  step: { name: string; waitsOn: string };
  runs: ReadonlyArray<string>;
};

/** A run's state, in the panel's words. */
export function stateText(run: Pick<Run, "state" | "step">, waitsOnHuman: boolean) {
  switch (run.state) {
    case "running":
      return `Working on ${stepLabel(run.step)}`;
    case "done":
      return waitsOnHuman ? "Done: waiting for you" : "Done";
    case "failed":
      return `Failed on ${stepLabel(run.step)}`;
    default:
      return "Stopped";
  }
}

const DOTS = {
  running: "accent",
  done: "success",
  failed: "error",
  stopped: "neutral",
} as const;

/** How long a run took: `42 s`, `18 min`, `1 h 5 min`. */
export function elapsed(from: string, to: string) {
  const seconds = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000));
  if (seconds < 60) {
    return `${seconds} s`;
  }
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** The session's cost, as the latest result of the run gave it. */
export function costText(costUsd: number) {
  return `$${costUsd.toFixed(2)} this session`;
}

/** A run's state, its time, and its cost, on one line under a dot. */
export function RunStatus({ run, waitsOnHuman }: { run: Run; waitsOnHuman: boolean }) {
  const state = run.state as keyof typeof DOTS;
  const text = stateText(run, waitsOnHuman);
  return (
    <VStack gap={1}>
      <HStack gap={2} align="center">
        <StatusDot
          variant={DOTS[state] ?? "neutral"}
          label={text}
          isPulsing={state === "running"}
        />
        <Text weight="semibold">{text}</Text>
      </HStack>
      <Text type="supporting" color="secondary">
        {run.endedAt ? (
          elapsed(run.startedAt, run.endedAt)
        ) : (
          <Timer startTime={Date.parse(run.startedAt)} />
        )}
        {run.costUsd != null && ` · ${costText(run.costUsd)}`}
      </Text>
    </VStack>
  );
}

/** Why a run failed or stopped, as the runner wrote it. */
export function RunReason({ reason }: { reason: string }) {
  return <Paragraph xstyle={styles.reason}>{reason}</Paragraph>;
}

/**
 * The actions `auto` mode blocked in a run, each with the button that allows it under the command,
 * where a phone has the width for both.
 */
export function Denials({
  denials,
  onAllow,
}: {
  denials: Run["denials"];
  onAllow?: (seq: number) => Promise<void>;
}) {
  return denials.map((denial) => (
    <Banner
      key={denial.seq}
      status="warning"
      title="Blocked by auto mode"
      collapsible={false}
      description={
        <VStack gap={1}>
          <Code xstyle={styles.wrap}>
            {denial.target ? `${denial.tool}: ${denial.target}` : denial.tool}
          </Code>
          {onAllow && (
            // The exact rule the button passes: a bare tool name allows its every call.
            <Text>
              Allows <Code xstyle={styles.wrap}>{denial.rule}</Code> for one run.
            </Text>
          )}
          {onAllow && (
            <HStack gap={2}>
              <Button label="Allow and continue" clickAction={() => onAllow(denial.seq)} />
            </HStack>
          )}
        </VStack>
      }
    />
  ));
}

/** The latest run: its state, its buttons, and what it was blocked from. Its log is its view's. */
function LatestRun({
  id,
  waitsOnHuman,
  canStart,
  onStart,
  onAllow,
}: {
  id: string;
  waitsOnHuman: boolean;
  canStart: boolean;
  onStart: () => Promise<void>;
  onAllow: (run: string, seq: number) => Promise<void>;
}) {
  const fate = useFateClient();
  const run = useRun(id);
  if (!run) {
    return null;
  }
  const running = run.state === "running";
  const stop = async () => {
    // The run ends once its process exits: its live update brings the state.
    await fate.mutations.run.stop({ input: { run: run.id }, view: RunView });
  };
  return (
    <>
      <RunStatus run={run} waitsOnHuman={waitsOnHuman} />
      {run.reason && run.state !== "running" && <RunReason reason={run.reason} />}
      {!running && (
        <Denials
          denials={run.denials}
          onAllow={canStart ? (seq) => onAllow(run.id, seq) : undefined}
        />
      )}
      {running ? (
        <HStack gap={2}>
          <Button variant="destructive" label="Stop" clickAction={stop} />
        </HStack>
      ) : (
        canStart && (
          <HStack gap={2}>
            <Button
              variant="primary"
              label={
                run.state === "failed" || run.state === "stopped" ? "Try again" : "Start the agent"
              }
              clickAction={onStart}
            />
          </HStack>
        )
      )}
    </>
  );
}

/** A run's row: its step and state, and when it started, leading to its view. */
function RunRow({
  folder,
  id,
  waitsOnHuman,
}: {
  folder: string;
  id: string;
  waitsOnHuman: boolean;
}) {
  const run = useRun(id);
  const pathname = usePathname();
  if (!run) {
    return null;
  }
  const href = `/f/${folder}/runs/${id}`;
  return (
    <ListItem
      href={href}
      isSelected={pathname === href}
      // Nodes, not strings, so long lines wrap instead of being cut.
      label={
        <>
          {stepLabel(run.step)} · {stateText(run, waitsOnHuman)}
        </>
      }
      description={
        <>
          {new Date(run.startedAt).toLocaleString()}
          {run.endedAt && ` · ${elapsed(run.startedAt, run.endedAt)}`}
        </>
      }
      endContent={
        <Text color="secondary" aria-hidden="true">
          ›
        </Text>
      }
    />
  );
}

/**
 * A feature's agent: the latest run live, Stop while it goes on, "Start the agent" or "Try again"
 * when the feature waits on an agent, and every run, newest first, each leading to its log.
 */
export function AgentPanel({ feature }: { feature: Feature }) {
  const fate = useFateClient();
  const runner = useRunner();
  // A run started here shows before the feature's live update lists it.
  const [started, setStarted] = useState<string>();
  const [message, setMessage] = useState<string>();
  const runs =
    started && !feature.runs.includes(started) ? [started, ...feature.runs] : feature.runs;
  const [latest] = runs;
  const waitsOnAgent =
    feature.step.waitsOn === "agent" && !["none", "done"].includes(feature.step.name);
  const waitsOnHuman = feature.step.waitsOn === "human";
  const canStart = Boolean(runner?.available) && waitsOnAgent;
  if (!latest && !canStart) {
    return null;
  }

  const start = async () => {
    setMessage(undefined);
    const result = await startRun(fate, { folder: feature.folder, trigger: "manual" });
    if (result.ok) {
      setStarted(result.run);
    } else {
      setMessage(result.message);
    }
  };
  const allow = async (run: string, seq: number) => {
    setMessage(undefined);
    const result = await fate.mutations.run.allow({ input: { run, seq }, view: RunView });
    const id = (result.result as { id?: string } | undefined)?.id;
    if (result.error || !id) {
      setMessage(result.error ? refusal(result.error).message : "The run did not start.");
    } else {
      setStarted(id);
    }
  };

  return (
    <VStack as="section" gap={3} aria-label="Agent">
      <Heading level={2}>Agent</Heading>
      {latest ? (
        <LatestRun
          key={latest}
          id={latest}
          waitsOnHuman={waitsOnHuman}
          canStart={canStart}
          onStart={start}
          onAllow={allow}
        />
      ) : (
        <HStack gap={2}>
          <Button variant="primary" label="Start the agent" clickAction={start} />
        </HStack>
      )}
      {message && <span {...stylex.props(statusStyles.error)}>{message}</span>}
      {runs.length > 0 && (
        <List header={<Heading level={3}>Runs</Heading>} aria-label="Runs" hasDividers>
          {runs.map((id) => (
            // Only the latest run can be the one a gate waits on.
            <RunRow
              key={id}
              folder={feature.folder}
              id={id}
              waitsOnHuman={id === latest && waitsOnHuman}
            />
          ))}
        </List>
      )}
    </VStack>
  );
}
