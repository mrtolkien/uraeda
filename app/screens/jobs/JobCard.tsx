// A job's card in the Jobs place: its name, its schedule in words ("Report only" after it when it
// is), the switch that pauses it, then when it runs next or why it does not, and what its last run
// left, and its two actions by a tap, "Run now" and "Delete", which `r` and `d` are on the list. The switch moves at once, and a refusal puts it back under it; a refusal of "Run now" or
// of a delete shows under the card until it is dismissed.
import { cleanup, View } from "nsh";
import { dismissRun, runRefusal } from "./actions";
import { askRun } from "./RunNow";
import { lastFact, nextFacts, whenItRuns } from "./words";
import { call, record } from "../../store";
import type { Job } from "../../store/protocol";
import { Banner, Button, type Sent, sent, Switch, Text } from "../../ui/controls";
import { Card } from "../../ui/lists";

export type JobCardProps = {
  job: Job;
  now: number;
  onPress: () => void;
  /** Asks to delete it. */
  onDelete: () => void;
  /** Why the last delete of it was refused. */
  refused: string | null;
  onDismiss: () => void;
  repo: string;
  selected: boolean;
  /** Gets the card's switch, for `p` on the list. */
  onSwitch: (toggle: Sent<boolean> | undefined) => void;
};

/** What its last run's session asks now, in words: "New reply", "Needs you". */
function statusOf(repo: string, job: Job) {
  const id = job.last?.session ?? null;
  if (id === null) return undefined;
  const session = record("Session", { id, repo })();
  return session === null || session === undefined ? undefined : session;
}

export function JobCard(props: JobCardProps) {
  const toggle = sent(
    () => props.job.on,
    (on) => call("jobs.setOn", { name: props.job.name, on, repo: props.repo }),
  );
  props.onSwitch(toggle);
  cleanup(() => props.onSwitch(undefined));
  const session = () => statusOf(props.repo, props.job);
  const args = () => ({ name: props.job.name, repo: props.repo });
  const refusal = () => props.refused ?? runRefusal(args());
  const dismiss = () => {
    props.onDismiss();
    dismissRun(args());
  };
  return (
    <View style={{ gap: 6 }}>
      <Card
        body={
          <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
            <Switch
              label={toggle.value() ? "Runs at its times" : "Paused"}
              onChange={toggle.set}
              pending={toggle.pending()}
              refusal={toggle.refusal()}
              testID={`job-on-${props.job.index}`}
              value={toggle.value()}
            />
          </View>
        }
        actions={[
          { icon: "play", label: "Run now…", run: () => askRun(args(), "list") },
          { icon: "trash-2", label: "Delete", run: props.onDelete },
        ]}
        facts={[
          ...nextFacts(props.job, props.now, true),
          lastFact(props.job, props.now, session()?.statusLabel),
        ]}
        icon="calendar-clock"
        onPress={props.onPress}
        selected={props.selected}
        state={
          session()?.status === "working"
            ? { label: "Running", running: true, tone: "live" }
            : undefined
        }
        testID={`job-card-${props.job.index}`}
        title={props.job.name}
        who={`${whenItRuns(props.job)}${props.job.reportOnly ? " · Report only" : ""}`}
      />
      <If when={refusal()}>
        {(words) => (
          <Banner
            action={<Button label="Dismiss" onPress={dismiss} />}
            title={words()}
            tone="danger"
          >
            <Text tone="quiet">Nothing changed.</Text>
          </Banner>
        )}
      </If>
    </View>
  );
}
