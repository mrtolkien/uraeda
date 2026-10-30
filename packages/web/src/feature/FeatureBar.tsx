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
import { isDone, openFigure, useFigureRows } from "./FeatureColumn.tsx";
import { hasLinks, LinkRows } from "./LinksPane.tsx";
import { producedTitle, ProducedRows } from "./ProducedPane.tsx";

type FeatureData = NonNullable<ReturnType<typeof useFeature>>;

/** The phone's sheets' names, by their keys in the address: `?tab=produced`, `?tab=links`. */
const SHEETS = { links: "Links", produced: "Produced" } as const;
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
  const produced = producedTitle(isDone(history));
  const links = hasLinks(feature);
  // Fixed names, and Links only while it shows: a sheet's history entry is named by its label.
  const sheet = useSheetTab(links ? SHEETS : { produced: SHEETS.produced }, true);
  const [open, setSheet] = sheet;
  const rows = useFigureRows(feature, history);
  const agent = useAgent();
  const here = useRepoPath();
  const sheets: Array<ColumnSheet> = [
    {
      height: "hug",
      key: "produced",
      label: SHEETS.produced,
      panel: (
        <ProducedRows
          beforeJump={(go) => {
            setSheet();
            afterOverlayCloses(SHEETS.produced, go, { scrolls: true });
          }}
          onOpen={openFigure(keys)}
          rows={rows}
        />
      ),
    },
    ...(links
      ? [
          {
            height: "hug" as const,
            key: "links",
            label: SHEETS.links,
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
