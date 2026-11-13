// The pending comments written on an older version of the file: read them again, or Start over,
// which removes them all at once. Undo puts them back.
import { signal, View } from "nsh";
import { call } from "../../store";
import { Banner, Button, Refusal } from "../../ui/controls";
import type { FileArgs } from "../file/read";
import { remember } from "../shell/undo";

export function StaleReview(props: { args: FileArgs }) {
  const pending = signal(false);
  const refusal = signal<string | null>(null);
  const startOver = async () => {
    pending.set(true);
    refusal.set(null);
    try {
      const { args } = props;
      const written = await call("review.startOver", {
        file: args.name,
        folder: args.folder,
        repo: args.repo,
      });
      remember(written.change, "Started your review over: its comments are removed.", {
        repo: args.repo,
      });
    } catch (error) {
      refusal.set((error as Error).message);
    }
    pending.set(false);
  };
  return (
    <View style={{ gap: 2 }}>
      <Banner
        action={<Button label="Start over" onPress={() => void startOver()} pending={pending()} />}
        title="Your review is on an older version"
        tone="caution"
      >
        The comments you have not sent were written on a version before this one: read them again
        before you send them, or start over.
      </Banner>
      <If when={refusal()}>{(words) => <Refusal words={words()} />}</If>
    </View>
  );
}
