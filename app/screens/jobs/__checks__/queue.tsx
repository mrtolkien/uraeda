// What `jobs.test.tsx` opens to watch a job's saves in order: a job's form model (`savedForm`)
// over a job held here, whose server answers each save after 2 s and shows it in the job 3 s
// later, so a change made during a save can only build on what the one before wrote. Each save sent is a line, in the order sent.
import { mount, signal, Text, View } from "nsh";
import { inputOf, savedForm } from "../form";
import type { Job } from "../../../store/protocol";
import { Button } from "../../../ui/controls";
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

function Queue() {
  const job = signal<Job>(JOB);
  const sent = signal<ReadonlyArray<string>>([]);
  const form = savedForm(job, async (next, before) => {
    const input = inputOf(next);
    sent.update((all) => [
      ...all,
      `sent ${all.length + 1}: ${input.schedule}${input.reportOnly ? " report" : ""} over ${before.time}`,
    ]);
    await new Promise((done) => setTimeout(done, 2000));
    // The record shows the write 3 s after its answer: the next save starts before it does.
    const [hour, minute] = next.time.split(":").map(Number);
    setTimeout(
      () =>
        job.set({
          ...JOB,
          reportOnly: input.reportOnly,
          schedule: { day: null, hour, kind: "daily", minute },
          scheduleText: input.schedule,
        }),
      3000,
    );
  });
  return (
    <View style={{ gap: 8, padding: 16 }}>
      <Button label="Report only" onPress={() => form.set("reportOnly", "reportOnly", true)} />
      <Button label="At 9:30" onPress={() => form.set("time", "time", "09:30")} />
      <Text>{`Shown: ${form.value()?.time} ${form.value()?.reportOnly ? "report" : "full"}`}</Text>
      <Each of={sent()}>{(line) => <Text>{line()}</Text>}</Each>
    </View>
  );
}

mount(() => (
  <KeysHost>
    <KeyScope name="Checks">
      <Queue />
    </KeyScope>
  </KeysHost>
));
