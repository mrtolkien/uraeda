// The pages shown in place of a repository's, on the sandbox `just app-test` starts: an address
// that names no listed repository is left by its key, not only by its button.
import { open, test } from "nsh/test";

test("Enter on an unknown repository's page opens the one opened last", async () => {
  const app = await open("../shell/__checks__/Places.tsx", {
    height: 800,
    host: { handlers: { places: null, problem: null, shown: null } },
    network: "live",
    width: 1400,
  });
  await app.waitUntil(() => app.shows("id:frame"), { timeout: 30_000 });
  await app.host.send("go", "/r/nosuch/");
  await app.waitFor("text:No repository named “nosuch”", { timeout: 20_000 });
  await app.keyboard.press("Enter");
  await app.waitFor("text:Needs you", { timeout: 20_000 });
}, 90_000);
