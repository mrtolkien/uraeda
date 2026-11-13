// "Run now", asked first: a run spends an agent's time, so its key, `r`, its button, and the
// phone's bar open the confirmation, which names the job, and `r` again or Enter starts it
// (rule 2). One question per pane that offers it, opened by the pane that asked.
import { signal, untracked } from "nsh";
import { Confirm, lastAsked } from "../../ui/controls";
import { type JobArgs, runNow } from "./actions";

/** The panes that offer "Run now": the list, a job's page, and its history. */
type From = "list" | "page" | "history";

const asked = signal<{ args: JobArgs; from: From } | null>(null);

/** Asks whether to run the job now, in the pane `from`. */
export const askRun = (args: JobArgs, from: From) => asked.set({ args, from });

/** The pane's question: drawn once in each pane that asks. */
export function RunQuestion(props: { from: From }) {
  const mine = () => {
    const now = asked();
    return now !== null && now.from === props.from ? now.args : null;
  };
  // The job it asked about last, kept as it closes, so its words leave whole.
  const job = lastAsked(mine);
  return (
    <Confirm
      icon="play"
      keys="r"
      label="Run it now"
      onClose={() => asked.set(null)}
      onConfirm={() => {
        const args = untracked(mine);
        if (args !== null) void runNow(args);
      }}
      open={mine() !== null}
      testID="run-now"
      title={`Run “${job()?.name ?? ""}” now?`}
      words={`It starts a session in the main checkout of ${job()?.repo ?? "the repository"} with the job's prompt, whatever its schedule or its pause: that spends its agent's time and usage.`}
    />
  );
}
