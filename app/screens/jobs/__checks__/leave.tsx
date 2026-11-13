// What `jobs.test.tsx` opens to watch a job's field saved as its page goes: the job's name typed
// in, then the field removed 3 s after the page opened, still with the focus, as a click on
// another page in the rail leaves it. Each save sent is a line.
import { mount, signal, Text, View } from "nsh";
import { type Form, savedForm } from "../form";
import { Typed } from "../Typed";
import type { Job } from "../../../store/protocol";
import { KeysHost } from "../../../ui/keys/KeysHost";
import { KeyScope } from "../../../ui/keys/registry";

const JOB: Job = {
  agent: null,
  effort: null,
  history: [],
  index: 0,
  last: null,
  model: null,
  name: "Dependencies",
  next: { at: null, text: null, why: "off" },
  on: true,
  problem: null,
  prompt: "Upgrade the dependencies.",
  repositories: ["sample"],
  reportOnly: false,
  schedule: { day: null, hour: 3, kind: "daily", minute: 0 },
  scheduleText: "daily 03:00",
};

function Leave() {
  const job = signal<Job>(JOB);
  const sent = signal<ReadonlyArray<string>>([]);
  const form: Form = savedForm(job, async (next) => {
    sent.update((all) => [...all, `sent: ${next.name}`]);
    job.set({ ...job(), name: next.name });
  });
  const shown = signal(true);
  setTimeout(() => shown.set(false), 3000);
  return (
    <View style={{ gap: 8, padding: 16 }}>
      <If when={shown()}>
        <Typed
          at="name"
          form={form}
          isNew={false}
          keptAs="checks:job-leave:name"
          label="Name"
          saved={() => form.value()?.name ?? ""}
          testID="job-name"
          write={(all, text) => ({ ...all, name: text })}
        />
      </If>
      <Each of={sent()}>{(line) => <Text>{line()}</Text>}</Each>
    </View>
  );
}

mount(() => (
  <KeysHost>
    <KeyScope name="Checks">
      <Leave />
    </KeyScope>
  </KeysHost>
));
