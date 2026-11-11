// Pictures of the app, for the review of a screen: `just app-shots <route>` opens the app on a
// sandbox at a route (`URAEDA_ROUTE`, which the app reads), and `just app-shots <state>` the
// shell in one of its own states: `pairing`, `stopped`, `refused`. Each in both themes, at a
// desktop's and a phone's width, in `target/shots/app/`. They run on the hidden display only.
import { type App, open, test } from "nsh/test";

const SHOTS = "../target/shots/app";
const THEMES = ["dark", "light"] as const;
const WIDTHS = [1400, 390] as const;
const LONG = 180_000;

type Opened = (theme: "dark" | "light", width: number) => Promise<App>;

/** Whether the run draws: `nsh test` alone has no display, and takes no picture. */
async function draws(): Promise<boolean> {
  const app = await open("./shell/__checks__/Shell.tsx", {
    host: { params: { scenario: "starts" } },
  });
  try {
    await app.screenshot();
    return true;
  } catch (error) {
    if (!String(error).includes("real platform")) throw error;
    return false;
  }
}

/**
 * Pictures what `opened` shows once `ready` holds, in each theme at each width, as `name`: on the
 * hidden display only.
 */
async function pictures(name: string, opened: Opened, ready: (app: App) => Promise<void>) {
  if (!(await draws())) return;
  // One picture after the other: two windows at once would share the machine's frames.
  const each = THEMES.flatMap((theme) => WIDTHS.map((width) => [theme, width] as const));
  await each.reduce<Promise<void>>(
    (done, [theme, width]) =>
      done.then(async () => {
        const app = await opened(theme, width);
        await ready(app);
        // The shaders' frames come back a frame or two after they are drawn.
        await app.wait(1500);
        await app.screenshot(`${SHOTS}/${name}-${theme}-${width}.png`);
      }),
    Promise.resolve(),
  );
}

const says = (words: string) => (app: App) =>
  app.waitUntil(() => app.texts().join(" ").includes(words), { timeout: 30_000 });

test(
  "route",
  () =>
    pictures(
      "route",
      (theme, width) =>
        open("../App.tsx", {
          colorScheme: theme,
          height: 800,
          host: { params: { theme } },
          network: "live",
          width,
        }),
      async (app) => {
        await app.waitFor("id:frame", { timeout: 30_000 });
        // The records of the page come a moment after the frame.
        await app.wait(1500);
      },
    ),
  LONG,
);

/** The shell's checks' app, in `scenario`. */
const shell =
  (scenario: string): Opened =>
  (theme, width) =>
    open("./shell/__checks__/Shell.tsx", {
      colorScheme: theme,
      height: 800,
      host: { params: { scenario, theme } },
      network: "live",
      width,
    });

test("state pairing", () => pictures("pairing", shell("pairing"), says("Pair this device")), LONG);

test(
  "state refused",
  () => pictures("refused", shell("server-older"), says("Update the server")),
  LONG,
);

test(
  "state stopped",
  () =>
    pictures("stopped", shell("starts"), async (app) => {
      await app.host.send("started", null);
      await app.waitFor("id:frame", { timeout: 30_000 });
      await app.host.send("stops", null);
      await says("Starting it again")(app);
    }),
  LONG,
);

test(
  "state starting",
  () => pictures("starting", shell("starts"), says("Starting Uraeda's server")),
  LONG,
);
