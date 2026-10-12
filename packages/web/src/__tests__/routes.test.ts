// The addresses of the task view and of a mockup, which the UI layout decision requires for an open
// detail.
import { expect, test } from "vite-plus/test";
import { parseRoute } from "../routes.tsx";

test.each([
  ["/priorities/git-listener", { page: "task", key: "git-listener" }],
  [
    "/f/2026-10-06-recurring-tasks/mockups/repeat.html",
    { page: "mockup", folder: "2026-10-06-recurring-tasks", name: "repeat.html" },
  ],
])("parseRoute(%s)", (path, route) => expect(parseRoute(path)).toEqual(route));
