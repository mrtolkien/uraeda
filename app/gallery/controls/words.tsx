// What reads, not what is pressed: text in its tones and steps, headings, badges, statuses,
// banners, a spinner, progress, links, breadcrumbs, tabs, and lines between parts.
import { View } from "nsh";
import { Line, Page, Part } from "../parts";
import {
  Badge,
  Banner,
  Breadcrumbs,
  Button,
  Divider,
  Heading,
  Link,
  Progress,
  Refusal,
  Spinner,
  StatusDot,
  Tabs,
  Text,
} from "../../ui/controls";

const nothing = () => {};
const TABS = [
  { count: 3, icon: "message-square", label: "Sessions", value: "sessions" },
  { icon: "file-text", label: "Spec", value: "spec" },
  { label: "Plan", value: "plan" },
  { disabled: true, label: "Review", value: "review" },
] as const;

export function words(narrow: boolean) {
  return (
    <Page narrow={narrow}>
      <Part narrow={narrow} title="Text">
        <Heading level={1}>A page's title</Heading>
        <Heading level={2}>A part of it</Heading>
        <Heading level={3}>A group</Heading>
        <Text>The reading size, 15 px on a 24 px line.</Text>
        <Text tone="quiet">What reads second, in the quiet ink.</Text>
        <Text size="under" tone="faint">
          One step under, in the faint ink.
        </Text>
        <Text font="code">crates/app/src/theme.rs</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Text bold tone="accent">
            accent
          </Text>
          <Text tone="needs">needs you</Text>
          <Text tone="done">done</Text>
          <Text tone="danger">removed</Text>
          <Text tone="caution">caution</Text>
          <Text tone="live">live</Text>
        </View>
        <Divider label="Earlier" />
        <Line name="link" narrow={narrow}>
          <Link onPress={nothing}>Open the plan</Link>
          <Link onPress={nothing} state="hover">
            under the pointer
          </Link>
          <Link onPress={nothing} state="focus">
            with the focus
          </Link>
          <Link disabled>gone</Link>
        </Line>
        <Breadcrumbs
          crumbs={[
            { label: "Features", onPress: nothing },
            { label: "nsh-migration", onPress: nothing },
            { label: "plan", onPress: nothing },
            { label: "Task 28" },
          ]}
        />
      </Part>
      <Part narrow={narrow} title="Status">
        <Line name="badge" narrow={narrow}>
          <Badge tone="needs">10</Badge>
          <Badge>draft</Badge>
          <Badge tone="done">merged</Badge>
          <Badge tone="danger">refused</Badge>
          <Badge tone="quiet">3</Badge>
        </Line>
        <Line name="status" narrow={narrow}>
          <StatusDot label="Running" tone="live" />
          <StatusDot label="Waits on you" tone="needs" />
          <StatusDot label="Done" tone="done" />
          <StatusDot label="Stopped" tone="quiet" />
        </Line>
        <Spinner label="Loading the plan…" />
        <Progress label="Importing sessions" value={0.42} />
        <Progress label="Pushing" value={1} words="12 of 12" />
        <Refusal words="“Perf” still runs here: wait for its run to end, or stop it in its session." />
        <Refusal
          action={{ label: "Open its session", onPress: nothing }}
          words="The agent is working: stop it in its session, with x, or wait for its turn to end."
        />
        <Banner
          action={<Button label="Pull" state="rest" />}
          title="The branch is behind main"
          tone="caution"
        >
          Three commits landed since it started. Pull them before the review.
        </Banner>
        <Banner title="The hook refused the commit" tone="danger">
          The format check failed in app/ui/controls/Button.tsx.
        </Banner>
        <Banner title="Merged" tone="done" />
      </Part>
      <Part narrow={narrow} title="Tabs">
        <Tabs label="Views" onChange={nothing} tabs={TABS} value="sessions" />
        <Tabs label="Views" onChange={nothing} state="hover" tabs={TABS} value="spec" />
        <Divider edge />
        <View style={{ flexDirection: "row", gap: 10, height: 24 }}>
          <Text tone="quiet">left</Text>
          <Divider vertical />
          <Text tone="quiet">right</Text>
        </View>
      </Part>
    </Page>
  );
}
