// The scheduled jobs, started on the server's parts: the scheduler reads the jobs from the settings
// file through the core's binding, and the switch, the repositories, and the extension from the
// server's own state.
import type { RepoContext } from "../fate/context.ts";
import { acceptOffers } from "./accept.ts";
import { announceJobChanges } from "./announce.ts";
import { Busy } from "./busy.ts";
import { type Scheduler, startScheduler } from "./scheduler.ts";

/**
 * Starts the scheduler on the listed repositories, each one's context the one a request there gets,
 * ticking every 30 seconds with a timer that does not keep the process alive, and accepts the
 * change each run offers. Its stop stops the timer, and waits for the runs and the acceptances in flight.
 */
export function startJobs(
  shared: Omit<RepoContext, "repo">,
  /** A test's clock, and `every: null` for the timer's absence. */
  timing: Pick<Parameters<typeof startScheduler>[0], "every" | "now"> = {},
): Scheduler {
  const { binding, extensions, hosts, settings } = shared;
  // The jobs an acceptance is opening a change for: the scheduler skips them as working.
  const busy = new Busy();
  const scheduler = startScheduler({
    ...timing,
    busy,
    context: (repo) => ({ ...shared, repo }),
    enabled: () => settings.runs().scheduledJobs.inForce,
    // Without the extensions' host, as in tests, the extension is on everywhere.
    isOn: (repository) => extensions?.isOn("jobs", repository) ?? true,
    jobs: () => binding.readJobs(settings.dir),
    repos: () =>
      hosts.all().flatMap((host) => (host.missing ? [] : [{ name: host.name, path: host.path }])),
  });
  // A job written just before its time is seen when the file is read, not at the timer's next look,
  // which may come after its time (R2, R47). A tick is serialised and starts a time once: an extra one is safe.
  const stopTicking = settings.onRead(() => void scheduler.tick());
  const stopAccepting = acceptOffers(shared, busy);
  const unannounce = announceJobChanges(shared);
  // Its stop ends the acceptance and the announcements too.
  const stop = scheduler.stop.bind(scheduler);
  return Object.assign(scheduler, {
    stop: async () => {
      stopTicking();
      stopAccepting();
      unannounce();
      // The acceptance in flight ends first: it may be creating a change, or sending its run.
      await Promise.all([stop(), stopAccepting.settled()]);
    },
  });
}
