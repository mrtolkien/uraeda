// Broken on purpose: it loads, then throws from a timer.
import type { ServerApi } from "uraeda/server";

export default function activate(api: ServerApi) {
  api.record("alive", () => true);
  api.action("break", () => {
    setTimeout(() => {
      throw new Error("it broke later");
    }, 10);
    return null;
  });
}
