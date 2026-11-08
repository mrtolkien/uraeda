// The runtime a new session runs on, picked as it starts: shown only while two runtimes or more are
// on here, each with its mark and name, the first one on picked until another is. One runtime on
// leaves nothing to pick, and draws nothing.
import { Selector } from "@astryxdesign/core/Selector";
import { harnessMark } from "./HarnessMark.tsx";
import { type Runtime, useRuntimes } from "./runtimes.ts";

/** The runtimes a new session can run on here: those on, in their order. */
export function useRuntimesOn(): ReadonlyArray<Runtime> {
  return useRuntimes().filter((runtime) => runtime.isOn);
}

/**
 * The picker, over the runtimes on: `value` while it is one of them, else the first. Its label,
 * "Agent", is hidden unless `isLabelShown`: in a composer, the mark and the name say what it holds.
 */
export function RuntimePicker({
  isLabelShown = false,
  onChange,
  value,
}: {
  isLabelShown?: boolean;
  onChange: (runtime: string) => void;
  value: string | undefined;
}) {
  const on = useRuntimesOn();
  if (on.length < 2) {
    return null;
  }
  const picked = on.find((runtime) => runtime.kind === value) ?? on[0]!;
  return (
    <Selector
      isLabelHidden={!isLabelShown}
      label="Agent"
      onChange={onChange}
      options={on.map((runtime) => ({
        icon: harnessMark(runtime.kind, on).icon,
        label: runtime.name,
        value: runtime.kind,
      }))}
      size={isLabelShown ? "md" : "sm"}
      value={picked.kind}
      variant={isLabelShown ? "input" : "ghost"}
    />
  );
}
