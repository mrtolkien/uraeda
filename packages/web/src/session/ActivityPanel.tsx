// The session's Activity: its runs, each with its calls and thoughts. For now, its empty state.
import { Text } from "@astryxdesign/core/Text";

/** What the Activity reads before the session's first call, as before its first message. */
export function NoCall() {
  return <Text color="secondary">No call yet.</Text>;
}

/** The Activity of the session `session`. */
export function ActivityPanel(_props: { session: string }) {
  return <NoCall />;
}
