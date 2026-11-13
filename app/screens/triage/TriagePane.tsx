// The inbox's triage, `/inbox/triage`: an agent's proposed outcome for each note, as questions the
// human answers one at a time, as every round is (`app/screens/round/`). An answered triage reads
// its answers, under the way to apply them.
import { signal, View } from "nsh";
import { record } from "../../store";
import { Banner, Spinner, Text } from "../../ui/controls";
import { PaneScroll } from "../../ui/layout";
import { Empty } from "../../ui/lists";
import { ORGANIZE_INBOX, startChat, TRIAGE_ID } from "./chat";
import { Answering, Answers } from "../round";
import { TriageBanner } from "./TriageBanner";

/** The triage's pane: the round once read, or why there is none. */
export function TriageView(props: { repo: string }) {
  const file = record("WorkflowFile", { id: TRIAGE_ID, repo: props.repo });
  const refusal = signal<string | null>(null);
  const waiting = () => file()?.status === "awaiting-human";
  return (
    <If
      when={waiting() ? file() : null}
      else={
        <PaneScroll style={{ flex: 1 }}>
          <View style={{ gap: 16, paddingBottom: 24 }}>
            <If when={file.error()}>
              {(error) => (
                <Banner icon="circle-alert" title="The triage could not be read" tone="danger">
                  <Text>{error().message}</Text>
                </Banner>
              )}
            </If>
            <If when={file() !== undefined} else={<Spinner label="Reading the triage" />}>
              <If
                when={file()}
                else={
                  <Empty
                    action={{
                      icon: "sparkles",
                      label: "Organize with AI",
                      run: () =>
                        void startChat(props.repo, ORGANIZE_INBOX).catch((error: Error) =>
                          refusal.set(error.message),
                        ),
                    }}
                    icon="inbox"
                    title="No inbox triage waits"
                    refusal={refusal()}
                    words="An agent proposes where each note goes, as questions you answer here. The inbox stays as it is until you do."
                  />
                }
              >
                {(shown) => (
                  <>
                    <TriageBanner here repo={props.repo} status={shown().status ?? "answered"} />
                    <Answers file={shown()} />
                  </>
                )}
              </If>
            </If>
          </View>
        </PaneScroll>
      }
    >
      {(shown) => <Answering args={{ id: TRIAGE_ID, repo: props.repo }} file={shown} />}
    </If>
  );
}
