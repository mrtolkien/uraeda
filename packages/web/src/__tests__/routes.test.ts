// The addresses of the task view, a mockup, and a run's view, which the UI layout decision requires for an open
// detail.
import { expect, test } from "vite-plus/test";
import { parseRoute } from "../routes.tsx";

test.each([
  ["/priorities/git-listener", { page: "task", key: "git-listener" }],
  [
    "/f/2026-10-06-recurring-tasks/mockups/repeat.html",
    { page: "mockup", folder: "2026-10-06-recurring-tasks", name: "repeat.html" },
  ],
  ["/f/2026-10-12-cli-tuis/runs/7", { page: "run", folder: "2026-10-12-cli-tuis", id: "7" }],
])("parseRoute(%s)", (path, route) => expect(parseRoute(path)).toEqual(route));
