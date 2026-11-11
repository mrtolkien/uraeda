// The one question the New page asks once Ctrl+Enter starts a change or a feature: its slug, which
// names its folder and branch, for a feature its research effort, under it, and how its steps run,
// the run map, as the settings draw it. Prefilled, so that Enter alone confirms; a dialog on wide
// screens, a bottom sheet on the phone, as the rename is. With the map, the dialog is as wide as
// the map's six steps read well in a row, on wide screens; a change's, and a feature's on semi-wide
// screens, where the map is a column, as wide as a form. It is as tall as its content, up to most
// of the window, its form scrolling over its buttons past that. The sheet hugs its content, up to
// most of the screen; a feature's map, a column of six steps, takes most of the screen, its form
// scrolling over the sheet's buttons, which stay in view. The page has no field for it: the composer is
// the page's one field.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { sizeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { StatusText } from "./fields/StatusText.tsx";
import { type EditorHandle } from "./fields/editor/Editor.tsx";
import { TextLine } from "./fields/TextLine.tsx";
import { Overlay } from "./layout/Overlay.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { useStartColumn } from "./runs/StartRuns.tsx";

/** The dialog's size when it draws the run map: the theme's, for the map's row and for its column. */
const ROW_SIZE = { height: "var(--size-start-height)", width: "var(--size-start)" };
const COLUMN_SIZE = { height: "var(--size-start-height)", width: "var(--size-start-column)" };

const styles = stylex.create({
  // With the map, on wide screens: the form scrolls on its own in a window too short for it, the
  // dialog clipping what is taller, so the buttons under it stay in view. What is left of the
  // dialog's tallest height once its header and its padding, the gap, and its buttons took theirs;
  // the room around it keeps a focus ring at its edge whole.
  scrolls: {
    margin: `calc(-1 * ${spacingVars["--spacing-1"]})`,
    maxHeight: `calc(var(--size-start-height) - 2 * ${spacingVars["--spacing-12"]} - ${spacingVars["--spacing-4"]} - ${sizeVars["--size-element-md"]})`,
    overflowY: "auto",
    padding: spacingVars["--spacing-1"],
  },
  // With a feature's map, on the phone: the question fills its sheet, a column whose form scrolls
  // and whose buttons stay at the sheet's end.
  fills: { display: "flex", flexDirection: "column", flexGrow: 1, minHeight: 0 },
  fillsForm: {
    flexGrow: 1,
    margin: `calc(-1 * ${spacingVars["--spacing-1"]})`,
    minHeight: 0,
    overflowY: "auto",
    padding: spacingVars["--spacing-1"],
  },
});

/** The short name's width beside the map: a form's field, not the map's whole width. */
const FIELD_WIDTH = "min(100%, var(--size-form))";

/** What the dialog asks, and how it reads: its field's name and its help. */
export type Question = { confirm: string; description: string; label: string; title: string };

/** A research effort to pick under the field: its levels, in order, and the one picked first. */
export type Effort = { initial: string; levels: ReadonlyArray<string> };

/** A refusal as a sentence under the field: the core's reasons end without a period. */
const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

/** A level as the control shows it: `medium` is Medium. */
const levelLabel = (level: string) => level.charAt(0).toUpperCase() + level.slice(1);

/**
 * Starts with the value and the effort picked when one is asked: the refusal to show under the
 * field, or nothing once it started.
 */
type OnConfirm = (value: string, level?: string) => Promise<string | undefined>;

/** The research effort under the field, named as the editor names it, beside its control. */
function EffortPick({
  levels,
  onChange,
  value,
}: {
  levels: ReadonlyArray<string>;
  onChange: (level: string) => void;
  value: string;
}) {
  return (
    <HStack align="center" gap={3} wrap="wrap">
      <Text color="secondary">Research effort</Text>
      <SegmentedControl label="Research effort" onChange={onChange} value={value}>
        {levels.map((each) => (
          <SegmentedControlItem key={each} label={levelLabel(each)} value={each} />
        ))}
      </SegmentedControl>
    </HStack>
  );
}

function Ask({
  effort,
  error: shown,
  fillsSheet = false,
  initial,
  onCancel,
  onConfirm,
  question,
  runs,
}: {
  effort?: Effort | undefined;
  /** A refusal to show from the start, as a story does. */
  error?: string | undefined;
  /** On the phone, whether the question fills its sheet, its form scrolling over its buttons. */
  fillsSheet?: boolean;
  initial: string;
  onCancel: () => void;
  onConfirm: OnConfirm;
  question: Question;
  /** How the start's steps run, the run map, under the effort. */
  runs?: ReactNode;
}) {
  const hasMap = runs !== undefined && runs !== null;
  const wide = !isNarrow(useWidthClass());
  const [value, setValue] = useState(initial);
  const [level, setLevel] = useState(effort?.initial);
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
      const refused = await onConfirm(value.trim(), level);
      if (refused !== undefined) {
        setError(refused);
      }
    } finally {
      starting.current = false;
    }
  };
  const scrolls = wide ? hasMap && styles.scrolls : fillsSheet && styles.fillsForm;
  return (
    <VStack gap={4} xstyle={!wide && fillsSheet && styles.fills}>
      <div {...stylex.props(scrolls)}>
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
            {...(hasMap ? { width: FIELD_WIDTH } : {})}
          />
          {effort && level !== undefined && (
            <EffortPick levels={effort.levels} onChange={setLevel} value={level} />
          )}
          {runs}
          {error && (
            <StatusText role="alert" tone="error" type="supporting">
              {sentence(error)}
            </StatusText>
          )}
        </VStack>
      </div>
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
 * effort is picked under the field; `runs`, the run map, says how its steps run, and makes the
 * dialog as large as the map reads well, a change's (`isChange`) as its column does.
 */
export function StartDialog({
  effort,
  error,
  initial,
  isChange = false,
  isOpen,
  onCancel,
  onConfirm,
  question,
  runs,
}: {
  effort?: Effort;
  error?: string;
  initial: string;
  /** Whether `runs` is a change's map, a column at every width: the dialog is narrower. */
  isChange?: boolean;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: OnConfirm;
  question: Question;
  runs?: ReactNode;
}) {
  const hasMap = runs !== undefined && runs !== null;
  const isColumn = useStartColumn(isChange);
  // A feature's map is taller than a phone's screen: its sheet is a tall one, filled.
  const fillsSheet = hasMap && !isChange;
  return (
    <Overlay
      fills={fillsSheet}
      isOpen={isOpen}
      label={question.title}
      onClose={onCancel}
      sheetHeight={fillsSheet ? "tall" : "hug"}
      {...(hasMap ? { size: isColumn ? COLUMN_SIZE : ROW_SIZE } : {})}
    >
      {isOpen && (
        <Ask
          effort={effort}
          error={error}
          fillsSheet={fillsSheet}
          initial={initial}
          onCancel={onCancel}
          onConfirm={onConfirm}
          question={question}
          runs={runs}
        />
      )}
    </Overlay>
  );
}
