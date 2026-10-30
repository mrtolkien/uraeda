// The git writes in flight, at the window's bottom right, on the leader menu's frosted glass: the
// one running, with what it does, then the ones waiting their turn. The page already shows each
// write's result: the toast says only that it is still landing in git. A write a hook refused stays
// until it is opened or dismissed, its hook's output under it, as its page also shows.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars, typographyVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { glassStyles } from "../layout/glass.ts";

/** A git write as the toast lists it: what it does, and where it is in the queue. */
export type QueuedWrite = {
  id: string;
  /** What it does, as its button said: "Approving the spec of Performance pass". */
  label: string;
  /** The hook's output, for a write a hook refused. */
  output?: string;
  state: "running" | "waiting" | "refused";
};

const styles = stylex.create({
  // Where the leader menu rises, over the status line: the menu, when open, covers it.
  place: {
    insetBlockEnd: `calc(var(--size-status-line, 0px) + ${spacingVars["--spacing-2"]})`,
    insetInlineEnd: spacingVars["--spacing-3"],
    maxWidth: `calc(100vw - 2 * ${spacingVars["--spacing-3"]})`,
    padding: spacingVars["--spacing-3"],
    position: "fixed",
    width: "var(--size-commit-toast, 26rem)",
    zIndex: 2,
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

/** One write's row: its icon, what it does, and how far it is. */
function Row({
  onDismiss,
  onOpen,
  write,
}: {
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
          A hook refused the commit: what it showed is back as it was.
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
  onDismiss,
  onOpen,
  writes,
}: {
  onDismiss: (id: string) => void;
  onOpen: (id: string) => void;
  writes: ReadonlyArray<QueuedWrite>;
}) {
  if (writes.length === 0) {
    return null;
  }
  return (
    <div
      aria-live="polite"
      role="status"
      {...stylex.props(glassStyles.surface, glassStyles.floating, styles.square, styles.place)}
    >
      <VStack gap={2}>
        {writes.map((write) => (
          <Row
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
