// The Jobs place, a built-in extension: the repository's scheduled jobs, `g j` and `Space j`,
// `/jobs`, in the phone's `…`, with a job's page and a new job's. Its screens are
// `app/screens/jobs/`: this declares them.
import { builtIn } from "./declare";

export const jobs = builtIn({
  name: "jobs",
  places: [
    {
      icon: "clock",
      id: "jobs",
      key: "j",
      onPhone: "more",
      pages: ["jobs", "job", "job-new"],
      title: "Jobs",
      to: { page: "jobs" },
    },
  ],
  title: "Jobs",
});
