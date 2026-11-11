// Beside the New page's composer, what a start is often made from: the priorities' proposals that
// have not started, and the inbox's notes. Enter, or a press, puts a line's words in the draft, its
// line kept so its start links it, or opens a proposal that has a file of its own, where it is
// written and started. A note's words go in under what the draft holds.
import { View } from "nsh";
import { navigate, record } from "../../store";
import type { InboxNote, ProposalItem } from "../../store/protocol";
import { Spinner, Text } from "../../ui/controls";
import { PaneScroll, usePane } from "../../ui/layout";
import { createCursor, Empty, Line, List } from "../../ui/lists";
import { plain } from "../priorities/Section";
import { addToDraft, proposalText, startFromLine } from "./draft";

type Source =
  | { id: string; kind: "proposal"; proposal: ProposalItem; section: string }
  | { id: string; kind: "note"; note: InboxNote; category: string };

export function Sources(props: { repo: string; kind: "session" | "change" | "feature" }) {
  const pane = usePane();
  const priorities = record("Priorities", { repo: props.repo });
  const inbox = record("Inbox", { repo: props.repo });
  const sources = (): ReadonlyArray<Source> => [
    ...(priorities()?.sections ?? []).flatMap((section) =>
      section.proposals
        .filter((proposal) => proposal.running === null && proposal.merged === null)
        .map((proposal) => ({
          id: `p:${proposal.key}`,
          kind: "proposal" as const,
          proposal,
          section: section.title,
        })),
    ),
    ...(inbox()?.categories ?? []).flatMap((category) =>
      category.notes.map((note) => ({
        category: category.name ?? "Inbox",
        id: `n:${note.key}`,
        kind: "note" as const,
        note,
      })),
    ),
  ];
  const at = pane.remember<string | null>("row", null);
  const cursor = createCursor(sources, {
    initial: at() ?? undefined,
    onChange: (id) => at.set(id ?? null),
  });
  const use = (id: string) => {
    const source = sources().find((one) => one.id === id);
    if (source === undefined) return;
    if (source.kind === "note") {
      addToDraft(props.repo, source.note.text);
    } else if (source.proposal.file !== null) {
      navigate({ key: source.proposal.key, page: "proposal", repo: props.repo });
    } else if (props.kind === "session") {
      addToDraft(props.repo, proposalText(source.proposal));
    } else {
      startFromLine(props.repo, source.proposal, props.kind);
    }
  };
  return (
    <If
      when={priorities() !== undefined && inbox() !== undefined}
      else={<Spinner label="Reading the priorities and the inbox" />}
    >
      <PaneScroll style={{ flex: 1 }}>
        <View style={{ gap: 8 }}>
          <Text size="under" tone="quiet">
            Enter puts a line in the draft; a proposal with a file opens, to be started there.
          </Text>
          <List
            cursor={cursor}
            empty={
              <Empty
                icon="inbox"
                title="Nothing waits to start"
                words="The priorities have no proposal left to start, and the inbox holds no note."
              />
            }
            onOpen={use}
            openLabel="use"
            row={(id) => {
              const source = () => sources().find((one) => one.id === id());
              return (
                <If when={source()}>
                  {(shown) => {
                    const it = shown();
                    return it.kind === "proposal" ? (
                      <Line
                        icon={it.proposal.file === null ? "flag" : "file-text"}
                        label={plain(it.proposal)}
                        meta={it.section}
                      />
                    ) : (
                      <Line icon="inbox" label={it.note.text} meta={it.category} />
                    );
                  }}
                </If>
              );
            }}
          />
        </View>
      </PaneScroll>
    </If>
  );
}
