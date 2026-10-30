// The messages sent to a feature while its commits were queued, which the server kept until they
// landed (R65): when one of those commits is refused, the server drops them, their text in the
// refused write's `queued`, and the composer of the feature's session takes it back, once. A kept
// message whose send was refused once they landed comes back the same, in an `unsent` write (R89).
import { type ReactNode, Suspense, useEffect, useState } from "react";
import { type Draft, takeBackInto } from "../useDraft.ts";
import { useWriteQueue } from "../writes/useWriteQueue.ts";

/** Why the composer holds a message it sent: it went back when the commit it waited for failed. */
export const RETURNED = "Not sent: the commit it waited for was refused. Your message is back.";

/** Why the composer holds a message it sent: its send was refused once its commits landed. */
export const UNSENT = "Not sent: sending it failed. Your message is back.";

/** The refused writes whose messages this document put back in a composer already. */
const taken = new Set<string>();

type Take = Pick<Draft, "setImages" | "setText">;

/**
 * Reads the queue for the refused write that returned `folder`'s messages, puts them in the draft
 * once, and gives its id to `onRead`, or none.
 */
function TakeBack({
  draft: { setImages, setText },
  folder,
  onRead,
}: {
  draft: Take;
  folder: string;
  onRead: (returned: { id: string; unsent: boolean } | undefined) => void;
}) {
  const write = useWriteQueue().findLast(
    (each) =>
      each.folder === folder &&
      each.state === "refused" &&
      each.steps === undefined &&
      each.queued !== undefined,
  );
  const id = write?.id;
  const queued = write?.queued;
  const unsent = write?.failure === "unsent";
  useEffect(() => {
    if (id !== undefined && queued !== undefined && !taken.has(id)) {
      taken.add(id);
      takeBackInto({ setImages, setText })(queued, []);
    }
    onRead(id === undefined ? undefined : { id, unsent });
  }, [id, onRead, queued, setImages, setText, unsent]);
  return null;
}

/** What a page hands its composer: its notice, and what follows a sent message. */
type Handed = { notice?: string; onSent?: (session: string) => void };

/**
 * The messages kept for `folder` and returned by a refused commit: once per refusal in this
 * document, put in `draft` before what it holds. Gives what to draw, which reads the queue under a
 * `Suspense` of its own, so the page never waits for it; and `handing`, the page's `given` hand-over
 * to the composer, with a notice that says why, unless the page gives one, until the composer sends
 * again or the refusal is dismissed. A start's messages go back in its steps' own composer (R59):
 * its page gives no folder.
 */
export function useReturnedMessages<H extends Handed>(
  folder: string | undefined,
  draft: Take,
  given: H,
): { element: ReactNode; handing: H & { onSent: (session: string) => void } } {
  const [returned, setReturned] = useState<{ id: string; unsent: boolean }>();
  const [answered, setAnswered] = useState<string>();
  const shows = returned !== undefined && answered !== returned.id;
  return {
    element:
      folder === undefined ? null : (
        <Suspense fallback={null}>
          <TakeBack draft={draft} folder={folder} onRead={setReturned} />
        </Suspense>
      ),
    handing: {
      ...(shows ? { notice: returned.unsent ? UNSENT : RETURNED } : {}),
      ...given,
      onSent: (session: string) => {
        setAnswered(returned?.id);
        given.onSent?.(session);
      },
    },
  };
}
