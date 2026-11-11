// One section of the priorities: its title, what it holds, its rows in the order the human sets,
// a refused move's words under them, and its Add row. Its keys are its own scope's, on while the
// section has the pane's focus, so Now, Next, and Later each have `j` `k` `m` without a clash.
import { type Accessor, computed, View } from "nsh";
import type { Order } from "./moves";
import { shownIn } from "./order";
import { call, record } from "../../store";
import type { ProposalItem } from "../../store/protocol";
import { Text } from "../../ui/controls";
import { KeyScope, registerKey } from "../../ui/keys/registry";
import { type Cursor, createCursor, DragOrder, Line, List, Row } from "../../ui/lists";
import { usePane } from "../../ui/layout";
import { TextField } from "../../ui/text";

/** A proposal's words, as one line of plain text. */
export const plain = (proposal: Pick<ProposalItem, "spans">) =>
  proposal.spans.map((span) => span.text).join("");

/** What a proposal's row shows besides its words: its file, or its merge. */
function looks(proposal: ProposalItem | undefined) {
  if (proposal?.merged) {
    const number = proposal.merged.pullRequest?.number;
    return {
      icon: "circle-check" as const,
      meta: number === undefined ? "Merged" : `Merged · #${number}`,
    };
  }
  if (proposal?.file) return { icon: "file-text" as const, meta: undefined };
  return { icon: undefined, meta: undefined };
}

/** A proposal's row: its words whole, its nested lines counted. */
export function ProposalLine(props: { proposal: ProposalItem | undefined }) {
  const look = () => looks(props.proposal);
  const nested = () => props.proposal?.children.length ?? 0;
  return (
    <Line
      icon={look().icon}
      label={props.proposal === undefined ? "" : plain(props.proposal)}
      meta={look().meta ?? (nested() > 0 ? `+${nested()}` : undefined)}
    />
  );
}

export type SectionProps = {
  /** Whether the keys go to this section now. */
  active: () => boolean;
  /** The section's cursor, made, for the pane's keys that cross sections. */
  cursor: (cursor: Cursor) => void;
  id: string;
  onOpen: (key: string) => void;
  /** A row was pointed at or pressed: the section takes the focus. */
  onTouched: () => void;
  order: Order;
  proposals: Accessor<ReadonlyMap<string, ProposalItem>>;
  repo: string;
  /** The row the visit left the cursor on. */
  start?: string;
};

/** The section's rows, which the human orders: by keys, the grip, or a long press. */
export function Section(props: SectionProps) {
  const keys = computed(() => shownIn(props.order.order(), props.id, props.order.runs));
  const items = computed(() => keys().map((id) => ({ id })));
  const cursor = createCursor(items, {
    initial: props.start,
    onChange: (id) => id !== undefined && props.onTouched(),
  });
  props.cursor(cursor);
  const label = (key: string) => {
    const proposal = props.proposals().get(key);
    return proposal === undefined ? "The proposal" : `“${plain(proposal)}”`;
  };
  const refusal = () => {
    const refused = props.order.refusal();
    return refused?.section === props.id ? refused.words : null;
  };
  return (
    <KeyScope kind="pane" name={props.id} on={props.active}>
      <View style={{ gap: 4 }}>
        <DragOrder
          cursor={cursor}
          label={label}
          onMove={(key, to) => props.order.move({ index: to, key, section: props.id })}
          onOpen={props.onOpen}
          row={(id) => <ProposalLine proposal={props.proposals().get(id())} />}
          testID={`section-${props.id}`}
        />
        <If when={keys().length === 0}>
          <Text size="under" tone="faint" style={{ paddingHorizontal: 8 }}>
            Nothing here yet.
          </Text>
        </If>
        <If when={refusal()}>
          {(words) => (
            <Text
              size="under"
              testID={`refusal-${props.id}`}
              tone="danger"
              style={{ paddingHorizontal: 8 }}
            >
              {words()}
            </Text>
          )}
        </If>
        <Add active={props.active} repo={props.repo} section={props.id} />
      </View>
    </KeyScope>
  );
}

/** Where a running proposal's feature is, in words: its task, or who it waits on. */
export function stepWords(proposal: ProposalItem | undefined) {
  const step = proposal?.running?.step;
  if (step === undefined) return undefined;
  return step.task ?? (step.waitsOn === "human" ? "Waits on you" : "An agent's turn");
}

/** The running proposals, apart: each opens its feature. Nothing to order here. */
export function Ongoing(props: {
  active: () => boolean;
  cursor: (cursor: Cursor) => void;
  keys: Accessor<ReadonlyArray<string>>;
  onOpen: (key: string) => void;
  onTouched: () => void;
  proposals: Accessor<ReadonlyMap<string, ProposalItem>>;
}) {
  const items = computed(() => props.keys().map((id) => ({ id })));
  const cursor = createCursor(items, { onChange: (id) => id !== undefined && props.onTouched() });
  props.cursor(cursor);
  return (
    <KeyScope kind="pane" name="ongoing" on={props.active}>
      <List
        cursor={cursor}
        onOpen={props.onOpen}
        openLabel="open its feature"
        row={(id) => {
          const proposal = () => props.proposals().get(id());
          return (
            <Line
              icon="activity"
              label={proposal() === undefined ? "" : plain(proposal()!)}
              meta={stepWords(proposal())}
            />
          );
        }}
        testID="section-ongoing"
      />
    </KeyScope>
  );
}

/** The Add row: `a`, or a press, opens a line; Enter adds it at the section's end. */
function Add(props: { active: () => boolean; repo: string; section: string }) {
  const pane = usePane();
  const open = pane.remember<boolean>(`adding:${props.section}`, false);
  const typed = pane.remember<string>(`add:${props.section}`, "");
  const refusal = pane.remember<string | null>(`added:${props.section}`, null);
  const priorities = record("Priorities", { repo: props.repo });
  registerKey({
    hint: "a",
    keys: "a",
    label: "add a proposal",
    run: () => {
      if (!props.active()) return false;
      open.set(true);
      return undefined;
    },
  });
  const add = async () => {
    const text = typed().trim();
    const hash = priorities()?.hash;
    if (text === "" || hash === undefined) return;
    typed.set("");
    try {
      await call("proposals.add", { hash, repo: props.repo, section: props.section, text });
      refusal.set(null);
    } catch (error) {
      typed.set(text);
      refusal.set(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <If
      when={open()}
      else={
        <Row onPress={() => open.set(true)}>
          <Line icon="plus" label="Add a proposal" quiet />
        </Row>
      }
    >
      <View style={{ paddingHorizontal: 4 }}>
        <TextField
          autoFocus
          label="New proposal"
          lines="one"
          onBlur={() => typed().trim() === "" && open.set(false)}
          onChange={(value) => typed.set(value)}
          onEnter={() => void add()}
          placeholder="What it is, in one line"
          refusal={refusal()}
          value={typed()}
        />
      </View>
    </If>
  );
}
