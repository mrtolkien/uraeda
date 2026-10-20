// The page of a feature or a change, top to bottom: where it is, what blocks it, what's next beside
// the agent, what it produced, a done one's record, and its notes, folded.
import { Banner } from "@astryxdesign/core/Banner";
import { Code } from "@astryxdesign/core/Code";
import { Grid, GridSpan } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Suspense } from "react";
import { Crumbs } from "../Crumbs.tsx";
import { useFeature, useHistory } from "../data.ts";
import { Page } from "../layout/Page.tsx";
import { Paragraph } from "../layout/Paragraph.tsx";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { useRestoreScroll } from "../routes.tsx";
import { useSession } from "../sessionData.ts";
import { useOpenKeys } from "../useOpenKeys.ts";
import { AgentCard, type AgentSession } from "./AgentCard.tsx";
import { Figures } from "./Figures.tsx";
import { FileList } from "./FileList.tsx";
import { nextOf } from "./next.ts";
import { NextCard } from "./NextCard.tsx";
import { Blocking, Notes } from "./Notes.tsx";
import { QUESTIONS_KEY, Record } from "./Record.tsx";
import { Section } from "./Section.tsx";
import { Stages } from "./Stages.tsx";
import { day } from "./times.ts";

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

/** "Next" beside the agent's card: one row on a wide screen, "Next" twice as wide; stacked on the phone. */
function NextAndAgent({
  feature,
  history,
  session,
}: {
  feature: FeatureData;
  history: HistoryData;
  session?: AgentSession;
}) {
  const wide = useWidthClass() === "wide";
  const merge = history.stages.find((stage) => stage.name === "merged")?.started;
  const next = nextOf(feature, {
    merged: merge ?? history.finished ?? undefined,
    working: session?.status === "working",
  });
  return (
    <Grid columns={wide ? 3 : 1} gap={3}>
      <GridSpan columns={wide ? 2 : 1}>
        <NextCard next={next} />
      </GridSpan>
      <AgentCard folder={feature.folder} progress={feature.step.progress} session={session} />
    </Grid>
  );
}

/** "Next" and the agent, once the feature's session is read. */
function WithSession({
  feature,
  history,
  id,
}: {
  feature: FeatureData;
  history: HistoryData;
  id: string;
}) {
  const session = useSession(id);
  return <NextAndAgent feature={feature} history={history} session={session ?? undefined} />;
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

/**
 * What the feature produced: its figures and files, then, once done, its record in place, its
 * folds open as the history entry keeps them.
 */
function Produced({ feature, history }: { feature: FeatureData; history: HistoryData }) {
  const keys = useOpenKeys();
  const done = history.current >= history.stages.length;
  const record = done ? feature.files.find((file) => file.kind === "record") : undefined;
  return (
    <>
      <Section id="changes" title={done ? "What it produced" : "What it produced so far"}>
        <Figures
          change={feature.kind === "change"}
          done={done}
          history={history}
          onOpen={(id) => id === "questions" && keys.onOpenChange(QUESTIONS_KEY, true)}
          pullRequest={done ? feature.pullRequest?.url : undefined}
          tokens={feature.tokens ?? null}
        />
        <div id="files">
          <FileList feature={feature} />
        </div>
      </Section>
      {record && (
        <Suspense fallback={null}>
          <Record folder={feature.folder} history={history} keys={keys} name={record.name} />
        </Suspense>
      )}
    </>
  );
}

/** The page of a feature that exists, with its history read from git. */
function FeatureBody({ feature }: { feature: FeatureData }) {
  const history = useHistory(feature.folder);
  if (!history) {
    return null;
  }
  return (
    <VStack gap={6}>
      <VStack gap={2}>
        <Heading level={1}>{feature.title}</Heading>
        <Text color="secondary" type="supporting">
          {headerLine(feature)}
        </Text>
      </VStack>
      <Stages history={history} />
      <Blocking
        change={feature.kind === "change"}
        folder={feature.folder}
        problems={feature.problems}
      />
      <LeftBanner feature={feature} />
      <Suspense fallback={null}>
        {feature.session ? (
          <WithSession feature={feature} history={history} id={feature.session} />
        ) : (
          <NextAndAgent feature={feature} history={history} />
        )}
      </Suspense>
      <Produced feature={feature} history={history} />
      <Notes notes={feature.notes} />
    </VStack>
  );
}

/** A feature's or a change's page. */
export function FeaturePage({ folder }: { folder: string }) {
  const feature = useFeature(folder);
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!feature || feature.missing) {
    return (
      <Page>
        <Paragraph>No feature {folder}.</Paragraph>
      </Page>
    );
  }
  return (
    <Page>
      <Crumbs folder={folder} />
      <FeatureBody feature={feature} />
    </Page>
  );
}
