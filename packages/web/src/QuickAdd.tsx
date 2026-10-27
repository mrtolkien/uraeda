import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { VStack } from "@astryxdesign/core/VStack";
import { Icon } from "@astryxdesign/core/Icon";
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { AddCommit } from "uraeda-binding";
import { usePriorities } from "./data.ts";
import { refusal } from "./errors.ts";
import { DISCARD_CHANGES, useConfirm } from "./fields/Confirm.tsx";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { TextField } from "./fields/TextField.tsx";
import { useTextField } from "./fields/useTextField.ts";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { PrioritiesAddedView } from "./views.ts";
import { useOwnWrite } from "./writes/useOwnWrite.ts";
import { WriteButtonView, type WriteState } from "./writes/WriteFeedback.tsx";

/**
 * The sections a line goes to, with their titles, in the order the page shows them: a map, which
 * the lint does not sort. Blocked is retired, so it is no target.
 */
export const TITLES = new Map([
  ["now", "Now"],
  ["next", "Next"],
  ["later", "Later"],
]);

/** A section's title to display, a Blocked an existing file still has included. */
export function titleOf(section: string) {
  return section === "blocked" ? "Blocked" : (TITLES.get(section) ?? section);
}

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
  return notice && <AnnouncedBanner status={notice.status} title={notice.title} />;
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
 * "Add and commit" as a git write, from its button or Enter: it reads "Committing…" at once, and
 * does nothing while another write runs. `add` adds and commits the form's line.
 */
export function useAddAndCommit(add: () => Promise<unknown>) {
  const { start, state } = useOwnWrite({ label: "Committing…" });
  return { commitState: state, onAddAndCommit: () => start(add) };
}

/**
 * A ＋ form's buttons: Cancel, Add, which adds the line uncommitted, and "Add and commit", the
 * primary one and Enter's, which commits that file alone. On wide screens, where a keyboard is
 * likely, "Add and commit" shows the Enter key it shares (C4); its name stays "Add and commit".
 * `start` comes first in the row, like the inbox's "Attach an image". `commitState` is "Add and
 * commit"'s write, as `useAddAndCommit` gives it.
 */
export function AddButtons({
  addLabel = "Add",
  commitState = "idle",
  isReady,
  onAdd,
  onAddAndCommit,
  onCancel,
  start,
}: {
  /** Add's label, like "Add as a draft". */
  addLabel?: string;
  commitState?: WriteState;
  isReady: boolean;
  onAdd: () => Promise<void>;
  /** Without it, Add alone, the primary button. */
  onAddAndCommit?: () => void;
  onCancel: () => void;
  start?: ReactNode;
}) {
  const wide = !isNarrow(useWidthClass());
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
        <WriteButtonView
          // Out of the button's name, which stays its label; named, for the tests to find it.
          endContent={wide && <Icon aria-hidden="true" icon="uraeda:enter" label="Enter" />}
          isDisabled={!isReady}
          label="Add and commit"
          onClick={onAddAndCommit}
          runningLabel="Committing…"
          state={commitState}
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

/** The sections a line goes to, one picked. */
function SectionPicker({
  onChange,
  section,
}: {
  onChange: (section: string) => void;
  section: string;
}) {
  return (
    <SegmentedControl label="Section" onChange={onChange} value={section}>
      {[...TITLES].map(([id, title]) => (
        <SegmentedControlItem key={id} label={title} value={id} />
      ))}
    </SegmentedControl>
  );
}

/**
 * The form: it reads the priorities when it opens, for the version it adds to. Its text is the
 * unsaved store's `quick-add`, kept as the overlay closes and restored as it opens again; Cancel
 * asks "Discard your changes?" first when it holds text.
 */
export function AddForm({
  notice: shown,
  onAdded,
  onCancel,
  section: start = "next",
}: {
  /** What "Add and commit" said last, from the start: the stories' not-committed state. */
  notice?: CommitNotice;
  onAdded: (section: string, added: Added | undefined) => void;
  onCancel: () => void;
  /** The section the form opens on, Next by default. */
  section?: string;
}) {
  const fate = useFateClient();
  const confirm = useConfirm();
  const priorities = usePriorities();
  const field = useTextField("quick-add", "");
  const text = field.text;
  const [section, setSection] = useState(start);
  const [message, setMessage] = useState<string>();
  const [notice, setNotice] = useState(shown);
  // The field takes the focus once the dialog has settled: the dialog's own focus goes to its first
  // control as it opens, which an autofocus alone sometimes loses to, as a key that opened it.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => box.current?.querySelector("textarea")?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  // Adds the line, uncommitted, and closes the form: the page's bar commits what was written.
  const add = async () => {
    setMessage(undefined);
    setNotice(undefined);
    const result = await fate.mutations.priorities.add({
      input: { hash: priorities?.hash ?? "", section, text },
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
    onAdded(section, added && { key: added.key, lines: added.lines, text: added.text });
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
      <div ref={box}>
        <TextField
          hasAutoFocus
          isLabelHidden
          kind="line"
          label="Priority"
          onChange={field.change}
          // A line: Enter adds it, and closes the form.
          onKeyDown={enterAdds(() => text.trim() && void add())}
          value={text}
        />
      </div>
      <SectionPicker onChange={setSection} section={section} />
      {message && <AnnouncedBanner status="error" title={message} />}
      <CommitBanner notice={notice} />
      <AddButtons isReady={text.trim() !== ""} onAdd={add} onCancel={() => void cancel()} />
    </VStack>
  );
}
