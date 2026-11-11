// An offer's card: the agent offers to make the chat a change, its proposal in the card, or the
// change a feature, with why. Starting is deliberate (rule 2): the card's button, or Ctrl+Enter in
// the proposal's field, whose whole purpose is the start; never Enter. Only the session's live
// offer has buttons: one in its last turn, once that turn ended, that moves this kind of session.
// Once it moved, the session's page says where it went (rule 9), and the card reads as the text.
import { type Signal, signal, View } from "nsh";
import { call, StoreError } from "../../store";
import { Button, Refusal, Text } from "../../ui/controls";
import { Card } from "../../ui/lists";
import { TextField } from "../../ui/text";
import { closeOffer, markMoved, type OfferKind, openOffer } from "./offers";

/** The proposal and the slug typed in a card, by its row: a cell reused keeps none of them. */
type Typed = { proposal: Signal<string>; slug: Signal<string> };
const typed = new Map<string, Typed>();

function typedOf(key: string, body: string) {
  let held = typed.get(key);
  if (held === undefined) {
    held = { proposal: signal(body), slug: signal("") };
    typed.set(key, held);
  }
  return held;
}

export type OfferProps = {
  /** The offer's text: a change's proposal, `# Title` first, or the reason for a feature. */
  body: string;
  /** Where the card is: its row, or the session for the card the human opened. */
  cardKey: string;
  /** The session's change, for a feature's offer. */
  folder: string | null;
  kind: OfferKind;
  /** Whether it is the session's live offer, with its buttons. */
  live: boolean;
  repo: string;
  session: string;
};

export function OfferCard(props: OfferProps) {
  const held = typedOf(props.cardKey, props.body);
  const pending = signal(false);
  const refusal = signal<string | null>(null);
  const close = () => {
    closeOffer(props.cardKey);
    openOffer(props.session, undefined);
  };
  const start = async () => {
    if (pending()) return;
    pending.set(true);
    refusal.set(null);
    try {
      if (props.kind === "change") {
        const slug = held.slug().trim();
        const moved = await call("session.toChange", {
          repo: props.repo,
          session: props.session,
          text: held.proposal(),
          ...(slug === "" ? {} : { slug }),
        });
        markMoved(props.session, { folder: moved.folder, to: "change" });
      } else if (props.folder !== null) {
        const promoted = await call("feature.promote", { folder: props.folder, repo: props.repo });
        markMoved(props.session, { folder: promoted.folder, to: "feature" });
      }
      close();
    } catch (error) {
      refusal.set(error instanceof StoreError ? error.message : String(error));
    } finally {
      pending.set(false);
    }
  };
  const title = () => (props.kind === "change" ? "Make it a change" : "Make it a feature");
  return (
    <Card
      body={
        <View style={{ gap: 8 }}>
          <If
            when={props.kind === "change" && props.live}
            else={<Text tone="quiet">{props.body}</Text>}
          >
            <TextField
              label="The change's proposal"
              onChange={(value) => held.proposal.set(value)}
              onSave={() => void start()}
              rows={{ max: 14, min: 3 }}
              testID="offer-proposal"
              value={held.proposal()}
            />
            <TextField
              hint="Its short name: the one the proposal's title gives when left empty."
              label="Slug"
              lines="one"
              onChange={(value) => held.slug.set(value)}
              placeholder="from the title"
              value={held.slug()}
            />
          </If>
          <If when={props.live}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button
                icon={props.kind === "change" ? "git-branch" : "flag"}
                label={props.kind === "change" ? "Start the change" : "Make it a feature"}
                onPress={() => void start()}
                pending={pending()}
                testID="offer-start"
              />
              <Button label="Not now" onPress={close} />
            </View>
            <If when={refusal()}>{(words) => <Refusal words={words()} />}</If>
          </If>
        </View>
      }
      icon={props.kind === "change" ? "git-branch" : "flag"}
      state={
        props.live
          ? { label: "Offered", tone: "accent" }
          : { label: "Offered earlier", tone: "quiet" }
      }
      testID={`offer-${props.kind}`}
      title={title()}
      who={
        props.kind === "change"
          ? "The chat goes on in the change's worktree, on its own branch."
          : "The change and its sessions move to a feature, with its spec and plan."
      }
    />
  );
}
