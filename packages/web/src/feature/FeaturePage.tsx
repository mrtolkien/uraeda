// The page of a feature or a change, top to bottom: where it is, what blocks it, what's next, its
// sessions, its timeline, a done one's record, and its notes, folded; beside them, its column of
// figures and links, which the phone's bottom bar holds instead (`FeatureBar`).
import { Banner } from "@astryxdesign/core/Banner";
import { Code } from "@astryxdesign/core/Code";
import { VStack } from "@astryxdesign/core/VStack";
import { type RefObject, Suspense, useCallback, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { Crumbs } from "../Crumbs.tsx";
import {
  agentRequest,
  historyRequest,
  recommendedRequest,
  rereadChanges,
  useAgent,
  useFeature,
  useHistory,
  useRecommendedMessage,
} from "../data.ts";
import { refusal } from "../errors.ts";
import { readAlong } from "../readAhead.ts";
import { FeatureView } from "../views.ts";
import { useKeys } from "../keys/registry.tsx";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Page } from "../layout/Page.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { useRestoreScroll } from "../routes.tsx";
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
import { useClean } from "../git/useClean.ts";

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
 * them.
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

/**
 * "Next": the one action of the feature's step, the agent's while its status is Working, whatever
 * the step, leading to the session at work.
 */
function NextStep({
  feature,
  history,
  onRun,
}: {
  feature: FeatureData;
  history: HistoryData;
  onRun: OnNextRun;
}) {
  const merge = history.stages.find((stage) => stage.name === "merged")?.started;
  const agent = useAgent();
  const recommended = recommendedOf(useRecommendedMessage(feature.folder));
  const working = feature.status.status === "working";
  const next = nextOf(feature, {
    agent: agent ? { available: agent.available, name: agent.name } : undefined,
    merged: merge ?? history.finished ?? undefined,
    recommended,
    session: feature.status.session,
    working,
  });
  // A human gate is peach, unless an agent works on it; the agent's turn, a build, or a merge is
  // the active pane.
  const tone = feature.step.waitsOn === "human" && !working ? "attention" : "active";
  const clean = useClean();
  const [refused, setRefused] = useState<string>();
  // Stable while the feature is: `n` and Enter are declared again only when what they do changes.
  const onClean = useCallback(() => {
    setRefused(undefined);
    void clean({
      folder: feature.folder,
      href: featurePage(feature.folder),
      name: feature.title,
    }).then(setRefused);
  }, [clean, feature.folder, feature.title]);
  return (
    <VStack gap={2}>
      <NextPane folder={feature.folder} next={next} onClean={onClean} onRun={onRun} tone={tone} />
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
    </VStack>
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
          {feature.leftWorktree && feature.leftBranch ? " are" : " is"} still there. Clean, under
          Next, removes {feature.leftWorktree && feature.leftBranch ? "them" : "it"}, and its line
          of the priorities.
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

/**
 * The check's notes; for a done feature, read from the default branch, with "Fix moved links",
 * which rewrites its record's moved links, uncommitted, for the Git page; why it was refused
 * shows under them until dismissed.
 */
function FeatureNotes({ feature }: { feature: FeatureData }) {
  const fate = useFateClient();
  const [refused, setRefused] = useState<string>();
  const fix = async () => {
    setRefused(undefined);
    const result = await fate.mutations.feature.fixLinks({
      input: { folder: feature.folder },
      view: FeatureView,
    });
    if (result.error) {
      setRefused(refusal(result.error).message);
      return;
    }
    // The Git page's count of changes now holds the repair.
    rereadChanges(fate);
  };
  return (
    <>
      <Notes notes={feature.notes} onFix={feature.source === "default-branch" ? fix : undefined} />
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
    </>
  );
}

/** What `j` and `k` move along on a feature's page: its links and buttons, in reading order. */
const STOPS = "a[href], button:not([disabled])";

/**
 * `j` `k` and the arrows on a feature's page, which has no list of its own: they move the focus
 * along `page`'s links and buttons, Next's, the sessions', the timeline's, in reading order, and
 * `Enter` opens the one focused, as its click does. The first press starts at the first.
 */
function usePageStops(page: RefObject<HTMLDivElement | null>) {
  const step = (by: 1 | -1) => {
    const stops = [...(page.current?.querySelectorAll<HTMLElement>(STOPS) ?? [])].filter(
      (stop) => stop.offsetParent !== null,
    );
    const at = stops.indexOf(document.activeElement as HTMLElement);
    const next = at === -1 ? (by === 1 ? 0 : stops.length - 1) : at + by;
    stops[Math.min(Math.max(next, 0), stops.length - 1)]?.focus();
  };
  useKeys([
    { hint: "j k", keys: "j", label: "move", run: () => step(1) },
    { keys: "ArrowDown", label: "move", run: () => step(1) },
    { keys: "k", label: "move up", run: () => step(-1) },
    { keys: "ArrowUp", label: "move up", run: () => step(-1) },
  ]);
}

/** The page of a feature that exists, with its history read from git. */
function FeatureBody({ feature }: { feature: FeatureData }) {
  const stops = useRef<HTMLDivElement>(null);
  usePageStops(stops);
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
      <VStack gap={6} ref={stops}>
        <FeatureTitle done={done} feature={feature} />
        <Blocking
          change={feature.kind === "change"}
          folder={feature.folder}
          isNextKey={!hasNext}
          problems={feature.problems}
        />
        <LeftBanner feature={feature} />
        {/* Read along with the feature and its history: drawn with the page, it never pushes the
            sessions and the timeline down once they are there. */}
        <NextStep feature={feature} history={history} onRun={onNextRun} />
        {/* Before the sessions' keys, as "Next" comes before them. */}
        <NextKey hasNext={hasNext} run={nextRun} />
        <SessionsPane
          folder={feature.folder}
          progress={feature.step.progress}
          sessions={feature.sessions}
        />
        <Timeline feature={feature} history={history} progress={feature.step.progress} />
        <RecordPart feature={feature} history={history} keys={keys} />
        <FeatureNotes feature={feature} />
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

/**
 * A feature's or a change's page, drawn once what it shows is read: its history and what "Next"
 * reads are asked for with the feature, not one after the other.
 */
export function FeaturePage({ folder }: { folder: string }) {
  const fate = useFateClient();
  readAlong(fate, [historyRequest(folder), agentRequest(), recommendedRequest(folder)]);
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
