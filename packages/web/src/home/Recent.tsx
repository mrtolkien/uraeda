// Home's Recent pane: the done items, merged features and changes and sessions read to their end,
// the latest first: five, then all of them once asked, or at `#done`, which the column's Done "…"
// opens.
import { Button } from "@astryxdesign/core/Button";
import { useState } from "react";
import { Pane } from "../layout/Pane.tsx";
import { useHash, useLocalPath, useRepoPath } from "../routes.tsx";
import type { Feature, Row } from "../sidebar/cards.ts";
import { doneRows } from "../sidebar/done.ts";
import { HomeRow } from "./parts.tsx";
import { Empty } from "../layout/Empty.tsx";
import { DoneIcon } from "../sidebar/StepIcon.tsx";

/** How many done items home shows before "Show all". */
const SHOWN = 5;

export function Recent({ features, rows }: { features: Array<Feature>; rows: Array<Row> }) {
  const here = useRepoPath();
  const pathname = useLocalPath();
  const [asked, setAll] = useState(false);
  const hash = useHash();
  const all = asked || hash === "#done";
  const done = doneRows(features, rows, { here, pathname });
  return (
    <Pane id="done" level={3} title="Recent">
      {done.length === 0 ? (
        <Empty isInset>Nothing done yet.</Empty>
      ) : (
        (all ? done : done.slice(0, SHOWN)).map((row) => (
          <HomeRow
            href={row.href}
            icon={<DoneIcon isSession={row.kind !== undefined} />}
            key={row.folder}
            sub={row.kind ? "Session" : "Merged"}
            title={row.title}
          />
        ))
      )}
      {!all && done.length > SHOWN && (
        <Button
          label={`Show all (${done.length})`}
          onClick={() => setAll(true)}
          size="sm"
          variant="ghost"
        />
      )}
    </Pane>
  );
}
