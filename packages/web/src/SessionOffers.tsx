// Where a session's offers draw: the agent's latest offer block, as a card in its message, once the
// message ended; the card the session's "…" opened, at the session's end; and the lines a move
// left there. An offer that does not apply to the session, an earlier one, or one still streaming
// reads as the agent's text.
import { Banner } from "@astryxdesign/core/Banner";
import { VStack } from "@astryxdesign/core/VStack";
import {
  createContext,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { OfferCard, type OfferSession } from "./OfferCard.tsx";
import {
  applies,
  closeOffer,
  lastOffer,
  OFFER_LANGUAGE,
  type Offer,
  offerKind,
  openOffer,
  useNotes,
  useOfferClosed,
  useOpened,
} from "./offers.ts";
import { fencePlugin, type ProsePlugin } from "./Prose.tsx";
import { useTurnLog } from "./sessionData.ts";

/** What a session's workflow is: none, a change, or a feature. */
export type SessionKind = "change" | "feature" | "session";

/** The session the transcript draws, as its offers need it, and its latest offer. */
type Scope = OfferSession & {
  kind: SessionKind;
  /** The key of its latest offer that applies, `<turn>:<seq>` of its message. */
  latest: string | undefined;
  /** Counts a message's offer, until the message goes. */
  register: (key: string) => () => void;
};

const ScopeContext = createContext<Scope | undefined>(undefined);

/** Where a message is in its session: its turn's place, then its own. */
function order(turns: ReadonlyArray<string>, key: string): [number, number] {
  const at = key.lastIndexOf(":");
  return [turns.indexOf(key.slice(0, at)), Number(key.slice(at + 1))];
}

/** The session's offers: which one is the latest, for the messages of its transcript. */
export function OffersProvider({
  children,
  kind,
  session,
  turns,
}: {
  children: ReactNode;
  kind: SessionKind;
  session: OfferSession;
  turns: ReadonlyArray<string>;
}) {
  const [keys, setKeys] = useState<ReadonlySet<string>>(() => new Set());
  const register = useCallback((key: string) => {
    setKeys((now) => new Set(now).add(key));
    return () =>
      setKeys((now) => {
        const next = new Set(now);
        next.delete(key);
        return next;
      });
  }, []);
  let latest: string | undefined;
  for (const key of keys) {
    const [turn, seq] = order(turns, key);
    const [best, bestSeq] = latest === undefined ? [-1, -1] : order(turns, latest);
    if (turn > best || (turn === best && seq > bestSeq)) {
      latest = key;
    }
  }
  const { folder, id, working } = session;
  const scope = useMemo(
    () => ({ folder, id, kind, latest, register, working }),
    [folder, id, kind, latest, register, working],
  );
  return <ScopeContext value={scope}>{children}</ScopeContext>;
}

/** The agent's offer in its message, as a card: "Not now" closes it for the page. */
function MessageOffer({ at, offer, scope }: { at: string; offer: Offer; scope: Scope }) {
  return (
    <OfferCard
      isLatest
      kind={offer.kind}
      onClose={() => closeOffer(at)}
      {...(offer.kind === "change" ? { proposal: offer.body } : { reason: offer.body })}
      session={scope}
    />
  );
}

/**
 * What draws an agent's message's offer block as a card: only once the message ended, for the
 * session's latest offer that applies to it, until closed. `at` is the message's `<turn>:<seq>`.
 */
export function useOfferPlugins(
  at: string,
  streaming: boolean,
  text: string,
): ReadonlyArray<ProsePlugin> | undefined {
  const scope = useContext(ScopeContext);
  const key = scope === undefined ? at : `${scope.id}:${at}`;
  const closed = useOfferClosed(key);
  const kind = scope?.kind;
  const offer = useMemo(() => {
    const found = streaming || kind === undefined ? undefined : lastOffer(text);
    return found && applies(found.kind, kind!) ? found : undefined;
  }, [kind, streaming, text]);
  const register = scope?.register;
  useEffect(() => (offer && register ? register(at) : undefined), [at, offer, register]);
  const shown = offer && scope && scope.latest === at && !closed ? scope : undefined;
  return useMemo(
    () =>
      shown && offer
        ? [
            fencePlugin({
              language: OFFER_LANGUAGE,
              read: ({ code, meta }) =>
                offerKind(meta) === offer.kind && code.trim() === offer.body
                  ? { body: offer.body, kind: offer.kind }
                  : undefined,
              render: (data) => <MessageOffer at={key} offer={data as Offer} scope={shown} />,
            }),
          ]
        : undefined,
    [key, offer, shown],
  );
}

/** The session's first message: the proposal "Make it a change" starts from. */
function FirstMessage({ children, turn }: { children: (text: string) => ReactNode; turn: string }) {
  const log = useTurnLog(`${turn}:0`);
  const first = log?.items.find((item) => item.kind === "message");
  return children(first?.kind === "message" ? first.text : "");
}

/** The card the session's "…" opened, at its end: for a change, from its first message. */
function OpenedOffer({ scope, turns }: { scope: Scope; turns: ReadonlyArray<string> }) {
  const kind = useOpened(scope.id);
  if (kind === undefined) {
    return null;
  }
  const close = () => openOffer(scope.id, undefined);
  if (kind === "feature" || turns.length === 0) {
    return <OfferCard isLatest isOpened key={kind} kind={kind} onClose={close} session={scope} />;
  }
  return (
    <Suspense fallback={null}>
      <FirstMessage turn={turns[0]}>
        {(proposal) => (
          <OfferCard
            isLatest
            isOpened
            kind="change"
            onClose={close}
            proposal={proposal}
            session={scope}
          />
        )}
      </FirstMessage>
    </Suspense>
  );
}

/** The session's end: the card its "…" opened, then the lines its moves left. */
export function SessionEnd({ id, turns }: { id: string; turns: ReadonlyArray<string> }) {
  const scope = useContext(ScopeContext);
  const notes = useNotes(id);
  return (
    <VStack gap={3}>
      {scope && <OpenedOffer scope={scope} turns={turns} />}
      {notes.map((note) => (
        <Banner collapsible={false} key={note.title} status={note.status} title={note.title} />
      ))}
    </VStack>
  );
}
