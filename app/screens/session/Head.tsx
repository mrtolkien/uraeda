// What sits above a session's conversation: its title; its state in words, with its cause; who
// runs it, "Claude Code · b · Opus 5.5 · High", which follows the account when a limit moves the
// session; where it works. Under it, what asks for the human: a run that ended badly, with its
// Dismiss; a run waiting to go on by itself, and when; a session that moved, and where (rule 9);
// a sub-session's parent, which it is read from.
import { signal, View } from "nsh";
import { call, navigate, record, serverTime, StoreError } from "../../store";
import type { RuntimeRecord, Session } from "../../store/protocol";
import { Banner, Button, Heading, Link, Refusal, sent, StatusDot, Text } from "../../ui/controls";
import { movedOf } from "./offers";
import { attentionWords, runsOnWords, statusTone, waitWords } from "./words";
import { isNarrow } from "../../ui/width";

export function SessionHead(props: {
  repo: string;
  runtime: RuntimeRecord | undefined;
  session: Session;
}) {
  const label = () => {
    const shown = props.session;
    return shown.wait === null
      ? shown.statusLabel
      : `${shown.statusLabel} · goes on at ${serverTime(shown.wait.at)}`;
  };
  // On a phone the conversation needs the height: a smaller title, and who runs it and where in
  // one small line under the state, rather than a line each.
  return (
    <View
      style={{
        gap: isNarrow() ? 0 : 2,
        paddingBottom: isNarrow() ? 4 : 6,
        paddingHorizontal: 12,
        paddingTop: isNarrow() ? 4 : 8,
      }}
    >
      <Heading level={isNarrow() ? 2 : 1} testID="session-title">
        {props.session.name ?? props.session.title}
      </Heading>
      <View style={{ alignItems: "center", columnGap: 12, flexDirection: "row", flexWrap: "wrap" }}>
        <StatusDot label={label()} tone={statusTone(props.session.status)} />
        <If when={!isNarrow()}>
          <Text tone="quiet" testID="runs-on">
            {runsOnWords(props.session, props.runtime?.name)}
          </Text>
          <Text size="under" tone="faint">
            {props.session.place}
          </Text>
        </If>
        <If when={props.session.folder === null && props.session.parent === null}>
          <Archive repo={props.repo} session={props.session} />
        </If>
      </View>
      <If when={isNarrow()}>
        <Text size="under" tone="quiet" testID="runs-on">
          {`${runsOnWords(props.session, props.runtime?.name)} · ${props.session.place}`}
        </Text>
      </If>
    </View>
  );
}

/** The banners of what asks for the human now, in the order they matter. */
export function SessionBanners(props: { repo: string; session: Session }) {
  return (
    <View style={{ gap: 6, paddingHorizontal: 12 }}>
      <Moved session={props.session} />
      <If when={props.session.parent}>
        {(parent) => (
          <Banner
            action={
              <Button
                label="Open its parent"
                onPress={() => navigate({ id: parent(), page: "session-id" })}
              />
            }
            icon="bot"
            title={`A sub-session: ${props.session.role === "reviewer" ? "a reviewer" : "an implementer"} of its parent's run.`}
            tone="info"
          >
            <Text tone="quiet">
              Its parent's run sends it its work, so it takes no message: Stop ends it.
            </Text>
          </Banner>
        )}
      </If>
      <If when={props.session.wait}>
        {(wait) => (
          <Banner icon="clock" title="Waiting to go on" tone="info">
            <Text tone="quiet">
              {waitWords(wait().reason, props.session.account, serverTime(wait().at))}
            </Text>
          </Banner>
        )}
      </If>
      <Attention repo={props.repo} session={props.session} />
    </View>
  );
}

/** Where the session went, once an offer's card moved it. */
function Moved(props: { session: Session }) {
  return (
    <If when={movedOf(props.session.id)}>
      {(moved) => (
        <Banner
          action={
            <Button
              label={`Open the ${moved().to}`}
              onPress={() => navigate({ folder: moved().folder, page: "feature" })}
            />
          }
          icon={moved().to === "change" ? "git-branch" : "flag"}
          title={`This session is now the ${moved().to} ${moved().folder}.`}
          tone="done"
        >
          <Text tone="quiet">
            {moved().to === "change"
              ? "It goes on here, in the change's worktree, on its branch: its page holds its steps."
              : "The change and its sessions moved to the feature: its page holds its steps."}
          </Text>
        </Banner>
      )}
    </If>
  );
}

/** A run that needs the human: why, what to do, and its Dismiss, with the server's refusal. */
function Attention(props: { repo: string; session: Session }) {
  const turn = () => props.session.statusTurn;
  const why = () => {
    const id = turn();
    return id === null ? null : (record("Turn", { id, repo: props.repo })()?.reason ?? null);
  };
  const words = () =>
    props.session.status === "attention" || props.session.status === "needs-you"
      ? attentionWords(props.session.statusReason, {
          continues: props.session.continues,
          item: props.session.folder === null ? "chat" : "feature",
          why: props.session.statusReason === "failed" ? why() : null,
        })
      : undefined;
  const pending = signal(false);
  const refusal = signal<string | null>(null);
  const dismiss = async () => {
    const id = turn();
    if (id === null || pending()) return;
    pending.set(true);
    refusal.set(null);
    try {
      await call("session.dismiss", { repo: props.repo, turn: id });
    } catch (error) {
      refusal.set(error instanceof StoreError ? error.message : String(error));
    } finally {
      pending.set(false);
    }
  };
  return (
    <If when={words()}>
      {(shown) => (
        <View style={{ gap: 2 }}>
          <Banner
            action={
              shown().dismisses && turn() !== null ? (
                <Button label="Dismiss" onPress={() => void dismiss()} pending={pending()} />
              ) : undefined
            }
            testID="attention"
            title={shown().title}
            tone={shown().tone}
          >
            <Text size={isNarrow() ? "under" : undefined} tone="quiet">
              {shown().words}
            </Text>
          </Banner>
          <If when={refusal()}>{(said) => <Refusal words={said()} />}</If>
        </View>
      )}
    </If>
  );
}

/** A chat's Archive, which takes it out of the lists, or Unarchive, with the server's refusal. */
function Archive(props: { repo: string; session: Session }) {
  const archived = sent(
    () => props.session.archived,
    (on) => call("session.archive", { archived: on, repo: props.repo, session: props.session.id }),
  );
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
      <Link onPress={() => archived.set(!archived.value())} size="under">
        {archived.value() ? "Unarchive" : "Archive"}
      </Link>
      <If when={archived.refusal()}>{(words) => <Refusal words={words()} />}</If>
    </View>
  );
}
