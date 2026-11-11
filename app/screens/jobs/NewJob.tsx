// A new job's page, `/jobs/new`: the empty form, every day at 03:00 in the page's repository, its
// text kept on the device as it is typed. "Add the job" writes its table once its name and its
// prompt are filled, then the page becomes the job's own, where each field saves as it is left;
// Back goes to the list.
import { untracked, View } from "nsh";
import { ticking } from "./clock";
import { newForm } from "./form";
import { JobForm } from "./JobForm";
import { call, redirect } from "../../store";
import { PaneScroll } from "../../ui/layout";
import { dropUnsaved, readUnsaved } from "../../ui/text";

/** Where the device keeps a new job's text, per repository. */
const keptAs = (repo: string) => `jobs-new:${repo}`;

export function NewJob(props: { repo: string }) {
  const now = ticking();
  const kept = (field: string) => untracked(() => readUnsaved(`${keptAs(props.repo)}:${field}`));
  const { filled, form, submit } = newForm(
    props.repo,
    async (job) => {
      await call("jobs.add", { job, repo: props.repo });
      for (const field of ["name", "prompt", "time"]) dropUnsaved(`${keptAs(props.repo)}:${field}`);
      redirect({ name: job.name, page: "job", repo: props.repo });
    },
    {
      name: kept("name")?.text,
      prompt: kept("prompt")?.text,
      time: kept("time")?.text,
    },
  );
  return (
    <PaneScroll style={{ flex: 1 }}>
      <View style={{ maxWidth: 960, paddingBottom: 16 }}>
        <JobForm
          add={{ filled, submit: () => void submit() }}
          form={form}
          job={() => undefined}
          keptAs={keptAs(props.repo)}
          now={now}
          repo={props.repo}
        />
      </View>
    </PaneScroll>
  );
}
