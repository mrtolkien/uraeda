// The question before a page is left while a field it shows holds unsaved text: by a link,
// `navigate`, or Back, through the history's `setLeaveGuard`. The text is not lost either way: it
// stays on the device, and comes back with its field. Mounted once, around the app.
import { cleanup, signal, untracked, View } from "nsh";
import { setLeaveGuard } from "../../store/history";
import { Button, Text } from "../controls";
import { Dialog } from "../surfaces";
import { hasDrawnUnsaved } from "./unsaved";

export function LeaveGuard() {
  // The question waiting, held in an object: a signal keeps a function as its value, so the
  // resolver itself is held, and called with the answer.
  const asking = signal<{ answer: (leave: boolean) => void } | null>(null);
  setLeaveGuard(() =>
    untracked(hasDrawnUnsaved)
      ? new Promise<boolean>((resolve) => asking.set({ answer: resolve }))
      : undefined,
  );
  cleanup(() => setLeaveGuard(undefined));
  const answer = (leave: boolean) => {
    untracked(asking)?.answer(leave);
    asking.set(null);
  };
  return (
    <Dialog onClose={() => answer(false)} open={asking() !== null} title="Leave page?">
      <Text>Your unsaved text stays on this device, and comes back when you return.</Text>
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
        <Button label="Stay" onPress={() => answer(false)} />
        <Button label="Leave page" onPress={() => answer(true)} />
      </View>
    </Dialog>
  );
}
