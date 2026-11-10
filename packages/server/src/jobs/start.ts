// The scheduled jobs, started on the server's parts: the scheduler reads the jobs from the settings
// file through the core's binding, and the switch, the repositories, and the extension from the
// server's own state.
import type { RepoContext } from "../fate/context.ts";
import { acceptOffers } from "./accept.ts";
import { announceJobChanges } from "./announce.ts";
import { type Scheduler, startScheduler } from "./scheduler.ts";

/**
 * Starts the scheduler on the listed repositories, each one's context the one a request there gets,
 * ticking every 30 seconds with a timer that does not keep the process alive, and accepts the
 * change each run offers. Its stop stops the timer, and waits for the runs in flight.
 */
export function startJobs(shared: Omit<RepoContext, "repo">): Scheduler {
  const { binding, extensions, hosts, settings } = shared;
  const scheduler = startScheduler({
    context: (repo) => ({ ...shared, repo }),
    enabled: () => settings.runs().scheduledJobs.inForce,
    // Without the extensions' host, as in tests, the extension is on everywhere.
    isOn: (repository) => extensions?.isOn("jobs", repository) ?? true,
    jobs: () => binding.readJobs(settings.dir),
    repos: () =>
      hosts.all().flatMap((host) => (host.missing ? [] : [{ name: host.name, path: host.path }])),
  });
  const stopAccepting = acceptOffers(shared);
  const unannounce = announceJobChanges(shared);
  // Its stop ends the acceptance and the announcements too.
  const stop = scheduler.stop.bind(scheduler);
  return Object.assign(scheduler, {
    stop: async () => {
      stopAccepting();
      unannounce();
      await stop();
    },
  });
}
