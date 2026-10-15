import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Code } from "@astryxdesign/core/Code";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Suspense } from "react";
import { AgentPanel } from "./AgentPanel.tsx";
import { Crumbs } from "./Crumbs.tsx";
import { useFeature } from "./data.ts";
import { waiting } from "./labels.ts";
import { Page } from "./layout/Page.tsx";
import { navigate, useRepoPath, useRestoreScroll } from "./routes.tsx";
import { Paragraph } from "./layout/Paragraph.tsx";

function statusVariant(status?: string) {
  switch (status) {
    case "awaiting-human":
      return "warning";
    case "approved":
    case "answered":
    case "auto-approved":
      return "success";
    case "changes-requested":
      return "error";
    default:
      return "neutral";
  }
}

type FeatureData = NonNullable<ReturnType<typeof useFeature>>;

/** A feature: what waits on the human, its branch, its files in workflow order, its problems. */
export function FeaturePage({ folder }: { folder: string }) {
  const feature = useFeature(folder);
  const here = useRepoPath();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!feature || feature.missing) {
    return (
      <Page>
        <Paragraph>No feature {folder}.</Paragraph>
      </Page>
    );
  }
  const gate = feature.step.waitsOn === "human" ? waiting(feature) : undefined;
  return (
    <Page>
      <Crumbs folder={folder} />
      <VStack gap={4}>
        <Heading level={1}>{feature.title}</Heading>
        {gate && (
          <Banner
            collapsible={false}
            description={gate.line}
            endContent={
              <Button
                label={gate.verb}
                onClick={() => navigate(here(gate.href))}
                variant="primary"
              />
            }
            status="warning"
            title={gate.title}
          />
        )}
        <Suspense fallback={null}>
          <AgentPanel feature={feature} />
        </Suspense>
        <BranchLine feature={feature} />
        <LeftBanner feature={feature} />
        <FileList feature={feature} folder={folder} />
        <MockupList feature={feature} folder={folder} />
        <ProblemList feature={feature} />
      </VStack>
    </Page>
  );
}

/** The feature's branch and worktree, or that it was merged. */
function BranchLine({ feature }: { feature: FeatureData }) {
  return (
    <Text display="block" type="supporting">
      {feature.branch ? (
        <>
          Branch <Code>{feature.branch}</Code>
          {feature.worktree && feature.worktree !== "." && (
            <>
              {" "}
              in <Code>{feature.worktree}</Code>
            </>
          )}
        </>
      ) : (
        "Merged into the default branch"
      )}
      {feature.uncommitted && " · uncommitted changes"}
    </Text>
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

/** The feature's files, in workflow order, with the spec and plan it does not have yet. */
function FileList({ feature, folder }: { feature: FeatureData; folder: string }) {
  const here = useRepoPath();
  // The core sends them in workflow order.
  const files = feature.files.filter((file) => file.kind !== "review");
  const finished = feature.files.some((file) => file.kind === "record");
  const missing =
    feature.kind === "feature" && !finished
      ? ["spec.md", "plan.md"].filter((name) => !feature.files.some((f) => f.name === name))
      : [];
  const problemFiles = new Set(feature.problems.map((p) => p.file));
  return (
    <List aria-label="Files" hasDividers>
      {files.map((file) => (
        <ListItem
          endContent={
            <HStack gap={2}>
              {problemFiles.has(`specs/${folder}/${file.name}`) && (
                <Badge label="problem" variant="error" />
              )}
              <Badge
                label={file.kind === "record" ? "record" : (file.status ?? "committed")}
                variant={statusVariant(file.status)}
              />
            </HStack>
          }
          href={here(`/f/${folder}/${file.name}`)}
          key={file.name}
          label={<Text type="code">{file.name}</Text>}
        />
      ))}
      {missing.map((name) => (
        <ListItem
          endContent={<Badge label="not yet" variant="neutral" />}
          key={name}
          label={
            <Text color="secondary" type="code">
              {name}
            </Text>
          }
        />
      ))}
    </List>
  );
}

/** The feature's HTML mockups. */
function MockupList({ feature, folder }: { feature: FeatureData; folder: string }) {
  const here = useRepoPath();
  if (feature.mockups.length === 0) {
    return null;
  }
  return (
    <List hasDividers header={<Heading level={2}>Mockups</Heading>}>
      {feature.mockups.map((name) => (
        <ListItem
          href={here(`/f/${folder}/mockups/${name}`)}
          key={name}
          label={<Text type="code">{name}</Text>}
        />
      ))}
    </List>
  );
}

/** The problems `ura check` finds in the feature's files. */
function ProblemList({ feature }: { feature: FeatureData }) {
  if (feature.problems.length === 0) {
    return null;
  }
  return (
    <List hasDividers header={<Heading level={2}>Problems</Heading>}>
      {feature.problems.map((problem, index) => (
        <ListItem
          description={<>{problem.message}</>}
          key={index}
          label={
            <Text type="code">
              {problem.file.split("/").pop()}
              {problem.line ? `:${problem.line}` : ""}
            </Text>
          }
        />
      ))}
    </List>
  );
}
