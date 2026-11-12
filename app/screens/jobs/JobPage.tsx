// A job's page, `/jobs/<name>`: when it runs next and "Run now" by its title, then its form, each
// field saved as it is left and a choice as it is made. A rename moves the address once the record
// shows the new name. Unticking the page's own repository, while another stays ticked, takes the
// job off this repository's list: the page says so, and "Run it here again" ticks it back.
import { effect, signal, untracked, View } from "nsh";
import { dismissRun, type JobArgs, jobNamed, jobsOf, runRefusal } from "./actions";
import { ticking } from "../../ui/clock";
import { inputOf, savedForm } from "./form";
import { JobForm } from "./JobForm";
import { askRun, RunQuestion } from "./RunNow";
import { whenItRuns } from "./words";
import { call, navigate, redirect } from "../../store";
import type { JobInput } from "../../store/protocol";
import { Banner, Button, Refusal, refusalOf, Spinner, Text } from "../../ui/controls";
import { registerKey } from "../../ui/keys/registry";
import { PaneScroll, usePane } from "../../ui/layout";
import { Empty } from "../../ui/lists";
import { isNarrow } from "../../ui/width";

const toJobs = (repo: string) => () => navigate({ page: "jobs", repo });

/** The page once its own repository was unticked: where the job went, and the way back. */
function Left(props: { job: JobInput; onBack: () => void; repo: string }) {
  const refused = signal<string | null>(null);
  const back = async () => {
    refused.set(null);
    const job = { ...props.job, repositories: [...props.job.repositories, props.repo] };
    try {
      await call("jobs.update", { job, name: props.job.name, repo: props.repo });
      props.onBack();
    } catch (error) {
      refused.set(refusalOf(error));
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <Banner
        action={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button label="Run it here again" onPress={() => void back()} variant="main" />
            <Button label="Open Jobs" onPress={toJobs(props.repo)} />
          </View>
        }
        title={`“${props.job.name}” no longer runs in ${props.repo}.`}
        tone="caution"
      >
        <Text tone="quiet">
          {`It runs in ${props.job.repositories.join(", ")} now, so this repository's list no longer shows it.`}
        </Text>
      </Banner>
      <If when={refused()}>{(words) => <Refusal words={words()} />}</If>
    </View>
  );
}

/**
 * "Run now", by the title on a wide window; on a narrow one it is the bottom bar's action. Either
 * asks first, as a run spends an agent's time.
 */
function RunNow(props: JobArgs) {
  return (
    <>
      <If
        when={isNarrow()}
        else={
          <Button
            icon="play"
            keys="r"
            label="Run now…"
            onPress={() => askRun(props, "page")}
            testID="job-run"
            variant="main"
          />
        }
      >
        <RunKey {...props} />
      </If>
      <RunQuestion from="page" />
    </>
  );
}

function RunKey(props: JobArgs) {
  registerKey([
    {
      hint: "r",
      hintLabel: "run now",
      keys: "r",
      label: "run the job now…",
      run: () => askRun(props, "page"),
    },
  ]);
  return null;
}

export function JobPage(props: JobArgs) {
  const pane = usePane();
  const now = ticking();
  const jobs = jobsOf(props.repo);
  const job = () => jobNamed(jobs(), props.name);
  // The job as it was saved once it left this repository, as JSON: what the way back sends.
  const kept = pane.remember<string | null>("left", null);
  const left = () => {
    const text = kept();
    return text === null ? null : (JSON.parse(text) as JobInput);
  };
  const renamed = signal<string | null>(null);
  const form = savedForm(job, async (next, before) => {
    const input = inputOf(next);
    await call("jobs.update", { job: input, name: before.name, repo: props.repo });
    if (input.name !== before.name) renamed.set(input.name);
    if (before.repositories.includes(props.repo) && !input.repositories.includes(props.repo)) {
      kept.set(JSON.stringify(input));
    }
  });
  // A rename moves the address once the record shows the new name, so the page never says the job
  // is gone between the two.
  effect(() => {
    const name = renamed();
    if (name !== null && jobNamed(jobs(), name) !== undefined) {
      untracked(() => redirect({ name, page: "job", repo: props.repo }));
    }
  });
  const shown = () => (left() === null && renamed() === null ? job() : undefined);
  return (
    <PaneScroll style={{ flex: 1 }}>
      <View style={{ gap: 12, maxWidth: 960, paddingBottom: 16 }}>
        <If
          when={left()}
          else={
            <If
              when={shown()}
              else={
                <If
                  when={jobs() === undefined || renamed() !== null}
                  else={
                    <Empty
                      action={{ label: "Open Jobs", run: toJobs(props.repo) }}
                      icon="calendar-clock"
                      title={`No job “${props.name}” here`}
                      words={`It was renamed or removed, or it runs in other repositories than ${props.repo} only.`}
                    />
                  }
                >
                  <Spinner label="Reading the job" />
                </If>
              }
            >
              {(found) => (
                <>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                    <Text style={{ flex: 1 }} tone="quiet">
                      {`${whenItRuns(found())}${found().reportOnly ? " · Report only" : ""}`}
                    </Text>
                    <RunNow {...props} />
                  </View>
                  <If when={runRefusal(props)}>
                    {(words) => (
                      <Banner
                        action={<Button label="Dismiss" onPress={() => dismissRun(props)} />}
                        title={words()}
                        tone="danger"
                      />
                    )}
                  </If>
                  <JobForm
                    form={form}
                    job={job}
                    keptAs={`jobs:${props.repo}:${props.name}`}
                    now={now}
                    repo={props.repo}
                  />
                </>
              )}
            </If>
          }
        >
          {(gone) => <Left job={gone()} onBack={() => kept.set(null)} repo={props.repo} />}
        </If>
      </View>
    </PaneScroll>
  );
}
