import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { createContext, type ReactNode, useContext, useState } from "react";

/** What a confirmation asks: its title, its body, and its two buttons. */
export type ConfirmOptions = { body: string; cancel: string; confirm: string; title: string };

type Ask = (options: ConfirmOptions) => Promise<boolean>;

/** Outside a host, nothing asks, and nothing is confirmed. */
const ConfirmContext = createContext<Ask>(async () => false);

/**
 * Asks the human to confirm, like "Discard your comment?" or "Leave page?": resolves with `true`
 * for the confirm button, `false` for the cancel button, Escape, or a newer question.
 */
export function useConfirm(): Ask {
  return useContext(ConfirmContext);
}

/** Where the app's confirmations show, on Astryx's `AlertDialog`: rendered once, in `App`. */
export function ConfirmHost({ children }: { children: ReactNode }) {
  const [asked, setAsked] = useState<{
    options: ConfirmOptions;
    resolve: (confirmed: boolean) => void;
  }>();
  const answer = (confirmed: boolean) => {
    asked?.resolve(confirmed);
    setAsked(undefined);
  };
  const ask: Ask = (options) =>
    new Promise((resolve) => {
      setAsked((before) => {
        before?.resolve(false);
        return { options, resolve };
      });
    });
  return (
    <ConfirmContext value={ask}>
      {children}
      {asked && (
        <AlertDialog
          actionLabel={asked.options.confirm}
          cancelLabel={asked.options.cancel}
          description={asked.options.body}
          isOpen
          onAction={() => answer(true)}
          onOpenChange={(open: boolean) => {
            if (!open) {
              answer(false);
            }
          }}
          title={asked.options.title}
        />
      )}
    </ConfirmContext>
  );
}
