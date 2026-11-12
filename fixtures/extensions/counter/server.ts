// The server part of the fixture extension `counter`, for the browser's tests of extension pages
// (`crates/server/tests/browser/extensions.rs`), where the page runs over the real server: its
// record `count` reads 3, its action `add` answers the count after the one the page saw, a third
// of a second later, and `done` keeps what the page got, which the route `/x/counter/done` says.
// The app's own tests (`crates/app/tests/extensions.rs`) build the page alone.
import type { ServerApi } from "uraeda/server";

export default function activate(api: ServerApi) {
  let done: unknown = null;
  api.record("count", () => ({ count: 3 }));
  api.action(
    "add",
    (input: { seen: number }) =>
      new Promise((resolve) => {
        setTimeout(() => resolve({ count: input.seen + 1 }), 300);
      }),
  );
  api.action("done", (input: unknown) => {
    done = input;
    return null;
  });
  api.route("/x/counter/done", () => Response.json(done), "GET");
}
