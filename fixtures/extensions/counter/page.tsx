// The page of the fixture extension `counter`, for `crates/app/tests/extensions.rs` and the
// browser's `crates/server/tests/browser/extensions.rs`: a place that reads its record `count`,
// draws it with the app's components and a colour of the app's theme, and calls its actions
// `add`, then `done` with what it got. It also tries what a page has no right to, a function its
// host does not grant, the app's own host's `uraeda.token`, the network, and a record of another
// extension, `echo`'s, named in its message, and says how each was refused.
import { effect, host, signal, Text, View } from "nsh";
import { navigate, place, useAction, useProps, useRecord } from "uraeda/page";
import { Button, tokens } from "uraeda/ui";

/**
 * Whether a read that names another extension, `echo`, got that extension's record: its
 * `counter`, which holds a greeting. The app reads the page's own extension's, whatever it names.
 */
function stolen(): Promise<boolean> {
  return new Promise((resolve) => {
    const id = 1000;
    host.on<{ id: number; value: unknown }>("record", (read) => {
      if (read.id !== id) return;
      const value = read.value as { greeting?: unknown } | null;
      resolve(value?.greeting !== undefined);
      host.post("record", { id, stop: true });
    });
    host.post("record", { extension: "echo", id, name: "counter" });
    setTimeout(() => resolve(false), 1000);
  });
}

/** The code of a refusal, or `allowed`. */
async function refused(attempt: () => Promise<unknown>): Promise<string> {
  try {
    await attempt();
    return "allowed";
  } catch (error) {
    return String((error as { code?: string }).code ?? error);
  }
}

function Counter() {
  const count = useRecord<{ count: number }>("count");
  const add = useAction<{ seen: number }, { count: number }>("add");
  const done = useAction<Record<string, unknown>, null>("done");
  const probe = useProps<{ probe?: string }>();
  const got = signal<number | undefined>(undefined);
  effect(() => {
    const seen = count().value?.count;
    if (seen === undefined || got() !== undefined) return;
    void add({ seen }).then(async (answer) => {
      got.set(answer.count);
      const outside = await refused(() => host.call("open", {}));
      const token = await refused(() => host.call("uraeda.token", {}));
      const fetched = await refused(() => fetch(probe()?.probe ?? "http://127.0.0.1:9/"));
      await done({ fetched, got: answer.count, outside, stolen: await stolen(), token });
    });
  });
  return (
    <View style={{ gap: 12, padding: 16 }}>
      <Text>{`Counted ${count().value?.count ?? "…"}`}</Text>
      <View style={{ backgroundColor: tokens.role.example, height: 60, width: 160 }} />
      <Button label="Open the inbox" onPress={() => navigate("/r/todo-app/inbox")} />
    </View>
  );
}

place({ icon: "list-checks", id: "counter", title: "Counter", view: Counter });
