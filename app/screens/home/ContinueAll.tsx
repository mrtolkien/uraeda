// Continue all, at the head of Needs you: it sends each run of this repository that stopped and
// asks for the human its step's message, as after a usage limit's reset. It shows only while one
// would go on, names them, and spends the agents' time only by its button or `C`, never Enter. The
// server says which runs go on (`continued`), by the rule its action follows; the runs it could not
// continue are told under the button, each with why.
import { signal, View } from "nsh";
import { call, record, StoreError } from "../../store";
import type { RefusedRun } from "../../store/protocol";
import { Button, Refusal, Text } from "../../ui/controls";
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
  const refusal = signal<string | null>(null);
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
            label={`Continue all (${names().length})`}
            onPress={() => void send()}
            pending={pending()}
          />
          <Text size="under" tone="quiet">
            {`Sends ${and(names())} ${names().length > 1 ? "their" : "its"} step's message.`}
          </Text>
        </If>
        <If when={refusal()}>{(words) => <Refusal words={words()} />}</If>
      </View>
    </If>
  );
}
