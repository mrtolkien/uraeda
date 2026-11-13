// The Runs category: the default agent, how each step runs, what continues a run by itself and how
// many times in a row, the catch-up of open pull requests, and the scheduled jobs. Each change is
// saved at once, and applies to the next run.
import { View } from "nsh";
import { FileProblem, settingsRecord } from "./fields";
import { wordsOf } from "./categories";
import { fromWords, isOverridden, onOff } from "./Row";
import { FieldRow, FieldRows } from "../../ui/lists/FieldRow";
import { call, record } from "../../store";
import type { ContinueKind, RunSettings, Setting } from "../../store/protocol";
import { NumberInput, Select, type Sent, sent, Switch, Text } from "../../ui/controls";
import { SettingsMap } from "../runs/SettingsMap";

/** The choice of no default agent: no agent's name holds a colon. */
const FIRST_ON = ":first";

/** Each switch of the category: its kind, the record's field, its row's name and icon. */
const SWITCHES = [
  {
    field: "continueAfterRestart",
    icon: "refresh-cw",
    key: "restart",
    label: "Continue after a restart",
  },
  {
    field: "continueAfterLimit",
    icon: "hourglass",
    key: "limit",
    label: "Continue after a usage limit",
  },
  {
    field: "catchUpPullRequests",
    icon: "git-pull-request",
    key: "catch-up",
    label: "Catch up open pull requests",
  },
  { field: "scheduledJobs", icon: "calendar-clock", key: "jobs", label: "Run scheduled jobs" },
] as const satisfies ReadonlyArray<{
  field: keyof RunSettings;
  icon: string;
  key: ContinueKind;
  label: string;
}>;

type Kind = (typeof SWITCHES)[number];

/** A kind of automatic run's value, as its switch shows it and sends it. */
function toggle(kind: Kind, runs: () => RunSettings | undefined): Sent<boolean> {
  return sent(
    () => runs()?.[kind.field].saved ?? runs()?.[kind.field].inForce ?? false,
    (on) => call("settings.setContinue", { key: kind.key, on }),
  );
}

/** A kind of automatic run's switch, saved at once. */
function ContinueRow(props: {
  kind: Kind;
  runs: () => RunSettings | undefined;
  value: Sent<boolean>;
}) {
  const setting = (): Setting<boolean> | undefined => props.runs()?.[props.kind.field];
  const value = props.value;
  return (
    <FieldRow
      {...wordsOf("runs", props.kind.label)}
      control={
        <Switch
          label={onOff(value.value())}
          onChange={value.set}
          pending={value.pending()}
          value={value.value()}
        />
      }
      from={setting() === undefined ? null : fromWords(setting()!, onOff)}
      icon={props.kind.icon}
      id={props.kind.key}
      overridden={setting() !== undefined && isOverridden(setting()!)}
      refusal={value.refusal()}
    />
  );
}

/**
 * The default agent: "The first one on", then every agent registered, by name, so the list keeps
 * its order whichever is picked. A name no agent has stays listed, and says the first one on runs.
 */
function DefaultAgent(props: {
  opener: (open: () => void) => void;
  runs: () => RunSettings | undefined;
}) {
  const agents = record("Agent", { repo: null });
  const runtimes = () => agents()?.runtimes ?? [];
  const first = () => runtimes().find((one) => one.isOn && one.id !== props.runs()?.defaultAgent);
  const picked = sent(
    () => props.runs()?.defaultAgent ?? FIRST_ON,
    (agent) => call("settings.setDefaultAgent", { agent: agent === FIRST_ON ? null : agent }),
  );
  const saved = () => props.runs()?.defaultAgent ?? null;
  const gone = () => {
    const name = saved();
    return name !== null && !runtimes().some((one) => one.id === name) ? name : null;
  };
  const options = () => [
    { hint: first()?.name, label: "The first one on", value: FIRST_ON },
    ...runtimes()
      .toSorted((a, b) => a.name.localeCompare(b.name))
      .map((one) => ({
        hint: one.isOn ? undefined : "off everywhere",
        label: one.name,
        value: one.id,
      })),
    ...(gone() === null ? [] : [{ hint: "not installed", label: gone()!, value: gone()! }]),
  ];
  const from = () => {
    if (gone() !== null) return `No agent is named ${gone()} here: the first one on runs.`;
    if (saved() !== null) return "Set in config.toml";
    const name = runtimes().find((one) => one.isOn)?.name;
    return name === undefined
      ? "Unset: no agent is on."
      : `Unset: the first agent on runs, ${name} now.`;
  };
  return (
    <FieldRow
      {...wordsOf("runs", "Default agent")}
      control={
        <Select
          label="Default agent"
          onChange={picked.set}
          opener={props.opener}
          options={options()}
          pending={picked.pending()}
          value={picked.value()}
          width={240}
        />
      }
      from={from()}
      icon="bot"
      id="agent"
      overridden={gone() !== null}
      refusal={picked.refusal()}
    />
  );
}

/** The continues in a row, from 1 to 10, saved as each is typed or stepped. */
function Continues(props: { runs: () => RunSettings | undefined }) {
  const setting = () => props.runs()?.automaticContinues;
  const value = sent(
    () => setting()?.saved ?? setting()?.inForce ?? 3,
    (continues: number) => call("settings.setAutomaticContinues", { continues: String(continues) }),
  );
  return (
    <FieldRow
      {...wordsOf("runs", "Automatic continues in a row")}
      control={
        <NumberInput
          label="Automatic continues in a row"
          max={10}
          min={1}
          onChange={(next) => next !== null && value.set(next)}
          value={value.value()}
          width={96}
        />
      }
      from={setting() === undefined ? null : fromWords(setting()!, String)}
      icon="repeat"
      id="continues"
      overridden={setting() !== undefined && isOverridden(setting()!)}
      refusal={value.refusal()}
    />
  );
}

export function Runs() {
  const settings = settingsRecord();
  const runs = () => (settings()?.problem === null ? settings()?.runs : undefined);
  const switches = (keys: ReadonlyArray<string>) =>
    SWITCHES.filter((kind) => keys.includes(kind.key));
  const values = new Map(SWITCHES.map((kind) => [kind.key, toggle(kind, runs)]));
  const flip = (key: string) => () => {
    const value = values.get(key as Kind["key"])!;
    value.set(!value.value());
  };
  let openAgent: (() => void) | undefined;
  const rows = () =>
    runs() === undefined
      ? []
      : [
          { act: () => openAgent?.(), id: "agent" },
          { id: "map" },
          { act: flip("restart"), id: "restart" },
          { act: flip("limit"), id: "limit" },
          { id: "continues" },
          { act: flip("catch-up"), id: "catch-up" },
          { act: flip("jobs"), id: "jobs" },
        ];
  return (
    <View style={{ gap: 12 }}>
      <If when={settings()?.problem}>
        {(problem) => <FileProblem file={settings()!.file} problem={problem()} />}
      </If>
      <FieldRows rows={rows}>
        <If when={runs() !== undefined}>
          <DefaultAgent opener={(open) => (openAgent = open)} runs={runs} />
          <FieldRow
            {...wordsOf("runs", "How each step runs")}
            icon="workflow"
            id="map"
            under={
              <View style={{ gap: 4 }}>
                <SettingsMap runs={runs} />
                <If when={runs()?.claudeEffortFromEnv}>
                  {(effort) => (
                    <Text tone="caution">
                      {`CLAUDE_CODE_EFFORT_LEVEL is set to ${effort()}: every Claude Code effort follows it.`}
                    </Text>
                  )}
                </If>
              </View>
            }
          />
          <Each
            key={(kind: (typeof SWITCHES)[number]) => kind.key}
            of={switches(["restart", "limit"])}
          >
            {(kind) => <ContinueRow kind={kind()} runs={runs} value={values.get(kind().key)!} />}
          </Each>
          <Continues runs={runs} />
          <Each
            key={(kind: (typeof SWITCHES)[number]) => kind.key}
            of={switches(["catch-up", "jobs"])}
          >
            {(kind) => <ContinueRow kind={kind()} runs={runs} value={values.get(kind().key)!} />}
          </Each>
          <Text size="under" tone="faint" style={{ paddingHorizontal: 8 }}>
            A change applies at once: turning a continue off cancels the waits it started.
          </Text>
        </If>
      </FieldRows>
    </View>
  );
}
