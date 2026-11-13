// The write queues' part of the frame: every write to a repository lands through its server's
// queue (`WriteQueue`, one record per repository), and the human sees, without watching, what is
// landing and what was refused, in every repository listed.
//
// - While writes land, one quiet toast names the one running, its step for a start, and how many
//   wait; once one landed, "Committed" says so for a moment, then goes.
// - A refused write is a card of its own, first in the stack, that stays until it is retried or
//   dismissed: what was refused, where its files are, the hook's output whole, and its ways out.
//   A toast never takes the focus, so typing elsewhere goes on.
import { effect, Scroll, signal, untracked, View } from "nsh";
import {
  call,
  navigate,
  parseRoute,
  pathOf,
  record,
  route,
  routeIn,
  type StoreError,
} from "../../store";
import type { QueuedWrite } from "../../store/protocol";
import { Button, Refusal, Spinner, Text } from "../../ui/controls";
import { Toast, Well } from "../../ui/surfaces";

/** A write of a repository's queue. */
type Of = { repo: string; write: QueuedWrite };

/** How long "Committed" stays, in ms. */
const LANDED_MS = 2500;

/** The repositories whose queues are read: every one listed whose folder is there. */
const repositories = () =>
  (record("Repositories", null)()?.rows ?? []).filter((row) => !row.missing).map((row) => row.name);

/** A repository's writes, as its queue's record has them now. */
const writesOf = (repo: string) => record("WriteQueue", { repo })()?.writes ?? [];

/** Every repository's writes in `state`. */
function writes(refused: boolean): Of[] {
  return repositories().flatMap((repo) =>
    writesOf(repo)
      .filter((write) => (write.state === "refused") === refused)
      .map((write) => ({ repo, write })),
  );
}

/** The writes that landed a moment ago, by their id: "Committed" names them. */
const landed = signal<ReadonlyArray<Of>>([]);

/**
 * The landed form of the first word of a write's label: "Starting the feature …" is started. A
 * write the app names, a note added or a proposal moved, lands as a commit; the Git page's own say
 * what they did, as staging commits nothing.
 */
const DONE: Record<string, string> = {
  Aborting: "Aborted",
  Cleaning: "Cleaned",
  Continuing: "Continued",
  Discarding: "Discarded",
  Fetching: "Fetched",
  Merging: "Merged",
  Pulling: "Pulled",
  Pushing: "Pushed",
  Removing: "Removed",
  Resolving: "Resolved",
  Saving: "Saved",
  Staging: "Staged",
  Starting: "Started",
  Unstaging: "Unstaged",
};

/** The word a landed write is said with: its label's first word, done. */
function doneWord(label: string): string {
  return DONE[label.split(" ")[0] ?? ""] ?? "Committed";
}

/** A landed write's label, said as done: "Started the feature …", never "Starting" under "Started". */
function doneLabel(label: string): string {
  const [verb = "", ...rest] = label.split(" ");
  const done = DONE[verb];
  return done === undefined ? label : [done, ...rest].join(" ");
}

/** Keeps the writes of `repo` that leave its queue unrefused, for "Committed". */
function WatchLanding(props: { repo: string }) {
  let before = new Map<string, QueuedWrite>();
  effect(() => {
    const now = writesOf(props.repo);
    const ids = new Set(now.map((write) => write.id));
    const gone = [...before.values()].filter(
      (write) => !ids.has(write.id) && write.state !== "refused",
    );
    before = new Map(now.map((write) => [write.id, write]));
    if (gone.length === 0) return;
    untracked(() => {
      const added = gone.map((write) => ({ repo: props.repo, write }));
      landed.set([...landed(), ...added]);
      setTimeout(() => landed.set(landed().filter((one) => !added.includes(one))), LANDED_MS);
    });
  });
  return null;
}

/** The step of a start that runs, "2 of 4: Commit the proposal on main". */
function stepLine(write: QueuedWrite): string | null {
  const steps = write.steps ?? [];
  const at = steps.findIndex((step) => step.state === "running");
  if (at < 0) return null;
  return `${at + 1} of ${steps.length}: ${steps[at]!.label}`;
}

/** Every repository's writes still landing. */
const landing = () => writes(false);
/** The write landing now: the one running, else the first to come. */
const running = () => landing().find((one) => one.write.state === "running") ?? landing()[0];
/** How many wait behind it. */
const waiting = () => landing().length - 1;

/** The toast of the writes landing, and of those that just landed. */
export function LandingWrites() {
  return (
    <>
      <Each key={(repo: string) => repo} of={repositories()}>
        {(repo) => <WatchLanding repo={repo()} />}
      </Each>
      <If when={running()}>
        {(now) => (
          <Toast icon="git-commit-horizontal" testID="writes-landing" title="Landing in git">
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <Spinner />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text lines={2}>{now().write.label}</Text>
              </View>
            </View>
            <If when={stepLine(now().write)}>
              {(line) => (
                <Text size="under" tone="quiet">
                  {line()}
                </Text>
              )}
            </If>
            <If when={waiting() > 0}>
              <Text size="under" tone="faint">
                {waiting() === 1 ? "1 more waits its turn" : `${waiting()} more wait their turn`}
              </Text>
            </If>
          </Toast>
        )}
      </If>
      <If when={running() === undefined ? landed()[0] : undefined}>
        {(last) => (
          <Toast icon="circle-check" testID="writes-landed" title={doneWord(last().write.label)}>
            <Text lines={2}>{doneLabel(last().write.label)}</Text>
          </Toast>
        )}
      </If>
    </>
  );
}

/** The Git page's own writes that commit nothing, by their label's verb: what each is called. */
const GIT_ACTIONS: Record<string, string> = {
  Aborting: "Abort",
  Discarding: "Discard",
  Fetching: "Fetch",
  Merging: "Merge",
  Pulling: "Pull",
  Pushing: "Push",
  Staging: "Stage",
  Unstaging: "Unstage",
};

/** What a refused write was, when it is one of Git's own that commits nothing: "Pull". */
const gitAction = (write: QueuedWrite) => GIT_ACTIONS[write.label.split(" ")[0] ?? ""];

/** A refused write's title: a commit a hook refused, a pull that failed, a commit that failed. */
function refusedTitle(write: QueuedWrite): string {
  if (write.failure === "hook") return "Commit refused";
  const action = gitAction(write);
  return action === undefined ? "Commit failed" : `${action} failed`;
}

/** Where a refused write left its files, and what the way out does. */
function whereWords(write: QueuedWrite): string {
  if (write.steps !== null) {
    return "The start stopped there: its proposal is as it was, and nothing was made.";
  }
  if (write.failure !== "hook" && gitAction(write) !== undefined) {
    return "Git refused it, for the reason below: the Git page shows where the repository stands.";
  }
  const onGitPage = write.href !== "" && parseRoute(write.href).page === "git";
  if (write.failure === "hook") {
    return onGitPage
      ? "A hook refused the commit: the files stay staged, not committed."
      : "A hook refused the commit, so what the action wrote is back as it was.";
  }
  return "The commit failed: the change is written in the files, not committed. The Git page lists it.";
}

/** Whether a write submitted the inbox's triage, by the page it was made on. */
const ofTriage = (write: QueuedWrite) =>
  write.href !== "" && parseRoute(write.href).page === "triage";

/**
 * Whether Retry commits it again: a feature's file left written (`commit.retry`), or the inbox's
 * triage submitted and left uncommitted (`triage.retry`).
 */
const retries = (write: QueuedWrite) =>
  write.failure === "failed" && ((write.folder !== null && write.file !== null) || ofTriage(write));

/**
 * A refused write's card: it stays until retried or dismissed. The first card's ways out have keys,
 * as a toast's owner declares them: `Space x` dismisses it, `Space o` retries it or opens where it
 * was made. Without them it sat over every page, a pointer's alone.
 */
function RefusedCard(props: Of & { first: boolean }) {
  const pending = signal(false);
  const refusal = signal<string | null>(null);
  const write = () => props.write;
  const elsewhere = () => props.repo !== route().repo;
  const dismiss = () =>
    void call("writes.dismiss", { id: write().id, repo: props.repo }).catch((error) =>
      refusal.set((error as StoreError).message),
    );
  const retry = async () => {
    const { file, folder, href, label } = write();
    if ((file === null || folder === null) && !ofTriage(write())) return;
    pending.set(true);
    refusal.set(null);
    try {
      await (file === null || folder === null
        ? call("triage.retry", { repo: props.repo, write: { href, label } })
        : call("commit.retry", { file, folder, repo: props.repo, write: { href, label } }));
      await call("writes.dismiss", { id: write().id, repo: props.repo });
    } catch (error) {
      refusal.set((error as StoreError).message);
    }
    pending.set(false);
  };
  // The page where it was made, which tries it again, in the write's own repository, whichever
  // is shown: the Git page for a write named by none.
  const open = () =>
    navigate(
      write().href === "" ? { page: "git", repo: props.repo } : routeIn(props.repo, write().href),
    );
  return (
    <Toast icon="triangle-alert" testID="write-refused" title={refusedTitle(write())} tone="danger">
      <Text bold>{elsewhere() ? `${write().label}, in ${props.repo}` : write().label}</Text>
      <Text tone="quiet">{whereWords(write())}</Text>
      <If when={write().output}>
        {(output) => (
          <Well style={{ maxHeight: 220 }}>
            <Scroll style={{ padding: 8 }}>
              <Text font="code" size="under">
                {output()}
              </Text>
            </Scroll>
          </Well>
        )}
      </If>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
        <Button keys={props.first ? "space x" : undefined} label="Dismiss" onPress={dismiss} />
        <If
          when={retries(write())}
          else={
            <Button
              icon="arrow-right"
              keys={props.first ? "space o" : undefined}
              label="Open"
              onPress={open}
            />
          }
        >
          <Button
            icon="refresh-cw"
            keys={props.first ? "space o" : undefined}
            label="Retry"
            onPress={() => void retry()}
            pending={pending()}
          />
        </If>
      </View>
      <If when={refusal()}>{(words) => <Refusal words={words()} />}</If>
    </Toast>
  );
}

/**
 * Whether the page shown is the Git page the write was made on, which shows its refusal under the
 * control it came from, whole, with its own way out: the card would cover it twice.
 */
function shownWhereMade(write: QueuedWrite): boolean {
  if (write.href === "") return false;
  const made = parseRoute(write.href);
  return made.page === "git" && pathOf(made) === pathOf(route());
}

/** The refused writes the cards show. */
const refusedShown = () => writes(true).filter((one) => !shownWhereMade(one.write));

/** Every refused write of every repository, each a card that stays until handled. */
export function RefusedWrites() {
  return (
    <Each key={(one: Of) => `${one.repo}/${one.write.id}`} of={refusedShown()}>
      {(one, index) => <RefusedCard first={index() === 0} repo={one().repo} write={one().write} />}
    </Each>
  );
}
