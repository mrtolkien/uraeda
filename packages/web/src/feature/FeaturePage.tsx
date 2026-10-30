// The page of a feature or a change, top to bottom: where it is, what blocks it, what's next, its
// sessions, its timeline, a done one's record, and its notes, folded; beside them, its column of
// figures and links, which the phone's bottom bar holds instead (`FeatureBar`).
import { Banner } from "@astryxdesign/core/Banner";
import { Code } from "@astryxdesign/core/Code";
import { VStack } from "@astryxdesign/core/VStack";
import { type RefObject, Suspense, useCallback, useRef, useState } from "react";
import { Crumbs } from "../Crumbs.tsx";
import { useAgent, useFeature, useHistory, useRecommendedMessage } from "../data.ts";
import { useKeys } from "../keys/registry.tsx";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Page } from "../layout/Page.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { useRestoreScroll } from "../routes.tsx";
import { useSession } from "../sessionData.ts";
import { type OpenKeys, useOpenKeys } from "../useOpenKeys.ts";
import { FeatureMenu } from "./FeatureMenu.tsx";
import { FeatureBar } from "./FeatureBar.tsx";
import { isDone, WithFeatureColumn } from "./FeatureColumn.tsx";
import { nextOf, type Recommended } from "./next.ts";
import { NextPane } from "./NextPane.tsx";
import { Blocking, Notes } from "./Notes.tsx";
import { Record } from "./Record.tsx";
import { SessionsPane } from "./SessionsPane.tsx";
import { Timeline } from "./Timeline.tsx";
import { day } from "./times.ts";
import { Missing } from "../layout/Missing.tsx";
import { PageTitle } from "../layout/PageTitle.tsx";
import { featurePage } from "../dropItem.ts";
import { RefusedHere } from "../writes/RefusedHere.tsx";

type FeatureData = NonNullable<ReturnType<typeof useFeature>>;
type HistoryData = NonNullable<ReturnType<typeof useHistory>>;

/** "Feature · Oct 17 · branch <branch>": its kind, its folder's day, and its branch. */
function headerLine(feature: FeatureData): string {
  const parts = [
    feature.kind === "change" ? "Change" : "Feature",
    day(feature.folder.slice(0, 10)),
  ];
  if (feature.branch) {
    parts.push(`branch ${feature.branch}`);
  }
  if (feature.uncommitted) {
    parts.push("uncommitted changes");
  }
  return parts.join(" · ");
}

/** The server's recommended message, as "Next" reads it: the message, or why there is none. */
function recommendedOf(read: ReturnType<typeof useRecommendedMessage>): Recommended {
  if (!read) {
    return undefined;
  }
  if (read.name !== null && read.trigger !== null) {
    return { name: read.name, trigger: read.trigger };
  }
  return read.reason === null ? undefined : { reason: read.reason };
}

/** What "Next" tells the page of its button: what it does, or none. */
type OnNextRun = (run: (() => void) | undefined) => void;

/**
 * `n`, what "Next"'s button does: declared before the sessions' `s` and `S`, as "Next" comes before
 * them, though it draws once its data is read.
 */
function NextKey({ hasNext, run }: { hasNext: boolean; run: RefObject<(() => void) | undefined> }) {
  useKeys(
    hasNext
      ? [
          { hint: "n", keys: "n", label: "next step", run: () => run.current?.() },
          // Enter too, with no hint, on the page itself: a link or a button with the focus keeps
          // its own Enter.
          {
            keys: "Enter",
            label: "next step",
            run: () => run.current?.(),
            when: (target) => target === document.body || target === document.documentElement,
          },
        ]
      : [],
  );
  return null;
}

/** "Next": the one action of the feature's step. */
function NextStep({
  feature,
  history,
  onRun,
  working = false,
}: {
  feature: FeatureData;
  history: HistoryData;
  onRun: OnNextRun;
  working?: boolean;
}) {
  const merge = history.stages.find((stage) => stage.name === "merged")?.started;
  const agent = useAgent();
  const recommended = recommendedOf(useRecommendedMessage(feature.folder));
  const next = nextOf(feature, {
    agent: agent ? { available: agent.available, name: agent.name } : undefined,
    merged: merge ?? history.finished ?? undefined,
    recommended,
    working,
  });
  // A human gate is peach; the agent's turn, a build, or a merge is the active pane.
  const tone = feature.step.waitsOn === "human" ? "attention" : "active";
  return <NextPane folder={feature.folder} next={next} onRun={onRun} tone={tone} />;
}

/** "Next", once the feature's latest session is read, which its runs go to. */
function WithSession({
  feature,
  history,
  id,
  onRun,
}: {
  feature: FeatureData;
  history: HistoryData;
  id: string;
  onRun: OnNextRun;
}) {
  const session = useSession(id);
  return (
    <NextStep
      feature={feature}
      history={history}
      onRun={onRun}
      working={session?.status === "working"}
    />
  );
}

/** What a finished feature left behind: its worktree, its branch, or both. */
function LeftBanner({ feature }: { feature: FeatureData }) {
  const left =
    feature.leftWorktree && feature.leftBranch
      ? "Worktree and branch left"
      : feature.leftWorktree
        ? "Worktree left"
        : feature.leftBranch
          ? "Branch left"
          : undefined;
  if (!left) {
    return null;
  }
  return (
    <Banner
      collapsible={false}
      description={
        <>
          {feature.leftWorktree && <Code>{feature.leftWorktree}</Code>}
          {feature.leftWorktree && feature.leftBranch && " and the branch "}
          {!feature.leftWorktree && "The branch "}
          {feature.leftBranch && <Code>{feature.leftBranch}</Code>}
          {feature.leftWorktree && feature.leftBranch ? " are" : " is"} still there. Run{" "}
          <Code>ura clean</Code> to remove{" "}
          {feature.leftWorktree && feature.leftBranch ? "them" : "it"}.
        </>
      }
      status="info"
      title={left}
    />
  );
}

/** A done item's record, in place, its folds open as the history entry keeps them. */
function RecordPart({
  feature,
  history,
  keys,
}: {
  feature: FeatureData;
  history: HistoryData;
  keys: OpenKeys;
}) {
  const done = isDone(history);
  const record = done ? feature.files.find((file) => file.kind === "record") : undefined;
  if (!record) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <Record folder={feature.folder} history={history} keys={keys} name={record.name} />
    </Suspense>
  );
}

/**
 * The feature's name, with its line of facts and, while it is not done, its menu; why the server
 * refused a drop shows under it until dismissed, and why its commit was refused once the page
 * already showed it dropped.
 */
function FeatureTitle({ done, feature }: { done: boolean; feature: FeatureData }) {
  const [refused, setRefused] = useState<string>();
  return (
    <VStack gap={2}>
      <PageTitle
        actions={
          !done && (
            <FeatureMenu
              feature={feature}
              item={{
                branch: feature.branch ?? null,
                folder: feature.folder,
                kind: feature.kind === "change" ? "change" : "feature",
                slug: feature.slug,
              }}
              onRefused={setRefused}
            />
          )
        }
        meta={{ text: headerLine(feature) }}
      >
        {feature.title}
      </PageTitle>
      {refused && (
        <AnnouncedBanner
          collapsible={false}
          dismissLabel="Dismiss"
          isDismissable
          onDismiss={() => setRefused(undefined)}
          status="error"
          title={refused}
        />
      )}
      <RefusedHere
        what={`the ${feature.kind === "change" ? "change" : "feature"} is back, not dropped.`}
        where={{ href: featurePage(feature.folder) }}
      />
    </VStack>
  );
}

/** The page of a feature that exists, with its history read from git. */
function FeatureBody({ feature }: { feature: FeatureData }) {
  const history = useHistory(feature.folder);
  // The record's folds, which a figure of the column opens.
  const keys = useOpenKeys();
  // What "Next"'s button does, which `n` does too, once "Next" is drawn.
  const nextRun = useRef<() => void>(undefined);
  const [hasNext, setHasNext] = useState(false);
  const onNextRun = useCallback((run: (() => void) | undefined) => {
    nextRun.current = run;
    setHasNext(run !== undefined);
  }, []);
  const inline = isNarrow(useWidthClass());
  if (!history) {
    return (
      <Page kind="rows">
        <Crumbs folder={feature.folder} />
      </Page>
    );
  }
  const done = isDone(history);
  const page = (
    <Page kind="rows">
      <Crumbs folder={feature.folder} />
      <VStack gap={6}>
        <FeatureTitle done={done} feature={feature} />
        <Blocking
          change={feature.kind === "change"}
          folder={feature.folder}
          problems={feature.problems}
        />
        <LeftBanner feature={feature} />
        <Suspense fallback={null}>
          {feature.session ? (
            <WithSession
              feature={feature}
              history={history}
              id={feature.session}
              onRun={onNextRun}
            />
          ) : (
            <NextStep feature={feature} history={history} onRun={onNextRun} />
          )}
        </Suspense>
        {/* Before the sessions' keys, as "Next" comes before them, though "Next" draws later. */}
        <NextKey hasNext={hasNext} run={nextRun} />
        <SessionsPane
          folder={feature.folder}
          progress={feature.step.progress}
          sessions={feature.sessions}
        />
        <Timeline feature={feature} history={history} progress={feature.step.progress} />
        <RecordPart feature={feature} history={history} keys={keys} />
        <Notes notes={feature.notes} />
      </VStack>
    </Page>
  );
  return (
    <>
      <WithFeatureColumn content={page} feature={feature} history={history} keys={keys} />
      {inline && (
        <FeatureBar
          feature={feature}
          history={history}
          keys={keys}
          next={hasNext ? () => nextRun.current?.() : undefined}
        />
      )}
    </>
  );
}

/** A feature's or a change's page. */
export function FeaturePage({ folder }: { folder: string }) {
  const feature = useFeature(folder);
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!feature || feature.missing) {
    return (
      <Page kind="rows">
        <Missing title={`No feature ${folder}.`} />
      </Page>
    );
  }
  return <FeatureBody feature={feature} />;
}
