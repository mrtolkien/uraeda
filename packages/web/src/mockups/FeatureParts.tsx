// TEMPORARY: mockup of the feature page redesign (specs/2026-10-18-redesign-feature/), replaced by the real page.
// The page's parts: the stages, what comes next beside the agent, the figures, the files, the notes.
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Grid, GridSpan } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Step, Stepper } from "@astryxdesign/core/Stepper";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode, SVGProps } from "react";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { StatusMark } from "../StatusMark.tsx";
import { StepIcon } from "../sidebar/StepIcon.tsx";
import type {
  MockAgent,
  MockFigure,
  MockFile,
  MockNext,
  MockProblem,
  MockStage,
} from "./featureMockupData.ts";

const styles = stylex.create({
  added: { color: colorVars["--color-success"] },
  eyebrow: { textTransform: "uppercase" },
  removed: { color: colorVars["--color-error"] },
  // The stages' lines stay on one line each: a time and a duration.
  stages: { whiteSpace: "nowrap" },
});

/** The workflow's stages, the current one marked; each reached one with its time and duration. */
export function Stages({ current, stages }: { current: number; stages: Array<MockStage> }) {
  const wide = useWidthClass() === "wide";
  return (
    <div id="stages" {...stylex.props(styles.stages)}>
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
    </div>
  );
}

/** What comes next: who acts and what, with its one button. */
function NextCard({ next }: { next: MockNext }) {
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
        {next.action && (
          <HStack>
            <Button label={next.action} variant="primary" />
          </HStack>
        )}
      </VStack>
    </Card>
  );
}

/** A crescent moon, Lucide's `moon`: an agent with nothing to do. */
function Moon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden
      fill="none"
      height="1em"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width="1em"
      {...props}
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

/** The feature's session, neutral and compact: its state, its task, and the one way into it. */
function AgentCard({ agent }: { agent: MockAgent }) {
  const working = agent.status === "working";
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack align="center" gap={2}>
          {working ? (
            <StatusMark label="Working" status="working" />
          ) : (
            <Icon color="secondary" icon={Moon} size="sm" />
          )}
          <Text color={working ? "primary" : "secondary"} weight={working ? "bold" : undefined}>
            {working ? "Agent · working" : "Agent · idle"}
          </Text>
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
        <HStack>
          <Button label="Open the session" size="sm" variant="secondary" />
        </HStack>
      </VStack>
    </Card>
  );
}

/** "Next" and the agent on one row on wide screens, "Next" first and wider; stacked on the phone. */
export function NextAndAgent({ agent, next }: { agent?: MockAgent; next: MockNext }) {
  const wide = useWidthClass() === "wide";
  if (!agent) {
    return <NextCard next={next} />;
  }
  return (
    <Grid columns={wide ? 3 : 1} gap={3}>
      <GridSpan columns={wide ? 2 : 1}>
        <NextCard next={next} />
      </GridSpan>
      <AgentCard agent={agent} />
    </Grid>
  );
}

/** A figure's value: plain, lines added in green and removed in red, or one line per part. */
function FigureValue({ figure }: { figure: MockFigure }) {
  const { value } = figure;
  if (typeof value === "string") {
    return (
      <Text hasTabularNumbers size="xl" weight="bold">
        {value}
      </Text>
    );
  }
  if ("added" in value) {
    return (
      <HStack gap={2}>
        <Text hasTabularNumbers size="lg" weight="bold" wrap="nowrap" xstyle={styles.added}>
          {value.added}
        </Text>
        <Text hasTabularNumbers size="lg" weight="bold" wrap="nowrap" xstyle={styles.removed}>
          {value.removed}
        </Text>
      </HStack>
    );
  }
  return (
    <VStack gap={0}>
      {value.lines.map((line) => (
        <Text hasTabularNumbers key={line} size="xl" weight="bold">
          {line}
        </Text>
      ))}
    </VStack>
  );
}

/** One figure: its name, its value, and what it counts; tapped, it opens its detail. */
function Figure({ figure }: { figure: MockFigure }) {
  const body: ReactNode = (
    <VStack gap={1}>
      <Text color="secondary" type="label" xstyle={styles.eyebrow}>
        {figure.label}
      </Text>
      <FigureValue figure={figure} />
      <Text color="secondary" type="supporting">
        {figure.caption}
      </Text>
    </VStack>
  );
  if (figure.href) {
    return (
      <ClickableCard href={figure.href} label={`${figure.label}, ${figure.caption}`} padding={4}>
        {body}
      </ClickableCard>
    );
  }
  return (
    <Card padding={4}>
      <div aria-label={figure.label} role="group">
        {body}
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

/** A status's colour: every finished state green, waiting on you amber, a request red. */
function statusVariant(status: string): "neutral" | "warning" | "success" | "error" {
  switch (status) {
    case "committed":
    case "answered":
    case "approved":
    case "auto-approved":
    case "record":
      return "success";
    case "awaiting-human":
      return "warning";
    case "changes-requested":
      return "error";
    default:
      return "neutral";
  }
}

/** The workflow files, compact: the step's icon, the name, its file muted, then its status. */
function FileList({ files }: { files: Array<MockFile> }) {
  return (
    <List aria-label="Files" density="compact" hasDividers>
      {files.map((file) => (
        <ListItem
          endContent={<Badge label={file.status} variant={statusVariant(file.status)} />}
          href="#"
          key={file.file}
          label={
            <HStack align="center" gap={2} wrap="wrap">
              <Text>{file.name}</Text>
              <Text color="secondary" type="supporting">
                {file.file}
              </Text>
            </HStack>
          }
          startContent={<StepIcon step={file.kind} />}
        />
      ))}
    </List>
  );
}

/** The files beside the Storybook and the pull request on wide screens, each half the width. */
export function Files({ files, pullRequest }: { files: Array<MockFile>; pullRequest?: number }) {
  const wide = useWidthClass() === "wide";
  return (
    <Grid columns={wide ? 2 : 1} gap={4}>
      <FileList files={files} />
      <List aria-label="Links" density="compact" hasDividers>
        <ListItem description="The feature's stories, live" href="#" label="Storybook" />
        {pullRequest && (
          <ListItem description="On GitHub" href="#" label={`Pull request #${pullRequest}`} />
        )}
      </List>
    </Grid>
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

/** A section's heading, then its content; `id` is its anchor. */
export function Section({
  children,
  id,
  title,
}: {
  children: ReactNode;
  id?: string;
  title: string;
}) {
  return (
    <section id={id}>
      <VStack gap={3}>
        <Heading level={2}>{title}</Heading>
        {children}
      </VStack>
    </section>
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
