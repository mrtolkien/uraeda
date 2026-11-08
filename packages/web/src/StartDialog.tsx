// The one question the New page asks once Ctrl+Enter starts a change or a feature: its slug, which
// names its folder and branch, and for a feature its research effort, under it. Prefilled, so that
// Enter alone confirms; a dialog on wide screens, a bottom sheet on the phone, as the rename is. The
// page has no field for it: the composer is the page's one field.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useEffect, useRef, useState } from "react";
import { StatusText } from "./fields/StatusText.tsx";
import { RuntimePicker } from "./RuntimePicker.tsx";
import { useRuntimePick } from "./runtimes.ts";
import { type EditorHandle } from "./fields/editor/Editor.tsx";
import { TextLine } from "./fields/TextLine.tsx";
import { Overlay } from "./layout/Overlay.tsx";

/** What the dialog asks, and how it reads: its field's name and its help. */
export type Question = { confirm: string; description: string; label: string; title: string };

/** A research effort to pick under the field: its levels, in order, and the one picked first. */
export type Effort = { initial: string; levels: ReadonlyArray<string> };

/** A refusal as a sentence under the field: the core's reasons end without a period. */
const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

/** A level as the control shows it: `medium` is Medium. */
const levelLabel = (level: string) => level.charAt(0).toUpperCase() + level.slice(1);

/**
 * Starts with the value, the effort picked when one is asked, and the runtime picked when the
 * picker shows: the refusal to show under the field, or nothing once it started.
 */
type OnConfirm = (value: string, level?: string, runtime?: string) => Promise<string | undefined>;

function Ask({
  effort,
  error: shown,
  hasRuntime,
  initial,
  onCancel,
  onConfirm,
  question,
}: {
  effort?: Effort | undefined;
  /** A refusal to show from the start, as a story does. */
  error?: string | undefined;
  hasRuntime: boolean;
  initial: string;
  onCancel: () => void;
  onConfirm: OnConfirm;
  question: Question;
}) {
  const [value, setValue] = useState(initial);
  const [level, setLevel] = useState(effort?.initial);
  // The pick as the picker shows it: one turned off since is never sent.
  const runtime = useRuntimePick();
  const [error, setError] = useState(shown);
  // The field takes the focus, its text selected, once the dialog has settled: the dialog's own
  // focus goes to its first control as it opens, and Enter must confirm from the first key.
  const field = useRef<EditorHandle>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      const view = field.current?.view();
      view?.focus();
      view?.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
    }, 80);
    return () => clearTimeout(timer);
  }, []);
  // One start at a time: Enter again, a held Enter, or the button while it runs starts nothing more.
  const starting = useRef(false);
  const confirm = async () => {
    if (starting.current) {
      return;
    }
    starting.current = true;
    setError(undefined);
    try {
      const refused = await onConfirm(value.trim(), level, hasRuntime ? runtime.kind : undefined);
      if (refused !== undefined) {
        setError(refused);
      }
    } finally {
      starting.current = false;
    }
  };
  return (
    <VStack gap={4}>
      <TextLine
        description={question.description}
        hasAutoFocus
        label={question.label}
        onChange={setValue}
        onEnter={() => {
          if (value.trim()) {
            void confirm();
          }
        }}
        ref={field}
        value={value}
      />
      {/* Named as the editor names it, beside its control. */}
      {effort && level !== undefined && (
        <HStack align="center" gap={3} wrap="wrap">
          <Text color="secondary">Research effort</Text>
          <SegmentedControl label="Research effort" onChange={setLevel} value={level}>
            {effort.levels.map((each) => (
              <SegmentedControlItem key={each} label={levelLabel(each)} value={each} />
            ))}
          </SegmentedControl>
        </HStack>
      )}
      {hasRuntime && (
        <RuntimePicker isLabelShown onChange={runtime.setPicked} value={runtime.picked} />
      )}
      {error && (
        <StatusText role="alert" tone="error" type="supporting">
          {sentence(error)}
        </StatusText>
      )}
      <HStack align="center" gap={2} justify="end">
        <Button label="Cancel" onClick={onCancel} />
        <Button
          clickAction={confirm}
          isDisabled={!value.trim()}
          label={question.confirm}
          variant="primary"
        />
      </HStack>
    </VStack>
  );
}

/**
 * The question, over the page while `isOpen`, its field starting as `initial`. Closing it, by Cancel,
 * Escape, or Back, cancels the start: the composer keeps what it holds. With `effort`, the research
 * effort is picked under the field; `hasRuntime`, the runtime of the session the start makes, while
 * two or more are on.
 */
export function StartDialog({
  effort,
  error,
  hasRuntime = false,
  initial,
  isOpen,
  onCancel,
  onConfirm,
  question,
}: {
  effort?: Effort;
  error?: string;
  hasRuntime?: boolean;
  initial: string;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: OnConfirm;
  question: Question;
}) {
  return (
    <Overlay isOpen={isOpen} label={question.title} onClose={onCancel} sheetHeight="hug">
      {isOpen && (
        <Ask
          effort={effort}
          error={error}
          hasRuntime={hasRuntime}
          initial={initial}
          onCancel={onCancel}
          onConfirm={onConfirm}
          question={question}
        />
      )}
    </Overlay>
  );
}
