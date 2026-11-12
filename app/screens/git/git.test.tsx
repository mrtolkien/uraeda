// The Git page against the real server: `just app-test` starts a sandbox, whose `sample`
// repository has two changes left in its main checkout, and `__checks__/Git.tsx` opens the app on
// its Git page. What the test guards is what a person cannot see on the page: that a commit takes
// what is staged, and nothing else.
import { expect, open, test } from "nsh/test";

test("a commit holds exactly the staged files", async () => {
  const app = await open("./__checks__/Git.tsx", {
    height: 800,
    network: "live",
    platform: "linux",
    width: 1400,
  });
  const shows = () => app.texts().join(" ");
  // Both changes are listed, nothing staged.
  await app.waitUntil(() => shows().includes("standup.md") && shows().includes("README.md"), {
    timeout: 30_000,
  });
  // Stage one of the two, by its mark: it reads staged once the server says so.
  await app.press("label:Stage notes/standup.md");
  await app.waitFor("label:Unstage notes/standup.md", { timeout: 15_000 });
  expect(app.shows("label:Stage specs/README.md")).toBe(true);

  // Commit, with a message typed, by Ctrl+Enter in the field.
  await app.type("id:git-message", "docs: the standup's notes");
  // Once the field holds it: Ctrl+Enter right after the last key may come before the field's
  // change does, and commit what it held before.
  await app.waitUntil(() =>
    Object.values(app.storage()).some((kept) => kept.includes("docs: the standup's notes")),
  );
  await app.keyboard.press("ctrl+Enter");
  // The commit lands: the staged file leaves Changes, the other stays, unstaged.
  await app.waitUntil(() => !shows().includes("standup.md"), { timeout: 15_000 });
  expect(app.shows("label:Stage specs/README.md")).toBe(true);

  // The commit is the history's newest: it holds the staged file alone.
  await app.press("label:History");
  await app.waitUntil(() => shows().includes("docs: the standup's notes"), { timeout: 15_000 });
  // "Committed" stands over the side stack's first rows for a moment: a press waits for it to go,
  // as a hand does. Native Shell 0.5.0's driver refuses a press on a view another covers.
  await app.waitUntil(() => !shows().includes("Committing 1 file"), { timeout: 15_000 });
  await app.press("text:docs: the standup's notes");
  await app.waitFor("id:git-commit-files >> text:notes/standup.md", { timeout: 15_000 });
  expect(app.count("id:git-commit-files >> text:/\\.md$/")).toBe(1);
});

test("c writes the message of the group the cursor is in, as the cursor crosses groups", async () => {
  const app = await open("./__checks__/CommitBoxes.tsx", {
    height: 800,
    platform: "linux",
    width: 1400,
  });
  await app.waitFor("label:The commit message of main");
  // The box of the next group comes as the first goes: both are drawn for a moment.
  await app.press("label:Next group");
  await app.waitFor("label:The commit message of dark-mode");
  await app.keyboard.press("c");
  await app.keyboard.press("x");
  await app.waitUntil(() =>
    Object.entries(app.storage()).some(
      ([key, kept]) => key.includes("dark-mode") && kept.includes("x"),
    ),
  );
});

test("a file's changes are discarded by the pointer too, asked first", async () => {
  const app = await open("./__checks__/Git.tsx", {
    height: 800,
    network: "live",
    platform: "linux",
    width: 1400,
  });
  const shows = () => app.texts().join(" ");
  await app.waitUntil(() => shows().includes("README.md"), { timeout: 30_000 });
  // The row opens its diff, whose Discard asks first, naming the file; Keep leaves it.
  await app.press("id:git-changes >> text:README.md");
  await app.press("id:git-discard");
  await app.waitUntil(() => shows().includes("Discard the changes to specs/README.md?"), {
    timeout: 10_000,
  });
  await app.press("text:Keep them");
  await app.waitUntil(() => !shows().includes("Discard the changes to"), { timeout: 10_000 });
  expect(app.shows("label:Stage specs/README.md")).toBe(true);
});
