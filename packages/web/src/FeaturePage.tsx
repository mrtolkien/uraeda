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
import { waiting, workflowOrder } from "./labels.ts";
import { Page } from "./layout/Page.tsx";
import { navigate, useRestoreScroll } from "./routes.tsx";
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

/** A feature: what waits on the human, its branch, its files in workflow order, its problems. */
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
  const gate = feature.step.waitsOn === "human" ? waiting(feature) : undefined;
  const files = workflowOrder(feature.files).filter((file) => file.kind !== "review");
  const finished = feature.files.some((file) => file.kind === "record");
  const left =
    feature.leftWorktree && feature.leftBranch
      ? "Worktree and branch left"
      : feature.leftWorktree
        ? "Worktree left"
        : feature.leftBranch
          ? "Branch left"
          : undefined;
  const missing =
    feature.kind === "feature" && !finished
      ? ["spec.md", "plan.md"].filter((name) => !feature.files.some((f) => f.name === name))
      : [];
  const problemFiles = new Set(feature.problems.map((p) => p.file));
  return (
    <Page>
      <Crumbs folder={folder} />
      <VStack gap={4}>
        <Heading level={1}>{feature.title}</Heading>
        {gate && (
          <Banner
            status="warning"
            title={gate.title}
            description={gate.line}
            collapsible={false}
            endContent={
              <Button variant="primary" label={gate.verb} onClick={() => navigate(gate.href)} />
            }
          />
        )}
        <Suspense fallback={null}>
          <AgentPanel feature={feature} />
        </Suspense>
        <Text type="supporting" display="block">
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
        {left && (
          <Banner
            status="info"
            title={left}
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
          />
        )}
        <List aria-label="Files" hasDividers>
          {files.map((file) => (
            <ListItem
              key={file.name}
              href={`/f/${folder}/${file.name}`}
              label={<Text type="code">{file.name}</Text>}
              endContent={
                <HStack gap={2}>
                  {problemFiles.has(`specs/${folder}/${file.name}`) && (
                    <Badge variant="error" label="problem" />
                  )}
                  <Badge
                    variant={statusVariant(file.status)}
                    label={file.kind === "record" ? "record" : (file.status ?? "committed")}
                  />
                </HStack>
              }
            />
          ))}
          {missing.map((name) => (
            <ListItem
              key={name}
              label={
                <Text type="code" color="secondary">
                  {name}
                </Text>
              }
              endContent={<Badge variant="neutral" label="not yet" />}
            />
          ))}
        </List>
        {feature.mockups.length > 0 && (
          <List header={<Heading level={2}>Mockups</Heading>} hasDividers>
            {feature.mockups.map((name) => (
              <ListItem
                key={name}
                href={`/f/${folder}/mockups/${name}`}
                label={<Text type="code">{name}</Text>}
              />
            ))}
          </List>
        )}
        {feature.problems.length > 0 && (
          <List header={<Heading level={2}>Problems</Heading>} hasDividers>
            {feature.problems.map((problem, index) => (
              <ListItem
                key={index}
                label={
                  <Text type="code">
                    {problem.file.split("/").pop()}
                    {problem.line ? `:${problem.line}` : ""}
                  </Text>
                }
                description={<>{problem.message}</>}
              />
            ))}
          </List>
        )}
      </VStack>
    </Page>
  );
}
