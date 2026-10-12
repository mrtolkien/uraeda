import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Timer } from "@astryxdesign/core/Timer";
import { useState } from "react";
import { useFateClient } from "react-fate";
import { useRun, useRunner } from "./data.ts";
import { refusal } from "./errors.ts";
import { stepLabel } from "./labels.ts";
import { RunLog } from "./RunLog.tsx";
import { startRun } from "./runs.ts";
import { RunView } from "./views.ts";

type Run = NonNullable<ReturnType<typeof useRun>>;

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
    <>
      <div className="agent-state">
        <StatusDot
          variant={DOTS[state] ?? "neutral"}
          label={text}
          isPulsing={state === "running"}
        />
        <span>{text}</span>
      </div>
      <p className="small muted">
        {run.endedAt ? (
          elapsed(run.startedAt, run.endedAt)
        ) : (
          <Timer startTime={Date.parse(run.startedAt)} />
        )}
        {run.costUsd != null && ` · ${costText(run.costUsd)}`}
      </p>
    </>
  );
}

/** The actions `auto` mode blocked in a run, each with the button that allows it. */
export function Denials({
  denials,
  onAllow,
}: {
  denials: Run["denials"];
  onAllow?: (seq: number) => Promise<void>;
}) {
  return denials.map((denial) => (
    <div key={denial.seq} className="agent-denial">
      <Banner
        status="warning"
        title="Blocked by auto mode"
        collapsible={false}
        endContent={
          onAllow && <Button label="Allow and continue" clickAction={() => onAllow(denial.seq)} />
        }
      >
        <span className="mono">
          {denial.target ? `${denial.tool}: ${denial.target}` : denial.tool}
        </span>
        {onAllow && (
          // The exact rule the button passes: a bare tool name allows its every call.
          <p className="agent-rule">
            Allows <span className="mono">{denial.rule}</span> for one run.
          </p>
        )}
      </Banner>
    </div>
  ));
}

/** The latest run: its state, its buttons, what it was blocked from, and its log. */
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
      {run.reason && run.state !== "running" && <p className="agent-reason">{run.reason}</p>}
      {!running && (
        <Denials
          denials={run.denials}
          onAllow={canStart ? (seq) => onAllow(run.id, seq) : undefined}
        />
      )}
      {running ? (
        <div className="actions">
          <Button variant="destructive" label="Stop" clickAction={stop} />
        </div>
      ) : (
        canStart && (
          <div className="actions">
            <Button
              variant="primary"
              label={
                run.state === "failed" || run.state === "stopped" ? "Try again" : "Start the agent"
              }
              clickAction={onStart}
            />
          </div>
        )
      )}
      <RunLog run={run} />
    </>
  );
}

/** An earlier run: its step, state, and date, and its log once opened. */
function EarlierRun({ id, waitsOnHuman }: { id: string; waitsOnHuman: boolean }) {
  const run = useRun(id);
  const [open, setOpen] = useState(false);
  if (!run) {
    return null;
  }
  return (
    <Collapsible
      isOpen={open}
      onOpenChange={setOpen}
      trigger={
        <span>
          {stepLabel(run.step)} · {stateText(run, waitsOnHuman)} ·{" "}
          {new Date(run.startedAt).toLocaleString()}
        </span>
      }
    >
      {open && <RunLog run={run} />}
    </Collapsible>
  );
}

/**
 * A feature's agent: the latest run live, Stop while it goes on, "Start the agent" or "Try again"
 * when the feature waits on an agent, and the earlier runs.
 */
export function AgentPanel({ feature }: { feature: Feature }) {
  const fate = useFateClient();
  const runner = useRunner();
  // A run started here shows before the feature's live update lists it.
  const [started, setStarted] = useState<string>();
  const [message, setMessage] = useState<string>();
  const runs =
    started && !feature.runs.includes(started) ? [started, ...feature.runs] : feature.runs;
  const [latest, ...earlier] = runs;
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
    <section className="agent-panel" aria-label="Agent">
      <div className="group label">Agent</div>
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
        <div className="actions">
          <Button variant="primary" label="Start the agent" clickAction={start} />
        </div>
      )}
      {message && <p className="not-saved">{message}</p>}
      {earlier.length > 0 && (
        <Collapsible
          defaultIsOpen={false}
          trigger={
            <span className="agent-earlier">
              <span>Earlier runs</span> <span className="muted">{earlier.length}</span>
            </span>
          }
        >
          {earlier.map((id) => (
            <EarlierRun key={id} id={id} waitsOnHuman={waitsOnHuman} />
          ))}
        </Collapsible>
      )}
    </section>
  );
}
