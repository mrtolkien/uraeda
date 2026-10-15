// The phone's progress line: under a feature's or a change's session's header, on narrow screens,
// one line of the step and the progress, or of a change's round, which opens the column's content in
// place, above the transcript.
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import {
  borderVars,
  colorVars,
  radiusVars,
  sizeVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Suspense, useEffect, useState } from "react";
import { QuestionCount, roundOf } from "./ChangeAside.tsx";
import { useFeature } from "./data.ts";
import { useWidthClass, widthClassNow } from "./layout/useWidthClass.ts";
import { ProgressRing } from "./ProgressRing.tsx";
import { currentEntry, updateEntry } from "./routes.tsx";
import { SessionAside, stepTitle } from "./SessionAside.tsx";

const styles = stylex.create({
  line: {
    borderColor: colorVars["--color-border"],
    borderRadius: radiusVars["--radius-container"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    // Room for Astryx's chevron, which ends the trigger: the rest of the row is the trigger.
    paddingInlineEnd: spacingVars["--spacing-2"],
  },
  open: {
    paddingBlockEnd: spacingVars["--spacing-3"],
    paddingInlineStart: spacingVars["--spacing-3"],
  },
  trigger: {
    // A control's height for a finger, its inset inside the trigger, so a tap on it toggles.
    minHeight: sizeVars["--size-element-md"],
    paddingInlineStart: spacingVars["--spacing-3"],
  },
});

/**
 * Whether the progress line is open, kept in the history entry, so Back and a reload find it as it
 * was left. Once the window turns wide, the column takes its place: the line comes back folded.
 */
function useLineOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => currentEntry().progress === true);
  // The entry this page was opened on: still shown while the next page loads, it must not write
  // into the next one's entry.
  const [id] = useState(() => currentEntry().id);
  useEffect(
    () => () => {
      // Gone because the window turned wide, not because the page was left.
      if (widthClassNow() === "wide" && currentEntry().id === id) {
        updateEntry({ progress: false });
      }
    },
    [id],
  );
  return [
    open,
    (next) => {
      setOpen(next);
      if (currentEntry().id === id) {
        updateEntry({ progress: next });
      }
    },
  ];
}

/**
 * "Implementation · 7/11 · Session column", beside a ring, "Answer questions · 1 question" for a
 * change's round, or the step alone: on narrow screens only, where the column is not. Open, the
 * column's content shows under it.
 */
export function ProgressLine({ folder, session }: { folder: string; session?: string }) {
  const narrow = useWidthClass() === "narrow";
  const feature = useFeature(folder);
  if (!narrow || !feature || feature.missing) {
    return null;
  }
  return <Line feature={feature} folder={folder} {...(session === undefined ? {} : { session })} />;
}

/** The line itself, drawn while the window is narrow: its open state goes when it does. */
function Line({
  feature,
  folder,
  session,
}: {
  feature: Parameters<typeof stepTitle>[0] &
    Parameters<typeof roundOf>[0] & {
      kind: string;
      step: { progress?: { position: number; title: string; total: number } | null };
    };
  folder: string;
  session?: string;
}) {
  const [open, setOpen] = useLineOpen();
  const step = stepTitle(feature);
  const progress = feature.step.progress ?? null;
  const round = feature.kind === "change" ? roundOf(feature) : undefined;
  return (
    <Collapsible
      isOpen={open}
      onOpenChange={setOpen}
      trigger={
        <HStack align="center" gap={2} xstyle={styles.trigger}>
          {progress && <ProgressRing position={progress.position} total={progress.total} />}
          <Text>
            {progress
              ? `${step} · ${progress.position}/${progress.total} · ${progress.title}`
              : step}
            {round && (
              <Suspense fallback={null}>
                <QuestionCount file={round.name} folder={folder} />
              </Suspense>
            )}
          </Text>
        </HStack>
      }
      xstyle={styles.line}
    >
      {open && (
        <div aria-label="Progress" role="region" {...stylex.props(styles.open)}>
          <SessionAside folder={folder} {...(session === undefined ? {} : { session })} />
        </div>
      )}
    </Collapsible>
  );
}
