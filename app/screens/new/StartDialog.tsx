// The one question a start asks, once the New page's Start or its Ctrl+Enter opens it, or a
// proposal file's Start (`../proposal/StartPart.tsx`), whose short name it shows as given: the
// short name that names the folder and the branch, proposed by the server and editable, a
// feature's research effort, and how its steps run, the run map, the settings' own component at
// its full size (rule 3), in a dialog as large as the map needs, up to most of the window. The
// field keeps the first focus and Enter, which confirm: the dialog is the deliberate step. Out of
// the field, the map's keys move on the map; Tab goes among the dialog's controls. Closing it, by
// Cancel, Escape, or Back, starts nothing: the composer keeps its text.
import { Scroll, signal, View, windowSize } from "nsh";
import { record } from "../../store";
import type { RunOptions } from "../../store/protocol";
import { Button, Segmented, Text } from "../../ui/controls";
import { keyScope } from "../../ui/keys/registry";
import type { Scope } from "../../ui/keys/store";
import { Dialog } from "../../ui/surfaces";
import { TextField } from "../../ui/text";
import { width, windowWidth } from "../../ui/width";
import { NONE } from "../runs/options";
import { RunMap } from "../runs/RunMap";

/** What a start takes from the dialog. */
export type StartAnswer = { slug: string; discovery: string | null; options: RunOptions | null };

export type StartDialogProps = {
  kind: "feature" | "change";
  repo: string;
  /** The text typed, which the server proposes a slug from. */
  text: string;
  /** A short name already given, as a proposal file's: shown in place of the one proposed. */
  slug?: string | null;
  /** Whether it asks the research effort: a proposal file holds its own, as its form says. */
  discovery?: boolean;
  open: boolean;
  onClose: () => void;
  /** Starts: resolves with the refusal's words, or `null` once started. */
  onStart: (answer: StartAnswer) => Promise<string | null>;
};

/** A level as the control shows it: `medium` is Medium. */
const levelLabel = (level: string) => level.charAt(0).toUpperCase() + level.slice(1);

/** Whether a map changes nothing: the start then sends no options, and follows the settings. */
const isNone = (options: RunOptions) =>
  options.steps.length === 0 &&
  options.implementers === null &&
  options.reviewers === null &&
  options.reviewDepth === null;

function Ask(props: StartDialogProps & { layer: Scope }) {
  const proposed = record("SlugProposal", { text: props.text });
  const settings = record("Settings", null);
  const agents = record("Agent", { repo: props.repo });
  const typed = signal<string | null>(null);
  const given = () => (props.slug == null || props.slug === "" ? undefined : props.slug);
  const slug = () => typed() ?? given() ?? proposed()?.slug ?? "";
  const level = signal<string | null>(null);
  const levels = () =>
    props.kind === "feature" && props.discovery !== false
      ? (proposed()?.discoveryLevels ?? [])
      : [];
  const discovery = () => level() ?? (levels().includes("high") ? "high" : (levels()[0] ?? null));
  const own = signal<RunOptions>(NONE);
  const refusal = signal<string | null>(null);
  const pending = signal(false);
  // A row of six tiles reads whole in a wide window only: a column elsewhere.
  const column = () => width() !== "wide" || props.kind === "change";
  const start = async () => {
    if (pending() || slug().trim() === "") return;
    pending.set(true);
    refusal.set(null);
    const refused = await props.onStart({
      discovery: props.kind === "feature" ? discovery() : null,
      options: isNone(own()) ? null : own(),
      slug: slug().trim(),
    });
    pending.set(false);
    refusal.set(refused);
  };
  return (
    <View style={{ flexShrink: 1, gap: 14, maxHeight: windowSize().height * 0.8 - 72 }}>
      <Scroll style={{ flexShrink: 1 }}>
        <View style={{ gap: 14, paddingBottom: 4 }}>
          <View style={{ maxWidth: 520 }}>
            <TextField
              autoFocus
              first
              hint="Two words at most: it names the folder and the branch. Enter starts."
              label="Short name"
              lines="one"
              onChange={(value) => {
                typed.set(value);
                refusal.set(null);
              }}
              onEnter={() => void start()}
              onSave={() => void start()}
              placeholder={proposed() === undefined ? "Proposing a name…" : undefined}
              refusal={refusal()}
              testID="start-slug"
              value={slug()}
            />
          </View>
          <If when={levels().length > 0 ? discovery() : null}>
            {(picked) => (
              <View style={{ gap: 6 }}>
                <Text tone="quiet">Research effort</Text>
                <Segmented
                  label="Research effort"
                  onChange={level.set}
                  options={levels().map((one) => ({ label: levelLabel(one), value: one }))}
                  value={picked()}
                />
              </View>
            )}
          </If>
          <View style={{ gap: 6 }}>
            <Text tone="quiet">
              {props.kind === "change"
                ? "How the change runs: its fix, and its reviewers. What you leave follows the settings."
                : "How each step runs. What you leave follows the settings, as they are at each run."}
            </Text>
            <If
              when={settings()?.runs}
              else={<Text tone="faint">Reading the settings' run options…</Text>}
            >
              {(runs) => (
                <RunMap
                  active={() => props.open}
                  column={column()}
                  defaultAgent={runs().defaultAgent}
                  disabled={pending()}
                  kind={props.kind}
                  onChange={own.set}
                  over={runs().options}
                  runtimes={agents()?.runtimes ?? []}
                  testID="start-map"
                  value={own()}
                />
              )}
            </If>
          </View>
        </View>
      </Scroll>
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
        <Button label="Cancel" onPress={props.onClose} />
        <Button
          disabled={slug().trim() === ""}
          icon="play"
          // From the map too, where Enter picks: the guide's Ctrl+Enter sends what the layer holds.
          keys="mod+Enter"
          label={props.kind === "change" ? "Start the change" : "Start the feature"}
          onPress={() => void start()}
          pending={pending()}
          scope={props.layer}
          testID="start-confirm"
          variant="main"
        />
      </View>
    </View>
  );
}

export function StartDialog(props: StartDialogProps) {
  // The dialog's layer, for its button's key: a browser gives what is written here the caller's
  // scope (`Float`'s `scope`).
  const layer = keyScope({
    kind: "layer",
    name: props.kind === "change" ? "Start a change" : "Start a feature",
    on: () => props.open,
  });
  return (
    <Dialog
      icon={props.kind === "change" ? "wrench" : "flag"}
      onClose={props.onClose}
      open={props.open}
      scope={layer}
      title={props.kind === "change" ? "Start a change" : "Start a feature"}
      width={
        props.kind === "change" || width() !== "wide" ? 640 : Math.min(1180, windowWidth() - 48)
      }
    >
      <If when={props.open}>
        <Ask {...props} layer={layer} />
      </If>
    </Dialog>
  );
}
