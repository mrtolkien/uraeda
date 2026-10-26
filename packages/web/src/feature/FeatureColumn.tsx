// The Home's column: the feature's sessions, what it produced, and its links, stacked. On wide and
// semi-wide screens it sits at the window's right edge, in the width and fold of the documents'
// column (`]` folds it to a rail of icons); on the phone, it follows the timeline in the page's one
// column.
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
import { SessionsPane } from "./SessionsPane.tsx";

type FeatureData = NonNullable<ReturnType<typeof useFeature>>;
type HistoryData = NonNullable<ReturnType<typeof useHistory>>;

/** What the column reads of the feature, and the page's open items, which a figure's jump opens. */
type ColumnProps = { feature: FeatureData; history: HistoryData; keys: OpenKeys };

/** Whether the feature is done: its history has passed its last stage. */
function isDone(history: HistoryData): boolean {
  return history.current >= history.stages.length;
}

/** The three panes: Sessions, "Produced so far" or "What it produced", and Links. */
export function FeatureColumn({ feature, history, keys }: ColumnProps) {
  const done = isDone(history);
  const agent = feature.agent ?? null;
  // Elapsed counts to now while the feature is live, and a running turn's time until it ends.
  // Every 30 s while it runs, as the feature page's record asks.
  const now = useNow(!done || agent?.runningSince != null ? 30_000 : null);
  const rows = figureRows({
    agent,
    change: feature.kind === "change",
    done,
    history,
    now,
    pullRequest: done ? feature.pullRequest?.url : undefined,
    tokens: feature.tokens ?? null,
  });
  return (
    <VStack gap={4}>
      <SessionsPane
        folder={feature.folder}
        progress={feature.step.progress}
        sessions={feature.sessions}
      />
      <ProducedPane
        done={done}
        onOpen={(id) => id === "record-questions" && keys.onOpenChange(QUESTIONS_KEY, true)}
        rows={rows}
      />
      <LinksPane feature={feature} />
    </VStack>
  );
}

/** The folded column's rail: an icon for each pane, named by it. */
function Rail() {
  return (
    <VStack align="center" gap={3}>
      <Icon icon="uraeda:terminal" label="Sessions" />
      <Icon icon="uraeda:activity" label="Figures" />
      <Icon icon="uraeda:step-pull-request" label="Links" />
    </VStack>
  );
}

/**
 * `content`, the page, with the column beside it on wide and semi-wide screens, in the documents'
 * width and fold; on the phone, the page alone, which draws `FeatureColumn` itself, after its
 * timeline.
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
