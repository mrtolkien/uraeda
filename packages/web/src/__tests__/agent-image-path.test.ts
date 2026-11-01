// The path an agent's image or link names in its repository, as the transcript draws it.
import { expect, test } from "vite-plus/test";
import { repositoryPath } from "../AgentStories.tsx";
import { imagePath } from "../Spans.tsx";

/** Markdown encodes a space as `%20`: the image route encodes the decoded path once, as a page's. */
test("an agent's image with a percent-encoded name draws from its file", () => {
  expect(imagePath(repositoryPath("specs/x/mockups/my%20shot.png"))).toBe(
    "/images/specs/x/mockups/my%20shot.png",
  );
});
