// A proposal file's start: what it starts as, a feature or a change, and its button, which opens
// the start dialog the New page opens (`../new/StartDialog.tsx`): its short name, proposed from the
// file's own and editable, and how its steps run, the run map at its full size. One dialog, one
// map, wherever work starts (rule 3). Starting makes a branch and commits, so it is deliberate
// (rule 2): only the dialog starts, never a key of the page; the text's Ctrl+Enter and `:w` save
// it. Its text is saved first; a refusal, as a taken name, shows in the dialog, under the name.
import { signal, View } from "nsh";
import { call, navigate, pathOf } from "../../store";
import type { ProposalFileView } from "../../store/protocol";
import { Button, Segmented, Text } from "../../ui/controls";
import { registerKey } from "../../ui/keys";
import { usePane } from "../../ui/layout";
import { Pane } from "../../ui/surfaces";
import type { Started } from "../new/Landing";
import { type StartAnswer, StartDialog } from "../new/StartDialog";

export type StartPartProps = {
  repo: string;
  /** The proposal's key in the priorities, whose page a refused start opens again. */
  proposalKey: string;
  file: ProposalFileView;
  /** Saves the text typed: says whether it is saved. */
  save: () => Promise<boolean>;
  onStarted: (started: Started) => void;
};

export function StartPart(props: StartPartProps) {
  const pane = usePane();
  const kind = pane.remember<"feature" | "change">("kind", "feature");
  const asking = signal(false);

  /** Starts it as the dialog answered: the refusal's words, or `null` once started. */
  const start = async (answer: StartAnswer): Promise<string | null> => {
    try {
      if (!(await props.save())) {
        return `Your text is not saved: the ${kind()} was not started.`;
      }
      if (kind() === "change") {
        const made = await call("change.startProposal", {
          options: answer.options,
          proposal: props.file.path,
          repo: props.repo,
          slug: answer.slug,
        });
        asking.set(false);
        navigate({ folder: made.folder, page: "feature", repo: props.repo });
        return null;
      }
      const plan = await call("feature.start", {
        kind: "feature",
        options: answer.options,
        proposal: props.file.path,
        repo: props.repo,
        slug: answer.slug,
        write: {
          href: pathOf({ key: props.proposalKey, page: "proposal", repo: props.repo }),
          label: `Starting the feature ${props.file.title}`,
        },
      });
      asking.set(false);
      props.onStarted({ folder: plan.folder, kind: "feature", title: plan.title });
      return null;
    } catch (error) {
      return (error as Error).message;
    }
  };

  // `s` is the button's own, shown on it.
  registerKey([
    { keys: "f", label: "Start it as a feature", run: () => kind.set("feature") },
    { keys: "c", label: "Start it as a change", run: () => kind.set("change") },
  ]);

  return (
    <Pane height="raised" icon="play" title="Start">
      <View style={{ gap: 12 }}>
        <Segmented
          label="Start it as"
          onChange={kind.set}
          options={[
            { hint: "f", label: "A feature", value: "feature" },
            { hint: "c", label: "A change", value: "change" },
          ]}
          value={kind()}
        />
        <View style={{ alignItems: "flex-start" }}>
          <Button
            icon="play"
            keys="s"
            label={kind() === "change" ? "Start the change…" : "Start the feature…"}
            onPress={() => asking.set(true)}
            testID="proposal-start"
            variant="main"
          />
        </View>
        <Text size="under" tone="quiet">
          {kind() === "change"
            ? "It asks its short name and how its fix runs, then commits the proposal, makes the change's branch and worktree, and sends its fix to the agent."
            : "It asks its short name and how each step runs, then commits the proposal, and makes the feature's branch and worktree; its first run waits on its page for your Continue."}
        </Text>
      </View>
      <StartDialog
        discovery={false}
        kind={kind() === "change" ? "change" : "feature"}
        onClose={() => asking.set(false)}
        onStart={start}
        open={asking()}
        repo={props.repo}
        slug={props.file.slug}
        text={props.file.title}
      />
    </Pane>
  );
}
