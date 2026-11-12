// The feature page's subject: where the feature stands, in words with their cause, and the one
// thing to do next, the page's main action, which breathes and takes `n`. Under it the message a
// continue sends, what a merged feature left, and the check's notes.
import { openUrl, signal, View } from "nsh";
import { call, navigate, record } from "../../store";
import type { Feature } from "../../store/protocol";
import { Banner, Button, Confirm, Heading, Refusal, StatusDot, Text } from "../../ui/controls";
import { PaneScroll, usePane } from "../../ui/layout";
import { Collapsible } from "../../ui/lists";
import { Pane, Well } from "../../ui/surfaces";
import type { Tone } from "../../ui/tokens";
import { type Next, type NextAction, nextOf } from "./next";
import { Drop, DroppedNote, Problems, Rename } from "./Parts";
import { Postpone } from "./Postpone";
import { ContinueDialog } from "../runs/ContinueDialog";
import { type FeatureArgs, ticking, WithFeature } from "./read";
import { day, endedWords, kindWord, plural, waitWords } from "./words";

/** A status's tone, as its dot shows it. */
export function toneOf(status: Feature["status"]["status"]): Tone {
  switch (status) {
    case "working":
      return "live";
    case "needs-you":
      return "needs";
    case "attention":
      return "caution";
    case "unread":
      return "info";
    default:
      return "quiet";
  }
}

/** "Feature · Oct 17 · branch x · 3 commits behind · uncommitted changes". */
function facts(feature: Feature): string {
  const parts = [kindWord(feature), day(feature.folder.slice(0, 10))];
  if (feature.branch !== null) parts.push(`branch ${feature.branch}`);
  if (feature.behind !== null && feature.behind > 0) {
    parts.push(`${plural(feature.behind, "commit")} behind the default branch`);
  }
  if (feature.uncommitted) parts.push("uncommitted changes");
  return parts.join(" · ");
}

/** Runs `action`; a refusal comes back in words, for under the button. */
async function run(args: FeatureArgs, action: NextAction): Promise<void> {
  switch (action.kind) {
    case "open":
      navigate(action.to);
      return;
    case "url":
      await openUrl(action.url);
      return;
    case "clean":
      await call("git.clean", { folder: args.folder, repo: args.repo, write: null });
      return;
    case "continue":
      // The continue dialog sends it, its message and run options read first (`NextPart`).
      return;
  }
}

/** The icon of an action's button. */
const ICONS = {
  clean: "brush-cleaning",
  continue: "play",
  open: "arrow-right",
  url: "external-link",
} as const;

/**
 * At the proposal's gate, its commit: the gate ends once the proposal is committed, and Next then
 * offers the agent's run. A button apart from Next's, as a commit is deliberate (rule 2).
 */
function CommitProposal(props: { args: FeatureArgs; path: string }) {
  const pending = signal(false);
  const refusal = signal<string | null>(null);
  const commit = async () => {
    pending.set(true);
    refusal.set(null);
    try {
      await call("text.commit", { path: props.path, repo: props.args.repo });
    } catch (error) {
      refusal.set((error as Error).message);
    }
    pending.set(false);
  };
  return (
    <View style={{ alignItems: "flex-start", gap: 4 }}>
      <Button
        icon="git-commit-horizontal"
        label="Commit the proposal"
        onPress={() => void commit()}
        pending={pending()}
      />
      <If when={refusal()}>{(words) => <Refusal words={words()} />}</If>
    </View>
  );
}

/** The proposal file a feature's step waits on, at its gate: none at any other step. */
function proposalAt(feature: Feature): string | undefined {
  const { file, fileKind } = feature.step;
  const gate = feature.step.waitsOn === "human" && fileKind === "proposal" && file !== null;
  return gate ? `${feature.path}/${file}` : undefined;
}

/** "Next": what comes next, why, and its one button, the view's main action, with `n`. */
function NextPart(props: { args: FeatureArgs; next: Next; proposal?: string }) {
  const pending = signal(false);
  const refusal = signal<string | null>(null);
  // The run the dialog asks about, kept after it closes so it leaves with its motion.
  const asked = signal<Extract<NextAction, { kind: "continue" }> | null>(null);
  const asking = signal(false);
  // Cleaning removes the worktree, the branch, and the priorities' line: asked first, as the Git
  // page's Worktrees does.
  const cleaning = signal<NextAction | null>(null);
  const press = async (action: NextAction, sure = false) => {
    if (action.kind === "continue") {
      asked.set(action);
      asking.set(true);
      return;
    }
    if (action.kind === "clean" && !sure) {
      cleaning.set(action);
      return;
    }
    if (pending()) return;
    pending.set(true);
    refusal.set(null);
    try {
      await run(props.args, action);
    } catch (error) {
      refusal.set((error as Error).message);
    }
    pending.set(false);
  };
  return (
    <Pane height="raised" needs={props.next.waitsOn === "human"} title="Next">
      <View style={{ gap: 4 }}>
        <Heading level={2}>{props.next.title}</Heading>
        <If when={props.next.line}>{(line) => <Text tone="quiet">{line()}</Text>}</If>
      </View>
      <If when={props.next.action}>
        {(action) => (
          <View style={{ alignItems: "flex-start", gap: 6, paddingTop: 8 }}>
            <Button
              breathes
              icon={ICONS[action().kind]}
              keys="n"
              label={action().label}
              onPress={() => void press(action())}
              pending={pending()}
              testID="feature-next"
              variant="main"
            />
            <If when={refusal()}>{(words) => <Refusal words={words()} />}</If>
          </View>
        )}
      </If>
      <If when={props.proposal}>{(path) => <CommitProposal args={props.args} path={path()} />}</If>
      <Confirm
        loses
        icon="brush-cleaning"
        keep="Keep it"
        keys="n"
        label="Clean it"
        onClose={() => cleaning.set(null)}
        onConfirm={() => {
          const action = cleaning();
          if (action !== null) void press(action, true);
        }}
        open={cleaning() !== null}
        title={`Clean ${props.args.folder}?`}
        words="Its worktree, its branch, and its line of the priorities go, as ura clean does. Nothing undoes it."
      />
      <If when={asked()}>
        {(next) => (
          <ContinueDialog
            folder={props.args.folder}
            onClose={() => asking.set(false)}
            open={asking()}
            repo={props.args.repo}
            run={next()}
          />
        )}
      </If>
    </Pane>
  );
}

/** The message a continue sends, folded, whole once open: the human reads what the agent gets. */
function Message(props: { text: string }) {
  const open = usePane().remember<boolean>("message", false);
  return (
    <Collapsible
      icon="message-square"
      keys="m"
      onToggle={open.set}
      open={open()}
      title="The message it sends"
    >
      <Well>
        <Text font="code">{props.text}</Text>
      </Well>
    </Collapsible>
  );
}

/** What a merged feature left: its worktree, its branch, or both, which Clean removes. */
function Left(props: { feature: Feature }) {
  const left = () =>
    [
      props.feature.leftWorktree === null ? null : `the worktree ${props.feature.leftWorktree}`,
      props.feature.leftBranch === null ? null : `the branch ${props.feature.leftBranch}`,
    ].filter((part): part is string => part !== null);
  return (
    <If when={left().length > 0}>
      <Banner icon="folder-git-2" title="It left work behind" tone="info">
        {`${left().join(" and ")} ${left().length > 1 ? "are" : "is"} still there. "Clean what it left", above, removes ${left().length > 1 ? "them" : "it"}, and its line of the priorities.`}
      </Banner>
    </If>
  );
}

function Body(props: { args: FeatureArgs; feature: () => Feature }) {
  const feature = props.feature;
  const now = ticking(30_000);
  const history = record("History", { id: props.args.folder, repo: props.args.repo });
  const recommended = record("RecommendedMessage", {
    id: props.args.folder,
    repo: props.args.repo,
  });
  const status = () => feature().status;
  // The session it follows, for the account a wait is on, and the turn a failure is told by.
  const session = () => {
    const id = status().session;
    return id === null ? undefined : record("Session", { id, repo: props.args.repo })();
  };
  const turn = () => {
    const id = status().turn;
    return id === null ? undefined : record("Turn", { id, repo: props.args.repo })();
  };
  const waits = () => {
    const wait = status().wait;
    return wait === null ? undefined : waitWords(wait, session()?.account ?? null, now());
  };
  const next = () =>
    nextOf(feature(), {
      ended: turn() ? endedWords(turn()!) : undefined,
      history: history() ?? undefined,
      now: now(),
      recommended: recommended(),
      waits: waits(),
    });
  const message = () => {
    const action = next().action;
    return action?.kind === "continue" ? action.text : undefined;
  };
  return (
    <View style={{ gap: 16, maxWidth: 760, paddingTop: 4 }}>
      <View style={{ gap: 6 }}>
        <Heading level={1}>{feature().label ?? feature().title}</Heading>
        <Text tone="quiet">{facts(feature())}</Text>
        <View
          style={{ alignItems: "center", columnGap: 12, flexDirection: "row", flexWrap: "wrap" }}
        >
          {/* A merged one's status is "Merged", which Next says. */}
          <If when={feature().step.name !== "done"}>
            <StatusDot label={status().label} tone={toneOf(status().status)} />
          </If>
          <Rename args={props.args} feature={feature()} />
        </View>
      </View>
      <Problems feature={feature()} />
      <NextPart args={props.args} next={next()} proposal={proposalAt(feature())} />
      <If when={message()}>{(text) => <Message text={text()} />}</If>
      <Left feature={feature()} />
      <Notes args={props.args} feature={feature()} />
      <If when={feature().step.name !== "done"}>
        {/* Postpone and Drop, the rare and structural ones, at the foot, far from Next. */}
        <View
          style={{
            alignItems: "flex-start",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            paddingTop: 24,
          }}
        >
          <Postpone args={props.args} feature={feature()} />
          <Drop args={props.args} feature={feature()} />
        </View>
      </If>
    </View>
  );
}

/** The check's notes, which block nothing, folded to their count, with the fix of moved links. */
function Notes(props: { args: FeatureArgs; feature: Feature }) {
  const open = usePane().remember<boolean>("notes", false);
  const pending = signal(false);
  const refusal = signal<string | null>(null);
  const fix = async () => {
    pending.set(true);
    refusal.set(null);
    try {
      await call("feature.fixLinks", { folder: props.args.folder, repo: props.args.repo });
    } catch (error) {
      refusal.set((error as Error).message);
    }
    pending.set(false);
  };
  const fixable = () =>
    props.feature.source === "default-branch" && props.feature.notes.some((note) => note.fixable);
  return (
    <If when={props.feature.notes.length > 0}>
      <Collapsible
        count={props.feature.notes.length}
        icon="list-checks"
        keys="f"
        onToggle={open.set}
        open={open()}
        title="Format notes"
      >
        <View style={{ gap: 8 }}>
          <Text tone="faint">
            They block nothing: the next step of the agent rewrites what drifted.
          </Text>
          <Each
            key={(note: Feature["notes"][number]) => `${note.file}:${note.line}:${note.message}`}
            of={props.feature.notes}
          >
            {(note) => (
              <View style={{ gap: 2 }}>
                <Text font="code" size="under" tone="quiet">
                  {`${note().file}${note().line === null ? "" : `:${note().line}`}`}
                </Text>
                <Text>{note().message}</Text>
              </View>
            )}
          </Each>
          <If when={fixable()}>
            <View style={{ alignItems: "flex-start", gap: 4 }}>
              <Button
                icon="link"
                label="Fix moved links"
                onPress={() => void fix()}
                pending={pending()}
              />
              <If when={refusal()}>{(words) => <Refusal words={words()} />}</If>
            </View>
          </If>
        </View>
      </Collapsible>
    </If>
  );
}

/** The pane "Feature": the page's subject, focused as it opens. */
export function Overview(props: { args: FeatureArgs }) {
  return (
    <PaneScroll style={{ flex: 1 }}>
      <View style={{ gap: 16 }}>
        <DroppedNote />
        <WithFeature args={props.args}>
          {(feature) => <Body args={props.args} feature={feature} />}
        </WithFeature>
      </View>
    </PaneScroll>
  );
}
