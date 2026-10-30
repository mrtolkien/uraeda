// A proposal file's Start, the editor page's second pane: what to start it as, a feature or a
// change, the slug that names its folder and branch, and the button. `f` and `c` pick the kind, `s`
// brings the focus to the slug, where Enter starts: no key starts anything without the slug in
// view. On the phone, the same in a sheet, which the bottom bar's one button opens (`StartBar`).
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode, RefObject } from "react";
import { ColumnStatusLine } from "./layout/ColumnStatusLine.tsx";
import { NavTile, NavTiles } from "./layout/NavBar.tsx";
import type { SheetState } from "./layout/useSheetTab.ts";
import type { useTextField } from "./fields/useTextField.ts";
import { Pane } from "./layout/Pane.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { SlugField } from "./SlugField.tsx";
import type { useEditorActions } from "./useEditorActions.ts";
import { WriteButton } from "./writes/WriteButton.tsx";

const styles = stylex.create({
  // Room under the buttons, which the pane's border would otherwise touch.
  body: { paddingBlockEnd: spacingVars["--spacing-3"] },
});

/** What a proposal file starts as. */
export type StartKind = "change" | "feature";

/**
 * The pane: `kind` is what it starts as, `onKind` changes it, `slugRef` is the slug's input. Its one
 * button, or Enter in the slug, opens the session at once, the agent's message in its composer for
 * the human to read and send, while the branch and worktree are made. A slug refused, as taken,
 * says why under it.
 */
export function ProposalStart({
  actions,
  kind,
  onKind,
  slug,
  slugRef,
}: {
  actions: ReturnType<typeof useEditorActions>;
  kind: StartKind;
  onKind: (kind: StartKind) => void;
  slug: ReturnType<typeof useTextField>;
  /** The element around the slug field, whose input `f` and `c` bring the focus to. */
  slugRef: RefObject<HTMLDivElement | null>;
}) {
  const narrow = isNarrow(useWidthClass());
  const isFeature = kind === "feature";
  // Always the same: the session opens at once with the workflow's message in its composer, unsent,
  // while the branch and worktree are made.
  const run = () => actions.start(kind);
  const body = (
    <VStack gap={3} xstyle={styles.body}>
      <SegmentedControl label="Start as" onChange={onKind} value={kind}>
        <SegmentedControlItem label="Feature" value="feature" />
        <SegmentedControlItem label="Change" value="change" />
      </SegmentedControl>
      <div ref={slugRef}>
        <SlugField
          description="Names its folder and its branch."
          {...(actions.slugError === undefined ? {} : { error: actions.slugError })}
          field={slug}
          onEnter={() => {
            if (slug.text.trim()) {
              void run();
            }
          }}
        />
      </div>
      <HStack align="center" gap={2} wrap="wrap">
        <WriteButton
          // Its key, as the New page's send shows Enter: the phone has no such key.
          endContent={
            !narrow && (
              <>
                Ctrl+
                <Icon aria-hidden="true" icon="uraeda:enter" label="Enter" />
              </>
            )
          }
          isDisabled={!slug.text.trim()}
          label={isFeature ? "Start feature" : "Start change"}
          onClick={run}
          variant="primary"
        />
      </HStack>
    </VStack>
  );
  // On the phone, the sheet's own title names it.
  return narrow ? (
    body
  ) : (
    <Pane icon={isFeature ? "uraeda:file-text" : "uraeda:wrench"} title="Start">
      {body}
    </Pane>
  );
}

/** The phone's sheet of the Start, by its key in the address: `?tab=start`. */
export const START_SHEETS = { start: "Start" } as const;

/**
 * On the phone, the editor's bottom bar: Start alone, in the accent, a single button, which
 * `onStart` makes open `start`, the Start's sheet, `sheet` naming it open. `message`, what the
 * start answered, as a refusal, shows in the sheet too, where the human pressed Start.
 */
export function StartBar({
  message,
  onStart,
  sheet,
  start,
}: {
  message: ReactNode;
  onStart: () => void;
  sheet: SheetState;
  start: ReactNode;
}) {
  const buttons = (
    <NavTiles label="The proposal's start">
      <NavTile icon="uraeda:play" isTinted label="Start" onPress={onStart} />
    </NavTiles>
  );
  return (
    <ColumnStatusLine
      buttons={buttons}
      sheet={sheet}
      sheets={[
        {
          height: "hug",
          key: "start",
          label: START_SHEETS.start,
          panel: (
            <VStack gap={3}>
              {start}
              {message}
            </VStack>
          ),
        },
      ]}
    />
  );
}
