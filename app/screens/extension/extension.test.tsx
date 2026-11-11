// What the extensions' places guarantee that a look at a picture would not show: a built-in turned
// off in a repository takes its place, its keys, and its pages there, which say so with the way back,
// and the app goes on; and an extension whose keys clash is named, its keys left out, while the
// others keep theirs (the extensions decision: a broken extension never stops another).
import { type App, expect, open, test } from "nsh/test";

const shows = (app: App) => app.texts().join(" ");

const says = (app: App, words: string) =>
  app.waitUntil(() => shows(app).includes(words), { timeout: 20_000 });

/** Sends `message` and waits for the server's answer to the action it calls. */
async function turn(app: App, message: "off" | "on", name: string) {
  const before = app.host.posts().filter((post) => post.name === "done").length;
  await app.host.send(message, name);
  await app.waitUntil(
    () => app.host.posts().filter((post) => post.name === "done").length > before,
    { timeout: 15_000 },
  );
  const answers = app.host.posts().filter((post) => post.name === "done");
  expect(answers[answers.length - 1]?.data).toEqual(message);
}

test("turning a built-in off removes its place, and the app goes on", async () => {
  const app = await open("./__checks__/App.tsx", {
    height: 800,
    host: { handlers: { done: null } },
    network: "live",
    width: 1400,
  });
  // The inbox of `sample`, with Decisions in the rail.
  await says(app, "We need a home icon");
  await says(app, "Decisions");
  try {
    await turn(app, "off", "decisions");
    // Its place leaves the rail, and the inbox stays as it was.
    await app.waitUntil(() => !shows(app).includes("Decisions"), { timeout: 15_000 });
    expect(shows(app)).toContain("We need a home icon");

    // Its address says it is off, with the way to turn it on: never a dead end.
    await app.host.send("go", "/r/sample/decisions");
    await says(app, "The Decisions extension is off in sample");
    // The app goes on: another place opens.
    await app.host.send("go", "/r/sample/git");
    await says(app, "README.md");

    // Turned on from its page, it comes back, place and page.
    await app.host.send("go", "/r/sample/decisions");
    await says(app, "Turn it on here");
    await app.press("label:Turn it on here");
    await app.waitUntil(() => !shows(app).includes("is off in sample"), { timeout: 15_000 });
    await says(app, "Decisions");
  } finally {
    await turn(app, "on", "decisions");
  }
}, 90_000);

test("an extension whose key clashes is named, and the others keep their keys", async () => {
  const app = await open("./__checks__/keys.tsx", { height: 600, width: 900 });
  await says(app, "alpha problem");
  const lines = app.texts();
  // Alpha and Gamma keep their keys; the shell keeps its own.
  expect(lines).toContain("Alpha: space y");
  expect(lines).toContain("Gamma: space w");
  expect(lines).toContain("Everywhere: space r");
  // Beta and Delta are left out whole, each named, with the key that clashed.
  expect(lines.filter((line) => line.startsWith("Beta:") || line.startsWith("Delta:"))).toEqual([]);
  const problem = (name: string) => lines.find((line) => line.startsWith(`${name} problem:`));
  expect(problem("alpha")).toBe("alpha problem: none");
  expect(problem("gamma")).toBe("gamma problem: none");
  expect(problem("beta")).toContain("A key means two things in Beta");
  expect(problem("beta")).toContain("space y");
  expect(problem("delta")).toContain("A key means two things in Delta");
});
