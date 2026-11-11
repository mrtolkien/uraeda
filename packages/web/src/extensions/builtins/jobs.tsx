// The Jobs place, a built-in extension: the repository's scheduled jobs, `Space j` and `g j`,
// `/jobs`, in the phone's `…`. A job's page, `/jobs/<name>`, and a new job's, `/jobs/new`, are
// routes of the UI that it owns, so turning it off turns them off with it.
import { JobsPage } from "../../pages.ts";
import { builtIn } from "./order.ts";
import { BUILT_IN_PLACES } from "./places.ts";

const { icon, label, path } = BUILT_IN_PLACES.jobs;

builtIn("jobs").place({
  component: JobsPage,
  goKey: "j",
  icon,
  id: "jobs",
  key: "j",
  path,
  phoneTab: "more",
  title: label,
});
