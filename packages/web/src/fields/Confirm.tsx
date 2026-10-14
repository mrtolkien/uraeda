import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { createContext, type ReactNode, useContext, useRef, useState } from "react";
import { afterOverlayCloses, Overlay } from "../layout/Overlay.tsx";

/** What a confirmation asks: its title, its body, and its two buttons. */
export type ConfirmOptions = { body: string; cancel: string; confirm: string; title: string };

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

  return (
    <ConfirmContext value={ask}>
      {children}
      {shown !== undefined && (
        <Overlay
          isOpen={open}
          label={shown.title}
          onClose={() => answer(false)}
          sheetHeight="capped"
        >
          <VStack gap={4}>
            <Text>{shown.body}</Text>
            <HStack gap={2} justify="end">
              <Button label={shown.cancel} onClick={() => answer(false)} variant="secondary" />
              <Button label={shown.confirm} onClick={() => answer(true)} variant="destructive" />
            </HStack>
          </VStack>
        </Overlay>
      )}
    </ConfirmContext>
  );
}
