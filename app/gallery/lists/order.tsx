// A list the human puts in order, by its grip, a long press, or `m` and the keys.
import { signal } from "nsh";
import { Page, Part } from "../parts";
import { createCursor, DragOrder, Line, moved } from "../../ui/lists";
import { Scoped } from "./rows";

const NAMES: Record<string, string> = {
  extensions: "Extension places",
  jobs: "Scheduled jobs",
  nsh: "The NSH migration",
  phone: "The phone's bottom bar",
  remote: "Remote agents",
};

export function order(narrow: boolean) {
  const items = signal(["nsh", "jobs", "remote", "phone", "extensions"].map((id) => ({ id })));
  const cursor = createCursor(items, { initial: "jobs" });
  return (
    <Page narrow={narrow}>
      <Part narrow={narrow} title="DragOrder">
        <Scoped name="Order" on>
          <DragOrder
            cursor={cursor}
            label={(id) => NAMES[id] ?? id}
            onMove={(id, to) => {
              const now = items();
              items.set(
                moved(
                  now.map((one) => one.id),
                  id,
                  to,
                ).map((one) => now.find((item) => item.id === one)!),
              );
            }}
            row={(id) => <Line icon="flag" label={NAMES[id()] ?? id()} />}
          />
        </Scoped>
      </Part>
    </Page>
  );
}
