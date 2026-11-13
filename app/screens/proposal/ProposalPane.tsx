// A proposal of the priorities, `/priorities/<key>`, the one place it is written and started: where
// it stands, its words, then by what it is: a started or merged one opens its feature; one with a
// file of its own is that file, edited in place, with its start; a line alone is written into a
// file, or started from the New page with its words. Then the moves to another section, which a
// touch screen has no other way to, and its removal. Its line's words are edited by `e`, or its
// link, and the pane follows the line to its new address. After a start, the pane follows the
// feature's steps as they land, and opens its page (rule 9).
import { effect, signal, View } from "nsh";
import { call, type Live, navigate, record, redirect } from "../../store";
import type { Priorities, ProposalItem } from "../../store/protocol";
import { Button, Heading, Link, Refusal, Spinner, Text } from "../../ui/controls";
import { PaneScroll, usePane } from "../../ui/layout";
import { Empty } from "../../ui/lists";
import { Landing, rememberStarted, type Started } from "../new/Landing";
import { startFromLine } from "../new/draft";
import { createOrder } from "../priorities/moves";
import { byKey } from "../priorities/order";
import { plain, stepWords } from "../priorities/Section";
import { FileEditor } from "./FileEditor";
import { Nested } from "./Nested";
import { remember } from "../shell/undoStack";
import { NameDialog } from "../NameDialog";
import { registerKey } from "../../ui/keys";

const toList = () => navigate({ page: "priorities" });

/** Where it stands, in words: "In Next", "Started · Waits on you", "Merged". */
function standing(
  repo: string,
  proposal: ProposalItem,
  priorities: Priorities,
  section: string | undefined,
) {
  if (proposal.running) return `Started · ${stepWords(repo, proposal)}`;
  if (proposal.merged) return "Merged";
  const title = priorities.sections.find((one) => one.section === section)?.title;
  return title === undefined ? "In the priorities" : `In ${title}`;
}

/** A line with no file: written into one, or started from the New page with its words. */
function LineOnly(props: { repo: string; proposal: ProposalItem; hash: string }) {
  const refusal = signal<string | null>(null);
  const pending = signal(false);
  const expand = async () => {
    pending.set(true);
    refusal.set(null);
    try {
      const written = await call("proposals.expand", {
        hash: props.hash,
        proposal: props.proposal.id,
        repo: props.repo,
      });
      remember(written.change, `Wrote “${plain(props.proposal)}” in a file of its own.`, {
        repo: props.repo,
        subject: plain(props.proposal),
      });
    } catch (error) {
      refusal.set((error as Error).message);
    }
    pending.set(false);
  };
  return (
    <View style={{ alignItems: "flex-start", gap: 8 }}>
      <Text tone="quiet">
        It has no file yet: write it into one to give it more than a line, or start it from its
        words.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button
          icon="file-pen-line"
          keys="w"
          label="Write it in a file"
          onPress={() => void expand()}
          pending={pending()}
          variant="main"
        />
        <Button
          icon="flag"
          label="Start it as a feature…"
          onPress={() => startFromLine(props.repo, props.proposal, "feature")}
        />
        <Button
          icon="wrench"
          label="Start it as a change…"
          onPress={() => startFromLine(props.repo, props.proposal, "change")}
        />
      </View>
      <If when={refusal()}>{(words) => <Refusal words={words()} />}</If>
    </View>
  );
}

/** The moves to the top of another section, and the removal, which asks for a second press. */
function Moves(props: {
  repo: string;
  proposal: ProposalItem;
  priorities: Live<Priorities>;
  where: () => string | undefined;
  order: ReturnType<typeof createOrder>;
}) {
  const refusal = signal<string | null>(null);
  // Undone by Undo, so never asked first (the undo decision).
  const remove = async () => {
    try {
      const written = await call("proposals.remove", {
        hash: props.priorities()?.hash ?? "",
        proposal: props.proposal.id,
        repo: props.repo,
      });
      remember(written.change, `Removed “${plain(props.proposal)}” from the priorities.`, {
        place: { page: "priorities", repo: props.repo },
        repo: props.repo,
        subject: plain(props.proposal),
      });
    } catch (error) {
      refusal.set((error as Error).message);
    }
  };
  return (
    <View style={{ gap: 6 }}>
      <Text size="under" tone="quiet">
        Move it to the top of
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Each
          of={(props.priorities()?.sections ?? []).filter((one) => one.section !== props.where())}
        >
          {(one) => (
            <Button
              label={one().title}
              onPress={() =>
                props.order.move({ index: 0, key: props.proposal.key, section: one().section })
              }
              pending={props.order.pending()}
            />
          )}
        </Each>
        <If when={!props.proposal.merged}>
          <Button
            icon="trash-2"
            label="Remove from the priorities"
            onPress={() => void remove()}
            variant="danger"
          />
        </If>
      </View>
      <If when={props.order.refusal()}>{(refused) => <Refusal words={refused().words} />}</If>
      <If when={refusal()}>{(words) => <Refusal words={words()} />}</If>
    </View>
  );
}

/**
 * "Edit its line": the proposal's words in the priorities, as one line of Markdown. Its address
 * follows its words, so once the list shows the new line at its place, the pane opens it there.
 */
function EditLine(props: { repo: string; proposal: ProposalItem; priorities: Live<Priorities> }) {
  const asking = signal(false);
  const moved = signal<string | null>(null);
  registerKey({
    hint: "e",
    hintLabel: "edit its line",
    icon: "pencil",
    keys: "e",
    label: "Edit the proposal's line",
    run: () => void asking.set(true),
  });
  effect(() => {
    const id = moved();
    const now = props.priorities();
    if (id === null || now === undefined) return;
    const line = now.sections.flatMap((one) => one.proposals).find((one) => one.id === id);
    if (line !== undefined && line.key !== props.proposal.key) {
      moved.set(null);
      redirect({ key: line.key, page: "proposal", repo: props.repo });
    }
  });
  return (
    <>
      <Link alone onPress={() => asking.set(true)} size="under">
        Edit its line
      </Link>
      <If when={asking()}>
        <NameDialog
          blank="A proposal needs words."
          icon="pencil"
          initial={props.proposal.text}
          label="Its line"
          onClose={() => asking.set(false)}
          onSave={async (text) => {
            const written = await call("proposals.edit", {
              hash: props.priorities()?.hash ?? "",
              proposal: props.proposal.id,
              repo: props.repo,
              text,
            });
            moved.set(props.proposal.id);
            remember(written.change, `Edited “${plain(props.proposal)}”.`, {
              repo: props.repo,
              subject: plain(props.proposal),
            });
          }}
          title="Edit the proposal's line"
          words="One line of Markdown, as the priorities show it."
        />
      </If>
    </>
  );
}

function Body(props: {
  repo: string;
  proposal: ProposalItem;
  priorities: Live<Priorities>;
  onStarted: (started: Started) => void;
}) {
  const order = createOrder(() => props.repo, props.priorities);
  const where = () =>
    Object.entries(order.order()).find(([, keys]) => keys.includes(props.proposal.key))?.[0];
  const feature = () => props.proposal.running ?? props.proposal.merged;
  return (
    <View style={{ gap: 18, maxWidth: 880, paddingBottom: 24 }}>
      <View style={{ gap: 4 }}>
        <Text size="under" tone="quiet">
          {standing(props.repo, props.proposal, props.priorities()!, where())}
        </Text>
        <Heading level={2}>{plain(props.proposal)}</Heading>
        <If when={!props.proposal.running && !props.proposal.merged}>
          <EditLine priorities={props.priorities} proposal={props.proposal} repo={props.repo} />
        </If>
        <If when={props.proposal.file}>
          {(file) => (
            <Text font="code" size="under" tone="faint">
              {file().path}
            </Text>
          )}
        </If>
      </View>
      <If when={!props.proposal.running && !props.proposal.merged}>
        <Nested priorities={props.priorities} proposal={props.proposal} repo={props.repo} />
      </If>
      <If
        when={feature()}
        else={
          <If
            when={props.proposal.file}
            else={
              <LineOnly
                hash={props.priorities()?.hash ?? ""}
                proposal={props.proposal}
                repo={props.repo}
              />
            }
          >
            {(file) => (
              <FileEditor
                onStarted={props.onStarted}
                path={file().path}
                proposalKey={props.proposal.key}
                repo={props.repo}
              />
            )}
          </If>
        }
      >
        {(shown) => (
          <View style={{ alignItems: "flex-start" }}>
            <Button
              icon="arrow-right"
              label={
                props.proposal.merged?.change === true ? "Open its change" : "Open its feature"
              }
              onPress={() =>
                navigate({ folder: shown().folder, page: "feature", repo: props.repo })
              }
              variant="main"
            />
          </View>
        )}
      </If>
      <If when={!props.proposal.running}>
        <Moves
          order={order}
          priorities={props.priorities}
          proposal={props.proposal}
          repo={props.repo}
          where={where}
        />
      </If>
    </View>
  );
}

export function ProposalView(props: { repo: string; proposalKey: string }) {
  const pane = usePane();
  const started = rememberStarted(pane);
  const priorities = record("Priorities", { repo: props.repo });
  const proposal = () => {
    const now = priorities();
    return now ? byKey(now).get(props.proposalKey) : undefined;
  };
  return (
    <PaneScroll style={{ flex: 1 }}>
      <If
        when={started()}
        else={
          <If when={priorities() !== undefined} else={<Spinner label="Reading the priorities" />}>
            <If
              when={proposal()}
              else={
                <Empty
                  action={{ icon: "list", label: "Back to the priorities", run: toList }}
                  icon="list"
                  title="That proposal is gone"
                  words="Its line was removed or rewritten since this address was made: the priorities show what is there now."
                />
              }
            >
              {(shown) => (
                <Body
                  onStarted={started.set}
                  priorities={priorities}
                  proposal={shown()}
                  repo={props.repo}
                />
              )}
            </If>
          </If>
        }
      >
        {(shown) => (
          <Landing
            againLabel="Back to the priorities"
            onAgain={toList}
            repo={props.repo}
            started={shown()}
          />
        )}
      </If>
    </PaneScroll>
  );
}
