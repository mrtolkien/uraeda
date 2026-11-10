// The Runs section: how each step runs, the run map over the settings' run options, which every
// feature starts from; whether Uraeda continues a run by itself after a restart or a usage limit,
// and how many times in a row; whether it catches up open pull requests behind the default branch.
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { HStack } from "@astryxdesign/core/HStack";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useMemo, useRef, useState } from "react";
import { EditableLine } from "../EditableLine.tsx";
import { RunMap } from "../runs/RunMap.tsx";
import { fromStored, type RunOptions, todayOptions, toSaved } from "../runs/runOptions.ts";
import type { PickerRuntime } from "../SessionPicker.tsx";
import { type Category, settingOf } from "./categories.ts";
import { CONTINUE_SETTINGS, type ContinueKey } from "./optimistic.ts";
import { SettingRow, SettingRows, useRefusal } from "./SettingRow.tsx";
import {
  FileProblem,
  overridden,
  type ServerActions,
  type ServerValues,
} from "./ServerSettings.tsx";

/** What a row of the section reads and changes. */
type RowProps = { actions: ServerActions; category: Category; values: ServerValues };

/** Each kind of automatic continue's switch, in the section's order, by its row's name. */
const CONTINUES: ReadonlyArray<{ key: ContinueKey; label: string }> = [
  { key: "restart", label: "Continue after a restart" },
  { key: "limit", label: "Continue after a usage limit" },
];

/** The catch-up of open pull requests' switch, off by default, after the continues' rows. */
const CATCH_UP = { key: "catch-up", label: "Catch up open pull requests" } as const;

const CAP = "Automatic continues in a row";
const CAP_PROBLEM = "Automatic continues in a row is a whole number from 1 to 10.";

const STEP_RUNS = "How each step runs";

/** The longest an edit saved stays shown while the record does not hold it yet, in ms. */
const HOLD_MS = 2000;

/** Whether two maps save as the same options. */
function sameSaved(one: RunOptions, other: RunOptions, defaults: RunOptions): boolean {
  return JSON.stringify(toSaved(one, defaults)) === JSON.stringify(toSaved(other, defaults));
}

/**
 * How each step runs: the run map over the saved options, on the agents `runtimes`, a step that
 * names none on the first; each change saved at once, with its refusal, and the Claude Code effort
 * the server's environment forces, under it. The saves go one after the other, as a feature's do:
 * each edit's map is shown until the record holds the last one, so an edit made while another
 * saves, as the effort picked right after its model, starts from that one and is never put back
 * by its answer.
 */
function StepRuns({
  actions,
  category,
  runtimes,
  values,
}: RowProps & { runtimes: ReadonlyArray<PickerRuntime> }) {
  const setting = settingOf(category, STEP_RUNS);
  const [refused, setRefused] = useRefusal(setting.label);
  const runtime = runtimes[0]?.kind ?? "claude";
  const defaults = useMemo(() => todayOptions(runtime), [runtime]);
  const value = useMemo(() => fromStored(values.runs.options, runtime), [runtime, values]);
  const [pending, setPending] = useState<{ isAnswered: boolean; next: RunOptions }>();
  const queue = useRef(Promise.resolve());
  const latest = useRef(0);
  const save = (next: RunOptions) => {
    const edit = ++latest.current;
    setPending({ isAnswered: false, next });
    setRefused(undefined);
    queue.current = queue.current.then(async () => {
      if (edit !== latest.current) {
        return;
      }
      const refusal = await actions.setRunOptions(toSaved(next, defaults));
      if (edit !== latest.current) {
        return;
      }
      setRefused(refusal);
      if (refusal !== undefined) {
        setPending(undefined);
        return;
      }
      // The record may still read the options before for a moment after the answer: the edit
      // stays shown until the record holds it, `HOLD_MS` at most.
      setPending({ isAnswered: true, next });
      setTimeout(() => {
        if (edit === latest.current) {
          setPending(undefined);
        }
      }, HOLD_MS);
    });
  };
  const isHeld =
    pending !== undefined && !(pending.isAnswered && sameSaved(pending.next, value, defaults));
  const shown = isHeld ? pending.next : value;
  const effort = values.runs.claudeEffortFromEnv;
  return (
    <SettingRow
      isUnderWide
      notes={refused && <AnnouncedBanner collapsible={false} status="error" title={refused} />}
      setting={setting}
      under={
        <VStack gap={3}>
          <RunMap defaults={defaults} onChange={save} runtimes={runtimes} value={shown} />
          {effort !== undefined && (
            <Text color="accent">
              CLAUDE_CODE_EFFORT_LEVEL is set to {effort}: every Claude Code effort follows it.
            </Text>
          )}
        </VStack>
      }
    />
  );
}

/**
 * A kind of automatic run's switch, saved at once, with the flag or the variable that sets it
 * for this run, and its refusal, under it.
 */
function ContinueSwitch({
  actions,
  category,
  kind,
  values,
}: RowProps & { kind: { key: ContinueKey; label: string } }) {
  const setting = settingOf(category, kind.label);
  const value = values.runs[CONTINUE_SETTINGS[kind.key]];
  const note = overridden(value, (on) => (on ? "on" : "off"));
  const [refused, setRefused] = useRefusal(setting.label);
  return (
    <SettingRow
      notes={
        <>
          {note && <Text color="accent">{note}</Text>}
          {refused && <AnnouncedBanner collapsible={false} status="error" title={refused} />}
        </>
      }
      setting={setting}
    >
      <Switch
        isLabelHidden
        label={setting.label}
        onChange={async (on: boolean) => {
          setRefused(undefined);
          setRefused(await actions.setContinue(kind.key, on));
        }}
        value={value.saved ?? value.inForce}
      />
    </SettingRow>
  );
}

/** The automatic continues in a row, edited in place as the port is, saved on Enter or blur. */
function AutomaticContinues({ actions, category, values }: RowProps) {
  const { automaticContinues } = values.runs;
  const note = overridden(automaticContinues, String);
  return (
    <SettingRow
      notes={note && <Text color="accent">{note}</Text>}
      setting={settingOf(category, CAP)}
    >
      <HStack>
        <EditableLine
          empty={CAP_PROBLEM}
          field="settings.automaticContinues"
          label={CAP}
          look="field"
          onSave={actions.setAutomaticContinues}
          value={String(automaticContinues.saved ?? automaticContinues.inForce)}
        />
      </HStack>
    </SettingRow>
  );
}

/**
 * The Runs section's rows that `shows` keeps, then, when it keeps a continue's, that a change
 * applies at once; the file's problem in place of its controls when the file cannot be read.
 */
export function RunSettings({
  actions,
  category,
  runtimes,
  shows,
  values,
}: RowProps & { runtimes: ReadonlyArray<PickerRuntime>; shows: (label: string) => boolean }) {
  const props = { actions, category, values };
  const kinds = CONTINUES.filter((kind) => shows(kind.label));
  const isContinuing = !values.problem && (kinds.length > 0 || shows(CAP));
  return (
    <VStack>
      {values.problem && <FileProblem problem={values.problem} />}
      <SettingRows>
        {!values.problem && shows(STEP_RUNS) && <StepRuns {...props} runtimes={runtimes} />}
        {!values.problem &&
          kinds.map((kind) => <ContinueSwitch key={kind.key} {...props} kind={kind} />)}
        {!values.problem && shows(CAP) && <AutomaticContinues {...props} />}
        {!values.problem && shows(CATCH_UP.label) && <ContinueSwitch {...props} kind={CATCH_UP} />}
      </SettingRows>
      {isContinuing && (
        <VStack paddingBlock={2} paddingInline={3}>
          <Text color="secondary" type="supporting">
            A change applies at once: turning a continue off cancels the waits it started.
          </Text>
        </VStack>
      )}
    </VStack>
  );
}
