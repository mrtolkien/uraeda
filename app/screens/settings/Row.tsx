// Where a setting's value comes from, in words, as every category's rows say it: the row itself
// is the shared saved field, `FieldRow` of `app/ui/lists/`.
import type { Setting } from "../../store/protocol";

/** Where a setting's value in force comes from, in words, its value too when it is not the file's. */
export function fromWords<T>(setting: Setting<T>, show: (value: T) => string): string {
  const { source } = setting;
  switch (source.kind) {
    case "default":
      return `The default, ${show(setting.inForce)}`;
    case "file":
      return "Set in config.toml";
    default:
      return `Set by ${source.name} for this run: ${show(setting.inForce)}. The file's value applies without it.`;
  }
}

/** Whether a flag or a variable sets the value in force. */
export const isOverridden = (setting: Setting<unknown>) =>
  setting.source.kind === "flag" || setting.source.kind === "environment";

/** A switch's value in words. */
export const onOff = (on: boolean) => (on ? "on" : "off");
