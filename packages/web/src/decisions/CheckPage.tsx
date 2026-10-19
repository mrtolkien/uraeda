import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { useRound } from "../data.ts";
import { Page } from "../layout/Page.tsx";
import { DECISIONS_CHECK_ID } from "../roundTarget.ts";
import { RoundPage } from "../RoundPage.tsx";
import { useRepoPath, useRestoreScroll } from "../routes.tsx";

/**
 * The decisions check, `specs/DECISIONS-CHECK.md`, at `/decisions/check`: answered as a round of
 * questions, written on the default branch; while there is none, a link back to the decisions.
 */
export function CheckPage() {
  const file = useRound(DECISIONS_CHECK_ID);
  const here = useRepoPath();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!file || file.missing) {
    return (
      <Page>
        <Banner
          collapsible={false}
          endContent={<Button href={here("/decisions")} label="Open the decisions" />}
          status="info"
          title="No decisions check waits."
        />
      </Page>
    );
  }
  return <RoundPage file={file} target={{ round: DECISIONS_CHECK_ID }} />;
}
