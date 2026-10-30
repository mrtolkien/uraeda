// A git write refused, shown where it happened, with its output, and Dismiss, which takes it out of
// the toast too: a hook's refusal says what is back as it was; any other failure, that the change is
// still written, not committed, with Try again where the place offers it, or that the commit page
// lists it, but for a feature's file, which the commit page never lists (R93). The toast's Open
// comes here.
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Link } from "@astryxdesign/core/Link";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { useLocalPath, useRepoPath } from "../routes.tsx";
import { REFUSED_ID, useDismissWrite, useRefusal, type Where } from "./useWriteQueue.ts";
import { WriteButton } from "./WriteButton.tsx";

/** The commit page's path, which a failed write's banner links, but on the commit page itself. */
const COMMIT_PAGE = "/commit";

/**
 * The refusal of the latest write at `where`: `what` says what a hook's refusal put back, as "the
 * spec awaits your verdict again."; `onRetry`, the place's Try again, commits what a failure left
 * written.
 */
export function RefusedHere({
  onRetry,
  what,
  where,
}: {
  onRetry?: () => Promise<void>;
  what: string;
  where: Where;
}) {
  const write = useRefusal(where);
  const dismiss = useDismissWrite();
  const here = useRepoPath();
  const onCommitPage = useLocalPath() === COMMIT_PAGE;
  if (!write) {
    return null;
  }
  const failed = write.failure === "failed";
  // A feature's file is on its branch: the commit page lists only the default branch's lists.
  const listed = !onCommitPage && (write.folder === undefined || write.file === undefined);
  return (
    <div id={REFUSED_ID}>
      <AnnouncedBanner
        collapsible={false}
        dismissLabel="Dismiss"
        isDismissable
        onDismiss={() => void dismiss(write.id)}
        status="error"
        title={
          failed
            ? "The commit failed: the change is still written, not committed."
            : `The pre-commit hook refused the commit: ${what}`
        }
        {...(failed && onRetry
          ? { endContent: <WriteButton label="Try again" onClick={onRetry} /> }
          : {})}
        {...(failed && !onRetry && listed
          ? {
              description: (
                <>
                  {"The "}
                  <Link hasUnderline href={here(COMMIT_PAGE)}>
                    commit page
                  </Link>
                  {" lists it."}
                </>
              ),
            }
          : {})}
      >
        {write.output && <CodeBlock code={write.output} isWrapped size="sm" width="100%" />}
      </AnnouncedBanner>
    </div>
  );
}
