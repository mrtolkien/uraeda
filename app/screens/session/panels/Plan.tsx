// The plan's progress, at the Activity's foot while a feature's session builds: the tasks checked
// of the total, and the one at work. Nothing outside the implementation, or for a chat.
import { View } from "nsh";
import { record } from "../../../store";
import { Progress, Text } from "../../../ui/controls";
import { tokens } from "../../../ui/tokens";
import { type SessionArgs, sessionIdOf } from "../place";

export function PlanProgress(props: { args: SessionArgs }) {
  const id = sessionIdOf(props.args);
  /** The feature's or the change's folder: the page's, else the session's. */
  const folder = () => {
    if (props.args.folder !== "") return props.args.folder;
    const shown = id();
    return typeof shown === "string"
      ? (record("Session", { id: shown, repo: props.args.repo })()?.folder ?? null)
      : null;
  };
  const progress = () => {
    const named = folder();
    return named === null
      ? null
      : (record("Feature", { id: named, repo: props.args.repo })()?.step.progress ?? null);
  };
  return (
    <If when={progress()}>
      {(shown) => (
        <View
          style={{
            borderTopColor: tokens.row.rule,
            borderTopWidth: 1,
            gap: 4,
            paddingHorizontal: tokens.space.panePadding,
            paddingVertical: 8,
          }}
          testID="plan-progress"
        >
          <Progress
            label="The plan"
            value={shown().total === 0 ? 0 : shown().done / shown().total}
            words={`${shown().done} of ${shown().total} tasks`}
          />
          <Text lines={2} size="under" tone="quiet">
            {shown().done < shown().total ? `Now: ${shown().title}` : "Every task is checked."}
          </Text>
        </View>
      )}
    </If>
  );
}
