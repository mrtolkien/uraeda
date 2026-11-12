// The triage's banner, over the inbox's notes and over the triage itself: a triage waiting for
// the human leads to answering it, an answered one to applying it in a chat. Either can be
// dismissed, for a new one: a triage as committed goes at once, as git keeps it; one holding
// answers not committed asks first, as those are lost for good.
import { signal, View } from "nsh";
import { call, navigate, record } from "../../store";
import { Banner, Button, Confirm, Text } from "../../ui/controls";
import { APPLY_TRIAGE, startChat, TRIAGE_ID } from "./chat";

/** Dismiss, which asks first only when answers would be lost. */
function Dismiss(props: { onRefused: (words: string | null) => void; repo: string }) {
  const file = record("WorkflowFile", { id: TRIAGE_ID, repo: props.repo });
  const asking = signal(false);
  const pending = signal(false);
  const dismiss = async () => {
    asking.set(false);
    pending.set(true);
    props.onRefused(null);
    try {
      await call("defaultRound.dismiss", {
        previous: file()?.current.document.hash ?? "",
        repo: props.repo,
        write: { href: "/inbox", label: "Dismissing the inbox triage" },
      });
    } catch (error) {
      props.onRefused((error as Error).message);
    }
    pending.set(false);
  };
  return (
    <>
      <Button
        label="Dismiss"
        onPress={() => (file()?.committed == null ? void dismiss() : asking.set(true))}
        pending={pending()}
      />
      <Confirm
        loses
        keep="Keep it"
        label="Dismiss the triage"
        onClose={() => asking.set(false)}
        onConfirm={() => void dismiss()}
        open={asking()}
        title="Dismiss the inbox triage?"
        words="The answers you saved but did not submit are deleted with it."
      />
    </>
  );
}

/**
 * The banner of the triage whose status is `status`: on the triage's own pane, `here` leaves out
 * the way to it.
 */
export function TriageBanner(props: { here?: boolean; repo: string; status: string }) {
  const refusal = signal<string | null>(null);
  const starting = signal(false);
  const apply = async () => {
    starting.set(true);
    refusal.set(null);
    try {
      await startChat(props.repo, APPLY_TRIAGE);
    } catch (error) {
      refusal.set((error as Error).message);
    }
    starting.set(false);
  };
  const answered = () => props.status === "answered";
  return (
    <Banner
      action={
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <If
            when={answered()}
            else={
              <If when={props.here !== true}>
                <Button
                  icon="message-circle-question"
                  label="Answer it"
                  onPress={() => navigate({ page: "triage", repo: props.repo })}
                />
              </If>
            }
          >
            <Button
              icon="send"
              label="Apply the answers"
              onPress={() => void apply()}
              pending={starting()}
            />
          </If>
          <Dismiss onRefused={(words) => refusal.set(words)} repo={props.repo} />
        </View>
      }
      icon="message-circle-question"
      title={
        answered()
          ? "Your triage answers are ready to apply"
          : "An inbox triage waits for your answers"
      }
      tone={answered() ? "info" : "needs"}
    >
      <If
        when={refusal()}
        else={
          <Text tone="quiet">
            {answered()
              ? "An agent moves each note where you answered, in one commit."
              : "An agent proposed where each note goes: answer one question at a time."}
          </Text>
        }
      >
        {(words) => <Text tone="danger">{words()}</Text>}
      </If>
    </Banner>
  );
}
