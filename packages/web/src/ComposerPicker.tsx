// What the composer's message runs on: for a message that makes its session, the session picker,
// agent, model, and effort; in a running session, its effort alone, changed from its next turn on.
import { Suspense } from "react";
import { useFateClient, useLiveView, useRequest } from "react-fate";
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
import { pickerRuntimes, SessionPicker } from "./SessionPicker.tsx";
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

/**
 * The runtime the composer's message goes to: the session's, by the name it stored, or for a
 * message that makes its session, to a feature without one or a new chat, the one picked, with its
 * `picker`, and `sent`, what the message's input sends of the pick. In a running session, `picker`
 * is its effort's. `unavailable` says why nothing can be sent: the page's `blocked`, or the runtime
 * off, gone, or not on this machine. A message sent elsewhere, `onSend`, needs no runtime.
 */
export function useComposerRuntime({ agent, blocked, onSend, session }: ComposerProps) {
  const makes = session === undefined && !onSend;
  const { pick, sent, setPick } = useSessionPick();
  const on = useRuntimesOn();
  const choice = useRuntime(makes ? undefined : agent, pick?.runtime);
  const effort = session !== undefined && !onSend && agent !== undefined && (
    // Read on its own: the composer draws before the session's pick.
    <Suspense fallback={null}>
      <SessionEffort agent={agent} id={session} />
    </Suspense>
  );
  return {
    agent: choice.runtime,
    picker: makes ? (
      <SessionPicker onChange={setPick} runtimes={pickerRuntimes(on)} value={pick} />
    ) : (
      effort
    ),
    // What the picker shows: a pick turned off since is never sent.
    sent: makes ? sent : {},
    unavailable: onSend ? blocked : (runtimeRefusal(choice) ?? blocked),
  };
}
