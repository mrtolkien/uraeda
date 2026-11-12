// Continue all, at the head of Needs you: it sends each run of this repository that stopped and
// asks for the human its step's message, as after a usage limit's reset. It shows only while one
// would go on, and spends the agents' time only once confirmed: its button, or `C`, opens the
// confirmation, which names the runs, and `C` again or Enter sends them (rule 2). The server says
// which runs go on (`continued`), by the rule its action follows; the runs it could not continue
// are told under the button, each with why.
import { signal, View } from "nsh";
import { call, record, StoreError } from "../../store";
import type { RefusedRun } from "../../store/protocol";
import { Button, Confirm, Refusal, Text } from "../../ui/controls";
import { idsWords as and } from "../round/words";

/** "cli-tuis and search could not continue: another session of this feature is working." */
function refusedWords(refused: ReadonlyArray<RefusedRun>): string {
  const byReason = new Map<string, Array<RefusedRun>>();
  for (const run of refused) byReason.set(run.reason, [...(byReason.get(run.reason) ?? []), run]);
  return [...byReason]
    .map(([reason, runs]) => {
      const why = `${reason.charAt(0).toLowerCase()}${reason.slice(1)}`.replace(/\.?$/, ".");
      return `${and(runs.map(({ name }) => name))} could not continue: ${why}`;
    })
    .join(" ");
}

export function ContinueAll(props: { repo: string }) {
  const needs = record("NeedsYouList", null);
  const names = () =>
    (needs()?.rows ?? [])
      .filter((row) => row.repository === props.repo && row.continued)
      .map((row) => row.label);
  const pending = signal(false);
  const asking = signal(false);
  const refusal = signal<string | null>(null);
  const runs = () => `${names().length} ${names().length === 1 ? "run" : "runs"}`;
  const send = async () => {
    if (pending() || names().length === 0) return;
    pending.set(true);
    refusal.set(null);
    try {
      const { refused } = await call("feature.continueAll", { repo: props.repo });
      if (refused.length > 0) refusal.set(refusedWords(refused));
    } catch (error) {
      refusal.set(error instanceof StoreError ? error.message : String(error));
    } finally {
      pending.set(false);
    }
  };
  return (
    <If when={names().length > 0 || refusal() !== null}>
      <View style={{ alignItems: "flex-start", gap: 4, paddingBottom: 10 }}>
        <If when={names().length > 0}>
          <Button
            icon="play"
            keys="C"
            label={`Continue all (${names().length})…`}
            onPress={() => asking.set(true)}
            pending={pending()}
            testID="continue-all"
          />
          <Text size="under" tone="quiet">
            {`Sends ${and(names())} ${names().length > 1 ? "their" : "its"} step's message.`}
          </Text>
        </If>
        <Confirm
          icon="play"
          keys="C"
          label={`Continue ${runs()}`}
          onClose={() => asking.set(false)}
          onConfirm={() => void send()}
          open={asking()}
          title={`Continue ${runs()}?`}
          words={`${and(names())} ${names().length > 1 ? "each get their" : "gets its"} step's message, and ${names().length > 1 ? "their agents go" : "its agent goes"} on with it: that spends ${names().length > 1 ? "their" : "its"} time and usage.`}
        />
        <If when={refusal()}>{(words) => <Refusal words={words()} />}</If>
      </View>
    </If>
  );
}
