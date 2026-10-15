// A change's session's column: its step, with its round or its pull request, its running
// sub-agents, the files changed on its branch, and its files, its Storybook first. The phone's
// progress line counts its round's questions the same way.
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { Feature } from "uraeda-server/fate";
import { useFeature, useFile } from "./data.ts";
import { useRepoPath } from "./routes.tsx";
import {
  Changes,
  Section,
  SectionHeading,
  StorybookRow,
  stepTitle,
  Subagents,
} from "./SessionAside.tsx";

type Item = Pick<Feature, "files" | "folder" | "preview" | "pullRequest" | "step">;

/** The number of questions a round asks now, from its parsed items. */
export function useRoundQuestions(folder: string, file: string): number {
  const round = useFile(folder, file);
  const questions = round && !round.missing ? round.current.items.clarifications?.questions : [];
  return (questions ?? []).filter((question) => question.asked).length;
}

/** "1 question", or "N questions". */
function questionCount(count: number) {
  return `${count} ${count === 1 ? "question" : "questions"}`;
}

/**
 * The round a change waits on the human for: its step's gate, the file the core names, while that
 * file is a round.
 */
export function roundOf(item: Pick<Item, "files" | "step">) {
  const gate = item.files.find((file) => file.name === item.step.file);
  return item.step.waitsOn === "human" && gate?.kind === "clarifications" ? gate : undefined;
}

/** " · N question(s)", after the step's title on the phone's progress line. */
export function QuestionCount({ file, folder }: { file: string; folder: string }) {
  return <>{` · ${questionCount(useRoundQuestions(folder, file))}`}</>;
}

/** The round's row: its name, opening it, and how many questions it asks. */
function RoundRow({ file, folder, round }: { file: string; folder: string; round: number }) {
  const here = useRepoPath();
  const count = useRoundQuestions(folder, file);
  return (
    <List aria-label="Round" density="compact">
      <ListItem
        endContent={
          <Text color="secondary" type="supporting">
            {questionCount(count)}
          </Text>
        }
        href={here(`/f/${folder}/${file}`)}
        label={`Questions, round ${String(round).padStart(2, "0")}`}
      />
    </List>
  );
}

/** The pull request's number, from its URL: none when the URL does not end with one. */
function pullNumber(url: string) {
  return /\/pull\/(\d+)\/?$/.exec(url)?.[1];
}

/**
 * What the change's step holds: its round's row, its pull request's, or "The agent is working."
 * while it waits on the agent; nothing otherwise.
 */
function StepContent({ item }: { item: Item }) {
  const round = roundOf(item);
  if (round) {
    return <RoundRow file={round.name} folder={item.folder} round={round.round ?? 1} />;
  }
  const number = item.pullRequest ? pullNumber(item.pullRequest) : undefined;
  if (item.pullRequest && number) {
    return (
      <List aria-label="Pull request" density="compact">
        <ListItem href={item.pullRequest} label={`Pull request #${number}`} />
      </List>
    );
  }
  return item.step.waitsOn === "agent" ? (
    <Text color="secondary">The agent is working.</Text>
  ) : null;
}

/**
 * The change's Storybook when its checkout has a preview decision, then its workflow files but its
 * reviews, or its record once finished, each opening it.
 */
function Files({ item }: { item: Pick<Item, "files" | "folder" | "preview"> }) {
  const here = useRepoPath();
  const files = item.files.filter((file) => file.kind !== "review");
  return (
    <VStack gap={2}>
      <SectionHeading>Files</SectionHeading>
      <List aria-label="Files" density="compact">
        <StorybookRow item={item} />
        {files.map((file) => (
          <ListItem
            href={here(`/f/${item.folder}/${file.name}`)}
            key={file.name}
            label={<Text type="code">{file.name}</Text>}
          />
        ))}
      </List>
    </VStack>
  );
}

/**
 * A change's column: its step, the running sub-agents, the files changed on its branch, and its
 * files, after its Storybook with a preview decision. It has no plan, and no page but its session
 * and its Storybook.
 */
export function ChangeAside({ folder, session }: { folder: string; session?: string }) {
  const item = useFeature(folder);
  if (!item || item.missing) {
    return null;
  }
  return (
    <VStack gap={6}>
      <VStack gap={2}>
        <SectionHeading>{stepTitle(item)}</SectionHeading>
        <Section>
          <StepContent item={item} />
        </Section>
      </VStack>
      {session !== undefined && (
        <Section>
          <Subagents session={session} />
        </Section>
      )}
      <Section>
        <Changes folder={folder} kind="change" />
      </Section>
      <Files item={item} />
    </VStack>
  );
}
