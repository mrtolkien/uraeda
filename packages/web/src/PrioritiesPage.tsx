import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import { useFateClient } from "react-fate";
import { CommitBar } from "./CommitBar.tsx";
import { usePriorities } from "./data.ts";
import { refusal } from "./errors.ts";
import { Page } from "./layout/Page.tsx";
import { PrioritiesList } from "./lists/PrioritiesList.tsx";
import { useRestoreScroll } from "./routes.tsx";
import { PrioritiesView } from "./views.ts";
import { PageTitle } from "./layout/PageTitle.tsx";

/**
 * Every line of `PRIORITIES.md`, by section, with the running ones apart in "Ongoing": each opens
 * its task view, drags to its place, and each section ends with an Add row; each change is written
 * at once, and a bar commits or discards them. While a line is dragged, and until its move is
 * written, the list stays as the drag found it: a live update waits for the drag's end. `select`
 * and `isFocused` select a row and focus it, for a mockup.
 */
export function PrioritiesPage({ isFocused, select }: { isFocused?: boolean; select?: string }) {
  const fate = useFateClient();
  const priorities = usePriorities();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  const [message, setMessage] = useState<string>();

  /** Writes a change: a refusal shows where it was made, and a conflict reads the list again. */
  const run = async (call: () => Promise<{ error?: unknown }>) => {
    setMessage(undefined);
    const result = await call();
    if (!result.error) {
      return undefined;
    }
    const failed = refusal(result.error);
    if (failed.kind === "conflict") {
      void fate.request(
        { priorities: { id: "priorities", view: PrioritiesView } },
        { mode: "network-only" },
      );
    }
    return failed.message;
  };
  if (!priorities) {
    return null;
  }

  return (
    <Page>
      <VStack gap={2}>
        <PageTitle description="What is worked on, in order: Ongoing runs now, then Now, Next, and Later.">
          Priorities
        </PageTitle>
        {message && <AnnouncedBanner collapsible={false} status="error" title={message} />}
        <PrioritiesList
          isFocused={isFocused}
          onMoveRefused={setMessage}
          priorities={priorities}
          run={run}
          select={select}
        />
        <CommitBar changes={priorities.changes} />
      </VStack>
    </Page>
  );
}
