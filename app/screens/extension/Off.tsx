// What a page of an extension off in the repository shows, which a link or Back still leads to:
// "The Decisions extension is off in sample.", with the way to turn it on here, Enter or a press,
// and the way to Settings, Extensions, which turns it on everywhere. Never a dead end (rule 9): the
// page comes back as the record says the extension is on.
import { signal, untracked, View } from "nsh";
import { BUILT_INS } from "../../extensions/builtins";
import { call, navigate, record } from "../../store";
import { Button, refusalOf } from "../../ui/controls";
import { Empty } from "../../ui/lists";

/** The extension's title: its row's, else a built-in's own, else its name. */
function titleOf(name: string, repo: string) {
  const row = record("Extensions", { repo })()?.extensions.find((one) => one.name === name);
  return row?.title || BUILT_INS.find((one) => one.name === name)?.title || name;
}

export function Off(props: { name: string; repo: string }) {
  const extensions = record("Extensions", { repo: props.repo });
  const refused = signal<string | null>(null);
  const turning = signal(false);
  const turnOn = async () => {
    const row = untracked(extensions)?.extensions.find((one) => one.name === props.name);
    if (row === undefined) return;
    refused.set(null);
    turning.set(true);
    try {
      await call("extensions.setOn", {
        name: props.name,
        on: [...row.on.filter((one) => one !== props.repo), props.repo],
        onAll: false,
      });
    } catch (error) {
      refused.set(refusalOf(error));
    } finally {
      turning.set(false);
    }
  };
  const title = () => titleOf(props.name, props.repo);
  return (
    <View style={{ gap: 8, maxWidth: 560 }}>
      <Empty
        action={{
          icon: "power",
          keys: "Enter",
          label: turning() ? "Turning it on…" : "Turn it on here",
          run: () => void turnOn(),
        }}
        icon="plug"
        refusal={refused()}
        title={`The ${title()} extension is off in ${props.repo}`}
        words={`Its pages and keys are gone from ${props.repo} until it is on again. Turn it on here, or in Settings, Extensions, for every repository.`}
      />
      <View style={{ alignItems: "flex-start", paddingHorizontal: 8 }}>
        <Button
          icon="settings"
          label="Settings, Extensions"
          onPress={() => navigate({ category: "extensions", page: "settings" })}
        />
      </View>
    </View>
  );
}
