// Cards: a thing of several facts, in its states, the way the screens will draw a sub-agent, a
// job, a review, and a feature; then cards that are a choice.
import { View } from "nsh";
import { Page, Part } from "../controls/parts";
import { Text } from "../../ui/controls";
import { Card, SelectableCard } from "../../ui/lists";
import { tokens } from "../../ui/tokens";

const nothing = () => {};

export function cards(narrow: boolean) {
  return (
    <Page narrow={narrow}>
      <Part narrow={narrow} title="Card">
        <Card
          facts={[
            { icon: "file-text", label: "6 files read" },
            { icon: "pencil-line", label: "2 written" },
            { icon: "terminal", label: "just app-test", tone: "done" },
          ]}
          hue={tokens.role.lightRunning}
          icon="bot"
          state={{ label: "Running", running: true, tone: "live" }}
          time={{ started: "14:02", took: "3 min" }}
          title="Review the plan's tasks against the spec"
          who="Claude · Opus 5.5 · reviewer"
        />
        <Card
          body={
            <Text tone="quiet">
              Not running here: Claude Code is off in this repository. Turn it on in Settings, or
              move the job to another repository.
            </Text>
          }
          facts={[
            { icon: "repeat", label: "Every day at 03:00" },
            { icon: "calendar-clock", label: "Next run: none" },
          ]}
          icon="calendar-clock"
          state={{ label: "Paused", tone: "caution" }}
          title="Clean merged branches"
          who="A job of this repository"
        />
        <Card
          actions={[
            { icon: "eye", label: "Open the review", run: nothing, variant: "main" },
            { icon: "message-square", label: "Its session", run: nothing },
          ]}
          facts={[
            { icon: "circle-check", label: "3 findings fixed", tone: "done" },
            { icon: "circle-alert", label: "1 left for you", tone: "needs" },
          ]}
          hue={tokens.role.added}
          icon="badge-check"
          selected
          state={{ label: "Done", tone: "done" }}
          time={{ ended: "15:20", started: "14:48", took: "32 min" }}
          title="The second review of the lists"
          who="Codex · GPT-6.1 Sol"
        />
        <Card
          body={<Text>Which theme should the gallery's pictures show first, dark or light?</Text>}
          hue={tokens.role.needsYou}
          icon="message-circle-question"
          onPress={nothing}
          state={{ label: "Waits on you", tone: "needs" }}
          time={{ started: "09:12" }}
          title="NSH migration"
          who="Questions · round 2"
        />
      </Part>
      <Part narrow={narrow} title="SelectableCard">
        <View style={{ gap: 8 }}>
          <SelectableCard
            icon="lightbulb"
            onSelect={nothing}
            selected
            title="A proposal"
            words="An idea to think through first: the agent asks, then writes a spec."
          />
          <SelectableCard
            icon="wrench"
            onSelect={nothing}
            selected={false}
            title="A change"
            words="A fix or a small change, made in its own worktree and reviewed once."
          />
          <SelectableCard
            icon="message-square"
            onSelect={nothing}
            selected={false}
            state="hover"
            title="A chat"
            words="A session with no workflow: ask, read, try."
          />
          <SelectableCard
            icon="workflow"
            onSelect={nothing}
            selected={false}
            state="focus"
            title="A feature"
            words="Several tasks, a plan, and reviews."
          />
          <SelectableCard
            disabled
            icon="git-pull-request"
            onSelect={nothing}
            selected={false}
            title="A pull request's review"
            words="No pull request is open in this repository."
          />
        </View>
      </Part>
    </Page>
  );
}
