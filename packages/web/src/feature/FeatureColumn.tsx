// The Home's column: what the feature produced, and its links, stacked. On wide and
// semi-wide screens it sits at the window's right edge, in the width and fold of the documents'
// column (`]` folds it to a rail of icons); on the phone, the bottom bar's tiles open each pane's
// rows in a sheet (`FeatureBar.tsx`).
import { Icon } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/VStack";
import type { ReactNode } from "react";
import type { useFeature, useHistory } from "../data.ts";
import { useDocumentColumnWidth } from "../layout/documentColumnWidth.ts";
import { SideColumn } from "../layout/SideColumn.tsx";
import type { OpenKeys } from "../useOpenKeys.ts";
import { figureRows } from "./figureRows.ts";
import { LinksPane } from "./LinksPane.tsx";
import { ProducedPane } from "./ProducedPane.tsx";
import { useNow } from "../useNow.ts";
import { QUESTIONS_KEY } from "./Record.tsx";

type FeatureData = NonNullable<ReturnType<typeof useFeature>>;
type HistoryData = NonNullable<ReturnType<typeof useHistory>>;

/** What the column reads of the feature, and the page's open items, which a figure's jump opens. */
type ColumnProps = { feature: FeatureData; history: HistoryData; keys: OpenKeys };

/** Whether the feature is done: its history has passed its last stage. */
export function isDone(history: HistoryData): boolean {
  return history.current >= history.stages.length;
}

/** What a figure's jump opens first: the record's questions, folded, by their id. */
export function openFigure(keys: OpenKeys) {
  return (id: string) => id === "record-questions" && keys.onOpenChange(QUESTIONS_KEY, true);
}

/** The figures of the feature's "Produced so far" or "What it produced", kept up to date. */
export function useFigureRows(feature: FeatureData, history: HistoryData) {
  const done = isDone(history);
  const agent = feature.agent ?? null;
  // Elapsed counts to now while the feature is live, and a running turn's time until it ends.
  // Every 30 s while it runs, as the feature page's record asks.
  const now = useNow(!done || agent?.runningSince != null ? 30_000 : null);
  return figureRows({
    agent,
    change: feature.kind === "change",
    done,
    history,
    now,
    pullRequest: done ? feature.pullRequest?.url : undefined,
    tokens: feature.tokens ?? null,
  });
}

/** The two panes: "Produced so far" or "What it produced", and Links. */
export function FeatureColumn({ feature, history, keys }: ColumnProps) {
  const done = isDone(history);
  const rows = useFigureRows(feature, history);
  return (
    <VStack gap={4}>
      <ProducedPane done={done} onOpen={openFigure(keys)} rows={rows} />
      <LinksPane feature={feature} />
    </VStack>
  );
}

/** The folded column's rail: an icon for each pane, named by it. */
function Rail() {
  return (
    <VStack align="center" gap={3}>
      <Icon icon="uraeda:activity" label="Figures" />
      <Icon icon="uraeda:step-pull-request" label="Links" />
    </VStack>
  );
}

/**
 * `content`, the page, with the column beside it on wide and semi-wide screens, in the documents'
 * width and fold; on the phone, the page alone, its bar holding the column (`FeatureBar`).
 */
export function WithFeatureColumn({ content, ...column }: ColumnProps & { content: ReactNode }) {
  const { isShown, resizable, setShown } = useDocumentColumnWidth();
  return (
    <SideColumn
      content={content}
      isShown={isShown}
      label="The feature's column"
      onShownChange={setShown}
      rail={<Rail />}
      width={resizable}
    >
      <FeatureColumn {...column} />
    </SideColumn>
  );
}
