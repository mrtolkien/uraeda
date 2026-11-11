// A session's effort, changed from its next turn on: a select in its head, `m` opening it. The
// efforts are its model's, as the agent lists them; "Default effort" follows the model's own. It moves at
// once and goes back with the server's words under it when refused. A sub-session runs as its
// parent's run says, and a model that takes no effort shows nothing.
import { call } from "../../store";
import type { RuntimeRecord, Session } from "../../store/protocol";
import { type Option, Select, sent } from "../../ui/controls";
import { registerKey } from "../../ui/keys";

export function SessionEffort(props: {
  repo: string;
  runtime: RuntimeRecord | undefined;
  session: Session;
}) {
  const list = () => props.runtime?.models;
  const model = () => props.session.model ?? list()?.defaults.model ?? null;
  const efforts = () => list()?.models.find((one) => one.id === model())?.efforts ?? [];
  const effort = sent(
    () => props.session.effort ?? "",
    (picked: string) =>
      call("session.setEffort", {
        effort: picked === "" ? null : picked,
        repo: props.repo,
        session: props.session.id,
      }),
  );
  const options = (): Array<Option> => {
    const first = list()?.defaults.effort;
    const out: Array<Option> = [
      {
        hint: efforts().find((one) => one.id === first)?.name,
        label: "Default effort",
        value: "",
      },
      ...efforts().map((one) => ({ label: `${one.name} effort`, value: one.id })),
    ];
    const set = effort.value();
    if (set !== "" && !efforts().some((one) => one.id === set)) {
      out.push({ hint: "not listed", label: `${set} effort`, value: set });
    }
    return out;
  };
  let open: (() => void) | undefined;
  registerKey({
    hint: "m",
    hintLabel: "effort",
    icon: "gauge",
    keys: "m",
    label: "Change the session's effort",
    run: () => (open === undefined || efforts().length === 0 ? false : void open()),
  });
  return (
    <If when={efforts().length > 0}>
      <Select
        label="Effort"
        onChange={(picked) => effort.set(picked)}
        opener={(opens) => {
          open = opens;
        }}
        options={options()}
        pending={effort.pending()}
        refusal={effort.refusal()}
        testID="session-effort"
        value={effort.value()}
        width={180}
      />
    </If>
  );
}
