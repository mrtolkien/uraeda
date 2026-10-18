// TEMPORARY: mockup of the feature page redesign (specs/2026-10-18-redesign-feature/), replaced by the real page.
// The page's parts: the stages, what comes next, the agent, the figures, the files, and the notes.
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Step, Stepper } from "@astryxdesign/core/Stepper";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { StatusMark } from "../StatusMark.tsx";
import type {
  MockAgent,
  MockFigure,
  MockFile,
  MockNext,
  MockProblem,
  MockStage,
} from "./featureMockupData.ts";

const styles = stylex.create({
  eyebrow: { textTransform: "uppercase" },
});

/** The workflow's stages, the current one marked; each reached one with its date and duration. */
export function Stages({ current, stages }: { current: number; stages: Array<MockStage> }) {
  const wide = useWidthClass() === "wide";
  return (
    <Stepper
      activeStep={current}
      density="compact"
      label="Stages"
      orientation={wide ? "horizontal" : "vertical"}
    >
      {stages.map((stage, index) => (
        <Step
          description={stage.line}
          key={stage.label}
          label={stage.label}
          status={index < current ? "success" : undefined}
          step={index}
        />
      ))}
    </Stepper>
  );
}

/** What comes next: who acts and what, with its buttons. */
export function NextCard({ next }: { next: MockNext }) {
  return (
    <Card padding={4} variant="muted">
      <VStack gap={3}>
        <VStack gap={1}>
          <Text color="secondary" type="label" xstyle={styles.eyebrow}>
            Next
          </Text>
          <Heading level={2}>{next.title}</Heading>
          <Text color="secondary">{next.line}</Text>
        </VStack>
        {next.actions && (
          <HStack gap={2} wrap="wrap">
            {next.actions.map((action) => (
              <Button key={action.label} label={action.label} variant={action.variant} />
            ))}
          </HStack>
        )}
      </VStack>
    </Card>
  );
}

const STATUS = {
  idle: { label: "Idle", status: "idle" },
  waiting: { label: "Waiting for you", status: "needs-you" },
  working: { label: "Working", status: "working" },
} as const;

/** The feature's session: its status, its task, its last run, and the one way into it. */
export function AgentCard({ agent }: { agent: MockAgent }) {
  const { label, status } = STATUS[agent.status];
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack align="center" gap={2} justify="between" wrap="wrap">
          <HStack align="center" gap={2}>
            <StatusMark label={label} status={status} />
            <Heading level={2}>Agent · {label}</Heading>
          </HStack>
          <Button label="Open the session" variant="secondary" />
        </HStack>
        {agent.progress && (
          <ProgressBar
            formatValueLabel={(value: number, max: number) => `${value}/${max}`}
            hasValueLabel
            label={`Task ${agent.progress.position} of ${agent.progress.total}: ${agent.progress.title}`}
            max={agent.progress.total}
            value={agent.progress.position}
          />
        )}
        <Text color="secondary" type="supporting">
          {agent.lastRun}
          {agent.subagents ? ` · ${agent.subagents} sub-agents working` : ""}
        </Text>
      </VStack>
    </Card>
  );
}

/** One figure: its name, its value, and what it counts. */
function Figure({ figure }: { figure: MockFigure }) {
  return (
    <Card padding={4}>
      <div aria-label={figure.label} role="group">
        <VStack gap={1}>
          <Text color="secondary" type="label" xstyle={styles.eyebrow}>
            {figure.label}
          </Text>
          <Text hasTabularNumbers size="xl" weight="bold">
            {figure.value}
          </Text>
          <Text color="secondary" type="supporting">
            {figure.caption}
          </Text>
        </VStack>
      </div>
    </Card>
  );
}

/** The figures of what the feature produced, in a grid that wraps. */
export function Figures({ figures }: { figures: Array<MockFigure> }) {
  const wide = useWidthClass() === "wide";
  return (
    <Grid columns={{ minWidth: wide ? 190 : 150, repeat: "fill" }} gap={3}>
      {figures.map((figure) => (
        <Figure figure={figure} key={figure.label} />
      ))}
    </Grid>
  );
}

const BADGES: Record<string, "neutral" | "warning" | "success"> = {
  answered: "success",
  approved: "success",
  "auto-approved": "success",
  "awaiting-human": "warning",
};

/** The workflow files, the Storybook, and the pull request, each a row. */
export function Files({ files, pullRequest }: { files: Array<MockFile>; pullRequest?: number }) {
  return (
    <List aria-label="Files" hasDividers>
      {files.map((file) => (
        <ListItem
          endContent={<Badge label={file.status} variant={BADGES[file.status] ?? "neutral"} />}
          href="#"
          key={file.name}
          label={<Text type="code">{file.name}</Text>}
        />
      ))}
      <ListItem description="The feature's stories, live" href="#" label="Storybook" />
      {pullRequest && (
        <ListItem description="On GitHub" href="#" label={`Pull request #${pullRequest}`} />
      )}
    </List>
  );
}

/** Problems that block the workflow, or notes that do not: file and line, then the message. */
export function ProblemLines({ problems }: { problems: Array<MockProblem> }) {
  return (
    <List density="compact">
      {problems.map((problem) => (
        <ListItem
          description={<>{problem.message}</>}
          key={problem.at}
          label={<Text type="code">{problem.at}</Text>}
        />
      ))}
    </List>
  );
}

/** The check's notes that block nothing, folded and muted. */
export function Notes({ notes }: { notes: Array<MockProblem> }) {
  return (
    <Collapsible
      defaultIsOpen={false}
      trigger={
        <Text color="secondary">
          {notes.length} format {notes.length === 1 ? "note" : "notes"}
        </Text>
      }
    >
      <VStack gap={2}>
        <Text color="secondary" type="supporting">
          They block nothing: the next agent step rewrites what drifted.
        </Text>
        <ProblemLines problems={notes} />
      </VStack>
    </Collapsible>
  );
}

/** A section's heading, then its content. */
export function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <VStack gap={3}>
      <Heading level={2}>{title}</Heading>
      {children}
    </VStack>
  );
}

/** The link to the record's file, under the record drawn in place. */
export function RecordLink() {
  return (
    <Link hasUnderline href="#">
      Open the record file
    </Link>
  );
}
