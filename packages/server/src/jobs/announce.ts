// The `Jobs` record's live update, on every repository's bus, apart from the scheduler's start so
// the jobs' mutations send it too.
import { JOBS_ID } from "../fate/jobs.ts";
import { announceEverywhere, onSessionChange } from "../live.ts";
import type { Hosts } from "../repositories.ts";
import type { Sessions } from "../runner/sessions.ts";
import type { ServerSettings } from "../settings.ts";

/** Sends the `Jobs` record's live update on the global bus and every host's. */
export const announceJobs = (hosts: Pick<Hosts, "all">) =>
  announceEverywhere(hosts, "Jobs", JOBS_ID);

/**
 * Announces the record when a job may have changed: the settings file was read (the jobs are read
 * apart from the values, so a hand edit of a job changes none), a run's row was added, changed, or
 * removed, or a run's session started or ended a turn, which its card's last run reads. Returns
 * what stops the announcements.
 */
export function announceJobChanges(shared: {
  hosts: Pick<Hosts, "all">;
  sessions: Sessions;
  settings: Pick<ServerSettings, "onRead">;
}): () => void {
  const { hosts, sessions, settings } = shared;
  const announce = () => announceJobs(hosts);
  const stops = [
    settings.onRead(announce),
    sessions.cache.jobs.onChange(announce),
    onSessionChange(sessions, (change) => {
      if ("agent" in change || (change.turn !== undefined && change.state === undefined)) {
        return;
      }
      if (sessions.cache.jobs.ofSession(change.session) !== undefined) {
        announce();
      }
    }),
  ];
  return () => stops.forEach((stop) => stop());
}
