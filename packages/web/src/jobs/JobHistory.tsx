// A job's history in the repository, newest first: each run's time over its session's or its
// change's card, as the sidebar draws it, or over the line of a time that was skipped. A run by "Run
// now" says so under its card. The page gives the cards (`renderCard`), the stories draw their own.
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { JobRunView } from "uraeda-server/fate";
import { Pane } from "../layout/Pane.tsx";
import { whenWords } from "./words.ts";

const styles = stylex.create({
  list: { listStyleType: "none", margin: 0, padding: 0 },
  // A line that started nothing: where a card's text starts.
  note: { paddingBlock: spacingVars["--spacing-1"], paddingInline: spacingVars["--spacing-2"] },
});

/**
 * Why a time was skipped, in words. `older` are the runs before it, newest first: the change that
 * is open is the one the latest of them started.
 */
export function skippedWords(run: JobRunView, older: ReadonlyArray<JobRunView>): string {
  if (run.reason === "working") {
    return "Skipped: its last run still works.";
  }
  const title = older.find((each) => each.outcome === "started" && each.folder !== null)?.title;
  return title == null
    ? "Skipped: a change it started is still open."
    : `Skipped: the change “${title}” is still open.`;
}

/** What a run says in place of its card, a skipped time's reason or a session that is gone. */
function lineOf(run: JobRunView, older: ReadonlyArray<JobRunView>): string {
  if (run.outcome === "skipped") {
    return skippedWords(run, older);
  }
  return run.title === null ? "Its session is gone." : `“${run.title}”: its session is gone.`;
}

/**
 * The history: `runs` newest first, `now` the time its times read against, in the server's `zone`, and `renderCard` a
 * started run's card, or nothing once its session is gone.
 */
export function JobHistory({
  now,
  renderCard,
  runs,
  zone,
}: {
  now: Date;
  renderCard: (run: JobRunView) => ReactNode;
  runs: ReadonlyArray<JobRunView>;
  zone: string;
}) {
  return (
    <Pane count={runs.length} icon="uraeda:history" isSnugOnPhone title="History">
      {runs.length === 0 ? (
        <Text color="secondary">It has not run here yet.</Text>
      ) : (
        <VStack as="ul" gap={2} xstyle={styles.list}>
          {runs.map((run, index) => {
            const card = run.outcome === "started" ? renderCard(run) : null;
            return (
              <VStack as="li" gap={1} key={run.id}>
                <Text color="secondary" type="supporting">
                  {whenWords(new Date(run.at), now, zone)}
                </Text>
                {card ?? (
                  <Text color="secondary" xstyle={styles.note}>
                    {lineOf(run, runs.slice(index + 1))}
                  </Text>
                )}
                {card && run.trigger === "manual" && (
                  <Text color="secondary" xstyle={styles.note}>
                    Started by “Run now”.
                  </Text>
                )}
              </VStack>
            );
          })}
        </VStack>
      )}
    </Pane>
  );
}
