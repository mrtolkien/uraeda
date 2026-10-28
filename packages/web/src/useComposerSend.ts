import { useState } from "react";
import { useFateClient } from "react-fate";
import type { ComposerProps } from "./Composer.tsx";
import { refusal } from "./errors.ts";
import { sendMessage } from "./sessions.ts";
import { SessionView } from "./views.ts";
import { clearPending, markPending } from "./writes/store.ts";

/**
 * Sends the composer's message and stops its turn: a refused send puts its text and images back,
 * with the reason. The workflow's message goes alone: the draft's images stay for the next one
 * (R67).
 */
export function useSend(
  {
    folder,
    images,
    isNewSession,
    onChange,
    onImagesChange,
    onSend,
    onSent,
    session,
    workflow,
  }: ComposerProps,
  { canSend, sent }: { canSend: boolean; sent: () => void },
) {
  const fate = useFateClient();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const withImages = workflow === undefined;
  const submit = (text: string) => {
    if (!canSend || pending) {
      return;
    }
    if (onSend) {
      // The text stays until it is sent, and `onSend` clears it: a refusal leaves it as typed.
      setPending(true);
      void onSend(text, images).then((done) => {
        setPending(false);
        if (done) {
          onImagesChange([]);
          sent();
        }
      });
      return;
    }
    const sending = withImages ? images : [];
    setError(undefined);
    // The feature's card says so at once, until the server's status for it changes.
    const starting = workflow !== undefined ? folder : undefined;
    if (starting !== undefined) {
      markPending(starting, "Starting the agent…");
    }
    onChange("");
    if (withImages) {
      onImagesChange([]);
      sent();
    }
    void sendMessage(fate, {
      ...(session === undefined
        ? folder === undefined
          ? {}
          : { folder, ...(isNewSession ? { newSession: true } : {}) }
        : { session }),
      images: sending.flatMap((image) => (image.image ? [image.image] : [])),
      text,
      ...(workflow === undefined ? {} : { workflow }),
    }).then((result) => {
      if (result.ok) {
        onSent?.(result.session);
        return;
      }
      if (starting !== undefined) {
        clearPending(starting);
      }
      onChange(text);
      if (sending.length > 0) {
        onImagesChange((now) => [...sending, ...now]);
      }
      setError(result.message);
    });
  };
  const stop = () => {
    if (session !== undefined) {
      setError(undefined);
      if (folder !== undefined) {
        markPending(folder, "Stopping…");
      }
      // The turn ends once the agent answers the interrupt: its live update brings the state.
      void fate.mutations.session.stop({ input: { session }, view: SessionView }).then((result) => {
        if (result.error) {
          if (folder !== undefined) {
            clearPending(folder);
          }
          setError(refusal(result.error).message);
        }
      });
    }
  };
  return { error, pending, stop, submit };
}
