// An action auto mode blocked, answered where it shows: "The agent wanted to run X". Allowing it
// opens the session's process again with its rule, and a turn of its own asks the agent to try
// again (`session.allow`); "Allow all" allows every blocked action of the latest turn that has a
// rule, in one turn (`session.allowAll`). Neither while the agent works: allowing reopens its
// process. An action no rule can match alone, as a command with a `*`, says so instead.
import { type Signal, signal, untracked, View } from "nsh";
import { call, StoreError } from "../../store";
import type { Item } from "../../store/protocol";
import { Refusal, Text } from "../../ui/controls";
import { Card, type CardAction } from "../../ui/lists";

type Denial = Extract<Item, { kind: "denial" }>;

export type PermissionProps = {
  /** How many blocked actions of the latest turn "Allow all" would allow. */
  allowable: number;
  denial: Denial;
  repo: string;
  /** Its row in the transcript, which keeps an allow on its way. */
  row: string;
  /** Whether it is the selected row, which Enter allows. */
  selected: boolean;
  session: string;
  turn: string;
  /** Whether the agent works now, which a reopened process would cut. */
  working: boolean;
};

/** What the agent wanted, in words. */
export const wantedWords = (denial: Pick<Denial, "target" | "tool">) =>
  denial.target === null ? denial.tool : `${denial.tool} ${denial.target}`;

/** An allow on its way, and the server's refusal of the last, by the blocked action's row. */
type Allowing = { pending: Signal<boolean>; refusal: Signal<string | null> };
const allowings = new Map<string, Allowing>();

function allowingOf(row: string): Allowing {
  let held = allowings.get(row);
  if (held === undefined) {
    held = { pending: signal(false), refusal: signal<string | null>(null) };
    allowings.set(row, held);
  }
  return held;
}

/** What `session.allow` and `session.allowAll` need: the session, and the blocked action's turn. */
export type AllowOf = { repo: string; row: string; session: string; turn: string; denial: string };

/**
 * Allows one blocked action, or with `all` every one of the latest turn's: the card shows it on
 * its way, and the server's refusal under it. The card's button and the row's Enter both call it.
 */
export async function allow(of: AllowOf, all = false) {
  const held = allowingOf(of.row);
  if (untracked(held.pending)) return;
  held.pending.set(true);
  held.refusal.set(null);
  try {
    await (all
      ? call("session.allowAll", { repo: of.repo, session: of.session })
      : call("session.allow", {
          denial: of.denial,
          repo: of.repo,
          session: of.session,
          turn: of.turn,
        }));
  } catch (error) {
    held.refusal.set(error instanceof StoreError ? error.message : String(error));
  } finally {
    held.pending.set(false);
  }
}

/** Whether a blocked action can be allowed now: it has a rule, and was not allowed yet. */
export const answerable = (denial: Pick<Denial, "allowed" | "rule">) =>
  !denial.allowed && denial.rule !== null;

export function Permission(props: PermissionProps) {
  const of = (): AllowOf => ({
    denial: props.denial.id,
    repo: props.repo,
    row: props.row,
    session: props.session,
    turn: props.turn,
  });
  const held = allowingOf(props.row);
  const actions = (): ReadonlyArray<CardAction> =>
    !answerable(props.denial) || props.working || held.pending()
      ? []
      : [
          {
            icon: "shield",
            label: "Allow and retry",
            run: () => void allow(of()),
            variant: "main",
          },
          ...(props.allowable >= 2
            ? [
                {
                  label: `Allow all (${props.allowable})`,
                  run: () => void allow(of(), true),
                } satisfies CardAction,
              ]
            : []),
        ];
  const why = () => {
    if (props.denial.allowed) return "Allowed for the session's process.";
    if (props.denial.rule === null) {
      return "No allow rule can match only this action: tell the agent another way to do it.";
    }
    if (held.pending()) return "Allowing: the agent tries again.";
    if (props.working) return "Allow it once the agent's turn ends: allowing reopens its process.";
    return `Allowing adds the rule ${props.denial.rule} to the session's process.`;
  };
  return (
    <Card
      actions={actions()}
      body={
        <View style={{ gap: 4 }}>
          <Text tone="quiet">{why()}</Text>
          <If when={held.refusal()}>{(words) => <Refusal words={words()} />}</If>
        </View>
      }
      icon="shield"
      selected={props.selected}
      state={
        props.denial.allowed
          ? { label: "Allowed", tone: "done" }
          : { label: "Blocked by auto mode", tone: "caution" }
      }
      testID="permission"
      title={`The agent wanted to run ${wantedWords(props.denial)}`}
    />
  );
}
