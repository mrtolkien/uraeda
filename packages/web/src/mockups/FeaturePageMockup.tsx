// TEMPORARY: mockup of the feature page redesign (specs/2026-10-18-redesign-feature/), replaced by the real page.
// The page, top to bottom: where it is, what's next, the agent, what it produced, the notes.
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Heading } from "@astryxdesign/core/Heading";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Page } from "../layout/Page.tsx";
import type { FeatureMock, MockRecord } from "./featureMockupData.ts";
import {
  AgentCard,
  Figures,
  Files,
  NextCard,
  Notes,
  ProblemLines,
  RecordLink,
  Section,
  Stages,
} from "./FeatureParts.tsx";

/** A list of plain sentences, as the record's sections hold them. */
function Lines({ label, lines }: { label: string; lines: Array<string> }) {
  return (
    <List aria-label={label} listStyle="disc">
      {lines.map((line) => (
        <ListItem key={line} label={<>{line}</>} />
      ))}
    </List>
  );
}

/** A done feature's record, drawn in place: its questions folded. */
function Record({ record }: { record: MockRecord }) {
  return (
    <VStack gap={6}>
      <Section title="What and why">
        <Text>{record.whatAndWhy}</Text>
      </Section>
      <Section title="Behaviour">
        <Lines label="Behaviour" lines={record.behaviour} />
      </Section>
      {record.decisions.length > 0 && (
        <Section title="Decisions">
          <Lines label="Decisions" lines={record.decisions} />
        </Section>
      )}
      {record.questions.length > 0 && (
        <Collapsible
          defaultIsOpen={false}
          trigger={<Heading level={2}>{record.questionsLine}</Heading>}
        >
          <List hasDividers>
            {record.questions.map((question) => (
              <ListItem
                description={<>{question.answer}</>}
                key={question.title}
                label={<>{question.title}</>}
              />
            ))}
          </List>
        </Collapsible>
      )}
      <Section title="Follow-ups">
        <Lines label="Follow-ups" lines={record.followUps} />
      </Section>
      <RecordLink />
    </VStack>
  );
}

/** The feature page, as the redesign proposes it, for one state. */
export function FeaturePageMockup({ feature }: { feature: FeatureMock }) {
  return (
    <Page>
      <VStack gap={6}>
        <VStack gap={2}>
          <Text color="secondary" type="supporting">
            Features ›
          </Text>
          <Heading level={1}>{feature.title}</Heading>
          <Text color="secondary" type="supporting">
            {feature.line}
          </Text>
        </VStack>
        <Stages current={feature.current} stages={feature.stages} />
        {feature.blocking && (
          <Banner
            collapsible={false}
            description={<ProblemLines problems={feature.blocking} />}
            endContent={<Button label="Open spec.md" variant="secondary" />}
            status="error"
            title="This feature cannot go on"
          />
        )}
        <NextCard next={feature.next} />
        {feature.agent && <AgentCard agent={feature.agent} />}
        <Section title={feature.record ? "What it produced" : "What it produced so far"}>
          <Figures figures={feature.figures} />
          {feature.files && <Files files={feature.files} pullRequest={feature.pullRequest} />}
        </Section>
        {feature.record && <Record record={feature.record} />}
        {feature.notes && <Notes notes={feature.notes} />}
      </VStack>
    </Page>
  );
}
