// The Jobs place, a built-in extension's (`Space j`, `g j`, the phone's `…`): `/jobs`, the jobs as
// cards; `/jobs/<name>`, a job's form in the main stack and its history in the side one, "Run now"
// the phone's bottom bar's action; `/jobs/new`, a new job's form. Task 51 wires the built-ins'
// declarations through the page API: until then the place is declared here, as every screen's.
import { jobsOf, runNow } from "./actions";
import { History } from "./History";
import { JobPage } from "./JobPage";
import { JobsList } from "./JobsList";
import { NewJob } from "./NewJob";
import { definePane, definePlace } from "../../ui/layout";

type Repo = { repo: string };
type Of = { name: string; repo: string };

export const jobsList = definePane<Repo>({
  icon: "calendar-clock",
  kind: "jobs-list",
  mark: ({ repo }) => ({ count: jobsOf(repo)()?.jobs.length }),
  stack: "main",
  title: "Jobs",
  view: (props) => <JobsList repo={props.args.repo} />,
});

export const jobForm = definePane<Of>({
  action: (args) => ({ icon: "play", label: "Run now", run: () => void runNow(args) }),
  icon: "calendar-clock",
  kind: "job-form",
  stack: "main",
  title: (args) => args.name,
  view: (props) => <JobPage name={props.args.name} repo={props.args.repo} />,
});

export const jobHistory = definePane<Of>({
  action: (args) => ({ icon: "play", label: "Run now", run: () => void runNow(args) }),
  icon: "history",
  kind: "job-history",
  mark: ({ name, repo }) => ({
    count: jobsOf(repo)()?.jobs.find((one) => one.name === name)?.history.length,
  }),
  stack: "side",
  title: "History",
  view: (props) => <History name={props.args.name} repo={props.args.repo} />,
});

export const newJob = definePane<Repo>({
  icon: "plus",
  kind: "job-new",
  stack: "main",
  title: "New job",
  view: (props) => <NewJob repo={props.args.repo} />,
});

definePlace("jobs", (route) => (route.repo === undefined ? [] : [jobsList({ repo: route.repo })]));

definePlace("job", (route) =>
  route.repo === undefined
    ? []
    : [
        jobForm({ name: route.name, repo: route.repo }),
        jobHistory({ name: route.name, repo: route.repo }),
      ],
);

definePlace("job-new", (route) => (route.repo === undefined ? [] : [newJob({ repo: route.repo })]));
