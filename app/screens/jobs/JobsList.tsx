// The Jobs place, `/jobs`: the jobs that name the repository, and those that name no repository of
// Uraeda's list, each a card, in the file's order. Above them, why none run: the settings file
// cannot be read, or scheduled jobs are off, each with its way out. Where the Jobs extension is off,
// the place is gone, and its address says so (`../extension`).
// The keys act on the selected card, each also by a press: `j` `k` move the selection, Enter opens
// the job, `r` runs it now, `p` pauses or resumes it, `d` deletes it after asking, `a` adds one.
import { computed, signal, untracked, View } from "nsh";
import { jobsOf, openJob, runNow } from "./actions";
import { ticking } from "./clock";
import { JobCard } from "./JobCard";
import { call, navigate } from "../../store";
import type { Job } from "../../store/protocol";
import { Banner, Button, refusalOf, type Sent, Spinner, Text } from "../../ui/controls";
import { registerKey } from "../../ui/keys/registry";
import { PaneScroll, usePane } from "../../ui/layout";
import { createCursor, Empty, listKeys } from "../../ui/lists";
import { Dialog } from "../../ui/surfaces";

/** A card's id in the cursor: its place in the file, since two jobs may share a name. */
const idOf = (job: Job) => String(job.index);

/** Why no job runs here by itself, each with its way out, above the cards. */
function Gates(props: { enabled: boolean; problem: string | null; repo: string }) {
  return (
    <>
      <If when={props.problem}>
        {(problem) => (
          <Banner title={problem()} tone="danger">
            <Text tone="quiet">Jobs are written in it: fix it by hand, and they come back.</Text>
          </Banner>
        )}
      </If>
      <If when={props.problem === null && !props.enabled}>
        <Banner
          action={
            <Button
              label="Open Settings, Runs"
              onPress={() => navigate({ category: "runs", page: "settings" })}
            />
          }
          title="Scheduled jobs are off."
        >
          <Text tone="quiet">
            No job starts by itself until “Run scheduled jobs” is on again, in Settings, Runs. “Run
            now” still starts one.
          </Text>
        </Banner>
      </If>
    </>
  );
}

export function JobsList(props: { repo: string }) {
  const pane = usePane();
  const now = ticking();
  const read = jobsOf(props.repo);
  const jobs = computed(() => read()?.jobs ?? []);
  const items = computed(() => jobs().map((job) => ({ id: idOf(job) })));
  const at = pane.remember<string | null>("at", null);
  const cursor = createCursor(items, {
    initial: at() ?? undefined,
    onChange: (id) => at.set(id ?? null),
  });
  // Why a card's last write was refused, by its id, as JSON: the visit keeps plain values.
  const keptRefusals = pane.remember<string>("refused", "{}");
  const refused = (): Record<string, string> =>
    JSON.parse(keptRefusals()) as Record<string, string>;
  const toggles = new Map<string, Sent<boolean>>();
  const deleting = signal<Job | null>(null);
  const selected = () => jobs().find((job) => idOf(job) === cursor.at());
  const add = () => navigate({ page: "job-new", repo: props.repo });

  const refuse = (job: Job, words: string | null) => {
    const { [idOf(job)]: _, ...rest } = untracked(refused);
    keptRefusals.set(JSON.stringify(words === null ? rest : { ...rest, [idOf(job)]: words }));
  };
  const remove = async () => {
    const job = untracked(deleting);
    deleting.set(null);
    if (job === null) return;
    refuse(job, null);
    try {
      await call("jobs.remove", { name: job.name, repo: props.repo });
    } catch (error) {
      refuse(job, refusalOf(error));
    }
  };
  /** Runs `act` on the selected job: `false` when there is none, so the key goes on. */
  const onSelected = (act: (job: Job) => void) => () => {
    const job = selected();
    if (job === undefined) return false;
    act(job);
    return undefined;
  };

  listKeys(cursor, {
    onOpen: (id) => {
      const job = jobs().find((one) => idOf(one) === id);
      if (job !== undefined) openJob(props.repo, job.name);
    },
    openLabel: "open the job",
  });
  registerKey([
    {
      hint: "r",
      hintLabel: "run now",
      keys: "r",
      label: "run the job now",
      run: onSelected((job) => void runNow({ name: job.name, repo: props.repo })),
    },
    {
      hint: "p",
      hintLabel: "pause",
      keys: "p",
      label: "pause or resume the job",
      run: onSelected((job) => {
        const toggle = toggles.get(idOf(job));
        toggle?.set(!toggle.value());
      }),
    },
    { keys: "d", label: "delete the job", run: onSelected((job) => deleting.set(job)) },
  ]);

  return (
    <PaneScroll style={{ flex: 1 }}>
      <View style={{ gap: 10, paddingBottom: 16 }}>
        <View
          style={{
            alignItems: pane.width() === "narrow" ? "flex-start" : "center",
            flexDirection: pane.width() === "narrow" ? "column" : "row",
            gap: 10,
          }}
        >
          <Text style={{ flexShrink: 1, flexGrow: 1 }} tone="quiet">
            Prompts that run here at set times, each in a session of the main checkout.
          </Text>
          <Button icon="plus" keys="a" label="Add a job" onPress={add} testID="jobs-add" />
        </View>
        <If when={read.error()}>
          {(error) => (
            <Banner title="The jobs could not be read" tone="danger">
              <Text tone="quiet">{error().message}</Text>
            </Banner>
          )}
        </If>
        <If
          when={read()}
          else={
            <If when={read.error() === undefined}>
              <Spinner label="Reading the jobs" />
            </If>
          }
        >
          {(shown) => (
            <>
              <Gates enabled={shown().enabled} problem={shown().problem} repo={props.repo} />
              <If when={shown().problem === null && jobs().length === 0}>
                <Empty
                  icon="calendar-clock"
                  title="No job yet"
                  words="A job runs a prompt here at set times, like a daily upgrade of the dependencies. “Add a job” writes one in config.toml."
                />
              </If>
              <Each key={(job: Job) => idOf(job)} of={jobs()}>
                {(job) => (
                  <JobCard
                    job={job()}
                    now={now()}
                    onDelete={() => deleting.set(job())}
                    onDismiss={() => refuse(job(), null)}
                    onPress={() => {
                      cursor.set(idOf(job()));
                      openJob(props.repo, job().name);
                    }}
                    onSwitch={(toggle) =>
                      toggle === undefined
                        ? toggles.delete(idOf(job()))
                        : toggles.set(idOf(job()), toggle)
                    }
                    refused={refused()[idOf(job())] ?? null}
                    repo={props.repo}
                    selected={cursor.holds(idOf(job()))}
                  />
                )}
              </Each>
            </>
          )}
        </If>
      </View>
      <Dialog
        icon="trash-2"
        onClose={() => deleting.set(null)}
        open={deleting() !== null}
        title={`Delete the job “${deleting()?.name ?? ""}”?`}
      >
        <View style={{ gap: 14 }}>
          <Text>Its prompt leaves config.toml, and its sessions stay.</Text>
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
            <Button label="Keep it" onPress={() => deleting.set(null)} />
            <Button
              icon="trash-2"
              keys="d"
              label="Delete"
              onPress={() => void remove()}
              variant="danger"
            />
          </View>
        </View>
      </Dialog>
    </PaneScroll>
  );
}
