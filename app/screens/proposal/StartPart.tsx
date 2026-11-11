// A proposal file's start: what it starts as, a feature or a change, the short name that names its
// folder and branch, proposed from the file's name and editable, and the button. Starting makes a
// branch and commits, so it is deliberate (rule 2): only the button starts, or Ctrl+Enter in the
// short name, the field whose whole purpose is the start. Enter there starts nothing, and the
// text's Ctrl+Enter and `:w` save it. Its text is saved first; a refusal, as a taken name, shows
// under the short name, its text kept.
import { signal, View } from "nsh";
import { call, navigate, pathOf } from "../../store";
import type { ProposalFileView } from "../../store/protocol";
import { Button, Kbd, Segmented, Text } from "../../ui/controls";
import { registerKey } from "../../ui/keys";
import { usePane } from "../../ui/layout";
import { Pane } from "../../ui/surfaces";
import { TextField, type TextFieldRef, unsavedKey, unsavedText } from "../../ui/text";
import type { Started } from "../new/Landing";

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
  const slug = unsavedText(
    unsavedKey(props.repo, `${props.file.path}#slug`),
    () => props.file.slug ?? "",
  );
  const refusal = signal<string | null>(null);
  const pending = signal(false);
  let field: TextFieldRef | undefined;

  const start = async () => {
    const name = slug.text().trim();
    if (pending() || name === "") return;
    pending.set(true);
    refusal.set(null);
    try {
      if (!(await props.save())) {
        throw new Error(`Your text is not saved: the ${kind()} was not started.`);
      }
      if (kind() === "change") {
        const made = await call("change.startProposal", {
          proposal: props.file.path,
          repo: props.repo,
          slug: name,
        });
        slug.discard();
        navigate({ folder: made.folder, page: "feature", repo: props.repo });
        return;
      }
      const plan = await call("feature.start", {
        kind: "feature",
        proposal: props.file.path,
        repo: props.repo,
        slug: name,
        write: {
          href: pathOf({ key: props.proposalKey, page: "proposal", repo: props.repo }),
          label: `Starting the feature ${props.file.title}`,
        },
      });
      slug.discard();
      props.onStarted({ folder: plan.folder, kind: "feature", title: plan.title });
    } catch (error) {
      refusal.set((error as Error).message);
    } finally {
      pending.set(false);
    }
  };

  registerKey([
    { hint: "s", keys: "s", label: "To the short name", run: () => field?.focus() },
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
        <View style={{ maxWidth: 480 }}>
          <TextField
            hint="Two words at most: it names the folder and the branch."
            label="Short name"
            lines="one"
            onChange={(value) => {
              slug.change(value);
              refusal.set(null);
            }}
            // Ctrl+Enter, the field's own "save", is the start here: the short name holds nothing
            // to save. Enter does nothing.
            onSave={() => void start()}
            ref={(made) => {
              field = made;
            }}
            refusal={refusal()}
            testID="proposal-slug"
            value={slug.text()}
          />
        </View>
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Button
            disabled={slug.text().trim() === ""}
            icon="play"
            label={kind() === "change" ? "Start the change" : "Start the feature"}
            onPress={() => void start()}
            pending={pending()}
            testID="proposal-start"
            variant="main"
          />
          <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
            <Kbd keys="mod+Enter" />
            <Text size="under" tone="faint">
              in the short name starts it too
            </Text>
          </View>
        </View>
        <Text size="under" tone="quiet">
          {kind() === "change"
            ? "It commits the proposal, makes the change's branch and worktree, and sends its fix to the agent, on the settings' run options."
            : "It commits the proposal, then makes the feature's branch and worktree; its first run follows, on the settings' run options, which its page changes."}
        </Text>
      </View>
    </Pane>
  );
}
