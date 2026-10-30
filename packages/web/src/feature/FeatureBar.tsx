// On the phone, the feature page's bottom bar: its wide column's two panes as tiles, Produced and
// Links, each opening its sheet; its latest session; then its next step, in the accent, which does
// what "Next"'s button does.
import { useAgent, type useFeature, type useHistory } from "../data.ts";
import { harnessMark } from "../HarnessMark.tsx";
import { type ColumnSheet, ColumnStatusLine } from "../layout/ColumnStatusLine.tsx";
import { NavTile, NavTiles } from "../layout/NavBar.tsx";
import { afterOverlayCloses } from "../layout/useBackCloses.ts";
import { useSheetTab } from "../layout/useSheetTab.ts";
import { navigate, useRepoPath } from "../routes.tsx";
import { sessionPath } from "../sessions.ts";
import type { OpenKeys } from "../useOpenKeys.ts";
import { isDone, useFigureRows } from "./FeatureColumn.tsx";
import { hasLinks, LinkRows } from "./LinksPane.tsx";
import { producedTitle, ProducedRows } from "./ProducedPane.tsx";
import { QUESTIONS_KEY } from "./Record.tsx";

type FeatureData = NonNullable<ReturnType<typeof useFeature>>;
type HistoryData = NonNullable<ReturnType<typeof useHistory>>;

/**
 * The bar: Produced, Links while the feature has one, Session once it has one, then `next`, what
 * "Next"'s button does, while it does something. A figure's jump into the page waits for its sheet
 * to close, as the spec's Contents do. `keys` are the page's open items, which a figure opens.
 */
export function FeatureBar({
  feature,
  history,
  keys,
  next,
}: {
  feature: FeatureData;
  history: HistoryData;
  keys: OpenKeys;
  next: (() => void) | undefined;
}) {
  const done = isDone(history);
  const produced = producedTitle(done);
  const sheet = useSheetTab({ links: "Links", produced }, true);
  const [open, setSheet] = sheet;
  const rows = useFigureRows(feature, history);
  const agent = useAgent();
  const here = useRepoPath();
  const links = hasLinks(feature);
  const sheets: Array<ColumnSheet> = [
    {
      height: "hug",
      key: "produced",
      label: produced,
      panel: (
        <ProducedRows
          beforeJump={(go) => {
            setSheet();
            afterOverlayCloses(produced, go, { scrolls: true });
          }}
          onOpen={(id) => id === "record-questions" && keys.onOpenChange(QUESTIONS_KEY, true)}
          rows={rows}
        />
      ),
    },
    ...(links
      ? [
          {
            height: "hug" as const,
            key: "links",
            label: "Links",
            panel: <LinkRows feature={feature} />,
          },
        ]
      : []),
  ];
  const buttons = (
    <NavTiles label="The feature's parts">
      <NavTile
        icon="uraeda:activity"
        isOpen={open === "produced"}
        label={produced}
        onPress={() => setSheet("produced")}
      />
      {links && (
        <NavTile
          icon="uraeda:step-pull-request"
          isOpen={open === "links"}
          label="Links"
          onPress={() => setSheet("links")}
        />
      )}
      {feature.session && (
        <NavTile
          icon={harnessMark(agent?.kind ?? "").icon}
          label="Session"
          onPress={() => navigate(here(sessionPath(feature.folder)))}
        />
      )}
      {next && <NavTile icon="uraeda:arrow-right" isTinted label="Next step" onPress={next} />}
    </NavTiles>
  );
  return <ColumnStatusLine buttons={buttons} sheet={sheet} sheets={sheets} />;
}
