// The sandbox of every preview frame the web UI draws: scripts, and never `allow-same-origin`, which
// would run a preview with Uraeda's origin. The Stack decision names these tests for the rule.
import { render, screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { MockupEmbed } from "../MockupEmbed.tsx";
import { RepositoryContext } from "../routes.tsx";
import { StoryFrames } from "../StoryFrames.tsx";
import { fixtureRepo, renderPage } from "./helpers.tsx";

const FOLDER = "2026-10-06-recurring-tasks";
const pick = { onPicked() {}, onPickStopped() {}, onReady() {}, picking: false };

const frames: Array<[string, string, () => Promise<unknown> | unknown]> = [
  [
    "the mockup embed",
    "Repeat, 1440 px",
    () =>
      render(
        <RepositoryContext.Provider value="uraeda">
          <MockupEmbed
            folder={FOLDER}
            mockup={{ block: 0, label: "Repeat", path: "mockups/repeat.html", width: 1440 }}
          />
        </RepositoryContext.Provider>,
      ),
  ],
  [
    "a story's frame",
    "Repeat, desktop",
    () =>
      render(
        <RepositoryContext.Provider value="uraeda">
          <StoryFrames label="Repeat" pick={pick} src="/story" width="desktop" />
        </RepositoryContext.Provider>,
      ),
  ],
  [
    "the mockup page",
    "repeat.html",
    () => renderPage(`/f/${FOLDER}/mockups/repeat.html`, fixtureRepo()),
  ],
];

test.each(frames)("%s runs scripts, never with Uraeda's origin", async (_, title, draw) => {
  await draw();
  const tokens = (await screen.findByTitle(title)).getAttribute("sandbox")?.split(" ") ?? [];
  expect(tokens).toContain("allow-scripts");
  expect(tokens).not.toContain("allow-same-origin");
});
