// The git writes in flight, at the window's bottom right, on the leader menu's frosted glass: the
// one running, with what it does, then the ones waiting their turn. The page already shows each
// write's result: the toast says only that it is still landing in git. A write refused stays until
// it is opened or dismissed, its output under it, as its page also shows: a hook's refusal put its
// files back, any other failure left them written, for the commit page. On the phone, it spans the
// screen's width over the bottom bar.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars, typographyVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import type { WriteFailure } from "uraeda-server/fate";
import { glassStyles } from "../layout/glass.ts";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { navigateHere, useRepoPath } from "../routes.tsx";
import { sessionPath } from "../sessions.ts";
import { REFUSED_ID, useDismissWrite, useWriteQueue } from "./useWriteQueue.ts";

/** A git write as the toast lists it: what it does, and where it is in the queue. */
export type QueuedWrite = {
  /** Once refused, why: a hook refused it, its files put back, or it failed, its files left. */
  failure?: WriteFailure;
  id: string;
  /** What it does, as its button said: "Approving the spec of Performance pass". */
  label: string;
  /** The hook's output, or the failure's message, for a write refused. */
  output?: string;
  state: "running" | "waiting" | "refused";
};

const styles = stylex.create({
  // Where the leader menu rises, over the status line: the menu, when open, covers it.
  // The phone's bar may slide away: the toast follows it down, as the session's composer does.
  place: {
    insetBlockEnd: `calc(var(--status-line-offset, var(--size-status-line, 0px)) + ${spacingVars["--spacing-2"]})`,
    insetInlineEnd: spacingVars["--spacing-3"],
    maxWidth: `calc(100vw - 2 * ${spacingVars["--spacing-3"]})`,
    padding: spacingVars["--spacing-3"],
    position: "fixed",
    width: "var(--size-commit-toast, 26rem)",
    zIndex: 2,
  },
  // On the phone, across the screen's width, as the leader menu's sheet.
  across: {
    insetInline: spacingVars["--spacing-2"],
    maxWidth: "none",
    width: "auto",
  },
  // The hook's output, in the code's font, a few lines high before it scrolls.
  output: {
    fontFamily: typographyVars["--font-family-code"],
    margin: 0,
    maxHeight: "var(--size-hook-output, 10rem)",
    overflow: "auto",
    whiteSpace: "pre-wrap",
  },
  // Square, as every glass is.
  square: { borderRadius: 0 },
});

/** Why a refused write did not land, and what it left: a failure points to the commit page. */
export function RefusalText({ commitHref, write }: { commitHref?: string; write: QueuedWrite }) {
  if (write.failure === "unsent") {
    return <>Not sent: your message is back in its composer.</>;
  }
  if (write.failure !== "failed") {
    return <>A hook refused the commit: what it showed is back as it was.</>;
  }
  return (
    <>
      The commit failed: the change is still written, not committed.
      {commitHref !== undefined && (
        <>
          {" The "}
          <Link hasUnderline href={commitHref}>
            commit page
          </Link>
          {" lists it."}
        </>
      )}
    </>
  );
}

/** One write's row: its icon, what it does, and how far it is. */
function Row({
  commitHref,
  onDismiss,
  onOpen,
  write,
}: {
  commitHref: string;
  onDismiss: () => void;
  onOpen: () => void;
  write: QueuedWrite;
}) {
  if (write.state === "refused") {
    return (
      <VStack gap={2}>
        <HStack align="center" gap={2}>
          <Icon color="error" icon="uraeda:triangle-alert" label="Refused" />
          <Text weight="semibold">{write.label}</Text>
        </HStack>
        <Text color="secondary" type="supporting">
          <RefusalText commitHref={commitHref} write={write} />
        </Text>
        {write.output && <pre {...stylex.props(styles.output)}>{write.output}</pre>}
        <HStack gap={2} justify="end">
          <Button label="Dismiss" onClick={onDismiss} size="sm" variant="ghost" />
          <Button label="Open" onClick={onOpen} size="sm" variant="secondary" />
        </HStack>
      </VStack>
    );
  }
  const running = write.state === "running";
  return (
    <HStack align="center" gap={2}>
      {running ? (
        <Spinner aria-hidden shade="subtle" size="sm" />
      ) : (
        <Icon color="secondary" icon="uraeda:hourglass" size="sm" />
      )}
      <Text color={running ? undefined : "secondary"}>{`${write.label}…`}</Text>
    </HStack>
  );
}

/**
 * The toast, while a git write runs or a refused one waits to be seen: `writes` in their order, the
 * running one first. Nothing when there are none.
 */
export function CommitToastView({
  commitHref = "/commit",
  isNarrow = false,
  onDismiss,
  onOpen,
  writes,
}: {
  /** The commit page's address, which a failed write's row links. */
  commitHref?: string;
  /** Whether the screen is a phone's: the toast spans its width. */
  isNarrow?: boolean;
  onDismiss: (id: string) => void;
  onOpen: (id: string) => void;
  writes: ReadonlyArray<QueuedWrite>;
}) {
  if (writes.length === 0) {
    return null;
  }
  return (
    <div
      aria-label="Git writes"
      aria-live="polite"
      role="status"
      {...stylex.props(
        glassStyles.surface,
        glassStyles.floating,
        styles.square,
        styles.place,
        isNarrow && styles.across,
      )}
    >
      <VStack gap={2}>
        {writes.map((write) => (
          <Row
            commitHref={commitHref}
            key={write.id}
            onDismiss={() => onDismiss(write.id)}
            onOpen={() => onOpen(write.id)}
            write={write}
          />
        ))}
      </VStack>
    </div>
  );
}

/**
 * The toast of the repository's write queue, the same in every tab. Open goes to where a refused
 * write happened, its refusal shown there, and leaves this tab's toast; Dismiss takes it out of the
 * queue, everywhere.
 */
export function CommitToast() {
  const writes = useWriteQueue();
  const dismiss = useDismissWrite();
  const narrow = isNarrow(useWidthClass());
  const here = useRepoPath();
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const open = (id: string) => {
    const write = writes.find((each) => each.id === id);
    if (write) {
      setOpened((before) => new Set(before).add(id));
      // A feature's start opens its session, where its steps show the refusal, and messages not
      // sent, where their composer holds them; a write named by no page, as a change's start,
      // opens home.
      const page =
        (write.steps !== undefined || write.failure === "unsent") && write.folder !== undefined
          ? sessionPath(write.folder)
          : write.href || "/";
      navigateHere(page.includes("#") ? page : `${page}#${REFUSED_ID}`);
    }
  };
  return (
    <CommitToastView
      commitHref={here("/commit")}
      isNarrow={narrow}
      onDismiss={(id) => void dismiss(id)}
      onOpen={open}
      writes={writes.filter((write) => !opened.has(write.id))}
    />
  );
}
