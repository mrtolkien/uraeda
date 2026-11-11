// Home's widgets: the inbox, whose note is added in one tap, first, then its latest notes; the
// priorities now, what comes next; and the agents' usage, each account by name.
import { computed, View } from "nsh";
import { Cards, Nothing } from "./Cards";
import { type AgentUsage, usageByAgent, LOW } from "../shell/usage";
import { call, navigate, record } from "../../store";
import type { Inbox, InboxNote } from "../../store/protocol";
import { Icon, type IconName, iconNamed, Link, Text } from "../../ui/controls";
import { registerKey } from "../../ui/keys/registry";
import { createCursor, Empty, Line, List } from "../../ui/lists";
import { usePane } from "../../ui/layout";
import { type TextFieldRef, TextField } from "../../ui/text";

/** The words of spans, as one line. */
const plain = (spans: ReadonlyArray<{ text: string }>) => spans.map((span) => span.text).join("");

/**
 * The inbox's latest notes: notes carry no date, and a quick add writes at the end of the notes
 * without a category, so the latest are taken from there first, then from the categories'.
 */
export function latestNotes(inbox: Inbox | null | undefined, count = 3): InboxNote[] {
  const named = (sorted: boolean) =>
    (inbox?.categories ?? [])
      .filter((category) => (category.name !== null) === sorted)
      .flatMap((category) => category.notes);
  return [...named(false).toReversed(), ...named(true).toReversed()].slice(0, count);
}

/** The inbox: its add field first, a note in one tap or `a`, then its latest three. */
export function InboxWidget(props: { repo: string }) {
  const pane = usePane();
  const inbox = record("Inbox", { repo: props.repo });
  const typed = pane.remember<string>("note", "");
  const refusal = pane.remember<string | null>("refused", null);
  const added = pane.remember<string | null>("added", null);
  let field: TextFieldRef | undefined;
  registerKey({ hint: "a", keys: "a", label: "add a note", run: () => field?.focus() });
  const add = async () => {
    const text = typed().trim();
    const hash = inbox()?.hash;
    if (text === "" || hash === undefined) return;
    typed.set("");
    refusal.set(null);
    try {
      await call("inbox.add", { hash, repo: props.repo, text });
      added.set(`Added “${text}” to the inbox.`);
    } catch (error) {
      typed.set(text);
      refusal.set(error instanceof Error ? error.message : String(error));
    }
  };
  const notes = computed(() => latestNotes(inbox()).map((note) => ({ id: note.key, note })));
  const cursor = createCursor(notes);
  const count = () => inbox()?.count ?? 0;
  return (
    <View style={{ gap: 10 }}>
      <TextField
        hint={added() ?? "Enter adds it to the notes without a category."}
        label="A note"
        lines="one"
        onChange={(value) => {
          typed.set(value);
          added.set(null);
        }}
        onEnter={() => void add()}
        placeholder="A note for later"
        ref={(made) => (field = made)}
        refusal={refusal()}
        value={typed()}
      />
      <List
        cursor={cursor}
        empty={<Text tone="faint">The inbox is empty.</Text>}
        onOpen={(key) => navigate({ key, page: "note" })}
        row={(id) => (
          <Line
            icon={notes().find((one) => one.id === id())?.note.file ? "file-text" : "pencil-line"}
            label={plain(notes().find((one) => one.id === id())?.note.spans ?? [])}
          />
        )}
      />
      <Link onPress={() => navigate({ page: "inbox" })}>
        {count() === 0
          ? "Open the inbox"
          : `${count()} ${count() === 1 ? "note" : "notes"} to organize`}
      </Link>
    </View>
  );
}

const openPriorities = () => navigate({ page: "priorities" });

/** How many entries Priorities now shows: the rest are one tap away, on the priorities page. */
const NOW_SHOWN = 5;

/** The first entries of Now that do not run: what comes next. Running ones are In progress. */
export function NowWidget(props: { repo: string }) {
  const priorities = record("Priorities", { repo: props.repo });
  const cards = () =>
    (priorities()?.sections.find((section) => section.section === "now")?.proposals ?? [])
      .filter((proposal) => proposal.running === null)
      .slice(0, NOW_SHOWN)
      .map((proposal) => ({
        icon: (proposal.file === null ? "list" : "file-text") as IconName,
        id: proposal.key,
        open: () => navigate({ key: proposal.key, page: "proposal" }),
        title: plain(proposal.spans),
        who: proposal.children.length > 0 ? plain(proposal.children[0]!.spans) : undefined,
      }));
  return (
    <View style={{ gap: 10 }}>
      <Cards
        cards={cards}
        empty={
          <Nothing
            action={{ icon: "list", label: "Open the priorities", run: openPriorities }}
            title="Nothing in Now"
            words="A proposal moved to Now on the priorities shows here."
          />
        }
      />
      <If when={cards().length > 0}>
        <Link onPress={openPriorities}>Open the priorities</Link>
      </If>
    </View>
  );
}

/** One window's line: its words, in the danger's colour once nearly gone. */
function Window(props: { left: number; words: string }) {
  return (
    <Text font="code" size="under" tone={props.left <= LOW ? "danger" : "quiet"}>
      {props.words}
    </Text>
  );
}

function AgentBlock(props: { agent: AgentUsage }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Icon name={iconNamed(props.agent.icon, "bot")} />
        <Text bold>{props.agent.name}</Text>
      </View>
      <Each of={props.agent.windows}>
        {(window) => <Window left={window().left} words={window().words} />}
      </Each>
      <Each of={props.agent.accounts}>
        {(account) => (
          <View style={{ gap: 2, paddingLeft: 4 }}>
            <Text tone={account().trouble === undefined ? "ink" : "danger"}>
              {account().trouble === undefined
                ? account().name
                : `${account().name} · ${account().trouble}`}
            </Text>
            <Each of={account().windows}>
              {(window) => <Window left={window().left} words={window().words} />}
            </Each>
          </View>
        )}
      </Each>
    </View>
  );
}

/** The agents on here, each under its mark, each account by name with its five hours and week. */
export function UsageWidget(props: { repo: string }) {
  const agents = () => usageByAgent(record("Agent", { repo: props.repo })(), new Date());
  return (
    <If
      when={agents().length > 0}
      else={
        <Empty
          icon="gauge"
          title="No usage reported yet"
          words="An agent's windows show once a run of it reports them."
        />
      }
    >
      <View style={{ gap: 14 }}>
        <Each key={(agent: AgentUsage) => agent.id} of={agents()}>
          {(agent) => <AgentBlock agent={agent()} />}
        </Each>
      </View>
    </If>
  );
}
