import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { KeyCap } from "../keys/KeyCap.tsx";
import { afterOverlayCloses, Overlay } from "../layout/Overlay.tsx";

/**
 * What a confirmation asks: its title, its body, and its two buttons. The confirm button is the
 * dialog's main one, or a destructive one when it deletes what the human typed.
 */
export type ConfirmOptions = {
  body: string;
  cancel: string;
  confirm: string;
  /** Another key that confirms, besides `y`: a delete's `d`, so that `d d` deletes. */
  confirmKey?: string;
  destructive?: boolean;
  title: string;
};

/** What the commit bar's Discard asks: `count` changes waiting for a commit are written back. */
export function discardChanges(count: number): ConfirmOptions {
  return {
    body: `${count === 1 ? "The change" : `The ${count} changes`} waiting for a commit will be discarded.`,
    cancel: "Keep them",
    confirm: "Discard them",
    destructive: true,
    title: "Discard these changes?",
  };
}

/** What `d` asks on a line of a list, before it deletes it; `d` or `y` deletes, `n` keeps. */
export function deleteLine(text: string): ConfirmOptions {
  return {
    body: text,
    cancel: "Keep it",
    confirm: "Delete",
    confirmKey: "d",
    destructive: true,
    title: "Delete this line?",
  };
}

/** What Escape or Cancel asks on a changed line, quick add, or slug: fields that are not comments. */
export const DISCARD_CHANGES: ConfirmOptions = {
  body: "The text you typed is deleted.",
  cancel: "Keep editing",
  confirm: "Discard",
  destructive: true,
  title: "Discard your changes?",
};

type Ask = (options: ConfirmOptions) => Promise<boolean>;

/** Outside a host, nothing asks, and nothing is confirmed. */
const ConfirmContext = createContext<Ask>(async () => false);

/**
 * Asks the human to confirm, like "Discard your comment?" or "Leave page?": resolves with `true`
 * for the confirm button, `false` for the cancel button, Close, Escape, Back, or a newer question.
 * The answer comes once the confirmation's history entry is gone, so a page opened then stays.
 */
export function useConfirm(): Ask {
  return useContext(ConfirmContext);
}

/**
 * Where the app's confirmations show, rendered once, in `App`: an `Overlay`, a dialog on wide
 * screens and a sheet on the phone, with Close, and Back closing it.
 */
export function ConfirmHost({ children }: { children: ReactNode }) {
  // The question open now, and the last one asked, still drawn while its overlay closes.
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<ConfirmOptions>();
  // Who waits for the answer, set and read in handlers only.
  const waiting = useRef<(confirmed: boolean) => void>(undefined);

  const ask: Ask = (options) =>
    new Promise((resolve) => {
      waiting.current?.(false);
      waiting.current = resolve;
      setShown(options);
      setOpen(true);
    });
  const answer = (confirmed: boolean) => {
    const resolve = waiting.current;
    waiting.current = undefined;
    setOpen(false);
    if (resolve !== undefined && shown !== undefined) {
      afterOverlayCloses(shown.title, () => resolve(confirmed));
    }
  };

  // The keys of every confirmation, the one window for them all: `y` confirms, `n` cancels, and a
  // question's own `confirmKey` confirms too. Escape and Back cancel, as the overlay's.
  const confirmKey = shown?.confirmKey;
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "y" || key === confirmKey) {
        event.preventDefault();
        event.stopPropagation();
        answer(true);
      } else if (key === "n") {
        event.preventDefault();
        event.stopPropagation();
        answer(false);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
    // `answer` reads the question of this render: the effect follows it.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shown]);

  return (
    <ConfirmContext value={ask}>
      {children}
      {shown !== undefined && (
        <Overlay isOpen={open} label={shown.title} onClose={() => answer(false)} sheetHeight="hug">
          <VStack gap={4}>
            <Text>{shown.body}</Text>
            {/* Wrapping, so a long label stays whole rather than cut (the UI checks decision). */}
            <HStack gap={2} justify="end" wrap="wrap">
              <Button
                endContent={<KeyCap>n</KeyCap>}
                label={shown.cancel}
                onClick={() => answer(false)}
                variant="secondary"
              />
              <Button
                endContent={<KeyCap>y</KeyCap>}
                label={shown.confirm}
                onClick={() => answer(true)}
                variant={shown.destructive ? "destructive" : "primary"}
              />
            </HStack>
          </VStack>
        </Overlay>
      )}
    </ConfirmContext>
  );
}
