// The commit page, the one place the inbox's, the priorities', and the proposal and note files'
// edits are committed: every form and list only edits and saves a file, and this page shows what a
// commit would hold, as the core lists it, with Commit, and Discard, which asks first. The
// sidebar's Commit button, the phone's tab, and `g c` lead here while something waits.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useFateClient } from "react-fate";
import { rereadChanges, usePriorities } from "./data.ts";
import { refusal } from "./errors.ts";
import { discardChanges, useConfirm } from "./fields/Confirm.tsx";
import { useKeys } from "./keys/registry.tsx";
import { plural } from "./labels.ts";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Page } from "./layout/Page.tsx";
import { PageTitle } from "./layout/PageTitle.tsx";
import { Pane } from "./layout/Pane.tsx";
import { closeUndoToasts } from "./layout/useUndoToast.ts";
import { useRestoreScroll } from "./routes.tsx";
import { PrioritiesView } from "./views.ts";
import { WriteButton } from "./writes/WriteButton.tsx";

const styles = stylex.create({
  // One change: its kind, small, over what it is about.
  change: {
    // Its bar's width, which StyleX's border widths do not list.
    "--commit-bar": "2px",
    borderInlineStartColor: colorVars["--color-border"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: "var(--commit-bar)",
    paddingInlineStart: spacingVars["--spacing-3"],
  },
});

/** A change line of the core, `- Add to the inbox: text`, as its kind and its text. */
function parts(line: string) {
  const body = line.replace(/^- /, "");
  const at = body.indexOf(": ");
  return at === -1
    ? { kind: "", text: body }
    : { kind: body.slice(0, at), text: body.slice(at + 2) };
}

/** What the commit holds: one change to a line, its kind over its text. */
function Changes({ lines }: { lines: ReadonlyArray<string> }) {
  return (
    <Pane icon="check" title="This commit holds">
      <VStack gap={2}>
        {lines.map((line, at) => {
          const { kind, text } = parts(line);
          return (
            <div key={at} {...stylex.props(styles.change)}>
              {kind && (
                <Text color="secondary" display="block" type="supporting">
                  {kind}
                </Text>
              )}
              <Text display="block">{text}</Text>
            </div>
          );
        })}
      </VStack>
    </Pane>
  );
}

/**
 * What waits for a commit, one change to a line, and what the commit and the discard do. Both
 * write on the default branch; a hook's refusal shows here, and the changes stay.
 */
export function CommitPage() {
  const fate = useFateClient();
  const confirm = useConfirm();
  const priorities = usePriorities();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  useRestoreScroll(true);

  /** Runs a write: the counts everywhere read again, and a refusal shows. */
  const run = async (call: () => Promise<{ error?: unknown }>, done: string) => {
    setMessage(undefined);
    const result = await call();
    rereadChanges(fate);
    if (result.error) {
      setMessage({ ok: false, text: refusal(result.error).message });
      return false;
    }
    // An Undo would write a change back over the committed file.
    closeUndoToasts();
    setMessage({ ok: true, text: done });
    return true;
  };
  const lines = priorities?.changeLines ?? [];
  const count = priorities?.changes ?? 0;
  const commit = () =>
    run(() => fate.mutations.changes.commit({ input: {}, view: PrioritiesView }), "Committed.");
  const discard = async () => {
    if (count > 0 && (await confirm(discardChanges(count)))) {
      await run(
        () => fate.mutations.changes.discard({ input: {}, view: PrioritiesView }),
        "Discarded.",
      );
    }
  };
  useKeys(
    count > 0
      ? [
          {
            hint: "⏎",
            keys: "Enter",
            label: "commit",
            run: () => void commit(),
            // A focused button's own Enter presses it: only the page's Enter commits.
            when: (target) => target === document.body || target === document.documentElement,
          },
          { keys: "mod+Enter", label: "commit", run: () => void commit() },
          { hint: "d", keys: "d", label: "discard", run: () => void discard() },
        ]
      : [],
  );
  if (!priorities) {
    return null;
  }
  return (
    <Page>
      <VStack gap={4}>
        <PageTitle meta={{ text: count > 0 ? plural(count, "change") : "Nothing waits" }}>
          Commit
        </PageTitle>
        {message && (
          <AnnouncedBanner
            collapsible={false}
            status={message.ok ? "success" : "error"}
            title={message.text}
          />
        )}
        {count > 0 && <Changes lines={lines} />}
        {count > 0 ? (
          <HStack align="center" gap={2}>
            <WriteButton
              endContent={<Icon aria-hidden="true" icon="uraeda:enter" label="Enter" />}
              label="Commit"
              onClick={commit}
              variant="primary"
            />
            {/* Not `clickAction`: its pending state closes the question this opens. */}
            <Button label="Discard" onClick={() => void discard()} variant="ghost" />
          </HStack>
        ) : (
          <Text color="secondary">
            The inbox, the priorities, and the proposal and note files are all committed.
          </Text>
        )}
      </VStack>
    </Page>
  );
}
