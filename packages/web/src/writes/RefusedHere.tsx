// A git write a hook refused, shown where it happened: what is back as it was, the hook's output,
// and Dismiss, which takes it out of the toast too. The toast's Open comes here.
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { REFUSED_ID, useDismissWrite, useRefusal, type Where } from "./useWriteQueue.ts";

/** The refusal of the latest write at `where`, if a hook refused it: `what` says what is back. */
export function RefusedHere({ what, where }: { what: string; where: Where }) {
  const write = useRefusal(where);
  const dismiss = useDismissWrite();
  if (!write) {
    return null;
  }
  return (
    <div id={REFUSED_ID}>
      <AnnouncedBanner
        collapsible={false}
        dismissLabel="Dismiss"
        isDismissable
        onDismiss={() => void dismiss(write.id)}
        status="error"
        title={`The pre-commit hook refused the commit: ${what}`}
      >
        {write.output && <CodeBlock code={write.output} isWrapped size="sm" width="100%" />}
      </AnnouncedBanner>
    </div>
  );
}
