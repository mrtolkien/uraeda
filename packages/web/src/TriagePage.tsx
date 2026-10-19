import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { useRound } from "./data.ts";
import { Page } from "./layout/Page.tsx";
import { RoundPage } from "./RoundPage.tsx";
import { TRIAGE_ID } from "./roundTarget.ts";
import { useRepoPath, useRestoreScroll } from "./routes.tsx";

/**
 * The inbox's triage, `specs/INBOX-TRIAGE.md`, at `/inbox/triage`: answered as a round of
 * questions, written on the default branch; while there is none, a link back to the inbox.
 */
export function TriagePage() {
  const file = useRound(TRIAGE_ID);
  const here = useRepoPath();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!file || file.missing) {
    return (
      <Page>
        <Banner
          collapsible={false}
          endContent={<Button href={here("/inbox")} label="Open the inbox" />}
          status="info"
          title="No inbox triage waits."
        />
      </Page>
    );
  }
  return <RoundPage file={file} target={{ round: TRIAGE_ID }} />;
}
