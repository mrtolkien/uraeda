import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useFateClient } from "react-fate";
import { rereadChanges } from "./data.ts";
import { refusal } from "./errors.ts";
import { closeUndoToasts } from "./layout/useUndoToast.ts";
import { PrioritiesView } from "./views.ts";

const styles = stylex.create({
  bar: {
    // The bar stays at the bottom of the screen while there is something to commit.
    backgroundColor: colorVars["--color-background-body"],
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    bottom: 0,
    marginBlockStart: spacingVars["--spacing-4"],
    paddingBlock: spacingVars["--spacing-2"],
    position: "sticky",
    zIndex: 2,
  },
});

/**
 * The commit bar, on the inbox and the priorities pages: how many changes wait for a commit, in
 * `INBOX.md`, `PRIORITIES.md`, and the drafts notes went into, with Commit, and Discard, which asks
 * first.
 * Both close the Undo toasts once done: an Undo would write a change back over the committed file.
 * A refusal, like a hook's, shows in the bar, and the changes stay. Hidden while nothing changed.
 */
export function CommitBar({ changes }: { changes: number }) {
  const fate = useFateClient();
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string>();
  if (changes === 0) {
    return null;
  }

  const run = async (call: () => Promise<{ error?: unknown }>) => {
    setMessage(undefined);
    const result = await call();
    // Both pages show the count: the one the answer did not update reads it again, and a refusal,
    // like a commit over files changed meanwhile, shows them as they are.
    rereadChanges(fate);
    if (result.error) {
      setMessage(refusal(result.error).message);
      return;
    }
    closeUndoToasts();
  };

  const commit = () =>
    run(() => fate.mutations.changes.commit({ input: {}, view: PrioritiesView }));
  const discard = () => {
    setConfirm(false);
    return run(() => fate.mutations.changes.discard({ input: {}, view: PrioritiesView }));
  };

  return (
    <div {...stylex.props(styles.bar)}>
      <VStack gap={2}>
        {message && <Banner collapsible={false} status="error" title={message} />}
        <HStack align="center" gap={2} wrap="wrap">
          <Text>
            {changes} {changes === 1 ? "change" : "changes"} to commit
          </Text>
          <HStack gap={2} justify="end">
            {confirm ? (
              <>
                <Button label="Keep them" onClick={() => setConfirm(false)} />
                <Button clickAction={discard} label="Discard them" variant="destructive" />
              </>
            ) : (
              <>
                <Button label="Discard" onClick={() => setConfirm(true)} variant="ghost" />
                <Button clickAction={commit} label="Commit" variant="primary" />
              </>
            )}
          </HStack>
        </HStack>
      </VStack>
    </div>
  );
}
