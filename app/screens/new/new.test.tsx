// What the New page guarantees that a look would not show: after a chat started from it, Back
// returns to a page that starts the next one. Its visit kept "a start is on its way" past the
// start, and Send then did nothing.
import { type App, expect, open, test } from "nsh/test";

const pages = (app: App) =>
  app.host
    .posts()
    .filter((post) => post.name === "shown")
    .map((post) => (post.data as { page: string }).page);

/** Types `text` in the New page's composer and sends it, once the device holds it. */
async function send(app: App, text: string) {
  await app.type("id:new-composer", text);
  await app.waitUntil(() => Object.values(app.storage()).some((kept) => kept.includes(text)));
  await app.keyboard.press("enter");
}

test("a chat started from the New page leaves it ready for the next", async () => {
  const app = await open("../shell/__checks__/Places.tsx", {
    height: 800,
    host: { handlers: { places: null, problem: null, shown: null } },
    network: "live",
    width: 1400,
  });
  await app.waitFor("id:frame", { timeout: 30_000 });
  await app.host.send("go", "/r/sample/new?kind=session");
  await app.waitFor("id:new-composer", { timeout: 20_000 });
  await send(app, "The first chat");
  // It opens its session.
  await app.waitUntil(() => pages(app).at(-1) === "session-id", { timeout: 20_000 });
  const started = pages(app).filter((page) => page === "session-id").length;

  // Back to the New page: the next chat starts as the first did.
  await app.host.send("back", null);
  await app.waitFor("id:new-composer", { timeout: 20_000 });
  await send(app, "The second chat");
  await app
    .waitUntil(() => pages(app).filter((page) => page === "session-id").length > started, {
      timeout: 15_000,
    })
    .catch(() => undefined);
  expect(pages(app).filter((page) => page === "session-id").length).toBe(started + 1);
}, 90_000);
