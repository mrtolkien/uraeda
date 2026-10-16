// A git write of one button, started by a click or by its field's key: the button's state, running
// its own write, blocked by another one, or free, and the function that starts it, which does
// nothing while any write runs.
import { useState } from "react";
import { type Write, useWrites } from "./store.ts";
import type { WriteState } from "./WriteFeedback.tsx";

export function useOwnWrite(write: Write) {
  const { run, running } = useWrites();
  const [own, setOwn] = useState(false);
  const state: WriteState = running ? (own ? "running" : "blocked") : "idle";
  const start = (action: () => Promise<unknown>) => {
    if (running) {
      return;
    }
    setOwn(true);
    void run(write, action).finally(() => setOwn(false));
  };
  return { start, state };
}
