import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { KeyCap } from "../keys/KeyCap.tsx";
import { afterOverlayCloses, Overlay } from "../layout/Overlay.tsx";

/**
 * An answer of a confirmation besides its two: its button's words, the key that gives it, and the
 * value the question resolves with, as a category's delete's "No, keep the notes".
 */
export type ConfirmAnswer<T extends string> = { key: string; label: string; value: T };

/**
 * What a confirmation asks: its title, its body, and its buttons. The confirm button is the
 * dialog's main one, or a destructive one when it deletes what the human typed. `answers` are drawn
 * between Cancel and it, each resolving the question with its own value.
 */
export type ConfirmOptions<T extends string = never> = {
  answers?: ReadonlyArray<ConfirmAnswer<T>>;
  body: string;
  cancel: string;
  /** The key that cancels, `n` unless an answer takes it. */
  cancelKey?: string;
  confirm: string;
  /** Another key that confirms, besides `y`: a delete's `d`, so that `d d` deletes. */
  confirmKey?: string;
  destructive?: boolean;
  /** A line under the body, in the secondary colour: what an answer does. */
  detail?: string;
  title: string;
};

/** What the commit page's Discard asks: `count` changes waiting for a commit are written back. */
export function discardChanges(count: number): ConfirmOptions {
  return {
    body: `${count === 1 ? "The change" : `The ${count} changes`} waiting for a commit will be discarded.`,
    cancel: "Keep them",
    confirm: "Discard them",
    // `d d` discards, as `y` does.
    confirmKey: "d",
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

/**
 * Asks a question: resolves with `true` for its confirm button, `false` for its cancel, and an
 * answer's value for that answer's button.
 */
type Ask = <T extends string = never>(options: ConfirmOptions<T>) => Promise<boolean | T>;

/** An answer as the host resolves the question with it. */
type Given = boolean | string;

/** Outside a host, nothing asks, and nothing is confirmed. */
const ConfirmContext = createContext<Ask>(async () => false);

/**
 * Asks the human to confirm, like "Discard your comment?" or "Leave page?": resolves with `true`
 * for the confirm button, `false` for the cancel button, Close, Escape, Back, or a newer question,
 * and an answer's value for its button. The answer comes once the confirmation's history entry is
 * gone, so a page opened then stays.
 */
export function useConfirm(): Ask {
  return useContext(ConfirmContext);
}

/**
 * The keys of every confirmation, the one window for them all, while `isOpen`, whatever the
 * single-key shortcuts' setting, as a dialog's own: `y` confirms, the cancel key (`n`) cancels, a
 * question's own `confirmKey` confirms too, and each answer's key gives it. Escape and Back cancel,
 * as the overlay's.
 */
function useConfirmKeys(
  isOpen: boolean,
  shown: ConfirmOptions<string> | undefined,
  onAnswer: (given: Given) => void,
) {
  const answerWith = useEffectEvent(onAnswer);
  useEffect(() => {
    if (!isOpen || shown === undefined) {
      return;
    }
    const given = (key: string): Given | undefined => {
      if (key === "y" || key === shown.confirmKey) {
        return true;
      }
      const answer = shown.answers?.find((one) => one.key === key);
      if (answer !== undefined) {
        return answer.value;
      }
      return key === (shown.cancelKey ?? "n") ? false : undefined;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat) {
        return;
      }
      const found = given(event.key.toLowerCase());
      if (found !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        answerWith(found);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, shown]);
}

/**
 * A question's body, its detail, and its buttons: Cancel first, then its answers, then the confirm
 * button, each with its key.
 */
function Question({
  onAnswer,
  shown,
}: {
  onAnswer: (given: Given) => void;
  shown: ConfirmOptions<string>;
}) {
  return (
    <VStack gap={4}>
      <VStack gap={2}>
        <Text display="block">{shown.body}</Text>
        {shown.detail !== undefined && (
          <Text color="secondary" display="block">
            {shown.detail}
          </Text>
        )}
      </VStack>
      {/* Wrapping, so a long label stays whole rather than cut (the UI checks decision). */}
      <HStack gap={2} justify="end" wrap="wrap">
        <Button
          // The focus opens on the cancel button, in every browser: Firefox would put it on the
          // dialog's Close, and Enter keeps rather than confirms.
          data-autofocus=""
          endContent={<KeyCap>{shown.cancelKey ?? "n"}</KeyCap>}
          label={shown.cancel}
          onClick={() => onAnswer(false)}
          variant="secondary"
        />
        {shown.answers?.map((answer) => (
          <Button
            endContent={<KeyCap>{answer.key}</KeyCap>}
            key={answer.value}
            label={answer.label}
            onClick={() => onAnswer(answer.value)}
            variant="secondary"
          />
        ))}
        <Button
          endContent={<KeyCap>y</KeyCap>}
          label={shown.confirm}
          onClick={() => onAnswer(true)}
          variant={shown.destructive ? "destructive" : "primary"}
        />
      </HStack>
    </VStack>
  );
}

/**
 * Where the app's confirmations show, rendered once, in `App`: an `Overlay`, a dialog on wide
 * screens and a sheet on the phone, with Close, and Back closing it.
 */
export function ConfirmHost({ children }: { children: ReactNode }) {
  // The question open now, and the last one asked, still drawn while its overlay closes.
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<ConfirmOptions<string>>();
  // Who waits for the answer, set and read in handlers only.
  const waiting = useRef<(given: Given) => void>(undefined);

  const ask = ((options: ConfirmOptions<string>) =>
    new Promise<Given>((resolve) => {
      waiting.current?.(false);
      waiting.current = resolve;
      setShown(options);
      setOpen(true);
    })) as Ask;
  const answer = (given: Given) => {
    const resolve = waiting.current;
    waiting.current = undefined;
    setOpen(false);
    if (resolve !== undefined && shown !== undefined) {
      afterOverlayCloses(shown.title, () => resolve(given));
    }
  };
  useConfirmKeys(open, shown, answer);

  return (
    <ConfirmContext value={ask}>
      {children}
      {shown !== undefined && (
        <Overlay isOpen={open} label={shown.title} onClose={() => answer(false)} sheetHeight="hug">
          <Question onAnswer={answer} shown={shown} />
        </Overlay>
      )}
    </ConfirmContext>
  );
}
