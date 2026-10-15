import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";

/** A number of hours or minutes in two digits. */
const pad = (n: number) => String(n).padStart(2, "0");

/** A time as the notice says it: local, 24-hour, `14:32`. */
function clock(at: string) {
  const date = new Date(at);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * The notice above a field whose unsaved text was restored, with Discard: when it was typed, and
 * `changed`, the sentence saying the saved text changed since, when it did. `answered` says the
 * round was answered, the field gone read-only.
 */
export function RestoreNotice({
  answered = false,
  changed,
  onDiscard,
  restored,
}: {
  answered?: boolean;
  changed: string;
  onDiscard: () => void;
  restored: { at: string; changed: boolean };
}) {
  const since = restored.changed ? ` ${changed}` : "";
  const round = answered ? " The round was answered." : "";
  return (
    <Banner
      endContent={<Button label="Discard" onClick={onDiscard} />}
      status={restored.changed || answered ? "warning" : "info"}
      title={`Unsaved text restored from ${clock(restored.at)}.${since}${round}`}
    />
  );
}
