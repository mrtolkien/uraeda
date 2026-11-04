// A git write refused, shown where it happened, with its output, and Dismiss, which takes it out of
// the toast too: a hook's refusal says what is back as it was; any other failure, that the change is
// still written, not committed, with Try again where the place offers it, or that the Git page
// lists it, but for a feature's file, which its own page tries again. The toast's Open
// comes here.
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Link } from "@astryxdesign/core/Link";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { useLocalPath, useRepoPath } from "../routes.tsx";
import {
  REFUSED_ID,
  useDismissWrite,
  useRefusal,
  type Where,
  type Write,
} from "./useWriteQueue.ts";
import { WriteButton } from "./WriteButton.tsx";

/** The Git page's path, which a failed write's banner links, but on the Git page itself. */
const GIT_PAGE = "/git";

/**
 * The refusal of the latest write at `where`: `what` says what a hook's refusal put back, as "the
 * spec awaits your verdict again."; `onRetry`, the place's Try again, commits what a failure left
 * written. `title`, where the write is no commit of a change, like the Git page's pull, says what
 * failed instead, its output under it.
 */
export function RefusedHere({
  onRetry,
  title,
  what,
  where,
}: {
  onRetry?: () => Promise<void>;
  title?: (write: Write) => string;
  what: string;
  where: Where;
}) {
  const write = useRefusal(where);
  const dismiss = useDismissWrite();
  const here = useRepoPath();
  const onGitPage = useLocalPath() === GIT_PAGE;
  if (!write) {
    return null;
  }
  const failed = write.failure === "failed";
  // A feature's file is on its branch: its own page's Try again commits it.
  const listed =
    !onGitPage && title === undefined && (write.folder === undefined || write.file === undefined);
  return (
    <div id={REFUSED_ID}>
      <AnnouncedBanner
        collapsible={false}
        dismissLabel="Dismiss"
        isDismissable
        onDismiss={() => void dismiss(write.id)}
        status="error"
        title={
          title?.(write) ??
          (failed
            ? "The commit failed: the change is still written, not committed."
            : `The pre-commit hook refused the commit: ${what}`)
        }
        {...(failed && onRetry
          ? { endContent: <WriteButton label="Try again" onClick={onRetry} /> }
          : {})}
        {...(failed && !onRetry && listed
          ? {
              description: (
                <>
                  {"The "}
                  <Link hasUnderline href={here(GIT_PAGE)}>
                    Git page
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
