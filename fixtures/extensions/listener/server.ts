// The events of the repositories it is on in, kept in a record.
import type { EventName, ServerApi } from "uraeda/server";

export default function activate(api: ServerApi) {
  const heard: Array<{ event: string; payload: unknown }> = [];
  const events = api.record("events", () => heard);
  const names: Array<EventName> = ["commit-landed", "session-started", "step-reached", "turn-ended"];
  for (const event of names) {
    api.on(event, (payload) => {
      heard.push({ event, payload });
      events.changed(payload.repository);
    });
  }
}
