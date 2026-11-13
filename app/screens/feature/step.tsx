// The feature page's next step, held by the page, not by a pane: Overview's Next draws it and
// presses it, and on a phone the bottom bar holds it on every tab, where only the tab shown is
// drawn and Overview goes as another opens. The page draws `FeatureStep` once beside its panes
// (`around`, in its place), with the dialogs a press opens.
import { cleanup, computed, effect, openUrl, signal, untracked } from "nsh";
import { call, entry, navigate, record } from "../../store";
import { Confirm } from "../../ui/controls";
import { type PaneAction, paneKey } from "../../ui/layout";
import { ticking } from "../../ui/clock";
import { ContinueDialog } from "../runs/ContinueDialog";
import { type Next, type NextAction, nextOf } from "./next";
import { featureOf, type FeatureArgs } from "./read";
import { endedWords, waitWords } from "./words";

/** The kind of the page's subject pane, whose memory says whether the feature was dropped. */
export const OVERVIEW = "feature-overview";

/** The icon of an action's button. */
export const ICONS = {
  clean: "brush-cleaning",
  continue: "play",
  open: "arrow-right",
  url: "external-link",
} as const;

/** The word of the phone's bottom bar's tile for each kind of next step: one, short. */
const WORDS = { clean: "Clean", continue: "Continue", open: "Next", url: "Open" } as const;

/** The step of the feature page shown, with its feature. */
const shown = signal<{ args: FeatureArgs; next: Next | undefined } | null>(null);
const pending = signal(false);
const refusal = signal<string | null>(null);
// The run the dialog asks about, kept after it closes so it leaves with its motion.
const asked = signal<Extract<NextAction, { kind: "continue" }> | null>(null);
const asking = signal(false);
// Cleaning removes the worktree, the branch, and the priorities' line: asked first, as the Git
// page's Worktrees does.
const cleaning = signal<NextAction | null>(null);

const same = (a: FeatureArgs, b: FeatureArgs) => a.folder === b.folder && a.repo === b.repo;

/** The next step of the feature `args`, while its page is shown: `undefined` until it is read. */
export function stepOf(args: FeatureArgs): Next | undefined {
  const now = shown();
  return now !== null && same(now.args, args) ? now.next : undefined;
}

/** Whether the step's press is on its way, and why it was refused. */
export const stepPending = () => pending();
export const stepRefusal = () => refusal();

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
      // The continue dialog sends it, its message and run options read first.
      return;
  }
}

/** Presses the step: a continue and a clean ask first, `sure` once the clean is confirmed. */
export async function pressStep(args: FeatureArgs, action: NextAction, sure = false) {
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
    await run(args, action);
  } catch (error) {
    refusal.set((error as Error).message);
  }
  pending.set(false);
}

/**
 * The bottom bar's end on a phone: the step the Next pane's button takes, which a tap there takes
 * too (the phone guide: "a feature's next step, which its Next pane's button also does").
 */
export function nextStep(): PaneAction | undefined {
  const now = shown();
  const action = now?.next?.action;
  if (now === null || action === undefined) return undefined;
  const { args } = now;
  return {
    icon: ICONS[action.kind],
    label: WORDS[action.kind],
    run: () => void pressStep(args, action),
  };
}

/** The feature's next step as the server's records say it, for as long as the page is shown. */
function useNext(args: FeatureArgs) {
  const feature = featureOf(args);
  const now = ticking(30_000);
  const history = record("History", { id: args.folder, repo: args.repo });
  const recommended = record("RecommendedMessage", { id: args.folder, repo: args.repo });
  // What a drop from Overview left (`Drop`): the page then offers nothing more to do.
  const dropped = () => entry().kept.panes?.[paneKey(OVERVIEW, args)]?.dropped;
  return computed(() => {
    const shownFeature = feature();
    if (shownFeature === undefined || shownFeature === null) return undefined;
    if (typeof dropped() === "string") return undefined;
    const { session: sessionId, turn: turnId, wait } = shownFeature.status;
    // The session it follows, for the account a wait is on, and the turn a failure is told by.
    const session =
      sessionId === null ? undefined : record("Session", { id: sessionId, repo: args.repo })();
    const turn = turnId === null ? undefined : record("Turn", { id: turnId, repo: args.repo })();
    return nextOf(shownFeature, {
      ended: turn ? endedWords(turn) : undefined,
      history: history() ?? undefined,
      now: now(),
      recommended: recommended(),
      waits: wait === null ? undefined : waitWords(wait, session?.account ?? null, now()),
    });
  });
}

/** What the feature page holds across its tabs: its next step, and the dialogs its press opens. */
export function FeatureStep(props: { args: FeatureArgs }) {
  const next = useNext(props.args);
  effect(() => {
    const value = { args: props.args, next: next() };
    untracked(() => shown.set(value));
    cleanup(() => {
      if (untracked(shown) === value) shown.set(null);
    });
  });
  cleanup(() => {
    pending.set(false);
    refusal.set(null);
    asking.set(false);
    asked.set(null);
    cleaning.set(null);
  });
  return (
    <>
      <Confirm
        loses
        icon="brush-cleaning"
        keep="Keep it"
        keys="n"
        label="Clean it"
        onClose={() => cleaning.set(null)}
        onConfirm={() => {
          const action = cleaning();
          if (action !== null) void pressStep(props.args, action, true);
        }}
        open={cleaning() !== null}
        title={`Clean ${props.args.folder}?`}
        words="Its worktree, its branch, and its line of the priorities go, as ura clean does. Nothing undoes it."
      />
      <If when={asked()}>
        {(continued) => (
          <ContinueDialog
            folder={props.args.folder}
            onClose={() => asking.set(false)}
            open={asking()}
            repo={props.args.repo}
            run={continued()}
          />
        )}
      </If>
    </>
  );
}
