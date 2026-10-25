// A mockup's page link, built from its path, holds every segment encoded, as its frame's address.
import { expect, test } from "vite-plus/test";
import { pageOf } from "../MockupEmbed.tsx";

const here = (path: string) => `/r/uraeda${path}`;
const FOLDER = "2026-10-06-recurring-tasks";
const embed = (path: string) => ({ block: 0, label: "Mockup", path, width: 1440 });

test("a mockup's page encodes its path's segments, in its folder or not", () => {
  expect(pageOf(here, FOLDER, embed(`specs/${FOLDER}/mockups/a #1/b?.html`))).toBe(
    `/r/uraeda/f/${FOLDER}/mockups/a%20%231/b%3F.html`,
  );
  expect(pageOf(here, FOLDER, embed("docs/a #1/b?.html"))).toBe(
    "/r/uraeda/mockups/docs/a%20%231/b%3F.html",
  );
});
