// A feature's round, `/f/<folder>/clarifications-NN.md`: answered here while it waits, read as its
// answers once submitted, with the way to the agent's next run, which never starts by itself.
import { View } from "nsh";
import type { FileView } from "../../store/protocol";
import { Banner, Text } from "../../ui/controls";
import { PaneScroll } from "../../ui/layout";
import { NextRun } from "./NextRun";
import { WithRound } from "./read";
import { Answering, Answers } from "./Round";
import { type RoundArgs, targetOf } from "./saves";

function Answered(props: { args: RoundArgs; file: () => FileView; folder: string }) {
  return (
    <PaneScroll style={{ flex: 1 }}>
      <View style={{ gap: 14, paddingBottom: 24 }}>
        <Banner
          action={<NextRun folder={props.folder} repo={props.args.repo} />}
          icon="circle-check"
          title={
            props.file().status === "answered"
              ? "Your answers are committed"
              : "This round takes no answers now"
          }
          tone="done"
        >
          <Text tone="quiet">
            The agent goes on from them once you start its next run, after reading its message.
          </Text>
        </Banner>
        <Answers file={props.file()} />
      </View>
    </PaneScroll>
  );
}

export function RoundPage(props: { args: RoundArgs }) {
  const target = targetOf(props.args);
  const folder = target.kind === "feature" ? target.folder : "";
  return (
    <WithRound args={props.args}>
      {(file) => (
        <If
          when={file().status === "awaiting-human"}
          else={<Answered args={props.args} file={file} folder={folder} />}
        >
          <Answering args={props.args} file={file} />
        </If>
      )}
    </WithRound>
  );
}
