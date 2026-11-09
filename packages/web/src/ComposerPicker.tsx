// What the composer's message runs on: for a message that makes its session, the session picker,
// agent, model, and effort, a feature's showing its next step's pick until the human picks; in a
// running session, its effort alone, changed from its next turn on.
import { Suspense, useEffect, useState } from "react";
import { useFateClient, useLiveView, useRequest, view } from "react-fate";
import type { Feature } from "uraeda-server/fate";
import type { ComposerProps } from "./Composer.tsx";
import { refusal } from "./errors.ts";
import { useTimedToast } from "./layout/useTimedToast.tsx";
import {
  runtimeRefusal,
  useRuntime,
  useRuntimes,
  useRuntimesOn,
  useSessionPick,
} from "./runtimes.ts";
import {
  type PickerRuntime,
  pickerRuntimes,
  type SessionPick,
  SessionPicker,
} from "./SessionPicker.tsx";
import { SessionPickView } from "./views.ts";

/**
 * A running session's effort: the picker with `isStarted`, its value the session's stored pick,
 * shown at once as changed while the server stores it. A refusal says why in a toast and puts the
 * effort back. A session whose runtime is off here, or whose model takes no effort, shows nothing.
 */
function SessionEffort({ agent, id }: { agent: string; id: string }) {
  const fate = useFateClient();
  const showToast = useTimedToast();
  const { session } = useRequest({ session: { id, view: SessionPickView } });
  const record = useLiveView(SessionPickView, session);
  const own = useRuntimes().filter((runtime) => runtime.kind === agent && runtime.isOn);
  if (!record) {
    return null;
  }
  return (
    <SessionPicker
      hasPageKey
      isStarted
      onChange={(next) => {
        const effort = next.effort ?? null;
        void fate.mutations.session
          .setEffort({ input: { effort, id }, optimistic: { effort, id }, view: SessionPickView })
          .then((result) => {
            if (result.error) {
              showToast({ autoHideDuration: 5000, body: refusal(result.error).message });
            }
          });
      }}
      runtimes={pickerRuntimes(own)}
      value={{
        runtime: agent,
        ...(record.model === null ? {} : { model: record.model }),
        ...(record.effort === null ? {} : { effort: record.effort }),
      }}
    />
  );
}

/** What a session of a feature made without a pick runs on, as the server says. */
const FeaturePickView = view<Feature>()({
  id: true,
  newPick: { effort: true, model: true, runtime: true },
});

/**
 * The picker of a feature's new session: what the human picked, else what a session made without a
 * pick runs on, its next step's pick from the feature's run options, as the server says, whose
 * agent it tells `onStepRuntime`.
 */
function FeaturePicker({
  folder,
  onChange,
  onStepRuntime,
  runtimes,
  value,
}: {
  folder: string;
  onChange: (pick: SessionPick) => void;
  onStepRuntime: (runtime: string | undefined) => void;
  runtimes: ReadonlyArray<PickerRuntime>;
  value: SessionPick | undefined;
}) {
  const { feature } = useRequest({ feature: { id: folder, view: FeaturePickView } });
  const step = useLiveView(FeaturePickView, feature)?.newPick;
  useEffect(() => onStepRuntime(step?.runtime), [onStepRuntime, step?.runtime]);
  const shown =
    value ??
    (step
      ? {
          runtime: step.runtime,
          ...(step.model === null ? {} : { model: step.model }),
          ...(step.effort === null ? {} : { effort: step.effort }),
        }
      : undefined);
  return <SessionPicker hasPageKey onChange={onChange} runtimes={runtimes} value={shown} />;
}

/**
 * Reads the agent of `folder`'s next step, as a session of it made without a pick runs on, and
 * tells it `onStepRuntime`: draws nothing.
 */
function StepRuntime({
  folder,
  onStepRuntime,
}: {
  folder: string;
  onStepRuntime: (runtime: string | undefined) => void;
}) {
  const { feature } = useRequest({ feature: { id: folder, view: FeaturePickView } });
  const runtime = useLiveView(FeaturePickView, feature)?.newPick?.runtime;
  useEffect(() => onStepRuntime(runtime), [onStepRuntime, runtime]);
  return null;
}

/**
 * The runtime the composer's message goes to: the session's, by the name it stored, or for a
 * message that makes its session, to a feature without one or a new chat, the one picked, with its
 * `picker`, and `sent`, what the message's input sends of the pick: a feature's, never picked, its
 * next step's agent, as its picker shows. In a running session, `picker` is its effort's. A
 * workflow message in a session of a feature goes where the server runs its step: its next step's
 * agent, the session's when it is the same, else a new session on the step's pick (`runSession`).
 * `unavailable` says why nothing can be sent: the page's `blocked`, or the runtime off, gone, or
 * not on this machine; `offer` says it of a workflow message, which the recommended message would
 * be. `reader` reads the next step's agent, drawn by the composer. A message sent elsewhere,
 * `onSend`, needs no runtime.
 */
export function useComposerRuntime({
  agent,
  blocked,
  folder,
  onSend,
  session,
  workflow,
}: ComposerProps) {
  const makes = session === undefined && !onSend;
  const { pick, sent, setPick } = useSessionPick();
  const on = useRuntimesOn();
  // A feature's next step's agent, once read: the server makes a session sent no pick on it, and
  // runs a workflow message of a session on it, so the message goes there, and waits while it is off.
  const [stepRuntime, setStepRuntime] = useState<string>();
  const unpicked = pick === undefined && folder !== undefined ? stepRuntime : undefined;
  const choice = useRuntime(makes ? unpicked : agent, pick?.runtime);
  const step = useRuntime(makes ? unpicked : (stepRuntime ?? agent), pick?.runtime);
  const reads = !makes && !onSend && folder !== undefined;
  const reader = reads && (
    <Suspense fallback={null}>
      <StepRuntime folder={folder} onStepRuntime={setStepRuntime} />
    </Suspense>
  );
  const effort = session !== undefined && !onSend && agent !== undefined && (
    // Read on its own: the composer draws before the session's pick.
    <Suspense fallback={null}>
      <SessionEffort agent={agent} id={session} />
    </Suspense>
  );
  const plain = (
    <SessionPicker hasPageKey onChange={setPick} runtimes={pickerRuntimes(on)} value={pick} />
  );
  const chatUnavailable = runtimeRefusal(choice) ?? blocked;
  const workflowUnavailable = runtimeRefusal(step) ?? blocked;
  return {
    agent: (workflow ? step : choice).runtime,
    offer: onSend ? blocked : workflowUnavailable,
    picker: !makes ? (
      effort
    ) : folder === undefined ? (
      plain
    ) : (
      <Suspense fallback={plain}>
        <FeaturePicker
          folder={folder}
          onChange={setPick}
          onStepRuntime={setStepRuntime}
          runtimes={pickerRuntimes(on)}
          value={pick}
        />
      </Suspense>
    ),
    // What the picker shows: a pick turned off since is never sent. A feature's, never picked,
    // sends nothing: the server makes its session on its next step's pick.
    reader,
    sent: makes && (pick !== undefined || folder === undefined) ? sent : {},
    unavailable: onSend ? blocked : workflow ? workflowUnavailable : chatUnavailable,
  };
}
