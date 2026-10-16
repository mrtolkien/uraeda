import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { VStack } from "@astryxdesign/core/VStack";
import { Icon } from "@astryxdesign/core/Icon";
import { type KeyboardEvent, type ReactNode, useState } from "react";
import { useFateClient } from "react-fate";
import type { AddCommit } from "uraeda-binding";
import { usePriorities } from "./data.ts";
import { refusal } from "./errors.ts";
import { DISCARD_CHANGES, useConfirm } from "./fields/Confirm.tsx";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { TextField } from "./fields/TextField.tsx";
import { useTextField } from "./fields/useTextField.ts";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { PrioritiesAddedView } from "./views.ts";

/** Each section's title, in the order the page shows them: a map, which the lint does not sort. */
export const TITLES = new Map([
  ["now", "Now"],
  ["next", "Next"],
  ["later", "Later"],
  ["blocked", "Blocked"],
]);

/**
 * What "Add and commit" says when the file had other changes: the line is added, not committed.
 * `place` is where it went, "Next" or "the inbox", and `file` the file it went in.
 */
export function notCommitted(place: string, file = "PRIORITIES.md") {
  return `Added to ${place}. Not committed: ${file} has other changes to commit or discard.`;
}

/** What the form says after "Add and commit", and how: a warning, or the hook's error. */
export type CommitNotice = { status: "error" | "warning"; title: string };

/**
 * Why "Add and commit" only added, for its form to say until it closes: the file's other changes,
 * or the hook that refused the commit, by the first line of its output. Nothing once committed.
 */
export function uncommitted(
  added: AddCommit | null | undefined,
  place: string,
  file?: string,
): CommitNotice | undefined {
  if (!added || added.committed) {
    return undefined;
  }
  return added.reason === "hook-failed"
    ? { status: "error", title: `Commit failed: ${added.message ?? ""}` }
    : { status: "warning", title: notCommitted(place, file) };
}

/** What a form says after "Add and commit", in the form, until it closes. */
export function CommitBanner({ notice }: { notice: CommitNotice | undefined }) {
  return notice && <Banner status={notice.status} title={notice.title} />;
}

/** A one-line field's Enter, Shift+Enter aside: it calls `onEnter` instead of a new line. */
export function enterAdds(onEnter: () => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onEnter();
    }
  };
}

/**
 * A ＋ form's buttons: Cancel, Add, which adds the line uncommitted, and "Add and commit", the
 * primary one and Enter's, which commits that file alone. On wide screens, where a keyboard is
 * likely, "Add and commit" shows the Enter key it shares (C4); its name stays "Add and commit".
 * `start` comes first in the row, like the inbox's "Attach an image".
 */
export function AddButtons({
  addLabel = "Add",
  isReady,
  onAdd,
  onAddAndCommit,
  onCancel,
  start,
}: {
  /** Add's label, like "Add as a draft". */
  addLabel?: string;
  isReady: boolean;
  onAdd: () => Promise<void>;
  /** Without it, Add alone, the primary button. */
  onAddAndCommit?: () => Promise<void>;
  onCancel: () => void;
  start?: ReactNode;
}) {
  const wide = useWidthClass() === "wide";
  const committing = onAddAndCommit !== undefined;
  return (
    <HStack gap={2} justify="end" wrap="wrap">
      {start}
      <Button label="Cancel" onClick={onCancel} variant={committing ? "ghost" : "secondary"} />
      <Button
        clickAction={onAdd}
        isDisabled={!isReady}
        label={addLabel}
        variant={committing ? "secondary" : "primary"}
      />
      {committing && (
        <Button
          clickAction={onAddAndCommit}
          // Out of the button's name, which stays its label; named, for the tests to find it.
          endContent={wide && <Icon aria-hidden="true" icon="uraeda:enter" label="Enter" />}
          isDisabled={!isReady}
          label="Add and commit"
          variant="primary"
        />
      )}
    </HStack>
  );
}

/**
 * The line ＋ added, as the core wrote it: its key, its text after its marker, and its lines; with
 * "Add and commit", the file's version after the commit, for Undo to remove it from.
 */
export type Added = {
  committed?: { hash: string };
  key: string;
  lines: ReadonlyArray<string>;
  text: string;
};

/**
 * The form: it reads the priorities when it opens, for the version it adds to. Its text is the
 * unsaved store's `quick-add`, kept as the overlay closes and restored as it opens again; Cancel
 * asks "Discard your changes?" first when it holds text.
 */
export function AddForm({
  notice: shown,
  onAdded,
  onCancel,
}: {
  /** What "Add and commit" said last, from the start: the stories' not-committed state. */
  notice?: CommitNotice;
  onAdded: (section: string, added: Added | undefined) => void;
  onCancel: () => void;
}) {
  const fate = useFateClient();
  const confirm = useConfirm();
  const priorities = usePriorities();
  const field = useTextField("quick-add", "");
  const text = field.text;
  const [section, setSection] = useState("next");
  const [message, setMessage] = useState<string>();
  const [notice, setNotice] = useState(shown);

  const add = async (commit = false) => {
    setMessage(undefined);
    setNotice(undefined);
    const result = await fate.mutations.priorities.add({
      input: { commit, hash: priorities?.hash ?? "", section, text },
      view: PrioritiesAddedView,
    });
    if (result.error) {
      setMessage(refusal(result.error).message);
      return;
    }
    const answer = result.result;
    // The line just added ends its section.
    const added = answer?.sections.find((s) => s.section === section)?.entries.at(-1);
    // Forgotten once added, unless more was typed meanwhile.
    if (field.unsavedNow()?.text === text) {
      field.discard();
    }
    // Only added: the form stays open, saying why.
    const why = commit ? uncommitted(answer?.added, TITLES.get(section) ?? section) : undefined;
    if (why) {
      setNotice(why);
      return;
    }
    onAdded(
      section,
      added && {
        ...(commit && answer ? { committed: { hash: answer.hash } } : {}),
        key: added.key,
        lines: added.lines,
        text: added.text,
      },
    );
  };

  const cancel = async () => {
    if (field.dirty && !(await confirm(DISCARD_CHANGES))) {
      return;
    }
    field.discard();
    onCancel();
  };

  return (
    <VStack gap={4}>
      {field.restored && (
        // Its saved text is always empty: it never changes since.
        <RestoreNotice changed="" onDiscard={field.discard} restored={field.restored} />
      )}
      <TextField
        hasAutoFocus
        isLabelHidden
        kind="line"
        label="Priority"
        onChange={field.change}
        // A line: Enter adds and commits, Ctrl+Enter or Cmd+Enter as well.
        onKeyDown={enterAdds(() => text.trim() && void add(true))}
        value={text}
      />
      <SegmentedControl
        label="Section"
        onChange={(value: string) => setSection(value)}
        value={section}
      >
        {[...TITLES].map(([id, title]) => (
          <SegmentedControlItem key={id} label={title} value={id} />
        ))}
      </SegmentedControl>
      {message && <Banner status="error" title={message} />}
      <CommitBanner notice={notice} />
      <AddButtons
        isReady={text.trim() !== ""}
        onAdd={() => add()}
        onAddAndCommit={() => add(true)}
        onCancel={() => void cancel()}
      />
    </VStack>
  );
}
