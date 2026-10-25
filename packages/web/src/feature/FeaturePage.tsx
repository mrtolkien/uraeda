// The page of a feature or a change, top to bottom: where it is, what blocks it, what's next, its
// timeline, a done one's record, and its notes, folded; beside them, or after them on the phone, its column of
// sessions, figures, and links.
import { Banner } from "@astryxdesign/core/Banner";
import { Code } from "@astryxdesign/core/Code";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Suspense, useState } from "react";
import { Crumbs } from "../Crumbs.tsx";
import { useAgent, useFeature, useHistory, useRecommendedMessage } from "../data.ts";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Page } from "../layout/Page.tsx";
import { Paragraph } from "../layout/Paragraph.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { useRestoreScroll } from "../routes.tsx";
import { useSession } from "../sessionData.ts";
import { type OpenKeys, useOpenKeys } from "../useOpenKeys.ts";
import { FeatureMenu } from "./FeatureMenu.tsx";
import { FeatureColumn, WithFeatureColumn } from "./FeatureColumn.tsx";
import { nextOf, type Recommended } from "./next.ts";
import { NextPane } from "./NextPane.tsx";
import { Blocking, Notes } from "./Notes.tsx";
import { Record } from "./Record.tsx";
import { Timeline } from "./Timeline.tsx";
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

/** "Next": the one action of the feature's step. */
function NextStep({
  feature,
  history,
  working = false,
}: {
  feature: FeatureData;
  history: HistoryData;
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
  return <NextPane folder={feature.folder} next={next} tone={tone} />;
}

/** "Next", once the feature's latest session is read, which its runs go to. */
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
  return <NextStep feature={feature} history={history} working={session?.status === "working"} />;
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
  const done = history.current >= history.stages.length;
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

/** The page of a feature that exists, with its history read from git. */
function FeatureBody({ feature }: { feature: FeatureData }) {
  const history = useHistory(feature.folder);
  // Why the server refused a drop, shown under the name until dismissed.
  const [refused, setRefused] = useState<string>();
  // The record's folds, which a figure of the column opens.
  const keys = useOpenKeys();
  const inline = isNarrow(useWidthClass());
  if (!history) {
    return (
      <Page>
        <Crumbs folder={feature.folder} />
      </Page>
    );
  }
  const done = history.current >= history.stages.length;
  const page = (
    <Page>
      <Crumbs folder={feature.folder} />
      <VStack gap={6}>
        <VStack gap={2}>
          <HStack align="center" gap={2} justify="between">
            <Heading level={1}>{feature.title}</Heading>
            {!done && (
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
            )}
          </HStack>
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
          <Text color="secondary" type="supporting">
            {headerLine(feature)}
          </Text>
        </VStack>
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
            <NextStep feature={feature} history={history} />
          )}
        </Suspense>
        <Timeline feature={feature} history={history} progress={feature.step.progress} />
        <RecordPart feature={feature} history={history} keys={keys} />
        {inline && <FeatureColumn feature={feature} history={history} keys={keys} />}
        <Notes notes={feature.notes} />
      </VStack>
    </Page>
  );
  return <WithFeatureColumn content={page} feature={feature} history={history} keys={keys} />;
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
  return <FeatureBody feature={feature} />;
}
