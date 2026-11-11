// What takes a value, in every state: switches, checkboxes, radios, segments, a select, and a
// number, each also on its way to the server ("saving…") and refused, with its words under it.
import { asked, Line, Page, Part, STATES } from "./parts";
import { Checkbox, NumberInput, Radio, Segmented, Select, Switch } from "../../ui/controls";

const nothing = () => {};
const REFUSED = "A time is from 00:00 to 23:59.";
const WIDTHS = [
  { label: "Narrow", value: "narrow" },
  { label: "Wide", value: "wide" },
  { label: "Full", value: "full" },
] as const;
const MODELS = [
  { hint: "the default", icon: "openai", label: "Codex", value: "codex" },
  { icon: "claude", label: "Claude Code", value: "claude" },
  { disabled: true, icon: "pi", label: "Pi", value: "pi" },
] as const;

export function choices(narrow: boolean) {
  return (
    <Page narrow={narrow}>
      <Part narrow={narrow} title="Switches and boxes">
        {STATES.map((state) => (
          <Line name={state} narrow={narrow}>
            <Switch
              disabled={state === "disabled"}
              label="Night"
              onChange={nothing}
              state={asked(state)}
              value={state !== "rest"}
            />
            <Checkbox
              disabled={state === "disabled"}
              label="Commit"
              onChange={nothing}
              state={asked(state)}
              value={state === "focus" || state === "disabled"}
            />
          </Line>
        ))}
        <Line name="mixed" narrow={narrow}>
          <Checkbox label="All rows" mixed onChange={nothing} value={false} />
        </Line>
        <Line name="saving" narrow={narrow}>
          <Switch label="Hourly" onChange={nothing} pending value />
        </Line>
        <Line name="refused" narrow={narrow}>
          <Switch label="At 3:00" onChange={nothing} refusal={REFUSED} value={false} />
        </Line>
      </Part>
      <Part narrow={narrow} title="One of a few">
        <Radio
          hint="Who runs a turn when none is named."
          label="Agent"
          onChange={nothing}
          options={MODELS}
          value="codex"
        />
        {STATES.map((state) => (
          <Line name={state} narrow={narrow}>
            <Segmented
              disabled={state === "disabled"}
              label="Width"
              onChange={nothing}
              options={WIDTHS}
              state={asked(state)}
              value="wide"
            />
          </Line>
        ))}
        <Line name="refused" narrow={narrow}>
          <Segmented
            label="Width"
            onChange={nothing}
            options={WIDTHS}
            refusal="Full width needs a window of 1280 points."
            value="wide"
          />
        </Line>
      </Part>
      <Part narrow={narrow} title="Select and number">
        {STATES.map((state) => (
          <Line name={state} narrow={narrow}>
            <Select
              disabled={state === "disabled"}
              label="Agent"
              onChange={nothing}
              options={MODELS}
              state={asked(state)}
              value={state === "rest" ? null : "codex"}
              width={200}
            />
          </Line>
        ))}
        <Line name="refused" narrow={narrow}>
          <Select
            label="Agent"
            onChange={nothing}
            options={MODELS}
            refusal="Claude Code is off in this repository."
            value="codex"
            width={200}
          />
        </Line>
        <Line name="number" narrow={narrow}>
          <NumberInput
            label="Every"
            max={59}
            min={1}
            onChange={nothing}
            unit="minutes"
            value={15}
          />
        </Line>
        <Line name="disabled" narrow={narrow}>
          <NumberInput disabled label="Every" onChange={nothing} value={15} />
        </Line>
      </Part>
    </Page>
  );
}
