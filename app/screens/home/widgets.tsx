// Home's widgets: the inbox, whose note is added in one tap, first, then its latest notes; the
// priorities now, what comes next; and the agents' usage, each account by name.
import { computed, effect, signal, untracked, View } from "nsh";
import { Cards, Nothing } from "./Cards";
import { type AgentUsage, usageByAgent, LOW } from "../shell/usage";
import { remember } from "../shell/undo";
import { call, navigate, record } from "../../store";
import type { Inbox, InboxNote } from "../../store/protocol";
import { Icon, type IconName, iconNamed, Link, Text, refusalOf } from "../../ui/controls";
import { registerKey } from "../../ui/keys/registry";
import { createCursor, Empty, Line, List } from "../../ui/lists";
import { usePane } from "../../ui/layout";
import { type TextFieldRef, TextField } from "../../ui/text";
import { plural } from "../../ui/words";

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

/** How many times `a` asked, from another pane of Home, for the inbox's field. */
const noteAsked = signal(0);

/** Asks the inbox's pane of Home to put the focus in its field, once it is drawn and focused. */
export const askForNote = () => noteAsked.update((asked) => asked + 1);

/** The inbox: its add field first, a note in one tap or `a`, then its latest three. */
export function InboxWidget(props: { repo: string }) {
  const pane = usePane();
  const inbox = record("Inbox", { repo: props.repo });
  const typed = pane.remember<string>("note", "");
  const refusal = pane.remember<string | null>("refused", null);
  const added = pane.remember<string | null>("added", null);
  let field: TextFieldRef | undefined;
  registerKey({ hint: "a", keys: "a", label: "add a note", run: () => field?.focus() });
  // `a` on another pane of Home focuses this pane, then asks for the field.
  let seen = untracked(noteAsked);
  effect(() => {
    const asked = noteAsked();
    if (asked === seen) return;
    seen = asked;
    queueMicrotask(() => field?.focus());
  });
  const add = async () => {
    const text = typed().trim();
    const hash = inbox()?.hash;
    if (text === "" || hash === undefined) return;
    typed.set("");
    refusal.set(null);
    try {
      const written = await call("inbox.add", { hash, repo: props.repo, text });
      remember(written.change, `Added “${text}” to the inbox.`, { quiet: true, repo: props.repo });
      added.set(`Added “${text}” to the inbox.`);
    } catch (error) {
      typed.set(text);
      refusal.set(refusalOf(error));
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
        empty={
          <Empty
            icon="inbox"
            reading={inbox() === undefined ? "Reading the inbox" : undefined}
            title="The inbox is empty"
          />
        }
        onOpen={(key) => navigate({ key, page: "note" })}
        row={(id) => (
          <Line
            icon={notes().find((one) => one.id === id())?.note.file ? "file-text" : "pencil-line"}
            label={plain(notes().find((one) => one.id === id())?.note.spans ?? [])}
          />
        )}
      />
      <Link onPress={() => navigate({ page: "inbox" })}>
        {count() === 0 ? "Open the inbox" : `${plural(count(), "note")} to organize`}
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
  const now = () =>
    priorities()?.sections.find((section) => section.section === "now")?.proposals ?? [];
  // Started ones are Needs you's or In progress's: an empty pane says so, never "Nothing in Now".
  const started = () => now().filter((proposal) => proposal.running !== null).length;
  const cards = () =>
    now()
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
            reading={priorities() === undefined ? "Reading the priorities" : undefined}
            title={started() === 0 ? "Nothing in Now" : "Nothing in Now waits to start"}
            words={
              started() === 0
                ? "A proposal moved to Now on the priorities shows here."
                : `Its ${started() === 1 ? "started one is" : `${started()} started ones are`} in Needs you or In progress.`
            }
          />
        }
      />
      <If when={cards().length > 0}>
        <Link alone onPress={openPriorities}>
          Open the priorities
        </Link>
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
  const usage = record("Agent", { repo: props.repo });
  const agents = () => usageByAgent(usage(), new Date());
  return (
    <If
      when={agents().length > 0}
      else={
        <Empty
          icon="gauge"
          reading={usage() === undefined ? "Reading the agents' usage" : undefined}
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
